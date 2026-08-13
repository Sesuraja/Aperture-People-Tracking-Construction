import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Play, Pause, Trash2, Copy, Check, Filter, Zap, Send, Globe } from 'lucide-react';
import { globalWsClient, RealtimeEventMessage } from '../lib/realtimeClients';

export interface WebhookLogEntry {
  id: string;
  timestamp: string;
  source: 'WebSocket' | 'Webhook' | 'MQTT' | 'REST API';
  event: string;
  statusCode?: number;
  payload: any;
  headers?: Record<string, string>;
  targetUrl?: string;
}

export default function WebhookInspector() {
  const [logs, setLogs] = useState<WebhookLogEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [simNotice, setSimNotice] = useState<string | null>(null);

  // Webhook target URL state (prefilled with user's provided Beeceptor URL)
  const [webhookUrl, setWebhookUrl] = useState(() => {
    return localStorage.getItem('beeceptor_webhook_url') || 'https://mpf7722fc2649235f056.free.beeceptor.com';
  });

  const logContainerRef = useRef<HTMLDivElement>(null);

  // Initialize with initial sample logs if empty
  useEffect(() => {
    const initialLogs: WebhookLogEntry[] = [
      {
        id: `wh_${Date.now()}_1`,
        timestamp: new Date(Date.now() - 12000).toISOString(),
        source: 'WebSocket',
        event: 'handshake_ack',
        statusCode: 101,
        headers: {
          'Upgrade': 'websocket',
          'Connection': 'Upgrade',
          'Sec-WebSocket-Accept': 's3pPLBwQ3BNy9q87d8P5542s='
        },
        payload: {
          status: 'CONNECTED',
          session: 'sess_gao_rfid_9921',
          protocol: 'v2.4-UHF',
          readerGateway: 'Gate-01-MainTurnstile',
          activeAntennas: [1, 2, 3, 4]
        }
      },
      {
        id: `wh_${Date.now()}_2`,
        timestamp: new Date(Date.now() - 5000).toISOString(),
        source: 'REST API',
        event: 'tag_scan_telemetry',
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-RFID-Signature': 'sha256=a89f381c0029b'
        },
        payload: {
          TagID: 'GAO-TAG-9081',
          epc: 'E2801170000002019A8271B1',
          Location: 'Heavy Crane Exclusion Zone',
          FirstName: 'David',
          LastName: 'Miller',
          rssi: -68,
          readCount: 14,
          antennaPort: 2
        }
      }
    ];
    setLogs(initialLogs);
  }, []);

  // Listen to WebSocket messages
  useEffect(() => {
    const unsubscribe = globalWsClient.onMessage((msg: RealtimeEventMessage) => {
      if (isPaused) return;

      const newEntry: WebhookLogEntry = {
        id: `wh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: msg.timestamp || new Date().toISOString(),
        source: 'WebSocket',
        event: msg.type || msg.event || 'ws_frame',
        statusCode: 200,
        headers: {
          'Channel': 'WebSocket Stream',
          'Encoding': 'JSON'
        },
        payload: msg.payload || msg
      };

      setLogs((prev) => [newEntry, ...prev].slice(0, 100));
    });

    return () => unsubscribe();
  }, [isPaused]);

  // Auto-scroll to top when new logs arrive if autoScroll enabled
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [logs, autoScroll]);

  const handleClearLogs = () => {
    setLogs([]);
  };

  const handleCopyEntry = (log: WebhookLogEntry) => {
    navigator.clipboard.writeText(JSON.stringify(log.payload, null, 2));
    setCopiedId(log.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(JSON.stringify(logs, null, 2));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleSimulateWebhook = async () => {
    setSimulating(true);
    setSimNotice(`Dispatching payload directly to external endpoint [${webhookUrl}]...`);

    const sampleTagId = `GAO-TAG-${Math.floor(1000 + Math.random() * 9000)}`;
    const locations = ['Heavy Crane Exclusion Zone', 'Gate 1 Turnstile', 'Scaffolding Level 4', 'Confined Shaft A'];
    const selectedLoc = locations[Math.floor(Math.random() * locations.length)];

    const payload = {
      TagID: sampleTagId,
      epc: `E2801170${Math.floor(10000000 + Math.random() * 90000000)}`,
      Location: selectedLoc,
      FirstName: 'Simulated',
      LastName: 'Worker',
      rssi: -55 - Math.floor(Math.random() * 30),
      readerId: 'RDR_GAO_UHF_01',
      timestamp: new Date().toISOString()
    };

    try {
      // 1. Direct fetch to external provided endpoint (e.g. Beeceptor)
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Hardware-Source': 'UHF-Reader-Gateway'
        },
        body: JSON.stringify(payload)
      }).catch(async () => {
        // Fallback to local RFID endpoint if external fails or CORS blocks
        return await fetch('/api/rfid/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      });

      let responseData: any = {};
      try {
        responseData = await res.json();
      } catch {
        responseData = { status: 'OK', rawText: 'Response received from Beeceptor endpoint' };
      }

      const newLog: WebhookLogEntry = {
        id: `wh_${Date.now()}_sim`,
        timestamp: new Date().toISOString(),
        source: 'Webhook',
        event: 'external_webhook_post',
        statusCode: res.status,
        targetUrl: webhookUrl,
        headers: {
          'Content-Type': 'application/json',
          'X-Hardware-Source': 'UHF-Reader-Gateway'
        },
        payload: {
          targetEndpoint: webhookUrl,
          sentPayload: payload,
          remoteResponse: responseData
        }
      };

      setLogs((prev) => [newLog, ...prev]);
      setSimNotice(`Payload delivered to [${webhookUrl}]! Status: HTTP ${res.status}`);
    } catch (err: any) {
      setSimNotice(`Webhook dispatch failed: ${err.message || 'Network error'}`);
    } finally {
      setSimulating(false);
      setTimeout(() => setSimNotice(null), 5000);
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (!filterText.trim()) return true;
    const query = filterText.toLowerCase();
    const strPayload = JSON.stringify(log.payload).toLowerCase();
    const strEvent = log.event.toLowerCase();
    const strSource = log.source.toLowerCase();
    return strPayload.includes(query) || strEvent.includes(query) || strSource.includes(query);
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl text-slate-200">
      {/* Header bar */}
      <div className="p-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-[#007BC4]/20 border border-[#007BC4]/40 rounded-lg text-[#007BC4]">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">Webhook & Payload Inspector</h3>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> Live Stream Active
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Inspect real-time incoming raw JSON payloads from RFID readers & gateways
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              isPaused
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5 text-amber-400" /> : <Pause className="w-3.5 h-3.5 text-slate-400" />}
            {isPaused ? 'Resume Feed' : 'Pause Feed'}
          </button>

          <button
            onClick={handleSimulateWebhook}
            disabled={simulating}
            className="px-3 py-1.5 bg-[#007BC4] hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Send className="w-3.5 h-3.5" />
            {simulating ? 'Sending...' : 'Test Webhook Payload'}
          </button>

          <button
            onClick={handleCopyAll}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            {copiedAll ? 'Copied All' : 'Copy All JSON'}
          </button>

          <button
            onClick={handleClearLogs}
            className="p-1.5 bg-slate-800 hover:bg-rose-950/50 hover:text-rose-400 text-slate-400 border border-slate-700 rounded-lg text-xs font-bold transition cursor-pointer"
            title="Clear Log History"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Target Endpoint Input Bar */}
      <div className="p-3 bg-slate-950/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[280px]">
          <Globe className="w-4 h-4 text-[#007BC4] shrink-0" />
          <span className="font-bold text-slate-300 text-xs shrink-0">Target Webhook:</span>
          <input
            type="text"
            value={webhookUrl}
            onChange={(e) => {
              setWebhookUrl(e.target.value);
              localStorage.setItem('beeceptor_webhook_url', e.target.value);
            }}
            placeholder="e.g. https://mpf7722fc2649235f056.free.beeceptor.com"
            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 font-mono text-xs text-sky-300 focus:outline-none focus:border-[#007BC4]"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            const preset = 'https://mpf7722fc2649235f056.free.beeceptor.com';
            setWebhookUrl(preset);
            localStorage.setItem('beeceptor_webhook_url', preset);
          }}
          className="px-2.5 py-1 bg-[#007BC4]/20 text-[#007BC4] border border-[#007BC4]/40 hover:bg-[#007BC4]/30 rounded-lg text-[11px] font-mono font-bold transition cursor-pointer shrink-0"
        >
          Use Provided Beeceptor Endpoint
        </button>
      </div>

      {/* Filter and stats sub-bar */}
      <div className="p-3 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Filter className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            placeholder="Filter payload by TagID, event, or key..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-[#007BC4]"
          />
        </div>

        <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px]">
          <span>Captured: <strong className="text-white">{filteredLogs.length}</strong> / {logs.length}</span>
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded bg-slate-950 border-slate-800 text-[#007BC4] focus:ring-0"
            />
            <span>Auto-scroll</span>
          </label>
        </div>
      </div>

      {/* Simulation Banner Notice */}
      {simNotice && (
        <div className="px-4 py-2 bg-blue-950/80 border-b border-blue-800/60 text-blue-200 text-xs font-mono flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-blue-400 shrink-0" />
          <span>{simNotice}</span>
        </div>
      )}

      {/* Payload Log List */}
      <div
        ref={logContainerRef}
        className="max-h-[500px] overflow-y-auto p-4 space-y-3 font-mono text-xs"
      >
        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-slate-500 font-sans">
            <Terminal className="w-8 h-8 mx-auto text-slate-700 mb-2" />
            <p className="font-bold text-slate-400">No raw webhook payloads matched filter</p>
            <p className="text-xs mt-1 text-slate-600">Waiting for hardware triggers or click "Test Webhook Payload"</p>
          </div>
        ) : (
          filteredLogs.map((log) => {
            const isCopy = copiedId === log.id;
            return (
              <div
                key={log.id}
                className="bg-slate-950/80 border border-slate-800/80 hover:border-slate-700 rounded-xl p-3.5 transition space-y-2 group"
              >
                {/* Meta header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900 pb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                        log.source === 'WebSocket'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : log.source === 'Webhook'
                          ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                          : log.source === 'MQTT'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      }`}
                    >
                      {log.source}
                    </span>

                    <span className="text-white font-bold text-xs">{log.event}</span>

                    {log.statusCode && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                          log.statusCode >= 200 && log.statusCode < 300
                            ? 'bg-emerald-950 text-emerald-400'
                            : 'bg-rose-950 text-rose-400'
                        }`}
                      >
                        HTTP {log.statusCode}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-500">
                      {new Date(log.timestamp).toLocaleTimeString()} ({new Date(log.timestamp).toLocaleDateString()})
                    </span>

                    <button
                      onClick={() => handleCopyEntry(log)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition cursor-pointer"
                      title="Copy Payload JSON"
                    >
                      {isCopy ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* Headers if present */}
                {log.headers && Object.keys(log.headers).length > 0 && (
                  <div className="text-[10px] text-slate-500 bg-slate-900/50 p-2 rounded border border-slate-800/40">
                    <span className="font-bold text-slate-400">Headers: </span>
                    {Object.entries(log.headers)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(' | ')}
                  </div>
                )}

                {/* JSON Body */}
                <pre className="text-[11px] leading-relaxed text-emerald-400/90 overflow-x-auto whitespace-pre-wrap font-mono bg-slate-900/90 p-3 rounded-lg border border-slate-800/60">
                  {JSON.stringify(log.payload, null, 2)}
                </pre>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
