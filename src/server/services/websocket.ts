import { WebSocketServer, WebSocket } from 'ws';
import { Server as HttpServer } from 'http';

export interface WSMessage {
  type: string;
  payload: any;
  timestamp?: string;
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
        serverTime: new Date().toISOString(),
        activeConnections: clients.size,
        message: 'Zero-latency worker safety & RFID tracking WebSocket active'
      }
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as WSMessage;
        handleIncomingWSMessage(ws, message);
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
    ws.send(JSON.stringify({ ...msg, timestamp: msg.timestamp || new Date().toISOString() }));
  }
}

function handleIncomingWSMessage(ws: WebSocket, msg: WSMessage) {
  switch (msg.type) {
    case 'ping':
      sendToClient(ws, { type: 'pong', payload: { time: Date.now() } });
      break;

    case 'subscribe':
      sendToClient(ws, { type: 'subscribed', payload: { channel: msg.payload?.channel || 'all' } });
      break;

    case 'acknowledge_alert':
      // Broadcast alert acknowledgment to all other clients in real time
      broadcastWebSocketEvent('alert_acknowledged', msg.payload);
      break;

    case 'trigger_safety_alert':
      // Broadcast emergency / panics / hazard breaches immediately
      broadcastWebSocketEvent('safety_alert', msg.payload);
      break;

    case 'tag_movement':
      // Broadcast tag position updates to all live tracking clients
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
    timestamp: new Date().toISOString()
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

  // console.log(`[WebSocket Broadcast] Sent '${type}' to ${activeCount} active client(s)`);
}

export function getActiveWSConnectionsCount(): number {
  return clients.size;
}
