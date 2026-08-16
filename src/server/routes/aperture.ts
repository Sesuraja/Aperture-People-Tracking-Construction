import { Router, Request, Response } from 'express';
import { getMaskedGaoConfig, saveGaoConfig, getSecureGaoConfig } from '../services/gaoConfig.js';
import { gaoRfidClient } from '../services/gaoRfidClient.js';
import { rfidPollingService } from '../services/rfidPollingService.js';
import { syncApertureHistory } from '../services/apertureClient.js';
import { inspectApiKeyData, extractAndIngestAllFromApiKey } from '../services/apiKeyDataExtractor.js';
import { bulkWriteRfidRealtimeEvents, getCollectionDocs } from '../services/db.js';
import { broadcastSseEvent } from '../services/sse.js';
import { broadcastWebSocketEvent } from '../services/websocket.js';
import { processTelemetryWithAI } from '../services/aiPipeline.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const apertureRouter = Router();

/**
 * GET /api/integrations/gao/config (or /api/integrations/aperture/config)
 * Returns current configuration status and masked API key. NEVER exposes the raw API key.
 */
const handleGetConfig = async (req: Request, res: Response) => {
  try {
    const config = await getMaskedGaoConfig();
    const secureConfig = await getSecureGaoConfig();
    const keyInspection = inspectApiKeyData(secureConfig.apiKey);

    return res.json({
      success: true,
      status: config.apiKeyConfigured ? 'CONNECTED' : 'NOT_CONFIGURED',
      provider: 'GAO RFID',
      keyInspection: {
        isDecoded: keyInspection.isDecoded,
        format: keyInspection.format,
        extractedEntities: keyInspection.extractedEntities
      },
      ...config
    });
  } catch (err: any) {
    console.error('[GAO RFID Router] Get config error:', err);
    return res.status(500).json({ error: 'Failed to retrieve GAO RFID configuration' });
  }
};

apertureRouter.get('/config', requireAuth, handleGetConfig);
apertureRouter.get('/status', requireAuth, handleGetConfig);

/**
 * POST /api/integrations/gao/config
 * Saves host & API key securely on backend MongoDB settings, extracts data from API key,
 * and synchronizes live RFID data into MongoDB collections. Admin-only.
 */
apertureRouter.post('/config', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const {
      host,
      apiKey,
      authHeaderType,
      customHeaderName,
      pollingIntervalSeconds,
      pollingEnabled,
      requestTimeoutMs,
      realTimeSyncActive,
      historySyncActive
    } = req.body || {};

    const result = await saveGaoConfig({
      host,
      apiKey,
      authHeaderType,
      customHeaderName,
      pollingIntervalSeconds,
      pollingEnabled,
      requestTimeoutMs,
      realTimeSyncActive,
      historySyncActive
    });

    if (pollingIntervalSeconds) {
      rfidPollingService.setPollingInterval(Number(pollingIntervalSeconds));
    }

    // If API key is provided or configured, immediately extract and ingest data into MongoDB
    let extractionSummary = null;
    if (apiKey && apiKey.trim()) {
      try {
        extractionSummary = await extractAndIngestAllFromApiKey(apiKey.trim());
      } catch (err: any) {
        console.warn('[GAO Config] Key extraction notice:', err?.message || err);
      }
    }

    return res.json({
      success: true,
      provider: 'GAO RFID',
      extractionSummary,
      ...result
    });
  } catch (err: any) {
    console.error('[GAO RFID Router] Save config error:', err);
    return res.status(500).json({ error: 'Failed to save GAO RFID configuration to MongoDB' });
  }
});

/**
 * POST /api/integrations/gao/extract-key-data
 * Decodes data from the API key AND uses the API key to fetch all data from GAO RFID API,
 * storing all records directly into MongoDB. Admin-only.
 */
apertureRouter.post('/extract-key-data', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { apiKey } = req.body || {};
    const extractionResult = await extractAndIngestAllFromApiKey(apiKey);
    return res.json({
      success: true,
      message: `Extracted & stored ${extractionResult.totalMongoRecordsSaved} record(s) in MongoDB across collections: ${extractionResult.collectionsUpdated.join(', ')}`,
      result: extractionResult
    });
  } catch (err: any) {
    console.error('[GAO RFID Router] Key data extraction error:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to extract data from API key'
    });
  }
});

/**
 * GET /api/integrations/gao/key-info
 * Returns inspection details of currently saved API key and MongoDB count summary
 */
