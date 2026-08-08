import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getCollectionDocs, upsertDoc, logAuditEvent } from '../services/db.js';
import { broadcastSseEvent } from '../services/sse.js';
import { broadcastWebSocketEvent } from '../services/websocket.js';

export const rfidRouter = Router();

const scanSchema = z.object({
  tagId: z.string().min(1, 'tagId is required'),
  name: z.string().optional().default('Unassigned Worker'),
  role: z.string().optional().default('General Construction'),
  zone: z.string().optional().default('Portal Sector West'),
  status: z.string().optional().default('Active'),
  epc: z.string().optional(),
  rssi: z.number().optional().default(-62)
});

// GET /api/GetTagsInRealtime or /api/rfid/realtime
const handleGetRealtime = async (req: Request, res: Response) => {
  try {
    const liveTags = await getCollectionDocs('live_tags');
    if (liveTags && liveTags.length > 0) {
      return res.json(liveTags);
    }

    // Default mock live tags
    const defaults = [
      { id: 'TAG_01', epc: 'E28011606000001', name: 'Marcus Vance', role: 'Site Engineer', zone: 'Zone A - Main Tower (L12)', rssi: -58, lastSeen: new Date().toISOString(), status: 'Active' },
      { id: 'TAG_02', epc: 'E28011606000002', name: 'Elena Rostova', role: 'Safety Inspector', zone: 'Zone B - Scaffolding', rssi: -64, lastSeen: new Date().toISOString(), status: 'Active' },
      { id: 'TAG_03', epc: 'E28011606000003', name: 'David Chen', role: 'Heavy Equipment Op', zone: 'Zone C - Excavation', rssi: -71, lastSeen: new Date().toISOString(), status: 'Active' }
    ];
    return res.json(defaults);
  } catch (err: any) {
    console.error('[RFID Route] Realtime tags error:', err);
    return res.status(500).json({ error: 'Failed to fetch realtime tags' });
  }
};

rfidRouter.get('/realtime', handleGetRealtime);
rfidRouter.get('/GetTagsInRealtime', handleGetRealtime);

// GET /api/GetHistoryRecords/:skip/:take or /api/rfid/history
const handleGetHistory = async (req: Request, res: Response) => {
  const skip = parseInt((req.params as any).skip || (req.query as any).skip || '0', 10);
  const take = parseInt((req.params as any).take || (req.query as any).take || '50', 10);

  try {
    const history = await getCollectionDocs('tag_history');
    const sorted = history.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
    const paginated = sorted.slice(skip, skip + take);

    return res.json(paginated);
  } catch (err: any) {
    console.error('[RFID Route] History records error:', err);
    return res.status(500).json({ error: 'Failed to fetch history records' });
  }
};

rfidRouter.get('/history', handleGetHistory);
rfidRouter.get('/GetHistoryRecords/:skip/:take', handleGetHistory);
rfidRouter.get('/GetHistoryRecords', handleGetHistory);

// GET /api/GetHistoryTotalCount or /api/rfid/history/count
const handleGetTotalCount = async (req: Request, res: Response) => {
  try {
    const history = await getCollectionDocs('tag_history');
    return res.json({ totalCount: history.length, count: history.length });
  } catch (err: any) {
    console.error('[RFID Route] History count error:', err);
    return res.status(500).json({ error: 'Failed to fetch history count' });
  }
};

rfidRouter.get('/history/count', handleGetTotalCount);
rfidRouter.get('/GetHistoryTotalCount', handleGetTotalCount);

// POST /api/rfid/scan
rfidRouter.post('/scan', async (req: Request, res: Response) => {
  const parseResult = scanSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid RFID scan data',
      details: parseResult.error.issues
    });
  }

  const data = parseResult.data;
  const timestamp = new Date().toISOString();

  try {
    const scanRecord = {
      id: `scan_${Date.now()}_${data.tagId}`,
      tagId: data.tagId,
      epc: data.epc || `E2801160${data.tagId}`,
      name: data.name,
      role: data.role,
      zone: data.zone,
      status: data.status,
      rssi: data.rssi,
      timestamp
    };

    // Update live tag state
    await upsertDoc('live_tags', {
      id: data.tagId,
      epc: scanRecord.epc,
      name: data.name,
      role: data.role,
      zone: data.zone,
      status: data.status,
      rssi: data.rssi,
      lastSeen: timestamp
    });

    // Record history
    await upsertDoc('tag_history', scanRecord);

    // Broadcast SSE & WebSocket real-time events to subscribers
    broadcastSseEvent('rfid_scan', {
      type: 'rfid_scan',
      record: scanRecord,
      timestamp
    });

    broadcastWebSocketEvent('tag_update', {
      type: 'tag_update',
      record: scanRecord,
      timestamp
    });

    await logAuditEvent({
      action: 'RFID_SCAN_EVENT',
      resource: 'rfid',
      details: { tagId: data.tagId, worker: data.name, zone: data.zone },
      ip: req.ip
    });

    return res.json({
      message: 'Scan recorded successfully',
      scanRecord
    });
  } catch (err: any) {
    console.error('[RFID Route] Scan post error:', err);
    return res.status(500).json({ error: 'Failed to record RFID scan' });
  }
});
