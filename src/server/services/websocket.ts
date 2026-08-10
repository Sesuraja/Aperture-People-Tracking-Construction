import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';
import { getCollectionDocs, upsertDoc } from './db.js';
import { formatUtcDateTime, formatUtcTimestampMs } from '../routes/rfid.js';

export interface WSMessage {
  type: string;
  payload?: any;
  timestamp?: string;
  TagID?: string;
  Timestamp?: string;
  Location?: string;
  FirstName?: string;
  LastName?: string;
  LocationName?: string;
  EnterTime?: string;
  LeaveTime?: string;
  Duration?: number;
}

const clients = new Set<WebSocket>();
let wssInstance: WebSocketServer | null = null;

export function initWebSocketServer(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server, path: '/ws' });
  wssInstance = wss;

  console.log('[WebSocket Service] Server initialized on path /ws');

  wss.on('connection', (ws: WebSocket, req) => {
    clients.add(ws);
    const ip = req.socket.remoteAddress || 'unknown';
    console.log(`[WebSocket] Client connected from ${ip}. Total connections: ${clients.size}`);

    // Send welcome & initial handshake
    sendToClient(ws, {
      type: 'connection_established',
      payload: {
        status: 'connected',
        serverTime: formatUtcDateTime(),
        activeConnections: clients.size,
        message: 'GAO RFID People Tracking WebSocket active'
      }
    });

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString()) as WSMessage;
        await handleIncomingWSMessage(ws, message);
      } catch (err) {
        console.error('[WebSocket] Invalid JSON message received:', err);
      }
    });

    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[WebSocket] Client disconnected. Total connections: ${clients.size}`);
    });

    ws.on('error', (err) => {
      console.error('[WebSocket] Client socket error:', err);
      clients.delete(ws);
    });
  });

  // Heartbeat ping interval every 15s to keep connection alive across reverse proxies
  const heartbeatInterval = setInterval(() => {
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.ping();
        } catch {
          clients.delete(ws);
        }
      } else {
        clients.delete(ws);
      }
    }
  }, 15000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  return wss;
}

function sendToClient(ws: WebSocket, msg: WSMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ ...msg, timestamp: msg.timestamp || formatUtcDateTime() }));
  }
}

async function handleIncomingWSMessage(ws: WebSocket, msg: WSMessage) {
  const typeLower = (msg.type || '').toLowerCase();

  switch (typeLower) {
    case 'ping':
      sendToClient(ws, { type: 'pong', payload: { time: Date.now() } });
      break;

    case 'subscribe':
      sendToClient(ws, { type: 'subscribed', payload: { channel: msg.payload?.channel || 'all' } });
      break;

    case 'gettagsinrealtime':
    case 'get_realtime_tags':
    case 'get_tags_in_realtime': {
      const liveTags = await getCollectionDocs('live_tags');
      const formatted = liveTags.map((item: any) => ({
        TagID: item.TagID || item.tagId || item.epc || 'E28011606000020788842D31',
        Timestamp: formatUtcTimestampMs(item.Timestamp || item.timestamp || item.lastSeen),
        Location: item.Location || item.location || item.LocationName || item.zone || 'Zone1'
      })).sort((a, b) => new Date(b.Timestamp).getTime() - new Date(a.Timestamp).getTime());

      sendToClient(ws, {
        type: 'GetTagsInRealtime_response',
        payload: formatted
      });
      break;
    }

    case 'gethistoryrecords':
    case 'get_history_records':
    case 'get_history': {
      const skipCount = Number(msg.payload?.SkipCount || 0);
      const takeCount = Math.min(Number(msg.payload?.TakeCount || 50), 200);
      const history = await getCollectionDocs('tag_history');
      
      const formatted = history.map((item: any) => {
        const enter = item.EnterTime || item.EnterTimeStr || item.timestamp || new Date().toISOString();
        const leave = item.LeaveTime || item.LeaveTimeStr || new Date().toISOString();
        const enterStr = formatUtcDateTime(enter);
        const leaveStr = formatUtcDateTime(leave);
        const diffMs = Math.max(0, new Date(leaveStr).getTime() - new Date(enterStr).getTime());
        const duration = item.Duration !== undefined ? item.Duration : Math.round((diffMs / 3600000) * 10) / 10;

        return {
          TagID: item.TagID || item.tagId || item.epc || 'E28011606000020788842D31',
          FirstName: item.FirstName || item.firstName || 'John',
          LastName: item.LastName || item.lastName || 'Smith',
          LocationName: item.LocationName || item.locationName || item.zone || 'd6',
          EnterTime: enterStr,
          LeaveTime: leaveStr,
          EnterTimeStr: enterStr,
          LeaveTimeStr: leaveStr,
          Duration: duration
        };
      }).sort((a, b) => new Date(b.EnterTime).getTime() - new Date(a.EnterTime).getTime())
        .slice(skipCount, skipCount + takeCount);

      sendToClient(ws, {
        type: 'GetHistoryRecords_response',
        payload: formatted
      });
      break;
    }

    case 'gethistorytotalcount':
    case 'get_history_total_count': {
      const history = await getCollectionDocs('tag_history');
      sendToClient(ws, {
        type: 'GetHistoryTotalCount_response',
        payload: { totalCount: history.length, count: history.length }
      });
      break;
    }

    case 'report_tag_scan':
    case 'tag_scan': {
      const tagId = msg.TagID || msg.payload?.TagID || msg.payload?.tagId || 'E28011606000020788842D31';
      const location = msg.Location || msg.payload?.Location || msg.payload?.zone || 'Zone1';
      const firstName = msg.FirstName || msg.payload?.FirstName || 'John';
      const lastName = msg.LastName || msg.payload?.LastName || 'Smith';
      const now = new Date();
      const utcDateTimeStr = formatUtcDateTime(now);
      const utcTimestampMsStr = formatUtcTimestampMs(now);

      const newScan = {
        id: `scan_${Date.now()}_${tagId}`,
        TagID: tagId,
        Timestamp: utcTimestampMsStr,
        Location: location,
        FirstName: firstName,
        LastName: lastName,
        LocationName: location,
        EnterTime: utcDateTimeStr,
        EnterTimeStr: utcDateTimeStr,
        LeaveTime: utcDateTimeStr,
        LeaveTimeStr: utcDateTimeStr,
        Duration: 0.1
      };

      await upsertDoc('live_tags', newScan);
      await upsertDoc('tag_history', newScan);

      // Broadcast to all clients
      broadcastWebSocketEvent('tag_update', newScan);
      break;
    }

    case 'acknowledge_alert':
      broadcastWebSocketEvent('alert_acknowledged', msg.payload);
      break;

    case 'trigger_safety_alert':
      broadcastWebSocketEvent('safety_alert', msg.payload);
      break;

    case 'tag_movement':
      broadcastWebSocketEvent('tag_update', msg.payload);
      break;

    default:
      console.log(`[WebSocket] Received message type: ${msg.type}`);
  }
}

export function broadcastWebSocketEvent(type: string, payload: any): void {
  const messageString = JSON.stringify({
    type,
    payload,
    timestamp: formatUtcDateTime()
  });

  let activeCount = 0;
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(messageString);
        activeCount++;
      } catch (err) {
        console.error('[WebSocket] Failed to send message to client:', err);
        clients.delete(client);
      }
    } else {
      clients.delete(client);
    }
  }
}

export function getActiveWSConnectionsCount(): number {
  return clients.size;
}