apertureRouter.get('/key-info', requireAuth, async (req: Request, res: Response) => {
  try {
    const config = await getSecureGaoConfig();
    const keyInspection = inspectApiKeyData(config.apiKey);
    
    // Get live counts from MongoDB collections
    const liveTags = await getCollectionDocs('live_tags');
    const historyDocs = await getCollectionDocs('rfid_history');
    const peopleDocs = await getCollectionDocs('registered_people');
    const locationDocs = await getCollectionDocs('locations');

    return res.json({
      success: true,
      apiKeyConfigured: Boolean(config.apiKey),
      apiKeyMasked: config.apiKeyMasked,
      keyInspection,
      mongoCounts: {
        liveTags: liveTags.length,
        historyRecords: historyDocs.length,
        registeredPeople: peopleDocs.length,
        locations: locationDocs.length
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/integrations/gao/test
 * Tests connection using stored credentials or provided overrides. Admin-only.
 */
apertureRouter.post('/test', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { host, apiKey, authHeaderType, customHeaderName } = req.body || {};
    const result = await gaoRfidClient.testConnection({
      host,
      apiKey,
      authHeaderType,
      customHeaderName
    });

    return res.json({
      status: result.status.toLowerCase() === 'connected' ? 'connected' : result.status,
      provider: result.provider,
      responseCode: result.responseCode || (result.status === 'CONNECTED' ? 200 : 500),
      latencyMs: result.latencyMs,
      checkedAt: result.checkedAt,
      message: result.message
    });
  } catch (err: any) {
    console.error('[GAO RFID Router] Test connection error:', err);
    return res.status(500).json({
      status: 'UNKNOWN_ERROR',
      provider: 'GAO RFID',
      responseCode: 500,
      checkedAt: new Date().toISOString(),
      message: err.message || 'Error executing connection test'
    });
  }
});

/**
 * POST /api/integrations/gao/sync-realtime
 * Triggers manual real-time tags sync and unique event ingestion. Admin-only.
 */
apertureRouter.post('/sync-realtime', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const result = await rfidPollingService.pollOnce();
    return res.json({
      success: result.success,
      processedCount: result.newUniqueEventsStored,
      totalFetched: result.totalFetched,
      activeTagsCount: result.activeTagsCount,
      timestamp: result.timestamp,
      error: result.error
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Real-time sync failed' });
  }
});

/**
 * POST /api/integrations/gao/sync-history
 * Triggers manual history records sync from GAO RFID API server. Admin-only.
 */
apertureRouter.post('/sync-history', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const skipCount = Number(req.body?.skipCount || 0);
    const takeCount = Number(req.body?.takeCount || 200);
    const result = await syncApertureHistory(skipCount, takeCount);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'History sync failed' });
  }
});

/**
 * GET /api/integrations/gao/polling/status
 * Returns real-time diagnostics of the background polling service.
 */
apertureRouter.get('/polling/status', requireAuth, (req: Request, res: Response) => {
  const status = rfidPollingService.getPollingStatus();
  return res.json({
    success: true,
    polling: status
  });
});

/**
 * POST /api/integrations/gao/polling/toggle
 * Starts or stops the background polling loop. Admin-only.
 */
apertureRouter.post('/polling/toggle', requireAuth, requireRole('admin'), (req: Request, res: Response) => {
  const { enable } = req.body || {};
  if (enable) {
    rfidPollingService.startPolling();
  } else {
    rfidPollingService.stopPolling();
  }
  return res.json({
    success: true,
    polling: rfidPollingService.getPollingStatus()
  });
});

/**
 * POST /api/integrations/gao/polling/interval
 * Configures the polling interval in seconds. Admin-only.
 */
apertureRouter.post('/polling/interval', requireAuth, requireRole('admin'), async (req: Request, res: Response) => {
  const intervalSeconds = Number(req.body?.intervalSeconds || 10);
  rfidPollingService.setPollingInterval(intervalSeconds);
  await saveGaoConfig({ pollingIntervalSeconds: intervalSeconds });

  return res.json({
    success: true,
    intervalSeconds,
    polling: rfidPollingService.getPollingStatus()
  });
});

/**
 * POST /api/integrations/gao/beeceptor-ingest (or webhook receiver)
 */
apertureRouter.post('/beeceptor-ingest', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    let rawEvents: any[] = [];

    if (Array.isArray(body)) {
      rawEvents = body;
    } else if (body && typeof body === 'object') {
      rawEvents = body.tags || body.data || body.events || body.records || body.items || [body];
    }

    if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
      return res.status(400).json({ error: 'Valid RFID event payload required.' });
    }

    // 1. Bulk write to MongoDB
    const result = await bulkWriteRfidRealtimeEvents(rawEvents, 'Beeceptor Ingest');

    // 2. Process all events through AI Telemetry Analysis Engine (stores to MongoDB + broadcasts to frontend)
    const aiResult = await processTelemetryWithAI(rawEvents, 'Beeceptor Ingest');

    // 3. Broadcast real-time notifications
    for (const evt of rawEvents) {
      const tagId = evt.TagID || evt.tagId || evt.epc || 'TAG_UNKNOWN';
      const loc = evt.Location || evt.LocationName || evt.zone || 'Zone1';
      broadcastSseEvent('rfid_scan', { type: 'rfid_scan', TagID: tagId, Location: loc, record: evt });
      broadcastWebSocketEvent('tag_update', { type: 'tag_update', TagID: tagId, Location: loc, record: evt });
    }

    return res.json({
      success: true,
      provider: 'GAO RFID API Webhook Ingest',
      message: `Successfully ingested and analyzed ${result.totalProcessed} RFID event(s) in MongoDB with AI Engine.`,
      result,
      aiAnalysis: {
        processedCount: aiResult.processedCount,
        analyzedResults: aiResult.analyzedResults
      }
    });
  } catch (err: any) {
    console.error('[GAO Router] Ingest error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to ingest RFID events' });
  }
});

apertureRouter.post('/ingest', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const rawEvents = Array.isArray(body) ? body : (body.tags || body.data || body.events || [body]);
    if (!Array.isArray(rawEvents) || rawEvents.length === 0) {
      return res.status(400).json({ error: 'Valid RFID event payload required.' });
    }

    const result = await bulkWriteRfidRealtimeEvents(rawEvents, 'Direct Ingest');
    const aiResult = await processTelemetryWithAI(rawEvents, 'Direct Ingest');

    return res.json({
      success: true,
      result,
      aiAnalysis: {
        processedCount: aiResult.processedCount,
        analyzedResults: aiResult.analyzedResults
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Ingest failed' });
  }
});
