import { getSecureGaoConfig, GaoApiConfig } from './gaoConfig.js';
import { rfidPollingService } from './rfidPollingService.js';
import { syncApertureHistory } from './apertureClient.js';
import { upsertDoc } from './db.js';
import { broadcastSseEvent } from './sse.js';
import { broadcastWebSocketEvent } from './websocket.js';

export interface DecodedKeyPayload {
  isDecoded: boolean;
  format?: 'JWT' | 'BASE64_JSON' | 'PLAIN_JSON' | 'RAW_TOKEN';
  header?: Record<string, any>;
  payload?: Record<string, any>;
  extractedEntities: {
    tagsCount: number;
    peopleCount: number;
    locationsCount: number;
    devicesCount: number;
    embeddedHost?: string;
    tenantId?: string;
    clientName?: string;
    roles?: string[];
    details: Record<string, any>;
  };
}

export interface ApiKeyIngestResult {
  success: boolean;
  timestamp: string;
  decodedKeyInfo: DecodedKeyPayload;
  realtimeTagsIngested: number;
  historyRecordsIngested: number;
  totalMongoRecordsSaved: number;
  collectionsUpdated: string[];
  error?: string;
}

/**
 * Safely decodes base64url or standard base64 string
 */
function safeBase64Decode(str: string): string | null {
  try {
    let normalized = str.replace(/-/g, '+').replace(/_/g, '/');
    while (normalized.length % 4) {
      normalized += '=';
    }
    return Buffer.from(normalized, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

/**
 * Inspects and parses any data embedded inside the API key itself (JWT, Base64 JSON, or raw token).
 */
export function inspectApiKeyData(rawApiKey: string): DecodedKeyPayload {
  const result: DecodedKeyPayload = {
    isDecoded: false,
    format: 'RAW_TOKEN',
    extractedEntities: {
      tagsCount: 0,
      peopleCount: 0,
      locationsCount: 0,
      devicesCount: 0,
      details: {}
    }
  };

  if (!rawApiKey || typeof rawApiKey !== 'string') {
    return result;
  }

  const key = rawApiKey.trim();

  // 1. Check for JWT (xxx.yyy.zzz)
  const parts = key.split('.');
  if (parts.length === 3) {
    const headerStr = safeBase64Decode(parts[0]);
    const payloadStr = safeBase64Decode(parts[1]);

    if (payloadStr) {
      try {
        const payloadJson = JSON.parse(payloadStr);
        let headerJson = {};
        if (headerStr) {
          try { headerJson = JSON.parse(headerStr); } catch {}
        }

        result.isDecoded = true;
        result.format = 'JWT';
        result.header = headerJson;
        result.payload = payloadJson;

        extractPayloadData(payloadJson, result);
        return result;
      } catch {
        // Not a JSON JWT
      }
    }
  }

  // 2. Check for Base64 encoded JSON
  if (key.length > 8 && !key.includes(' ')) {
    const decodedStr = safeBase64Decode(key);
    if (decodedStr && (decodedStr.trim().startsWith('{') || decodedStr.trim().startsWith('['))) {
      try {
        const json = JSON.parse(decodedStr);
        result.isDecoded = true;
        result.format = 'BASE64_JSON';
        result.payload = Array.isArray(json) ? { items: json } : json;
        extractPayloadData(result.payload, result);
        return result;
      } catch {
        // Continue
      }
    }
  }

  // 3. Check for direct JSON
  if (key.startsWith('{') && key.endsWith('}')) {
    try {
      const json = JSON.parse(key);
      result.isDecoded = true;
      result.format = 'PLAIN_JSON';
      result.payload = json;
      extractPayloadData(json, result);
      return result;
    } catch {
      // Continue
    }
  }

  return result;
}

function extractPayloadData(payload: Record<string, any>, result: DecodedKeyPayload) {
  const extracted = result.extractedEntities;

  if (payload.host || payload.apiUrl || payload.endpoint || payload.url) {
    extracted.embeddedHost = payload.host || payload.apiUrl || payload.endpoint || payload.url;
  }

  if (payload.tenantId || payload.tenant || payload.companyId || payload.organization) {
    extracted.tenantId = payload.tenantId || payload.tenant || payload.companyId || payload.organization;
  }

  if (payload.name || payload.client || payload.clientName || payload.sub) {
    extracted.clientName = payload.name || payload.client || payload.clientName || payload.sub;
  }

  if (payload.roles || payload.permissions) {
    extracted.roles = Array.isArray(payload.roles) ? payload.roles : (Array.isArray(payload.permissions) ? payload.permissions : []);
  }

  // Extract embedded tags if present in token
  const tagsList = payload.tags || payload.rfidTags || payload.devices || payload.tagList || [];
  if (Array.isArray(tagsList)) {
    extracted.tagsCount = tagsList.length;
  }

  // Extract embedded users/people if present in token
  const peopleList = payload.people || payload.users || payload.personnel || payload.staff || [];
  if (Array.isArray(peopleList)) {
    extracted.peopleCount = peopleList.length;
  }

  // Extract embedded locations
  const locationsList = payload.locations || payload.zones || payload.readers || [];
  if (Array.isArray(locationsList)) {
    extracted.locationsCount = locationsList.length;
  }

  extracted.details = {
    ...payload
  };
}

/**
 * Extracts data from the API key itself AND uses the API key to pull all live/historical
 * GAO RFID data, storing every record directly into MongoDB collections.
 */
export async function extractAndIngestAllFromApiKey(customApiKey?: string): Promise<ApiKeyIngestResult> {
  const nowIso = new Date().toISOString();
  const config: GaoApiConfig = await getSecureGaoConfig();
  const targetApiKey = (customApiKey || config.apiKey || '').trim();

  const collectionsUpdated = new Set<string>();
  let totalMongoRecordsSaved = 0;

  // Step 1: Decode & extract any data directly embedded inside the API key
  const decodedInfo = inspectApiKeyData(targetApiKey);

  if (decodedInfo.isDecoded && decodedInfo.payload) {
    // 1a. Ingest embedded people
    const embeddedPeople = decodedInfo.payload.people || decodedInfo.payload.users || decodedInfo.payload.staff || [];
    if (Array.isArray(embeddedPeople)) {
      for (const p of embeddedPeople) {
        if (!p) continue;
        const pId = p.id || p.personId || `P_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const pDoc = {
          id: pId,
          personId: pId,
          name: p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim() || 'Staff Member',
          tagId: p.tagId || p.TagID || p.badgeId || null,
          role: p.role || 'Staff',
          department: p.department || 'Operations',
          source: 'API_KEY_DECODED_DATA',
          updatedAt: nowIso
        };
        await upsertDoc('people', pDoc);
        await upsertDoc('registered_people', pDoc);
        collectionsUpdated.add('people');
        collectionsUpdated.add('registered_people');
        totalMongoRecordsSaved += 2;
      }
    }

    // 1b. Ingest embedded tags
    const embeddedTags = decodedInfo.payload.tags || decodedInfo.payload.rfidTags || [];
    if (Array.isArray(embeddedTags)) {
      for (const t of embeddedTags) {
        if (!t) continue;
        const tagId = t.TagID || t.tagId || t.epc || t.id;
        if (!tagId) continue;
        const tDoc = {
          id: tagId,
          TagID: tagId,
          Location: t.Location || t.location || 'Zone1',
          LocationName: t.Location || t.location || 'Zone1',
          Timestamp: t.Timestamp || t.timestamp || nowIso,
          source: 'API_KEY_DECODED_DATA',
          updatedAt: nowIso
        };
        await upsertDoc('real_time_tags', tDoc);
        await upsertDoc('live_tags', tDoc);
        collectionsUpdated.add('real_time_tags');
        collectionsUpdated.add('live_tags');
        totalMongoRecordsSaved += 2;
      }
    }

    // 1c. Ingest embedded locations / zones
    const embeddedLocs = decodedInfo.payload.locations || decodedInfo.payload.zones || [];
    if (Array.isArray(embeddedLocs)) {
      for (const l of embeddedLocs) {
        if (!l) continue;
        const locId = l.id || l.zoneId || l.name || `ZONE_${Date.now()}`;
        const locDoc = {
          id: locId,
          name: l.name || l.zoneName || locId,
          description: l.description || 'RFID Monitoring Zone',
          type: l.type || 'Zone',
          source: 'API_KEY_DECODED_DATA',
          updatedAt: nowIso
        };
        await upsertDoc('locations', locDoc);
        collectionsUpdated.add('locations');
        totalMongoRecordsSaved += 1;
      }
    }

    // Store decoded metadata in MongoDB settings
    await upsertDoc('settings', {
      id: 'api_key_decoded_metadata',
      decodedInfo,
      extractedAt: nowIso
    });
    collectionsUpdated.add('settings');
  }

  // Step 2: Use the API key to fetch Real-Time RFID tags and ingest to MongoDB
  let realtimeTagsIngested = 0;
  try {
    const realTimeResult = await rfidPollingService.pollOnce();
    if (realTimeResult.success) {
      realtimeTagsIngested = realTimeResult.newUniqueEventsStored;
      totalMongoRecordsSaved += realTimeResult.newUniqueEventsStored + realTimeResult.activeTagsCount;
      collectionsUpdated.add('rfid_realtime_events');
      collectionsUpdated.add('real_time_tags');
      collectionsUpdated.add('live_tags');
    }
  } catch (err: any) {
    console.warn('[API Key Extractor] Real-time ingest warning:', err?.message || err);
  }

  // Step 3: Use the API key to fetch History records and store in MongoDB
  let historyRecordsIngested = 0;
  try {
    const historyResult = await syncApertureHistory(0, 300);
    if (historyResult.success) {
      historyRecordsIngested = historyResult.recordsFetched;
      totalMongoRecordsSaved += historyResult.recordsFetched;
      collectionsUpdated.add('rfid_history');
      collectionsUpdated.add('tag_history');
    }
  } catch (err: any) {
    console.warn('[API Key Extractor] History ingest warning:', err?.message || err);
  }

  // Step 4: Broadcast updates to connected clients
  broadcastSseEvent('MONGODB_SYNC_COMPLETED', {
    type: 'MONGODB_SYNC_COMPLETED',
    totalMongoRecordsSaved,
    collections: Array.from(collectionsUpdated),
    timestamp: nowIso
  });

  broadcastWebSocketEvent('db_synced', {
    type: 'db_synced',
    totalMongoRecordsSaved,
    collections: Array.from(collectionsUpdated),
    timestamp: nowIso
  });

  return {
    success: true,
    timestamp: nowIso,
    decodedKeyInfo: decodedInfo,
    realtimeTagsIngested,
    historyRecordsIngested,
    totalMongoRecordsSaved,
    collectionsUpdated: Array.from(collectionsUpdated)
  };
}
