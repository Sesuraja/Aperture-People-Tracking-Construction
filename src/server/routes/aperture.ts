import { Router, Request, Response } from 'express';
import {
  getApertureConfig,
  saveApertureConfig,
  testApertureConnection,
  syncApertureRealtimeTags,
  syncApertureHistory
} from '../services/apertureClient.js';
import { bulkWriteRfidRealtimeEvents } from '../services/db.js';
import { broadcastSseEvent } from '../services/sse.js';
import { broadcastWebSocketEvent } from '../services/websocket.js';

export const apertureRouter = Router();

/**
 * GET /api/integrations/aperture/config
 * Returns current configuration status and masked API key. NEVER returns raw API key.
 */
const handleGetConfig = async (req: Request, res: Response) => {
  try {
    const config = await getApertureConfig();
    return res.json({
      success: true,
      status: config.apiKeyConfigured ? 'CONNECTED' : 'NOT_CONFIGURED',
      provider: 'GAO RFID',
      host: config.host,
      apiKeyConfigured: config.apiKeyConfigured,
      apiKeyMasked: config.apiKeyMasked,
      realTimeSyncActive: config.realTimeSyncActive,
      historySyncActive: config.historySyncActive,
      lastSuccessfulSync: config.lastSuccessfulSync,
      lastError: config.lastError
    });
  } catch (err: any) {
    console.error('[Aperture Router] Get config error:', err);
    return res.status(500).json({ error: 'Failed to retrieve GAO RFID configuration' });
  }
};

apertureRouter.get('/config', handleGetConfig);
apertureRouter.get('/status', handleGetConfig);

/**
 * POST /api/integrations/aperture/config
 * Request: { "host": "...", "apiKey": "..." }
 * Saves host & API key securely on backend. Returns masked key only.
 */
apertureRouter.post('/config', async (req: Request, res: Response) => {
  try {
    const { host, apiKey, authHeaderType } = req.body || {};

    const result = await saveApertureConfig({ host, apiKey, authHeaderType });

    return res.json({
      success: true,
      provider: 'Aperture RFID',
      apiKeyConfigured: result.apiKeyConfigured,
      apiKeyMasked: result.apiKeyMasked
    });
  } catch (err: any) {
    console.error('[Aperture Router] Save config error:', err);
    return res.status(500).json({ error: 'Failed to save Aperture RFID configuration' });
  }
});

/**
 * POST /api/integrations/aperture/test
 * Tests connection using stored credentials or provided overrides.
 */
apertureRouter.post('/test', async (req: Request, res: Response) => {
  try {
    const { host, apiKey } = req.body || {};
    const result = await testApertureConnection(host, apiKey);

    // Normalize status string to lowercase or UPPERCASE as expected by frontend
    return res.json({
      status: result.status.toLowerCase() === 'connected' ? 'connected' : result.status,
      provider: result.provider,
      responseCode: result.responseCode || (result.status === 'CONNECTED' ? 200 : 500),
      checkedAt: result.checkedAt,
      message: result.message
    });
  } catch (err: any) {
    console.error('[Aperture Router] Test connection error:', err);
    return res.status(500).json({
      status: 'UNKNOWN_ERROR',
      provider: 'Aperture RFID',
      responseCode: 500,
      checkedAt: new Date().toISOString(),
      message: err.message || 'Error executing connection test'
    });
  }
});

/**
 * POST /api/integrations/aperture/sync-realtime
 * Triggers manual real-time tags sync from Aperture server.
 */
apertureRouter.post('/sync-realtime', async (req: Request, res: Response) => {
  try {
    const result = await syncApertureRealtimeTags();
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Real-time sync failed' });
  }
});

/**
 * POST /api/integrations/aperture/sync-history
 * Triggers manual history records sync from Aperture server.
 */
apertureRouter.post('/sync-history', async (req: Request, res: Response) => {
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
 * POST /api/integrations/aperture/beeceptor-ingest
 * Direct endpoint for receiving returned RFID events from Beeceptor mock API testing or webhooks,
 * storing them into MongoDB collections.
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
      return res.status(400).json({ error: 'Valid RFID event payload (object or array) required.' });
    }

    const result = await bulkWriteRfidRealtimeEvents(rawEvents, 'Beeceptor Mock Ingest');

    // Broadcast SSE & WebSocket updates
    for (const evt of rawEvents) {
      const tagId = evt.TagID || evt.tagId || evt.epc || 'TAG_UNKNOWN';
      const loc = evt.Location || evt.LocationName || evt.zone || 'Zone1';
      broadcastSseEvent('rfid_scan', { type: 'rfid_scan', TagID: tagId, Location: loc, record: evt });
      broadcastWebSocketEvent('tag_update', { type: 'tag_update', TagID: tagId, Location: loc, record: evt });
    }

    return res.json({
      success: true,
      provider: 'Beeceptor Aperture Mock API',
      message: `Successfully ingested and stored ${result.totalProcessed} RFID event(s) in MongoDB.`,
      result
    });
  } catch (err: any) {
    console.error('[Aperture Router] Beeceptor ingest error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to ingest Beeceptor mock RFID events' });
  }
});

apertureRouter.post('/ingest', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const rawEvents = Array.isArray(body) ? body : (body.tags || body.data || body.events || [body]);
    const result = await bulkWriteRfidRealtimeEvents(rawEvents, 'Beeceptor Ingest');
    return res.json({ success: true, result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message || 'Ingest failed' });
  }
});

