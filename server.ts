import express from 'express';
import path from 'path';
import cors from 'cors';
import 'dotenv/config';
import { GoogleGenAI, Type } from '@google/genai';
import fs from 'fs';
import { MongoClient, Db } from 'mongodb';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: { 'User-Agent': 'aistudio-build' }
  }
});

// Configure MongoDB client
const isVercel = !!(process.env.VERCEL || process.env.NOW_BUILDER);
const MONGODB_CONFIG_FILE = isVercel
  ? path.join('/tmp', 'mongodb-config.json')
  : path.resolve(process.cwd(), 'mongodb-config.json');
const SERVER_DATA_FILE = isVercel
  ? path.join('/tmp', 'server-data-store.json')
  : path.resolve(process.cwd(), 'server-data-store.json');

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;
let activeMongoUri = '';
let lastMongoError: string | null = null;

async function initMongo(uri: string): Promise<boolean> {
  if (!uri) return false;
  try {
    if (mongoClient && activeMongoUri === uri) {
      lastMongoError = null;
      return true;
    }
    if (mongoClient) {
      try { await mongoClient.close(); } catch {}
    }
    console.log('Connecting to MongoDB...');
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await client.connect();
    mongoClient = client;
    
    // Parse database name from connection string or default
    const urlParts = uri.split('/');
    const lastPart = urlParts[urlParts.length - 1];
    const dbName = lastPart.split('?')[0] || 'gao_rfid';
    
    mongoDb = client.db(dbName);
    activeMongoUri = uri;
    lastMongoError = null;
    console.log(`Connected successfully to MongoDB database: ${dbName}`);
    return true;
  } catch (err: any) {
    lastMongoError = err.message || 'Failed to connect to MongoDB cluster';
    console.error('MongoDB connection error:', err);
    return false;
  }
}

