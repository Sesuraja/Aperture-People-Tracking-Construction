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

