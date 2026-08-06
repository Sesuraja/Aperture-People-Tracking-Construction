import { MongoClient, Db } from 'mongodb';

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;

// Transient in-memory store for dev fallback when MongoDB is not connected
const inMemoryStore: Record<string, any[]> = {
  users: [],
  permissions: [],
  role_permissions: [],
  registered_people: [],
  devices: [],
  visitors: [],
  alerts: [],
  live_tags: [],
  tag_history: [],
  audit_logs: [],
  settings: []
};

export function getMongoUri(): string {
  return process.env.MONGODB_URI || '';
}

export async function initDatabase(): Promise<void> {
  const uri = getMongoUri();
  if (!uri) {
    console.warn('[DB Service] MONGODB_URI not set. Operating with transient in-memory storage (NON-PERSISTENT).');
    return;
  }

  try {
    if (!mongoClient) {
      mongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
      await mongoClient.connect();
      mongoDb = mongoClient.db();
      console.log('[DB Service] Successfully connected to MongoDB.');
    }
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
