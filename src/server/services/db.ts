import { MongoClient, Db } from 'mongodb';

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;
let runtimeMongoUri: string | null = null;

// Transient in-memory store for dev fallback when MongoDB is not connected
const inMemoryStore: Record<string, any[]> = {
  users: [],
  permissions: [],
  role_permissions: [],
  registered_people: [],
  devices: [],
  visitors: [],
  visitor_security_list: [],
  visitor_access_tokens: [],
  visitor_access_logs: [],
  attendance_logs: [],
  leave_requests: [],
  shift_schedules: [],
  alerts: [],
  alerts_enterprise: [],
  alert_rules: [],
  alert_dispatch_logs: [],
  emergency_broadcasts: [],
  live_tags: [],
  real_time_tags: [],
  rfid_realtime_events: [],
  tag_history: [],
  audit_logs: [],
  settings: [],
  incidents_enterprise: [],
  zones: [],
  map_configurations: [],
  geofences: [],
  reader_zone_mappings: [],
  people: []
};

export function getMongoUri(): string {
  return runtimeMongoUri || process.env.MONGODB_URI || "";
}

export async function initDatabase(customUri?: string): Promise<void> {
  const uri = customUri || getMongoUri();
  if (!uri) {
    console.warn('[DB Service] MONGODB_URI not set in environment or settings. Operating with transient in-memory storage.');
    return;
  }

  try {
    if (mongoClient) {
      try { await mongoClient.close(); } catch {}
      mongoClient = null;
      mongoDb = null;
    }
    
    mongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await mongoClient.connect();
    await mongoClient.db().admin().ping();
    mongoDb = mongoClient.db();
    runtimeMongoUri = uri;
    console.log('[DB Service] Successfully connected to MongoDB database.');
  } catch (err: any) {
    console.error('[DB Service] Failed to connect to MongoDB:', err.message);
    console.warn('[DB Service] Falling back to transient in-memory storage (NON-PERSISTENT).');
    mongoClient = null;
    mongoDb = null;
  } finally {
    await bootstrapMapAndZoneDefinitions();
  }
}

export function isMongoConnected(): boolean {
  return mongoDb !== null;
}

export function getDbStatus() {
  const uri = getMongoUri();
  return {
    connected: isMongoConnected(),
    provider: isMongoConnected() ? 'mongodb' : 'in_memory',
    uri: uri ? uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') : 'None (In-Memory Fallback)'
  };
}

export async function getMongoStats() {
  const uri = getMongoUri();
  const connected = isMongoConnected();
  let collectionsCount = 0;
  let totalRecords = 0;
  let lastError: string | null = null;

  if (connected && mongoDb) {
    try {
      const cols = await mongoDb.listCollections().toArray();
      collectionsCount = cols.length;
      for (const col of cols) {
        const count = await mongoDb.collection(col.name).countDocuments();
        totalRecords += count;
      }
    } catch (err: any) {
      lastError = err.message;
    }
  } else {
    lastError = 'MongoDB is not connected (operating with in-memory fallback)';
  }

  const maskedUri = uri ? uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@') : '';

  return {
    connected,
    connectionString: maskedUri,
    engine: connected ? 'MongoDB Cluster' : 'In-Memory Fallback',
    collectionsCount,
    totalRecords,
    lastError
  };
}

export async function testMongoConnection(uri: string): Promise<{ success: boolean; error?: string }> {
  let tempClient: MongoClient | null = null;
  try {
    tempClient = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    await tempClient.connect();
    await tempClient.db().admin().ping();
    await tempClient.close();
    return { success: true };
  } catch (err: any) {
    if (tempClient) {
      try { await tempClient.close(); } catch {}
    }
    return { success: false, error: err.message || 'Failed to connect to MongoDB instance' };
  }
}

