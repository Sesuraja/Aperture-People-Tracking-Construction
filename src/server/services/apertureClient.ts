import { getCollectionDocs, upsertDoc, getDocById } from './db.js';
import { broadcastSseEvent } from './sse.js';
import { broadcastWebSocketEvent } from './websocket.js';

export interface ApertureConfig {
  host: string;
  apiKey: string;
  authHeaderType: 'X-API-Key' | 'Bearer';
  apiKeyConfigured: boolean;
  apiKeyMasked: string;
  realTimeSyncActive: boolean;
  historySyncActive: boolean;
  lastSuccessfulSync: string | null;
  lastError: string | null;
}

export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 4) return '••••••••••••';
  return '••••••••••••' + key.slice(-4);
}

const DEFAULT_HOST = process.env.APERTURE_RFID_HOST || 'https://www.i360services.com/peopletrackinguhf';
const DEFAULT_API_KEY = process.env.APERTURE_RFID_API_KEY || '';

/**
 * Gets the current Aperture configuration securely.
 * NEVER returns the raw API key to public callers, only masked.
 */
export async function getApertureConfig(): Promise<ApertureConfig> {
  const doc = await getDocById('settings', 'aperture_config');
  
  const host = doc?.host || DEFAULT_HOST;
  const apiKey = doc?.apiKey !== undefined ? doc.apiKey : DEFAULT_API_KEY;
  const authHeaderType = doc?.authHeaderType || 'X-API-Key';
  const realTimeSyncActive = doc?.realTimeSyncActive !== undefined ? doc.realTimeSyncActive : true;
  const historySyncActive = doc?.historySyncActive !== undefined ? doc.historySyncActive : true;
  const lastSuccessfulSync = doc?.lastSuccessfulSync || null;
  const lastError = doc?.lastError || null;

  return {
    host,
    apiKey, // Internal use only
    authHeaderType,
    apiKeyConfigured: Boolean(apiKey && apiKey.length > 0),
    apiKeyMasked: maskApiKey(apiKey),
    realTimeSyncActive,
    historySyncActive,
    lastSuccessfulSync,
    lastError
  };
}

/**
 * Saves Aperture RFID configuration securely to backend store.
 */
export async function saveApertureConfig(input: { host?: string; apiKey?: string; authHeaderType?: 'X-API-Key' | 'Bearer' }): Promise<{
  success: boolean;
  provider: string;
  apiKeyConfigured: boolean;
  apiKeyMasked: string;
}> {
  const current = await getApertureConfig();
  
  const newHost = input.host !== undefined ? input.host.trim() : current.host;
  // If user provides a non-masked new key, save it. If masked or empty, keep current unless explicitly cleared.
  let newApiKey = current.apiKey;
  if (input.apiKey !== undefined) {
    if (!input.apiKey.includes('••••')) {
      newApiKey = input.apiKey.trim();
    }
  }

  const newAuthHeaderType = input.authHeaderType || current.authHeaderType;

  const docToSave = {
    id: 'aperture_config',
    host: newHost,
    apiKey: newApiKey,
    authHeaderType: newAuthHeaderType,
    realTimeSyncActive: current.realTimeSyncActive,
    historySyncActive: current.historySyncActive,
    lastSuccessfulSync: current.lastSuccessfulSync,
    lastError: null,
    updatedAt: new Date().toISOString()
  };

  await upsertDoc('settings', docToSave);

  return {
    success: true,
    provider: 'Aperture RFID',
    apiKeyConfigured: Boolean(newApiKey && newApiKey.length > 0),
    apiKeyMasked: maskApiKey(newApiKey)
  };
}

/**
 * Centralized Aperture API fetch wrapper that injects proper authentication headers.
 */