// Default Seed Datasets for Server JSON Store Fallback
const SEED_DATA: Record<string, any[]> = {
  floorplans: [
    {
      id: "demo_plan_1",
      name: "Aperture HQ 1st Floor",
      building: "Aperture Building A",
      imageUrl: "/assets/images/facility_floorplan_2d_1780726630123.png",
      devices: [
        { id: "dev_1", name: "Server Room RFID", mac: "00:1A:2B:3C:4D:5E", x: 85, y: 20 },
        { id: "dev_2", name: "Meeting Room RFID", mac: "00:1A:2B:3C:4D:5F", x: 55, y: 20 },
        { id: "dev_3", name: "Cafeteria RFID", mac: "00:1A:2B:3C:4D:6A", x: 20, y: 30 },
        { id: "dev_4", name: "Office RFID", mac: "00:1A:2B:3C:4D:6B", x: 65, y: 55 }
      ]
    }
  ],
  devices: [
    { id: "dev_1", name: "Server Room RFID", mac: "00:1A:2B:3C:4D:5E", status: "Online", location: "Server Room", ip: "192.168.1.101" },
    { id: "dev_2", name: "Meeting Room RFID", mac: "00:1A:2B:3C:4D:5F", status: "Online", location: "Meeting Room", ip: "192.168.1.102" },
    { id: "dev_3", name: "Cafeteria RFID", mac: "00:1A:2B:3C:4D:6A", status: "Online", location: "Cafeteria", ip: "192.168.1.103" },
    { id: "dev_4", name: "Office RFID", mac: "00:1A:2B:3C:4D:6B", status: "Online", location: "Office", ip: "192.168.1.104" }
  ],
  registered_people: [
    { id: "1", name: "Alice Smith", role: "Employee", department: "Engineering", tag: "1", email: "alice@aperturestaff.com" },
    { id: "2", name: "Bob Johnson", role: "Visitor", department: "Product Guest", tag: "2", email: "bob@fictional.com" },
    { id: "3", name: "Charlie Davis", role: "Security", department: "Operations", tag: "3", email: "charlie@aperturestaff.com" },
    { id: "4", name: "Diana Prince", role: "Employee", department: "Executive", tag: "4", email: "diana@aperturestaff.com" }
  ],
  visitors: [
    {
      id: "VIS-BOB",
      name: "Bob Johnson",
      company: "Fictional Corp",
      host: "Diana Prince",
      status: "Active",
      time: "Arrived 10:15 AM",
      tag: "2",
      email: "bob@fictional.com",
      location: "Office",
      duration: "1h 45m",
      path: ["Entrance", "Office"],
      arrivalTime: Date.now() - 3600 * 1000 * 2
    }
  ],
  settings: [
    {
      id: "global",
      loiteringThreshold: 120,
      idleAlertThreshold: 300,
      occupancyThresholds: {
        "Server Room": 2,
        "Meeting Room": 4,
        "Cafeteria": 8,
        "Office": 10
      }
    },
    {
      id: "role_permissions",
      admin: { dashboard: true, live: true, playback: true, people: true, visitors: true, attendance: true, alerts: true, incidents: true, digitalTwin: true, analytics: true, aiInsights: true, devices: true, maintenance: true, audit: true, settings: true },
      manager: { dashboard: true, live: true, playback: true, people: true, visitors: true, attendance: true, alerts: true, incidents: true, digitalTwin: true, analytics: true, aiInsights: true, devices: true, maintenance: true, audit: true, settings: false },
      operator: { dashboard: false, live: true, playback: false, people: true, visitors: true, attendance: true, alerts: true, incidents: true, digitalTwin: true, analytics: false, aiInsights: false, devices: false, maintenance: true, audit: false, settings: false },
      blocked: { dashboard: false, live: false, playback: false, people: false, visitors: false, attendance: false, alerts: false, incidents: false, digitalTwin: false, analytics: false, aiInsights: false, devices: false, maintenance: false, audit: false, settings: false }
    },
    {
      id: "user_role_sigmund_ts_boot",
      uid: "sigmund_ts_boot",
      email: "sigmund.t.d@gaostaff.com",
      displayName: "sigmund.t.d",
      role: "admin",
      updatedAt: new Date().toISOString()
    }
  ],
  incidents: [
    {
      id: "inc_1",
      type: "Unauthorized Entry",
      zone: "Server Room",
      timestamp: new Date().toISOString(),
      status: "Investigating",
      person: "Bob Johnson",
      severity: "High",
      description: "Visitor entered Server Room without escort."
    }
  ],
  alerts: [
    { id: "alert_1", type: "warning", message: "OVERCAPACITY: Server Room exceeded max occupancy of 2. Currently 3.", timestamp: new Date(Date.now() - 100000).toISOString(), resolved: false },
    { id: "alert_2", type: "security", message: "UNAUTHORIZED ACCESS: Bob Johnson entered Server Room", timestamp: new Date(Date.now() - 300000).toISOString(), resolved: false }
  ],
  ai_recommendations: [
    {
       id: "rec_1",
       title: "Optimizing HVAC Scheduling",
       category: "energy",
       content: "HVAC usage in Office Zone B remains active outside official hours.",
       roi: "$540/mo",
       appliedAt: new Date().toISOString()
    }
  ],
  tag_history: [
    { id: "hist_1", TagID: "1", name: "Alice Smith", role: "Employee", fromZone: "Entrance", toZone: "Office", timestamp: new Date(Date.now() - 3600000).toISOString() },
    { id: "hist_2", TagID: "2", name: "Bob Johnson", role: "Visitor", fromZone: "Entrance", toZone: "Office", timestamp: new Date(Date.now() - 1800000).toISOString() }
  ]
};

function readServerDataStore(): Record<string, any[]> {
  try {
    if (fs.existsSync(SERVER_DATA_FILE)) {
      const content = fs.readFileSync(SERVER_DATA_FILE, 'utf8');
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object') {
        return { ...SEED_DATA, ...parsed };
      }
    }
  } catch (err) {
    console.error('Failed to read server data store:', err);
  }
  try {
    fs.writeFileSync(SERVER_DATA_FILE, JSON.stringify(SEED_DATA, null, 2), 'utf8');
  } catch (err) {}
  return { ...SEED_DATA };
}

