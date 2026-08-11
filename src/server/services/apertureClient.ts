import { getCollectionDocs, upsertDoc, getDocById, bulkWriteRfidRealtimeEvents } from './db.js';
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

const DEFAULT_HOST = process.env.BEECEPTOR_MOCK_URL || process.env.APERTURE_RFID_HOST || 'https://www.i360services.com/peopletrackinguhf';
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
 * Centralized Aperture API / Beeceptor mock API fetch wrapper.
 * Dynamically resolves URL paths and injects authentication headers.
 */
export async function makeApertureRequest(endpointPath: string, options: RequestInit = {}): Promise<Response> {
  const config = await getApertureConfig();
  const rawHost = config.host.replace(/\/$/, '');
  const cleanPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;

  let fullUrl: string;
  if (rawHost.toLowerCase().endsWith(cleanPath.toLowerCase())) {
    fullUrl = rawHost;
  } else if (rawHost.toLowerCase().includes('/gettagsinrealtime') && cleanPath.toLowerCase().includes('/gettagsinrealtime')) {
    fullUrl = rawHost;
  } else if (rawHost.toLowerCase().includes('/gethistoryrecords') && cleanPath.toLowerCase().includes('/gethistoryrecords')) {
    fullUrl = rawHost;
  } else if (rawHost.toLowerCase().includes('/gethistorytotalcount') && cleanPath.toLowerCase().includes('/gethistorytotalcount')) {
    fullUrl = rawHost;
  } else {
    fullUrl = `${rawHost}${cleanPath}`;
  }

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
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    let res = await fetch(fullUrl, {
      ...options,
      headers,
      signal: controller.signal
    });

    // Fallback for Beeceptor mock endpoints defined without /api/ prefix or at root
    if (res.status === 404 && cleanPath.startsWith('/api/')) {
      const fallbackPath = cleanPath.replace('/api/', '/');
      const fallbackUrl = `${rawHost}${fallbackPath}`;
      try {
        const altRes = await fetch(fallbackUrl, { ...options, headers, signal: controller.signal });
        if (altRes.ok) {
          clearTimeout(timeoutId);
          return altRes;
        }
      } catch {}
    }

    clearTimeout(timeoutId);
    return res;
  } catch (err: any) {
    clearTimeout(timeoutId);
    throw err;
  }
}