export async function makeApertureRequest(endpointPath: string, options: RequestInit = {}): Promise<Response> {
  const config = await getApertureConfig();
  const baseUrl = config.host.replace(/\/$/, '');
  const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
  const fullUrl = `${baseUrl}${cleanPath}`;

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (config.apiKey) {
    if (config.authHeaderType === 'Bearer') {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    } else {
      headers['X-API-Key'] = config.apiKey;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  try {
    const res = await fetch(fullUrl, {
      ...options,
      headers,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Tests connection to the Aperture RFID server.
 */
export async function testApertureConnection(overrideHost?: string, overrideApiKey?: string): Promise<{
  status: string;
  provider: string;
  responseCode?: number;
  checkedAt: string;
  message?: string;
}> {
  const currentConfig = await getApertureConfig();
  const host = (overrideHost !== undefined ? overrideHost : currentConfig.host).trim();
  let apiKey = currentConfig.apiKey;
  if (overrideApiKey !== undefined && !overrideApiKey.includes('••••')) {
    apiKey = overrideApiKey.trim();
  }

  if (!host) {
    return {
      status: 'NOT_CONFIGURED',
      provider: 'Aperture RFID',
      checkedAt: new Date().toISOString(),
      message: 'Server URL is not configured.'
    };
  }

  const baseUrl = host.replace(/\/$/, '');
  const testUrl = `${baseUrl}/api/GetHistoryTotalCount`;

  const headers: Record<string, string> = {
    'Accept': 'application/json'
  };

  if (apiKey) {
    if (currentConfig.authHeaderType === 'Bearer') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else {
      headers['X-API-Key'] = apiKey;
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(testUrl, { method: 'GET', headers, signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      // Record success
      await upsertDoc('settings', {
        id: 'aperture_config',
        ...currentConfig,
        lastSuccessfulSync: new Date().toISOString(),
        lastError: null
      });

      return {
        status: 'CONNECTED',
        provider: 'Aperture RFID',
        responseCode: res.status,
        checkedAt: new Date().toISOString(),
        message: 'Successfully connected to Aperture RFID API server.'
      };
    } else if (res.status === 401 || res.status === 403) {
      const errMsg = `Authentication failed (HTTP ${res.status})`;
      await updateLastError(errMsg);
      return {
        status: 'AUTHENTICATION_FAILED',
        provider: 'Aperture RFID',
        responseCode: res.status,
        checkedAt: new Date().toISOString(),
        message: errMsg
      };
    } else {
      const errMsg = `Server returned HTTP ${res.status}`;
      await updateLastError(errMsg);
      return {
        status: 'SERVER_UNAVAILABLE',
        provider: 'Aperture RFID',
        responseCode: res.status,
        checkedAt: new Date().toISOString(),
        message: errMsg
      };
    }
  } catch (err: any) {
    clearTimeout(timeout);
    let status = 'UNKNOWN_ERROR';
    let errMsg = err.message || 'Connection failed';

    if (err.name === 'AbortError') {
      status = 'TIMEOUT';
      errMsg = 'Connection attempt timed out after 8 seconds';
    } else if (err.code === 'ECONNREFUSED' || err.message?.includes('fetch failed')) {
      status = 'SERVER_UNAVAILABLE';
      errMsg = 'Aperture RFID server is unreachable or offline';
    }

    await updateLastError(errMsg);

    return {
      status,
      provider: 'Aperture RFID',
      checkedAt: new Date().toISOString(),
      message: errMsg
    };
  }
}

async function updateLastError(errMsg: string) {
  const currentConfig = await getApertureConfig();
  await upsertDoc('settings', {
    id: 'aperture_config',
    ...currentConfig,
    lastError: errMsg
  });
}

/**
 * Performs Real-Time Tag Sync from Aperture API:
 * 1. GET /api/GetTagsInRealtime
 * 2. Validate response array
 * 3. Match TagID with people.tagId (or registered_people)
 * 4. Match Location with locations.name
 * 5. Store raw event in rfid_realtime_events
 * 6. Update people.currentZone and lastSeen
 * 7. Update zone occupancy
 * 8. Broadcast update through existing SSE (/api/events/sse) & WebSockets
 */
export async function syncApertureRealtimeTags(): Promise<{
  success: boolean;
  processedCount: number;
  tags?: any[];
  error?: string;
}> {
  try {
    const res = await makeApertureRequest('/api/GetTagsInRealtime');
    if (!res.ok) {
      const errText = `Failed GET /api/GetTagsInRealtime with status ${res.status}`;
      await updateLastError(errText);
      return { success: false, processedCount: 0, error: errText };
    }

    const data = await res.json();
    const tagArray = Array.isArray(data) ? data : (data.tags || data.data || []);

    if (!Array.isArray(tagArray)) {
      return { success: true, processedCount: 0, tags: [] };
    }

    // Load registered people and locations for matching
    const peopleList = await getCollectionDocs('personnel') || await getCollectionDocs('registered_people') || [];
    const locationsList = await getCollectionDocs('locations') || [];

    const nowIso = new Date().toISOString();

    for (const item of tagArray) {
      if (!item || (!item.TagID && !item.tagId && !item.epc)) continue;

      const tagId = item.TagID || item.tagId || item.epc;
      const rawLocation = item.Location || item.location || item.LocationName || item.zone || 'Zone1';
      const timestamp = item.Timestamp || item.timestamp || nowIso;

      // 1. Store raw event in rfid_realtime_events
      const rawEventDoc = {
        id: `evt_${Date.now()}_${tagId}`,
        TagID: tagId,
        Timestamp: timestamp,
        Location: rawLocation,
        receivedAt: nowIso
      };
      await upsertDoc('rfid_realtime_events', rawEventDoc);

      // 2. Match TagID with personnel / registered_people
      const matchedPerson = peopleList.find((p: any) => p.tagId === tagId || p.TagID === tagId || p.badgeId === tagId || p.id === tagId);

      if (matchedPerson) {
        // Match Location with locations
        const matchedLocation = locationsList.find((loc: any) => loc.name === rawLocation || loc.id === rawLocation);
        const resolvedLocationName = matchedLocation ? matchedLocation.name : rawLocation;

        // Update person's currentZone and lastSeen
        const updatedPerson = {
          ...matchedPerson,
          currentZone: resolvedLocationName,
          zone: resolvedLocationName,
          lastSeen: timestamp,
          lastSeenTime: timestamp,
          updatedAt: nowIso
        };
        await upsertDoc('personnel', updatedPerson);
      }

      // Store in live_tags / real_time_tags
      const tagDoc = {
        id: tagId,
        TagID: tagId,
        Timestamp: timestamp,
        Location: rawLocation,
        FirstName: matchedPerson?.firstName || item.FirstName || 'Staff',
        LastName: matchedPerson?.lastName || item.LastName || 'User',
        lastSyncAt: nowIso
      };
      await upsertDoc('real_time_tags', tagDoc);
      await upsertDoc('live_tags', tagDoc);

      // Broadcast update through existing SSE system (/api/events/sse)
      broadcastSseEvent('rfid_scan', tagDoc);
      broadcastSseEvent('tag_update', tagDoc);

      // Also publish via WebSockets
      broadcastWebSocketEvent('tag_update', tagDoc);
    }

    // Update last sync timestamp
    const config = await getApertureConfig();
    await upsertDoc('settings', {
      id: 'aperture_config',
      ...config,
      lastSuccessfulSync: nowIso,
      lastError: null
    });

    return { success: true, processedCount: tagArray.length, tags: tagArray };
  } catch (err: any) {
    const errMsg = err.message || 'Real-time sync failed';
    await updateLastError(errMsg);
    return { success: false, processedCount: 0, error: errMsg };
  }
}

/**
 * Performs History Data Syncing from Aperture API:
 * 1. GET /api/GetHistoryTotalCount
 * 2. GET /api/GetHistoryRecords/{SkipCount}/{TakeCount} (max TakeCount 200)
 * 3. Store in rfid_history without duplicates
 */
export async function syncApertureHistory(skipCount: number = 0, takeCount: number = 200): Promise<{
  success: boolean;
  totalCount: number;
  recordsFetched: number;
  error?: string;
}> {
  const safeTake = Math.min(Math.max(1, takeCount), 200);

  try {
    // 1. Get Total Count
    const countRes = await makeApertureRequest('/api/GetHistoryTotalCount');
    let totalCount = 0;
    if (countRes.ok) {
      const countData = await countRes.json();
      totalCount = typeof countData === 'number' ? countData : (countData.totalCount || countData.count || 0);
    }

    // 2. Fetch Records
    const recordsRes = await makeApertureRequest(`/api/GetHistoryRecords/${skipCount}/${safeTake}`);
    if (!recordsRes.ok) {
      const errText = `Failed GET /api/GetHistoryRecords/${skipCount}/${safeTake} with status ${recordsRes.status}`;
      await updateLastError(errText);
      return { success: false, totalCount, recordsFetched: 0, error: errText };
    }

    const recordsData = await recordsRes.json();
    const recordsArray = Array.isArray(recordsData) ? recordsData : (recordsData.records || recordsData.data || []);

    const nowIso = new Date().toISOString();

    // Store in rfid_history & tag_history without duplicates
    for (const rec of recordsArray) {
      if (!rec) continue;
      const tagId = rec.TagID || rec.tagId || rec.epc || `REC_${Date.now()}`;
      const enterTime = rec.EnterTime || rec.enterTime || rec.Timestamp || nowIso;
      const docId = rec.id || `hist_${tagId}_${new Date(enterTime).getTime()}`;

      const historyDoc = {
        id: docId,
        TagID: tagId,
        FirstName: rec.FirstName || rec.firstName || 'Staff',
        LastName: rec.LastName || rec.lastName || 'User',
        LocationName: rec.LocationName || rec.Location || rec.location || 'Zone1',
        EnterTime: enterTime,
        LeaveTime: rec.LeaveTime || rec.leaveTime || enterTime,
        Duration: rec.Duration !== undefined ? Number(rec.Duration) : 0,
        syncedAt: nowIso
      };

      await upsertDoc('rfid_history', historyDoc);
      await upsertDoc('tag_history', historyDoc);
    }

    return {
      success: true,
      totalCount,
      recordsFetched: recordsArray.length
    };
  } catch (err: any) {
    const errMsg = err.message || 'History sync failed';
    await updateLastError(errMsg);
    return { success: false, totalCount: 0, recordsFetched: 0, error: errMsg };
  }
}