export async function reconnectDatabase(newUri: string): Promise<{ success: boolean; error?: string }> {
  try {
    await initDatabase(newUri);
    if (isMongoConnected()) {
      return { success: true };
    } else {
      return { success: false, error: 'Could not establish connection to MongoDB URI provided' };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to reconnect to MongoDB' };
  }
}

export async function getCollectionDocs(colName: string): Promise<any[]> {
  if (mongoDb) {
    try {
      const docs = await mongoDb.collection(colName).find({}).toArray();
      return docs.map(doc => {
        const { _id, ...rest } = doc;
        return { id: doc.id || (_id ? _id.toString() : undefined), ...rest };
      });
    } catch (err) {
      console.error(`[DB Service] Error fetching docs for ${colName}:`, err);
    }
  }
  return inMemoryStore[colName] || [];
}

export async function getDocById(colName: string, id: string): Promise<any | null> {
  if (mongoDb) {
    try {
      const doc = await mongoDb.collection(colName).findOne({ id });
      if (doc) {
        const { _id, ...rest } = doc;
        return { id: doc.id, ...rest };
      }
      return null;
    } catch (err) {
      console.error(`[DB Service] Error fetching doc ${id} in ${colName}:`, err);
    }
  }
  const items = inMemoryStore[colName] || [];
  return items.find((i: any) => i.id === id) || null;
}

export async function upsertDoc(colName: string, doc: any): Promise<any> {
  if (!doc.id) {
    doc.id = `${colName}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  }

  const cleanDoc = { ...doc };
  delete (cleanDoc as any)._id;

  if (mongoDb) {
    try {
      await mongoDb.collection(colName).updateOne(
        { id: cleanDoc.id },
        { $set: cleanDoc },
        { upsert: true }
      );
      return cleanDoc;
    } catch (err) {
      console.error(`[DB Service] Error upserting doc in ${colName}:`, err);
    }
  }

  if (!inMemoryStore[colName]) {
    inMemoryStore[colName] = [];
  }
  const idx = inMemoryStore[colName].findIndex((item: any) => item.id === cleanDoc.id);
  if (idx >= 0) {
    inMemoryStore[colName][idx] = cleanDoc;
  } else {
    inMemoryStore[colName].push(cleanDoc);
  }
  return cleanDoc;
}

export async function deleteDocById(colName: string, id: string): Promise<boolean> {
  if (mongoDb) {
    try {
      const result = await mongoDb.collection(colName).deleteOne({ id });
      return result.deletedCount > 0;
    } catch (err) {
      console.error(`[DB Service] Error deleting doc ${id} in ${colName}:`, err);
    }
  }

  if (inMemoryStore[colName]) {
    const initLen = inMemoryStore[colName].length;
    inMemoryStore[colName] = inMemoryStore[colName].filter((item: any) => item.id !== id);
    return inMemoryStore[colName].length < initLen;
  }
  return false;
}

export async function deleteDocsByFilter(colName: string, predicate: (doc: any) => boolean): Promise<number> {
  const docs = await getCollectionDocs(colName);
  const toDelete = docs.filter(predicate);
  let count = 0;

  for (const doc of toDelete) {
    const deleted = await deleteDocById(colName, doc.id);
    if (deleted) count++;
  }

  return count;
}

export async function logAuditEvent(event: {
  userId?: string;
  userEmail?: string;
  action: string;
  resource: string;
  details?: any;
  ip?: string;
}): Promise<void> {
  const auditDoc = {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
    userId: event.userId || 'system',
    userEmail: event.userEmail || 'system',
    action: event.action,
    resource: event.resource,
    details: event.details || {},
    ip: event.ip || 'unknown'
  };

  await upsertDoc('audit_logs', auditDoc);
}

export async function getAuditLogs(limitCount = 100): Promise<any[]> {
  const logs = await getCollectionDocs('audit_logs');
  return logs
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limitCount);
}

/**
 * Normalizes multi-protocol real-time stream events (WebSocket, SSE, MQTT, Webhook)
 * to { TagID, Timestamp, Location } structure and performs bulk write to 'rfid_realtime_events' collection.
 */
export async function bulkWriteRfidRealtimeEvents(rawEvents: any[], protocol: string = 'Multi-Protocol'): Promise<{ insertedCount: number; modifiedCount: number; totalProcessed: number }> {
  if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
    return { insertedCount: 0, modifiedCount: 0, totalProcessed: 0 };
  }

  const nowIso = new Date().toISOString();
  let insertedCount = 0;
  let modifiedCount = 0;

  const normalizedDocs = rawEvents.map((raw) => {
    const tagId = String(raw.TagID || raw.tagId || raw.epc || raw.EPC || raw.id || `TAG_${Date.now()}`);
    const location = String(raw.Location || raw.location || raw.LocationName || raw.zone || raw.Zone || 'Zone1');
    const rawTime = raw.Timestamp || raw.timestamp || raw.EnterTime || raw.time || nowIso;
    const d = new Date(rawTime);
    const validDate = isNaN(d.getTime()) ? new Date() : d;

    // ISO & GAO formatted timestamp string
    const YYYY = validDate.getUTCFullYear();
    const MM = String(validDate.getUTCMonth() + 1).padStart(2, '0');
    const DD = String(validDate.getUTCDate()).padStart(2, '0');
    const hh = String(validDate.getUTCHours()).padStart(2, '0');
    const mm = String(validDate.getUTCMinutes()).padStart(2, '0');
    const ss = String(validDate.getUTCSeconds()).padStart(2, '0');
    const fff = String(validDate.getUTCMilliseconds()).padStart(3, '0');
    const timestampMs = `${YYYY}-${MM}-${DD} ${hh}:${mm}:${ss}.${fff}`;

    const docId = `evt_${tagId}_${validDate.getTime()}_${Math.random().toString(36).substring(2, 6)}`;

    return {
      id: docId,
      TagID: tagId,
      Timestamp: timestampMs,
      Location: location,
      FirstName: raw.FirstName || raw.firstName || 'Staff',
      LastName: raw.LastName || raw.lastName || 'Member',
      protocol: raw.protocol || protocol,
      rssi: raw.rssi !== undefined ? Number(raw.rssi) : -60,
      readerId: raw.readerId || raw.ReaderID || 'APERTURE-READER-01',
      antennaPort: raw.antennaPort || raw.antennaId || 1,
      receivedAt: nowIso
    };
  });

  if (mongoDb) {
    try {
      const operations = normalizedDocs.map((doc) => ({
        updateOne: {
          filter: { id: doc.id },
          update: { $set: doc },
          upsert: true
        }
      }));

      const result = await mongoDb.collection('rfid_realtime_events').bulkWrite(operations, { ordered: false });
      insertedCount = result.upsertedCount || 0;
      modifiedCount = result.modifiedCount || 0;

      // Also mirror/update real_time_tags & live_tags
      await bulkWriteRealtimeTags(normalizedDocs);

      return { insertedCount, modifiedCount, totalProcessed: rawEvents.length };
    } catch (err: any) {
      console.error('[DB Service] Error in bulkWriteRfidRealtimeEvents to MongoDB:', err);
    }
  }

  // Fallback in-memory persistence
  for (const doc of normalizedDocs) {
    await upsertDoc('rfid_realtime_events', doc);
    await upsertDoc('real_time_tags', doc);
    await upsertDoc('live_tags', doc);
    insertedCount++;
  }

  return { insertedCount, modifiedCount: 0, totalProcessed: rawEvents.length };
}

/**
 * Bulk writes real-time tag documents into MongoDB collection 'real_time_tags'
 */
export async function bulkWriteRealtimeTags(tags: any[]): Promise<{ insertedCount: number; updatedCount: number; totalProcessed: number }> {
  if (!Array.isArray(tags) || tags.length === 0) {
    return { insertedCount: 0, updatedCount: 0, totalProcessed: 0 };
  }

  let insertedCount = 0;
  let updatedCount = 0;

  if (mongoDb) {
    try {
      const operations = tags.map((rawTag) => {
        const tagId = rawTag.TagID || rawTag.tagId || rawTag.epc || `TAG_${Date.now()}`;
        const docToUpsert = {
          id: tagId,
          TagID: tagId,
          Timestamp: rawTag.Timestamp || new Date().toISOString(),
          Location: rawTag.Location || rawTag.LocationName || rawTag.zone || 'Zone1',
          FirstName: rawTag.FirstName || 'Staff',
          LastName: rawTag.LastName || 'User',
          rssi: rawTag.rssi !== undefined ? Number(rawTag.rssi) : -60,
          status: rawTag.status || 'Active',
          lastSyncAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        return {
          updateOne: {
            filter: { TagID: tagId },
            update: { $set: docToUpsert },
            upsert: true
          }
        };
      });

      const result = await mongoDb.collection('real_time_tags').bulkWrite(operations, { ordered: false });
      insertedCount = result.upsertedCount || 0;
      updatedCount = result.modifiedCount || 0;
      
      // Also mirror to live_tags collection
      for (const t of tags) {
        await upsertDoc('live_tags', t);
      }

      return { insertedCount, updatedCount, totalProcessed: tags.length };
    } catch (err: any) {
      console.error('[DB Service] Error during bulkWriteRealtimeTags to MongoDB:', err);
    }
  }

  // Fallback for in-memory store
  for (const t of tags) {
    const tagId = t.TagID || t.tagId || t.epc || `TAG_${Date.now()}`;
    const cleanDoc = {
      id: tagId,
      TagID: tagId,
      Timestamp: t.Timestamp || new Date().toISOString(),
      Location: t.Location || t.LocationName || t.zone || 'Zone1',
      FirstName: t.FirstName || 'Staff',
      LastName: t.LastName || 'User',
      rssi: t.rssi !== undefined ? Number(t.rssi) : -60,
      status: t.status || 'Active',
      lastSyncAt: new Date().toISOString()
    };
    await upsertDoc('real_time_tags', cleanDoc);
    await upsertDoc('live_tags', cleanDoc);
    updatedCount++;
  }

  return { insertedCount: tags.length, updatedCount, totalProcessed: tags.length };
}

/**
 * Periodically cleans up stale real-time tag data older than specified threshold (minutes) from MongoDB 'real_time_tags'
 */
export async function cleanupStaleRealTimeTags(maxAgeMinutes: number = 60): Promise<{ cleanedCount: number; remainingCount: number }> {
  const cutoffTime = new Date(Date.now() - maxAgeMinutes * 60 * 1000);
  let cleanedCount = 0;

  console.log(`[DB Service] Running stale real-time tags cleanup (Threshold: ${maxAgeMinutes} mins / Cutoff: ${cutoffTime.toISOString()})...`);

  if (mongoDb) {
    try {
      const filter = {
        $or: [
          { Timestamp: { $lt: cutoffTime.toISOString() } },
          { lastSyncAt: { $lt: cutoffTime.toISOString() } }
        ]
      };

      const result = await mongoDb.collection('real_time_tags').deleteMany(filter);
      cleanedCount = result.deletedCount || 0;
      
      const remainingCount = await mongoDb.collection('real_time_tags').countDocuments();
      console.log(`[DB Service] Cleaned up ${cleanedCount} stale real-time tags from MongoDB. Remaining: ${remainingCount}`);
      return { cleanedCount, remainingCount };
    } catch (err: any) {
      console.error('[DB Service] Error cleaning up stale real-time tags in MongoDB:', err);
    }
  }

  // In-memory cleanup fallback
  if (inMemoryStore['real_time_tags']) {
    const initialLen = inMemoryStore['real_time_tags'].length;
    inMemoryStore['real_time_tags'] = inMemoryStore['real_time_tags'].filter((doc: any) => {
      const ts = new Date(doc.Timestamp || doc.lastSyncAt || doc.timestamp || Date.now());
      return !isNaN(ts.getTime()) && ts.getTime() >= cutoffTime.getTime();
    });
    cleanedCount = initialLen - inMemoryStore['real_time_tags'].length;
  }

  const remainingCount = (inMemoryStore['real_time_tags'] || []).length;
  return { cleanedCount, remainingCount };
}

export const DEFAULT_PERMANENT_ZONES = [
  {
    id: 'zone_excavation_shaft',
    zoneId: 'zone_excavation_shaft',
    name: 'Excavation & Foundation Pit',
    aliasNames: ['Excavation Shaft', 'Excavation & Foundation Pit', 'Deep Excavation Shaft', 'Zone2'],
    category: 'EXCAVATION & SHORING',
    hazardLevel: 'warning',
    capacity: 8,
    siteId: 'metro-tower',
    x: 10,
    y: 15,
    width: 34,
    height: 62,
    readerIds: ['RDR-002', 'GAO-UHF-READER-02'],
    antennaIds: [1]
  },
  {
    id: 'zone_tower_core',
    zoneId: 'zone_tower_core',
    name: 'Structure & Scaffolding (L1-L4)',
    aliasNames: ['Tower Core', 'Structure & Scaffolding (L1-L4)', 'Tower Core Structure', 'Zone1', 'd6'],
    category: 'CONCRETE REINFORCEMENT',
    hazardLevel: 'normal',
    capacity: 25,
    siteId: 'metro-tower',
    x: 51,
    y: 25,
    width: 32,
    height: 50,
    readerIds: ['RDR-003', 'GAO-UHF-READER-01'],
    antennaIds: [1]
  },
  {
    id: 'zone_crane_area',
    zoneId: 'zone_crane_area',
    name: 'Heavy Crane & Exclusion Area',
    aliasNames: ['Crane Swing Zone', 'Heavy Crane & Exclusion Area', 'd8', 'Crane Exclusion'],
    category: 'CRANE SWING RADIUS',
    hazardLevel: 'critical',
    capacity: 4,
    siteId: 'metro-tower',
    x: 80,
    y: 5,
    width: 16,
    height: 42,
    readerIds: ['RDR-002', 'GAO-UHF-READER-03'],
    antennaIds: [1]
  },
  {
    id: 'zone_high_voltage',
    zoneId: 'zone_high_voltage',
    name: 'High Voltage Area',
    aliasNames: ['High Voltage Area', 'Substation Area', 'Substation Perimeter'],
    category: 'SUBSTATION PERIMETER',
    hazardLevel: 'critical',
    capacity: 2,
    siteId: 'metro-tower',
    x: 46,
    y: 5,
    width: 14,
    height: 16,
    readerIds: ['RDR-003', 'GAO-UHF-READER-03'],
    antennaIds: [2]
  },
  {
    id: 'zone_gate_1',
    zoneId: 'zone_gate_1',
    name: 'Gate 1 / Main Access Gate',
    aliasNames: ['Gate 1', 'Main Access Gate', 'Gate 1 Turnstile', 'Muster Point A'],
    category: 'MUSTER POINT & ACCESS',
    hazardLevel: 'normal',
    capacity: 50,
    siteId: 'metro-tower',
    x: 2,
    y: 10,
    width: 12,
    height: 16,
    readerIds: ['RDR-001', 'GAO-UHF-READER-01'],
    antennaIds: [1]
  },
  {
    id: 'zone_material_laydown',
    zoneId: 'zone_material_laydown',
    name: 'Material Laydown & Loading',
    aliasNames: ['Material Laydown & Loading', 'Storage Yard', 'Storage Yard Reader'],
    category: 'MATERIAL STORAGE',
    hazardLevel: 'normal',
    capacity: 15,
    siteId: 'metro-tower',
    x: 20,
    y: 75,
    width: 30,
    height: 20,
    readerIds: ['RDR-004', 'GAO-UHF-READER-01'],
    antennaIds: [2]
  },
  {
    id: 'zone_site_office',
    zoneId: 'zone_site_office',
    name: 'Site Office & Welfare Container',
    aliasNames: ['Site Office', 'Welfare Container', 'Site Office & Welfare Container'],
    category: 'ADMINISTRATION',
    hazardLevel: 'normal',
    capacity: 30,
    siteId: 'metro-tower',
    x: 5,
    y: 40,
    width: 15,
    height: 25,
    readerIds: ['RDR-001'],
    antennaIds: [2]
  },
  {
    id: 'zone_confined_shaft',
    zoneId: 'zone_confined_shaft',
    name: 'Confined Shaft & Tunneling',
    aliasNames: ['Confined Shaft', 'Tunneling', 'Confined Shaft & Tunneling'],
    category: 'CONFINED SPACE',
    hazardLevel: 'critical',
    capacity: 4,
    siteId: 'metro-tower',
    x: 60,
    y: 75,
    width: 25,
    height: 20,
    readerIds: ['RDR-003'],
    antennaIds: [2]
  }
];

export const DEFAULT_READER_ZONE_MAPPINGS = [
  { id: 'GAO-UHF-READER-01_1', readerId: 'GAO-UHF-READER-01', antennaPort: 1, zoneId: 'zone_tower_core', zoneName: 'Structure & Scaffolding (L1-L4)' },
  { id: 'GAO-UHF-READER-01_2', readerId: 'GAO-UHF-READER-01', antennaPort: 2, zoneId: 'zone_material_laydown', zoneName: 'Material Laydown & Loading' },
  { id: 'GAO-UHF-READER-02_1', readerId: 'GAO-UHF-READER-02', antennaPort: 1, zoneId: 'zone_excavation_shaft', zoneName: 'Excavation & Foundation Pit' },
  { id: 'GAO-UHF-READER-02_2', readerId: 'GAO-UHF-READER-02', antennaPort: 2, zoneId: 'zone_site_office', zoneName: 'Site Office & Welfare Container' },
  { id: 'GAO-UHF-READER-03_1', readerId: 'GAO-UHF-READER-03', antennaPort: 1, zoneId: 'zone_crane_area', zoneName: 'Heavy Crane & Exclusion Area' },
  { id: 'GAO-UHF-READER-03_2', readerId: 'GAO-UHF-READER-03', antennaPort: 2, zoneId: 'zone_high_voltage', zoneName: 'High Voltage Area' },
  { id: 'RDR-001_1', readerId: 'RDR-001', antennaPort: 1, zoneId: 'zone_gate_1', zoneName: 'Gate 1 / Main Access Gate' },
  { id: 'RDR-001_2', readerId: 'RDR-001', antennaPort: 2, zoneId: 'zone_site_office', zoneName: 'Site Office & Welfare Container' },
  { id: 'RDR-002_1', readerId: 'RDR-002', antennaPort: 1, zoneId: 'zone_crane_area', zoneName: 'Heavy Crane & Exclusion Area' },
  { id: 'RDR-002_2', readerId: 'RDR-002', antennaPort: 2, zoneId: 'zone_excavation_shaft', zoneName: 'Excavation & Foundation Pit' },
  { id: 'RDR-003_1', readerId: 'RDR-003', antennaPort: 1, zoneId: 'zone_tower_core', zoneName: 'Structure & Scaffolding (L1-L4)' },
  { id: 'RDR-003_2', readerId: 'RDR-003', antennaPort: 2, zoneId: 'zone_confined_shaft', zoneName: 'Confined Shaft & Tunneling' },
  { id: 'RDR-004_1', readerId: 'RDR-004', antennaPort: 1, zoneId: 'zone_material_laydown', zoneName: 'Material Laydown & Loading' }
];

export const DEFAULT_MAP_CONFIG = {
  id: 'metro-tower',
  siteId: 'metro-tower',
  name: 'Metro Commercial Tower Site',
  contractor: 'Apex Construction JV',
  sizeSqFt: 350000,
  dimensions: '250m x 180m',
  floorplanUrl: 'https://images.unsplash.com/photo-1581094288338-2314dddb7ecc?auto=format&fit=crop&q=80&w=1200',
  buildings: [
    {
      id: 'bldg-main',
      name: 'Main Tower Structure',
      floors: [
        {
          id: 'fl-1',
          name: 'Ground Floor & Podiums',
          levelNumber: 1,
          activeVersionId: 'v-1.0',
          versions: [
            {
              id: 'v-1.0',
              versionNumber: '1.0',
              status: 'published',
              createdAt: new Date().toISOString(),
              author: 'System Initializer',
              notes: 'Initial synchronized site blueprint vector definitions',
              zones: DEFAULT_PERMANENT_ZONES.reduce((acc: any, z) => {
                acc[z.name] = {
                  zoneId: z.zoneId,
                  x: z.x,
                  y: z.y,
                  width: z.width,
                  height: z.height,
                  category: z.category,
                  hazardLevel: z.hazardLevel,
                  capacity: z.capacity
                };
                return acc;
              }, {}),
              floorplanUrl: 'https://images.unsplash.com/photo-1581094288338-2314dddb7ecc?auto=format&fit=crop&q=80&w=1200'
            }
          ]
        }
      ]
    }
  ],
  updatedAt: new Date().toISOString()
};

/**
 * Bootstraps permanent zones, map configurations, and reader-to-zone mappings in DB
 */
export async function bootstrapMapAndZoneDefinitions(): Promise<void> {
  try {
    const existingZones = await getCollectionDocs('zones');
    if (existingZones.length === 0) {
      for (const z of DEFAULT_PERMANENT_ZONES) {
        await upsertDoc('zones', z);
        await upsertDoc('geofences', z);
      }
      console.log(`[DB Service] Initialized ${DEFAULT_PERMANENT_ZONES.length} permanent zones in database.`);
    }

    const existingMappings = await getCollectionDocs('reader_zone_mappings');
    if (existingMappings.length === 0) {
      for (const m of DEFAULT_READER_ZONE_MAPPINGS) {
        await upsertDoc('reader_zone_mappings', m);
      }
      console.log(`[DB Service] Initialized ${DEFAULT_READER_ZONE_MAPPINGS.length} Reader/Antenna -> zoneId mappings.`);
    }

    const existingMapConfig = await getDocById('map_configurations', 'metro-tower');
    if (!existingMapConfig) {
      await upsertDoc('map_configurations', DEFAULT_MAP_CONFIG);
      console.log('[DB Service] Initialized default map configuration in database.');
    }
  } catch (err: any) {
    console.warn('[DB Service] Warning during map & zone bootstrapping:', err.message);
  }
}

/**
 * Background job runner that runs real-time tag cleanup periodically (e.g. every 15 minutes)
 */
let cleanupTimer: any = null;
export function startRealTimeTagsCleanupJob(intervalMinutes: number = 15, maxAgeMinutes: number = 60) {
  if (cleanupTimer) return;

  console.log(`[DB Service] Starting periodic real-time tags background cleanup job (Interval: ${intervalMinutes}m, MaxAge: ${maxAgeMinutes}m)`);
  
  // Run once on start
  cleanupStaleRealTimeTags(maxAgeMinutes).catch(err => console.error('[DB Service] Cleanup job initial run error:', err));

  cleanupTimer = setInterval(() => {
    cleanupStaleRealTimeTags(maxAgeMinutes).catch(err => console.error('[DB Service] Cleanup job periodic run error:', err));
  }, intervalMinutes * 60 * 1000);
}