/**
 * Tests connection to the Aperture RFID / Beeceptor mock server.
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
  let testUrl = `${baseUrl}/api/GetHistoryTotalCount`;

  if (baseUrl.toLowerCase().includes('/gethistorytotalcount') || baseUrl.toLowerCase().includes('/gettagsinrealtime')) {
    testUrl = baseUrl;
  }

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
    let res = await fetch(testUrl, { method: 'GET', headers, signal: controller.signal });
    if (res.status === 404) {
      // Try alternative real-time or root mock endpoint
      try {
        const altRes = await fetch(`${baseUrl}/GetTagsInRealtime`, { method: 'GET', headers, signal: controller.signal });
        if (altRes.ok) res = altRes;
      } catch {}
    }
    clearTimeout(timeout);

    if (res.ok) {
      await upsertDoc('settings', {
        id: 'aperture_config',
        ...currentConfig,
        host,
        lastSuccessfulSync: new Date().toISOString(),
        lastError: null
      });

      return {
        status: 'CONNECTED',
        provider: 'Aperture RFID',
        responseCode: res.status,
        checkedAt: new Date().toISOString(),
        message: 'Successfully connected to Aperture RFID / Beeceptor mock API server.'
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
      errMsg = 'Aperture RFID / Beeceptor server is unreachable or offline';
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
 * Performs Real-Time Tag Sync from Aperture / Beeceptor Mock API:
 * 1. GET /api/GetTagsInRealtime
 * 2. Parses RFID JSON array/object
 * 3. Stores raw events in MongoDB 'rfid_realtime_events' and 'real_time_tags'
 * 4. Matches TagID with personnel / registered_people
 * 5. Updates people currentZone and lastSeen
 * 6. Broadcasts updates via SSE and WebSockets
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
    let tagArray: any[] = [];

    if (Array.isArray(data)) {
      tagArray = data;
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data.tags)) tagArray = data.tags;
      else if (Array.isArray(data.data)) tagArray = data.data;
      else if (Array.isArray(data.events)) tagArray = data.events;
      else if (Array.isArray(data.records)) tagArray = data.records;
      else if (Array.isArray(data.items)) tagArray = data.items;
      else if (Array.isArray(data.payload)) tagArray = data.payload;
      else if (Array.isArray(data.result)) tagArray = data.result;
      else if (data.TagID || data.tagId || data.epc) tagArray = [data];
    }

    if (!Array.isArray(tagArray) || tagArray.length === 0) {
      return { success: true, processedCount: 0, tags: [] };
    }

    // Perform MongoDB bulk write for rfid_realtime_events and real_time_tags
    await bulkWriteRfidRealtimeEvents(tagArray, 'Beeceptor/Aperture API');

    // Load registered people and locations for matching
    const peopleList = await getCollectionDocs('personnel') || await getCollectionDocs('registered_people') || [];
    const locationsList = await getCollectionDocs('locations') || [];

    const nowIso = new Date().toISOString();

    for (const item of tagArray) {
      if (!item || (!item.TagID && !item.tagId && !item.epc && !item.id)) continue;

      const tagId = String(item.TagID || item.tagId || item.epc || item.id);
      const rawLocation = String(item.Location || item.location || item.LocationName || item.zone || 'Zone1');
      const timestamp = item.Timestamp || item.timestamp || item.EnterTime || nowIso;

      // 1. Store raw event in MongoDB rfid_realtime_events
      const rawEventDoc = {
        id: `evt_${Date.now()}_${tagId}`,
        TagID: tagId,
        Timestamp: timestamp,
        Location: rawLocation,
        FirstName: item.FirstName || item.firstName || 'Staff',
        LastName: item.LastName || item.lastName || 'User',
        source: 'Beeceptor/Aperture Mock API',
        receivedAt: nowIso
      };
      await upsertDoc('rfid_realtime_events', rawEventDoc);

      // 2. Match TagID with personnel / registered_people
      const matchedPerson = peopleList.find((p: any) => p.tagId === tagId || p.TagID === tagId || p.badgeId === tagId || p.id === tagId);

      if (matchedPerson) {
        const matchedLocation = locationsList.find((loc: any) => loc.name === rawLocation || loc.id === rawLocation);
        const resolvedLocationName = matchedLocation ? matchedLocation.name : rawLocation;

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

      // Store in live_tags / real_time_tags / tag_history in MongoDB
      const tagDoc = {
        id: tagId,
        TagID: tagId,
        Timestamp: timestamp,
        Location: rawLocation,
        FirstName: item.FirstName || item.firstName || matchedPerson?.firstName || 'Staff',
        LastName: item.LastName || item.lastName || matchedPerson?.lastName || 'User',
        lastSyncAt: nowIso
      };
      await upsertDoc('real_time_tags', tagDoc);
      await upsertDoc('live_tags', tagDoc);
      await upsertDoc('tag_history', { ...tagDoc, id: `hist_${tagId}_${Date.now()}`, EnterTime: timestamp });

      // Broadcast update through SSE & WebSockets
      broadcastSseEvent('rfid_scan', tagDoc);
      broadcastSseEvent('tag_update', tagDoc);
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
 * Performs History Data Syncing from Aperture / Beeceptor API:
 * Stores fetched records in MongoDB 'rfid_history' and 'tag_history'.
 */
export async function syncApertureHistory(skipCount: number = 0, takeCount: number = 200): Promise<{
  success: boolean;
  totalCount: number;
  recordsFetched: number;
  error?: string;
}> {
  const safeTake = Math.min(Math.max(1, takeCount), 200);

  try {
    const countRes = await makeApertureRequest('/api/GetHistoryTotalCount');
    let totalCount = 0;
    if (countRes.ok) {
      const countData = await countRes.json();
      totalCount = typeof countData === 'number' ? countData : (countData.totalCount || countData.count || 0);
    }

    const recordsRes = await makeApertureRequest(`/api/GetHistoryRecords/${skipCount}/${safeTake}`);
    if (!recordsRes.ok) {
      const errText = `Failed GET /api/GetHistoryRecords/${skipCount}/${safeTake} with status ${recordsRes.status}`;
      await updateLastError(errText);
      return { success: false, totalCount, recordsFetched: 0, error: errText };
    }

    const recordsData = await recordsRes.json();
    let recordsArray: any[] = [];
    if (Array.isArray(recordsData)) {
      recordsArray = recordsData;
    } else if (recordsData && typeof recordsData === 'object') {
      recordsArray = recordsData.records || recordsData.data || recordsData.events || recordsData.items || [recordsData];
    }

    const nowIso = new Date().toISOString();

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

/**
 * Background auto-sync job for pulling real-time RFID tag events from Beeceptor / Aperture Mock API
 */
let autoSyncTimer: any = null;

export function startApertureAutoSyncJob(intervalSeconds: number = 10) {
  if (autoSyncTimer) return;

  console.log(`[Aperture Service] Starting periodic auto-sync background job (Interval: ${intervalSeconds}s)`);

  const runSync = async () => {
    try {
      const config = await getApertureConfig();
      if (config.realTimeSyncActive && config.host) {
        await syncApertureRealtimeTags();
      }
    } catch (err: any) {
      console.warn('[Aperture Service] Auto-sync tick warning:', err?.message || err);
    }
  };

  setTimeout(runSync, 3000);
  autoSyncTimer = setInterval(runSync, intervalSeconds * 1000);
}

