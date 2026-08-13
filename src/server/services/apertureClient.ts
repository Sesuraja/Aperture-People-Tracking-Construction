import { getCollectionDocs, upsertDoc, getDocById, bulkWriteRfidRealtimeEvents } from './db.js';
import { broadcastSseEvent } from './sse.js';
import { broadcastWebSocketEvent } from './websocket.js';
import { processTelemetryWithAI } from './aiPipeline.js';

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

const DEFAULT_HOST = process.env.GAO_RFID_HOST || process.env.BEECEPTOR_MOCK_URL || process.env.APERTURE_RFID_HOST || 'https://www.i360services.com/peopletrackinguhf';
const DEFAULT_API_KEY = process.env.GAO_RFID_API_KEY || process.env.APERTURE_RFID_API_KEY || '';
const DEFAULT_AUTH_HEADER = (process.env.GAO_RFID_AUTH_HEADER as any) || 'X-API-Key';

/**
 * Gets the current Aperture configuration securely.
 * NEVER returns the raw API key to public callers, only masked.
 */
export async function getApertureConfig(): Promise<ApertureConfig> {
  const doc = await getDocById('settings', 'aperture_config');
  
  const host = doc?.host || DEFAULT_HOST;
  const apiKey = doc?.apiKey !== undefined ? doc.apiKey : DEFAULT_API_KEY;
  const authHeaderType = doc?.authHeaderType || DEFAULT_AUTH_HEADER;
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
 * Performs Real-Time Tag Sync from GAO RFID API:
 * 1. GET /api/GetTagsInRealtime
 * 2. Parses RFID JSON array/object
 * 3. Stores raw events in MongoDB 'rfid_realtime_events' BEFORE AI analysis
 * 4. Matches TagID with registered personnel
 * 5. Matches Location with zone metadata
 * 6. Updates people currentZone and lastSeen
 * 7. Recalculates zone occupancy based on unique active tags
 * 8. Broadcasts SSE events (TAG_LOCATION_UPDATE, rfid_scan, tag_update)
 * 9. Runs AI Engine analysis asynchronously without blocking raw RFID ingestion
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

    const nowIso = new Date().toISOString();

    // Fetch people & locations for tag and zone resolution
    const peopleDocs = [
      ...(await getCollectionDocs('people')),
      ...(await getCollectionDocs('registered_people')),
      ...(await getCollectionDocs('personnel'))
    ];
    const locationDocs = [
      ...(await getCollectionDocs('locations')),
      ...(await getCollectionDocs('zones'))
    ];

    const rawEventDocs: any[] = [];

    for (let i = 0; i < tagArray.length; i++) {
      const item = tagArray[i];
      if (!item) continue;

      const tagId = String(item.TagID || item.tagId || item.epc || item.id || `TAG_${Date.now()}_${i}`);
      const rawLocation = String(item.Location || item.location || item.LocationName || item.zone || 'Zone1');
      const rawTimestamp = item.Timestamp || item.timestamp || item.lastSeen || nowIso;

      let parsedDate = new Date(rawTimestamp);
      if (isNaN(parsedDate.getTime())) parsedDate = new Date();
      const utcTimestampIso = parsedDate.toISOString();

      // Tag -> Person matching
      const matchedPerson = peopleDocs.find(
        (p: any) => p.tagId === tagId || p.TagID === tagId || p.badgeId === tagId || p.id === tagId
      );

      const personId = matchedPerson ? (matchedPerson.id || matchedPerson.personId || null) : null;
      const personName = matchedPerson
        ? (matchedPerson.name || `${matchedPerson.firstName || ''} ${matchedPerson.lastName || ''}`.trim() || null)
        : (item.FirstName || item.FirstName ? `${item.FirstName || ''} ${item.LastName || ''}`.trim() : null);

      const unassignedTag = !matchedPerson;

      // Location matching
      const matchedLocation = locationDocs.find(
        (l: any) =>
          l.name?.toLowerCase() === rawLocation.toLowerCase() ||
          l.id?.toLowerCase() === rawLocation.toLowerCase() ||
          l.zoneName?.toLowerCase() === rawLocation.toLowerCase()
      );

      const locationId = matchedLocation ? (matchedLocation.id || matchedLocation.locationId || rawLocation) : null;
      const unresolvedLocation = !matchedLocation;

      const eventId = `RFID-EVT-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      const rawEventDoc = {
        id: eventId,
        tagId,
        personId,
        personName,
        unassignedTag,
        locationId,
        locationName: rawLocation,
        unresolvedLocation,
        timestamp: utcTimestampIso,
        source: 'GAO_RFID_API',
        processed: true,
        aiAnalyzed: false,
        createdAt: nowIso,
        rawPayload: {
          TagID: item.TagID || tagId,
          Timestamp: item.Timestamp || rawTimestamp,
          Location: item.Location || rawLocation
        }
      };

      rawEventDocs.push(rawEventDoc);

      // Save raw RFID event directly to MongoDB before AI analysis
      await upsertDoc('rfid_realtime_events', rawEventDoc);
      await upsertDoc('real_time_tags', {
        id: tagId,
        TagID: tagId,
        personId,
        personName,
        Location: rawLocation,
        Timestamp: utcTimestampIso,
        lastSeen: utcTimestampIso,
        unassignedTag
      });
      await upsertDoc('live_tags', {
        id: tagId,
        TagID: tagId,
        personId,
        personName,
        Location: rawLocation,
        Timestamp: utcTimestampIso,
        lastSeen: utcTimestampIso
      });

      // Update person currentZone and lastSeen
      if (matchedPerson && matchedPerson.id) {
        const updatedPersonDoc = {
          ...matchedPerson,
          currentZone: rawLocation,
          zone: rawLocation,
          lastSeen: utcTimestampIso,
          status: 'In-Zone',
          updatedAt: nowIso
        };
        await upsertDoc('people', updatedPersonDoc);
        await upsertDoc('registered_people', updatedPersonDoc);
        await upsertDoc('personnel', updatedPersonDoc);
      }

      // Broadcast SSE events
      const ssePayload = {
        type: 'TAG_LOCATION_UPDATE',
        personId,
        tagId,
        personName: personName || 'Unassigned Tag',
        zoneId: locationId || rawLocation,
        zoneName: rawLocation,
        timestamp: utcTimestampIso,
        eventId
      };
      broadcastSseEvent('TAG_LOCATION_UPDATE', ssePayload);
      broadcastSseEvent('rfid_scan', ssePayload);
      broadcastWebSocketEvent('tag_update', ssePayload);
    }

    // Recalculate unique occupancy per zone
    try {
      const allActiveTags = await getCollectionDocs('real_time_tags');
      const zoneCounts: Record<string, Set<string>> = {};

      for (const t of allActiveTags) {
        const zoneName = t.Location || t.locationName || 'Zone1';
        if (!zoneCounts[zoneName]) zoneCounts[zoneName] = new Set();
        zoneCounts[zoneName].add(t.TagID || t.tagId || t.id);
      }

      for (const loc of locationDocs) {
        if (!loc || !loc.id) continue;
        const locName = loc.name || loc.zoneName || loc.id;
        const uniqueOccupants = zoneCounts[locName] ? zoneCounts[locName].size : 0;

        await upsertDoc('locations', {
          ...loc,
          currentOccupancy: uniqueOccupants,
          updatedAt: nowIso
        });
      }
    } catch (e) {
      console.warn('[GAO RFID] Zone occupancy update warning:', e);
    }

    // AI Engine Analysis asynchronously (non-blocking)
    processTelemetryWithAI(tagArray, 'GAO RFID API').then(() => {
      for (const evt of rawEventDocs) {
        upsertDoc('rfid_realtime_events', { ...evt, aiAnalyzed: true }).catch(() => {});
      }
    }).catch((aiErr) => {
      console.warn('[GAO RFID] AI Engine analysis failed (RFID events safely stored):', aiErr?.message || aiErr);
    });

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
 * Performs History Data Syncing from GAO RFID API:
 * 1. GET /api/GetHistoryTotalCount
 * 2. GET /api/GetHistoryRecords/{skip}/{take}
 * 3. Normalizes EnterTime/EnterTimeStr and LeaveTime/LeaveTimeStr to UTC enterTime & leaveTime
 * 4. Stores fetched records in MongoDB 'rfid_history'
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
      const tagId = String(rec.TagID || rec.tagId || rec.epc || `REC_${Date.now()}`);

      const rawEnter = rec.EnterTime || rec.EnterTimeStr || rec.enterTime || rec.timestamp || nowIso;
      const rawLeave = rec.LeaveTime || rec.LeaveTimeStr || rec.leaveTime || rawEnter;

      let enterDate = new Date(rawEnter);
      if (isNaN(enterDate.getTime())) enterDate = new Date();

      let leaveDate = new Date(rawLeave);
      if (isNaN(leaveDate.getTime())) leaveDate = enterDate;

      const enterTimeUtc = enterDate.toISOString();
      const leaveTimeUtc = leaveDate.toISOString();

      const diffMs = Math.max(0, leaveDate.getTime() - enterDate.getTime());
      const durationHours = rec.Duration !== undefined ? Number(rec.Duration) : Math.round((diffMs / 3600000) * 10) / 10;

      const firstName = rec.FirstName || rec.firstName || 'John';
      const lastName = rec.LastName || rec.lastName || 'Smith';
      const locationName = rec.LocationName || rec.Location || rec.location || 'Zone1';

      const docId = rec.id || `HIST-${tagId}-${enterDate.getTime()}`;

      const historyDoc = {
        id: docId,
        tagId,
        TagID: tagId,
        personId: rec.personId || null,
        personName: `${firstName} ${lastName}`.trim(),
        FirstName: firstName,
        LastName: lastName,
        locationId: rec.locationId || locationName,
        locationName,
        LocationName: locationName,
        enterTime: enterTimeUtc,
        leaveTime: leaveTimeUtc,
        EnterTime: enterTimeUtc,
        LeaveTime: leaveTimeUtc,
        durationHours,
        Duration: durationHours,
        source: 'GAO_RFID_API',
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

