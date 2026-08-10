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
  tag_history: [],
  audit_logs: [],
  settings: [],
  incidents_enterprise: []
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