function writeServerDataStore(store: Record<string, any[]>): void {
  try {
    fs.writeFileSync(SERVER_DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save server data store:', err);
  }
}

// Helpers for database access with auto-fallback
async function getCollectionDocs(colName: string): Promise<any[]> {
  if (mongoDb) {
    try {
      const docs = await mongoDb.collection(colName).find({}).toArray();
      if (docs.length > 0) return docs;
    } catch (e) {
      console.warn(`MongoDB read failed for ${colName}, falling back to server store`, e);
    }
  }
  const store = readServerDataStore();
  return store[colName] || [];
}

async function getDocById(colName: string, id: string): Promise<any | null> {
  if (mongoDb) {
    try {
      const doc = await mongoDb.collection(colName).findOne({ id: id });
      if (doc) return doc;
    } catch (e) {
      console.warn(`MongoDB findOne failed for ${colName}/${id}, falling back to server store`, e);
    }
  }
  const store = readServerDataStore();
  const list = store[colName] || [];
  return list.find((item: any) => item.id === id || item._id === id) || null;
}

async function upsertDoc(colName: string, id: string, data: any): Promise<any> {
  const docData = { ...data, id, updatedAt: new Date().toISOString() };
  if (mongoDb) {
    try {
      await mongoDb.collection(colName).updateOne(
        { id: id },
        { $set: docData },
        { upsert: true }
      );
    } catch (e) {
      console.warn(`MongoDB updateOne failed for ${colName}/${id}:`, e);
    }
  }
  const store = readServerDataStore();
  const list = store[colName] || [];
  const idx = list.findIndex((item: any) => item.id === id);
  if (idx > -1) {
    list[idx] = { ...list[idx], ...docData };
  } else {
    list.push(docData);
  }
  store[colName] = list;
  writeServerDataStore(store);
  return docData;
}

async function insertDoc(colName: string, data: any): Promise<any> {
  const id = data.id || ('doc_' + Math.random().toString(36).substring(2, 11));
  const docData = { ...data, id, createdAt: new Date().toISOString() };
  if (mongoDb) {
    try {
      await mongoDb.collection(colName).insertOne(docData);
    } catch (e) {
      console.warn(`MongoDB insertOne failed for ${colName}:`, e);
    }
  }
  const store = readServerDataStore();
  const list = store[colName] || [];
  list.push(docData);
  store[colName] = list;
  writeServerDataStore(store);
  return docData;
}

async function deleteDocById(colName: string, id: string): Promise<boolean> {
  let deleted = false;
  if (mongoDb) {
    try {
      const res = await mongoDb.collection(colName).deleteOne({ id: id });
      if (res.deletedCount > 0) deleted = true;
    } catch (e) {
      console.warn(`MongoDB deleteOne failed for ${colName}/${id}:`, e);
    }
  }
  const store = readServerDataStore();
  const list = store[colName] || [];
  const initialLen = list.length;
  const filtered = list.filter((item: any) => item.id !== id && item._id !== id);
  if (filtered.length < initialLen) deleted = true;
  store[colName] = filtered;
  writeServerDataStore(store);
  return deleted;
}

// Read saved MongoDB URI if any
let initialMongoUri = process.env.MONGODB_URI || '';
try {
  if (fs.existsSync(MONGODB_CONFIG_FILE)) {
    const saved = JSON.parse(fs.readFileSync(MONGODB_CONFIG_FILE, 'utf8'));
    if (saved.mongodbUri) {
      initialMongoUri = saved.mongodbUri;
    }
  }
} catch (err) {
  console.error('Failed to read saved MongoDB configuration:', err);
}

if (initialMongoUri) {
  initMongo(initialMongoUri).catch(err => console.error('Initial MongoDB activation failed:', err));
}

const app = express();
const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Auto-connect MongoDB on incoming requests if URI is present and DB is not connected
  app.use(async (req, res, next) => {
    if (!mongoDb) {
      const uriToUse = process.env.MONGODB_URI || initialMongoUri;
      if (uriToUse) {
        try {
          await initMongo(uriToUse);
        } catch (err) {
          // Continue request even if mongo fails, fallback store will handle
        }
      }
    }
    next();
  });

  // Data Store Status & Stats API
  app.get(['/api/mongodb/status', '/api/data/status'], async (req, res) => {
    const store = readServerDataStore();
    const collections = Object.keys(store);
    let totalItems = 0;
    collections.forEach(col => { totalItems += (store[col] || []).length; });

    let maskedUri = '';
    if (activeMongoUri) {
      maskedUri = activeMongoUri.replace(/:([^@]+)@/, ':****@');
    }

    res.json({
      connected: !!mongoDb,
      engine: mongoDb ? 'MongoDB Cluster' : 'Cloud Firestore / Local Store',
      connectionString: maskedUri || 'None Configured',
      lastError: lastMongoError,
      collectionsCount: collections.length,
      totalRecords: totalItems,
      collectionsList: collections
    });
  });

  app.get('/api/data/stats', async (req, res) => {
    const store = readServerDataStore();
    const summary: Record<string, { count: number; sample?: any }> = {};
    for (const key of Object.keys(store)) {
      const docs = await getCollectionDocs(key);
      summary[key] = {
        count: docs.length,
        sample: docs[0] || null
      };
    }
    res.json({
      success: true,
      engine: mongoDb ? 'MongoDB' : 'Server File Storage',
      data: summary,
      timestamp: new Date().toISOString()
    });
  });

  app.post('/api/mongodb/config', async (req, res) => {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { mongodbUri } = body;
      if (!mongodbUri) {
        return res.status(400).json({ success: false, error: 'Connection string is empty' });
      }
      const success = await initMongo(mongodbUri);
      if (success) {
        try {
          fs.writeFileSync(MONGODB_CONFIG_FILE, JSON.stringify({ mongodbUri }, null, 2), 'utf8');
        } catch (fsErr) {
          console.error('Failed to write mongodb-config.json:', fsErr);
        }
        res.json({ success: true, message: 'Connected to MongoDB successfully!' });
      } else {
        res.status(400).json({ success: false, error: lastMongoError || 'Connection failed. Please check connection string, credentials, and ensure 0.0.0.0/0 is allowed in MongoDB Atlas Network Access.' });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message || 'Server error configuring MongoDB' });
    }
  });

  app.post('/api/mongodb/test-connection', async (req, res) => {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { mongodbUri } = body;
      if (!mongodbUri) {
        return res.json({ success: false, error: 'Connection string is empty' });
      }
      const tempClient = new MongoClient(mongodbUri, { serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000 });
      await tempClient.connect();
      await tempClient.db().admin().ping();
      await tempClient.close();
      res.json({ success: true });
    } catch (err: any) {
      res.json({ success: false, error: err.message || 'Failed to connect to MongoDB cluster. Verify credentials and Atlas IP whitelist (0.0.0.0/0).' });
    }
  });

  // --- UNIFIED REST DATA STORE ENDPOINTS (/api/mongodb and /api/data) ---
  
  // Get all items in a collection
  app.get(['/api/mongodb/:collection', '/api/data/:collection'], async (req, res) => {
    try {
      const colName = req.params.collection;
      const docs = await getCollectionDocs(colName);
      res.json({ data: docs });
    } catch (err: any) {
      console.error(`Data API GET /${req.params.collection} error:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  // Get a single item by id
  app.get(['/api/mongodb/:collection/:id', '/api/data/:collection/:id'], async (req, res) => {
    try {
      const { collection: colName, id } = req.params;
      const doc = await getDocById(colName, id);
      res.json({ doc });
    } catch (err: any) {
      console.error(`Data API GET /${req.params.collection}/${req.params.id} error:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  // Add an item (generates ID if missing)
  app.post(['/api/mongodb/:collection', '/api/data/:collection'], async (req, res) => {
    try {
      const colName = req.params.collection;
      const data = req.body;
      const created = await insertDoc(colName, data);
      res.json({ success: true, doc: created });
    } catch (err: any) {
      console.error(`Data API POST /${req.params.collection} error:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  // Upsert or set doc by exact ID
  app.post(['/api/mongodb/:collection/:id', '/api/data/:collection/:id'], async (req, res) => {
    try {
      const { collection: colName, id } = req.params;
      const data = req.body;
      const updated = await upsertDoc(colName, id, data);
      res.json({ success: true, doc: updated });
    } catch (err: any) {
      console.error(`Data API POST /${req.params.collection}/${req.params.id} error:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  app.put(['/api/mongodb/:collection/:id', '/api/data/:collection/:id'], async (req, res) => {
    try {
      const { collection: colName, id } = req.params;
      const data = req.body;
      const updated = await upsertDoc(colName, id, data);
      res.json({ success: true, doc: updated });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete an item by ID
  app.delete(['/api/mongodb/:collection/:id', '/api/data/:collection/:id'], async (req, res) => {
    try {
      const { collection: colName, id } = req.params;
      const success = await deleteDocById(colName, id);
      res.json({ success });
    } catch (err: any) {
      console.error(`Data API DELETE /${req.params.collection}/${req.params.id} error:`, err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- RFID SCAN & REALTIME TELEMETRY API ENDPOINTS ---
  app.post('/api/rfid/scan', async (req, res) => {
    try {
      const { tagId, name, role, zone, readerMac, readerLocation, status } = req.body;
      if (!tagId) {
        return res.status(400).json({ error: 'tagId is required' });
      }

      const scanRecord = {
        id: 'scan_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        TagID: tagId,
        tagId,
        name: name || `Tag ${tagId}`,
        role: role || 'Personnel',
        zone: zone || 'Entrance',
        readerMac: readerMac || '00:1A:2B:3C:4D:5E',
        readerLocation: readerLocation || zone || 'Entrance Gate',
        timestamp: new Date().toISOString()
      };

      // Save to tag_history collection
      await insertDoc('tag_history', scanRecord);

      // Update or insert into realtime_tags collection
      await upsertDoc('realtime_tags', `tag_${tagId}`, {
        tagId,
        TagID: tagId,
        name: scanRecord.name,
        role: scanRecord.role,
        currentZone: scanRecord.zone,
        status: status || 'Active',
        lastScanTime: scanRecord.timestamp
      });

      res.json({ success: true, scan: scanRecord });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/rfid/realtime', async (req, res) => {
    try {
      const realtimeTags = await getCollectionDocs('realtime_tags');
      res.json({ success: true, count: realtimeTags.length, tags: realtimeTags });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/rfid/history', async (req, res) => {
    try {
      const history = await getCollectionDocs('tag_history');
      res.json({ success: true, count: history.length, records: history });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // AI Activity Analysis endpoint
  app.post('/api/analyze-activity', async (req, res) => {
    try {
      const { tags } = req.body;
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: `Analyze these RFID tracking tags to infer staff activity and dwell time. Tags: ${JSON.stringify(tags)}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              analysis: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    TagID: { type: Type.STRING },
                    activity: { type: Type.STRING },
                    confidence: { type: Type.NUMBER }
                  }
                }
              }
            }
          }
        }
      });
      res.json(JSON.parse(response.text!));
    } catch (e: any) {
      console.error('AI Analysis Error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Comprehensive AI RFID Analysis and Quality Improvement Endpoint
  app.post('/api/analyze-rfid-results', async (req, res) => {
    try {
      const { liveTags, historyRecords } = req.body;
      
      const promptText = `
        You are an expert UHF RFID Systems Analytics AI. Analyze the following real-time and historical personnel scans from our GAO RFID Readers to deliver operational observations, security risk intelligence, and facility flow recommendations ("improved output").

        --- LIVE SCANS ---
        ${JSON.stringify(liveTags || [])}

        --- HISTORY ARCHIVE LOGS ---
        ${JSON.stringify(historyRecords || [])}

        --- ANALYTICAL CRITERIA ---
        1. Look for unexpected dwell times, loitering, or out-of-bounds occurrences (e.g. unescorted visitors entering the Server Room or Engineering Lab).
        2. Identify bottlenecks or flow issues (e.g. dense scans at Entrance but empty office desks).
        3. Formulate actionable layout or hardware optimization recommendations (e.g., repositioning reader devices, adding verification gates, or adjusting shift schedule bounds).
        4. Detail personnel efficiency based on zone transitions.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: promptText,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              executiveSummary: { type: Type.STRING },
              anomalies: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    tagId: { type: Type.STRING },
                    name: { type: Type.STRING },
                    zone: { type: Type.STRING },
                    severity: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"] },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING }
                  },
                  required: ["tagId", "severity", "title", "description"]
                }
              },
              optimizations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    category: { type: Type.STRING },
                    title: { type: Type.STRING },
                    impact: { type: Type.STRING, enum: ["HIGH", "MEDIUM", "LOW"] },
                    description: { type: Type.STRING },
                    actionableSteps: { type: Type.STRING }
                  },
                  required: ["category", "title", "impact", "description"]
                }
              },
              personnelEfficiency: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    tagId: { type: Type.STRING },
                    name: { type: Type.STRING },
                    inferredActivity: { type: Type.STRING },
                    efficiencyScore: { type: Type.INTEGER }, // scale 1-100
                    dwellTimeInfo: { type: Type.STRING }
                  },
                  required: ["tagId", "inferredActivity", "efficiencyScore"]
                }
              }
            }
          }
        }
      });

      const parsedData = JSON.parse(response.text || '{}');
      res.json(parsedData);
    } catch (e: any) {
      console.error('RFID Intelligent Analysis failed:', e);
      res.status(500).json({ error: e.message || 'Intelligent processing failed' });
    }
  });

  // --- MONGODB AUTH ENDPOINTS ---
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }
      if (!mongoDb) {
        return res.status(503).json({ error: 'MongoDB is not connected.' });
      }
      
      const cleanEmail = email.toLowerCase();
      // Check if user already exists
      const existing = await mongoDb.collection('settings').findOne({ 
        $or: [
          { email: cleanEmail },
          { id: `user_role_${cleanEmail}` }
        ]
      });
      if (existing) {
        return res.status(400).json({ error: 'An account with this email already exists' });
      }
      
      const uid = 'u_' + Math.random().toString(36).substring(2, 11);
      // Determine role
      let role = 'operator';
      if (cleanEmail === 'sigmund.t.d@gaostaff.com') {
        role = 'admin';
      }
      
      const userData = {
        id: `user_role_${uid}`,
        uid,
        email: cleanEmail,
        password, // simply stored inside MongoDB
        displayName: email.split('@')[0],
        role,
        updatedAt: new Date().toISOString()
      };
      
      await mongoDb.collection('settings').insertOne(userData);
      res.json({ success: true, user: { uid, email: cleanEmail, displayName: userData.displayName, role } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }
      if (!mongoDb) {
        return res.status(503).json({ error: 'MongoDB database is not connected.' });
      }
      const cleanEmail = email.toLowerCase();
      let userDoc: any = await mongoDb.collection('settings').findOne({ email: cleanEmail });
      
      // Bootstrap default superadmin if trying to login and it doesn't exist yet
      if (!userDoc && cleanEmail === 'sigmund.t.d@gaostaff.com') {
        const uid = 'sigmund_ts_boot';
        userDoc = {
          id: `user_role_${uid}`,
          uid,
          email: cleanEmail,
          password: password || 'Jesuraja123@',
          displayName: 'sigmund.t.d',
          role: 'admin',
          updatedAt: new Date().toISOString()
        };
        await mongoDb.collection('settings').insertOne(userDoc);
      }
      
      if (!userDoc) {
        return res.status(401).json({ error: 'Authentication failed. Email not found.' });
      }
      
      if (userDoc.password !== password) {
        return res.status(401).json({ error: 'Authentication failed. Password does not match.' });
      }
      
      res.json({ 
        success: true, 
        user: { 
          uid: userDoc.uid || userDoc.id, 
          email: userDoc.email, 
          displayName: userDoc.displayName, 
          role: userDoc.role 
        } 
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    res.json({ success: true });
  });

  // ADMIN: Register standard users and bootstrap 'sigmund.t.d@gaostaff.com' as Admin
  app.post('/api/admin/register', async (req, res) => {
    try {
      const { uid, email, displayName } = req.body;
      if (!uid || !email) {
        return res.status(400).json({ error: 'Missing uid or email' });
      }
      if (!mongoDb) {
        return res.status(503).json({ error: 'MongoDB database is not connected.' });
      }

      const userRoleDocPath = `user_role_${uid}`;
      let role = 'operator';
      if (email.toLowerCase() === 'sigmund.t.d@gaostaff.com') {
        role = 'admin';
      }

      const existingDoc = await mongoDb.collection('settings').findOne({ id: userRoleDocPath });
      if (existingDoc && existingDoc.role) {
        role = existingDoc.role;
      }

      const updatedData = {
        id: userRoleDocPath,
        uid,
        email,
        displayName: displayName || email.split('@')[0],
        role,
        updatedAt: new Date().toISOString()
      };

      await mongoDb.collection('settings').updateOne(
        { id: userRoleDocPath },
        { $set: updatedData },
        { upsert: true }
      );

      res.json({ success: true, role, userData: updatedData });
    } catch (e: any) {
      console.error('Admin auto-register API Error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // ADMIN: Create a user account manually with custom designated role claims
  app.post('/api/admin/create-user', async (req, res) => {
    try {
      const { email, password, displayName, role } = req.body;
      if (!email || !password || !role) {
        return res.status(400).json({ error: 'Missing email, password, or role' });
      }

      const validRoles = ['admin', 'manager', 'operator', 'blocked'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid custom claims role' });
      }

      if (!mongoDb) {
        return res.status(503).json({ error: 'MongoDB database is not connected.' });
      }

      const uid = 'u_' + Math.random().toString(36).substring(2, 11);
      const userRoleDocPath = `user_role_${uid}`;
      const userData = {
        id: userRoleDocPath,
        uid,
        email,
        password,
        displayName: displayName || email.split('@')[0],
        role,
        updatedAt: new Date().toISOString()
      };

      await mongoDb.collection('settings').updateOne(
        { id: userRoleDocPath },
        { $set: userData },
        { upsert: true }
      );

      res.json({ success: true, user: userData });
    } catch (e: any) {
      console.error('Manual user creation API error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // ADMIN: List all registered roles
  app.get('/api/admin/users', async (req, res) => {
    try {
      let users: any[] = [];
      if (mongoDb) {
        const settingsColl = mongoDb.collection('settings');
        const list = await settingsColl.find({ id: { $regex: '^user_role_' } }).toArray();
        users = list;
      }

      // Safeguard: always have a bootstrapped operator at least, or return what's available
      if (users.length === 0) {
        users = [
          {
            id: 'user_role_sigmund_ts_boot',
            uid: 'sigmund_ts_boot',
            email: 'sigmund.t.d@gaostaff.com',
            displayName: 'sigmund.t.d',
            role: 'admin',
            updatedAt: new Date().toISOString()
          }
        ];
      }

      res.json({ users });
    } catch (e: any) {
      console.error('Admin list users API Error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // ADMIN: Modify user custom claims
  app.post('/api/admin/set-user-role', async (req, res) => {
    try {
      const { uid, role } = req.body;
      if (!uid || !role) {
        return res.status(400).json({ error: 'Missing uid or role' });
      }

      const validRoles = ['admin', 'manager', 'operator', 'blocked'];
      if (!validRoles.includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
      }

      if (!mongoDb) {
        return res.status(503).json({ error: 'MongoDB database is not connected.' });
      }

      const userRoleDocPath = `user_role_${uid}`;
      await mongoDb.collection('settings').updateOne(
        { id: userRoleDocPath },
        { $set: { role, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );

      res.json({ success: true, uid, role });
    } catch (e: any) {
      console.error('Admin set user role API Error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // ADMIN: Delete a registered user account
  app.delete('/api/admin/users/:uid', async (req, res) => {
    try {
      const { uid } = req.params;
      if (!uid) {
        return res.status(400).json({ error: 'Missing user uid' });
      }
      if (!mongoDb) {
        return res.status(503).json({ error: 'MongoDB database is not connected.' });
      }

      // Safeguard: Do not allow deletion of the primary admin user ID
      if (uid === 'sigmund_ts_boot') {
        return res.status(403).json({ error: 'Cannot delete the system root admin account.' });
      }

      const userRoleDocPath = `user_role_${uid}`;
      const result = await mongoDb.collection('settings').deleteOne({ id: userRoleDocPath });
      
      // If of generic form or found by uid directly
      if (result.deletedCount === 0) {
        await mongoDb.collection('settings').deleteOne({ uid });
      }

      res.json({ success: true, message: `Successfully deleted user ${uid} from database settings` });
    } catch (e: any) {
      console.error('Admin delete user API Error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // ADMIN: Get/Load specific role permissions configuration
  app.get('/api/admin/permissions', async (req, res) => {
    try {
      let permissions = {
        admin: {
          dashboard: true, live: true, playback: true, people: true, visitors: true,
          attendance: true, alerts: true, incidents: true, digitalTwin: true, analytics: true,
          aiInsights: true, devices: true, maintenance: true, audit: true, settings: true
        },
        manager: {
          dashboard: true, live: true, playback: true, people: true, visitors: true,
          attendance: true, alerts: true, incidents: true, digitalTwin: true, analytics: true,
          aiInsights: true, devices: true, maintenance: true, audit: true, settings: false
        },
        operator: {
          dashboard: false, live: true, playback: false, people: true, visitors: true,
          attendance: true, alerts: true, incidents: true, digitalTwin: true, analytics: false,
          aiInsights: false, devices: false, maintenance: true, audit: false, settings: false
        },
        blocked: {
          dashboard: false, live: false, playback: false, people: false, visitors: false,
          attendance: false, alerts: false, incidents: false, digitalTwin: false, analytics: false,
          aiInsights: false, devices: false, maintenance: false, audit: false, settings: false
        }
      };

      if (mongoDb) {
        const snap = await mongoDb.collection('settings').findOne({ id: 'role_permissions' });
        if (snap) {
          const { _id, id, ...cleanPermissions } = snap;
          permissions = { ...permissions, ...cleanPermissions };
        } else {
          await mongoDb.collection('settings').updateOne(
            { id: 'role_permissions' },
            { $set: { id: 'role_permissions', ...permissions } },
            { upsert: true }
          );
        }
      }
      res.json(permissions);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ADMIN: Update/modify role permissions
  app.post('/api/admin/permissions', async (req, res) => {
    try {
      const permissions = req.body;
      if (!mongoDb) {
        return res.status(503).json({ error: 'MongoDB database is not connected.' });
      }
      await mongoDb.collection('settings').updateOne(
        { id: 'role_permissions' },
        { $set: { id: 'role_permissions', ...permissions } },
        { upsert: true }
      );
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Proxy the GAO APIs with fully-dynamic target host and auth configuration
  const DEFAULT_GAO_API_HOST = 'https://www.i360services.com/peopletrackinguhf';

  async function getGaoHeadersAndUrl(req: express.Request, path: string) {
    const targetHost = (req.headers['x-gao-target-host'] as string) || DEFAULT_GAO_API_HOST;
    const cleanHost = targetHost.replace(/\/$/, '');
    const url = `${cleanHost}${path}`;

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    const authType = req.headers['x-gao-auth-type'] as string;
    
    if (authType === 'api_key') {
      const key = req.headers['x-gao-api-key'] as string;
      const keyHeader = (req.headers['x-gao-api-key-header'] as string) || 'X-API-Key';
      if (key) {
        headers[keyHeader] = key;
      }
    } else if (authType === 'bearer') {
      const token = req.headers['x-gao-bearer-token'] as string;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    } else if (authType === 'basic') {
      const username = req.headers['x-gao-username'] as string;
      const password = req.headers['x-gao-password'] as string;
      if (username && password) {
        const creds = Buffer.from(`${username}:${password}`).toString('base64');
        headers['Authorization'] = `Basic ${creds}`;
      }
    } else if (authType === 'oauth') {
      const clientId = req.headers['x-gao-oauth-client-id'] as string;
      const clientSecret = req.headers['x-gao-oauth-client-secret'] as string;
      const tokenUrl = req.headers['x-gao-oauth-token-url'] as string;

      if (clientId && clientSecret && tokenUrl) {
        try {
          const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
          const tokenRes = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `Basic ${authString}`
            },
            body: new URLSearchParams({
              grant_type: 'client_credentials'
            })
          });
          if (tokenRes.ok) {
            const tokenJson: any = await tokenRes.json();
            if (tokenJson.access_token) {
              headers['Authorization'] = `Bearer ${tokenJson.access_token}`;
            }
          }
        } catch (oauthErr) {
          console.error('OAuth token exchange error in proxy server:', oauthErr);
        }
      }
    }

    return { url, headers };
  }

  app.get('/api/GetHistoryTotalCount', async (req, res) => {
    try {
      const { url, headers } = await getGaoHeadersAndUrl(req, '/api/GetHistoryTotalCount');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const gaoRes = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeout);
      if (gaoRes.ok) {
        const data = await gaoRes.text();
        return res.send(data);
      }
    } catch (e: any) {
      console.warn('GetHistoryTotalCount proxy fallback:', e.message);
    }
    res.send("52");
  });

  app.get('/api/GetHistoryRecords/:skip/:take', async (req, res) => {
    try {
      const { skip, take } = req.params;
      const { url, headers } = await getGaoHeadersAndUrl(req, `/api/GetHistoryRecords/${skip}/${take}`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const gaoRes = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeout);
      if (gaoRes.ok) {
        const data = await gaoRes.json();
        return res.json(data);
      }
    } catch (e: any) {
      console.warn('GetHistoryRecords proxy fallback:', e.message);
    }
    res.json([]);
  });

  app.get('/api/GetTagsInRealtime', async (req, res) => {
    try {
      const { url, headers } = await getGaoHeadersAndUrl(req, '/api/GetTagsInRealtime');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const gaoRes = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeout);
      if (gaoRes.ok) {
        const data = await gaoRes.json();
        return res.json(data);
      }
    } catch (e: any) {
      console.warn('GetTagsInRealtime proxy fallback:', e.message);
    }
    const nowStr = new Date().toISOString();
    res.json([
      { TagID: "1", Timestamp: nowStr, Location: "Office" },
      { TagID: "2", Timestamp: nowStr, Location: "Entrance" },
      { TagID: "3", Timestamp: nowStr, Location: "Meeting Room" },
      { TagID: "4", Timestamp: nowStr, Location: "Cafeteria" }
    ]);
  });


  // Express Global Error Handler (Ensures API always returns JSON on errors)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Express server route error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        error: err?.message || 'A server error occurred'
      });
    }
  });

  // Vite middleware for local development / container runtime (disabled on Vercel)
  if (!process.env.VERCEL) {
    if (process.env.NODE_ENV !== "production") {
      import('vite').then(({ createServer: createViteServer }) => {
        createViteServer({
          server: { middlewareMode: true },
          appType: "spa",
        }).then(vite => {
          app.use(vite.middlewares);
        }).catch(err => {
          console.error("Failed to start Vite dev server middleware:", err);
        });
      }).catch(err => {
        console.error("Failed to load Vite module:", err);
      });
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  }

export default app;
