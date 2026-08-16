/**
 * Centralized GAO RFID API & Configuration Adapter
 * Re-exports and integrates with gaoConfig, gaoRfidClient, and rfidPollingService.
 */

import { getSecureGaoConfig, getMaskedGaoConfig, saveGaoConfig, GaoApiConfig, MaskedGaoApiConfig } from './gaoConfig.js';
import { gaoRfidClient, GaoRfidClient, GaoRealtimeTagRaw, GaoHistoryRecordRaw } from './gaoRfidClient.js';
import { rfidPollingService, IngestionResult } from './rfidPollingService.js';
import { upsertDoc } from './db.js';

export type {
  GaoApiConfig as ApertureConfig,
  MaskedGaoApiConfig
};

export {
  getSecureGaoConfig as getApertureConfig,
  getMaskedGaoConfig,
  saveGaoConfig as saveApertureConfig,
  gaoRfidClient,
  GaoRfidClient,
  rfidPollingService
};

export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 4) return '••••••••••••';
  return '••••••••••••' + key.slice(-4);
}

/**
 * Direct request wrapper using centralized GaoRfidClient
 */
export async function makeApertureRequest(endpointPath: string, options: RequestInit = {}): Promise<Response> {
  return gaoRfidClient.makeRequest(endpointPath, options);
}

/**
 * Tests connection to GAO RFID server
 */
export async function testApertureConnection(
  overrideHost?: string,
  overrideApiKey?: string,
  overrideAuthHeaderType?: 'X-API-Key' | 'Bearer' | 'Custom',
  overrideCustomHeaderName?: string
) {
  return gaoRfidClient.testConnection({
    host: overrideHost,
    apiKey: overrideApiKey,
    authHeaderType: overrideAuthHeaderType,
    customHeaderName: overrideCustomHeaderName
  });
}

/**
 * Synchronizes real-time tags using the centralized ingestion pipeline
 */
export async function syncApertureRealtimeTags(): Promise<{
  success: boolean;
  processedCount: number;
  tags?: any[];
  error?: string;
}> {
  const res: IngestionResult = await rfidPollingService.pollOnce();
  return {
    success: res.success,
    processedCount: res.newUniqueEventsStored,
    tags: [],
    error: res.error
  };
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
  const safeTake = Math.min(Math.max(1, takeCount), 500);

  try {
    const totalCount = await gaoRfidClient.getHistoryTotalCount();
    const recordsArray: GaoHistoryRecordRaw[] = await gaoRfidClient.getHistoryRecords(skipCount, safeTake);

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
    return { success: false, totalCount: 0, recordsFetched: 0, error: errMsg };
  }
}

/**
 * Background auto-sync job
 */
export function startApertureAutoSyncJob(intervalSeconds: number = 10) {
  rfidPollingService.startPolling(intervalSeconds);
}
