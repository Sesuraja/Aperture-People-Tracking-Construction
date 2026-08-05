import React, { useState, useEffect } from 'react';
import { Key, Webhook, Activity, ShieldAlert, BarChart, Plus, Copy, CheckCircle2, Database, Send, Play, Code2, Server, RefreshCw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const MOCK_KEYS = [
  { id: '1', name: 'HRMS Integration', prefix: 'pk_live_8f92', created: '2026-05-10', lastUsed: '10 mins ago', status: 'Active', usage: '45.2k reqs' },
  { id: '2', name: 'Building Mgmt (BMS)', prefix: 'pk_live_b2a1', created: '2026-04-22', lastUsed: '5 secs ago', status: 'Active', usage: '1.2M reqs' },
  { id: '3', name: 'ERP Legacy Sync', prefix: 'pk_live_c109', created: '2026-01-15', lastUsed: '2 days ago', status: 'Revoked', usage: '0 reqs' },
];

export default function DeveloperApiTab() {
  const [activeTab, setActiveTab] = useState<'tester' | 'keys' | 'docs' | 'stats'>('tester');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Live API Tester state
  const [method, setMethod] = useState<'GET' | 'POST' | 'DELETE'>('GET');
  const [endpoint, setEndpoint] = useState<string>('/api/data/devices');
  const [requestBody, setRequestBody] = useState<string>('{\n  "name": "New RFID Scanner Zone C",\n  "location": "Warehouse Entrance",\n  "mac": "00:1A:2B:99:88:77",\n  "status": "Online"\n}');
  const [apiResponse, setApiResponse] = useState<string>('Click "Send Request" to test live API response.');
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  // Backend Stats state
  const [serverStats, setServerStats] = useState<any>(null);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);

  const fetchBackendStats = async () => {
    setLoadingStats(true);
    try {
      const res = await fetch('/api/data/stats');
      if (res.ok) {
        const data = await res.json();
        setServerStats(data);
      }
    } catch (e) {
      console.warn('Failed to fetch backend stats:', e);
    } finally {
      setLoadingStats(false);
    }
  };

  useEffect(() => {
    fetchBackendStats();
  }, []);

  const handleSendApiRequest = async () => {
    setIsExecuting(true);
    setApiResponse('Sending API request to backend server...');
    setResponseStatus(null);
    try {
      const options: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      };

      if (method === 'POST') {
        options.body = requestBody;
      }

      const res = await fetch(endpoint, options);
      setResponseStatus(res.status);
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        setApiResponse(JSON.stringify(json, null, 2));
      } catch {
        setApiResponse(text);
      }
    } catch (err: any) {
      setResponseStatus(500);
      setApiResponse(JSON.stringify({ error: err.message || 'Network call failed' }, null, 2));
    } finally {
      setIsExecuting(false);
    }
  };

  const presetEndpoints = [
    { label: 'GET Devices List', method: 'GET', url: '/api/data/devices', body: '' },
    { label: 'GET Registered People', method: 'GET', url: '/api/data/registered_people', body: '' },
    { label: 'GET Live Visitors', method: 'GET', url: '/api/data/visitors', body: '' },
    { label: 'GET Real-time Tags', method: 'GET', url: '/api/rfid/realtime', body: '' },
    { label: 'GET RFID Scan History', method: 'GET', url: '/api/rfid/history', body: '' },
    { label: 'POST New RFID Scan Event', method: 'POST', url: '/api/rfid/scan', body: JSON.stringify({ tagId: "TAG_99", name: "Sarah Jenkins", role: "Safety Supervisor", zone: "Structure & Scaffolding (L1-L4)", status: "Active" }, null, 2) },
    { label: 'GET Backend Store Stats', method: 'GET', url: '/api/data/stats', body: '' },
  ];

  return (
    <div className="w-full flex flex-col p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Key className="w-6 h-6 text-[#007BC4]" />
            Backend API & Data Store Integration
          </h2>
          <p className="text-slate-500 font-medium tracking-tight">Connect external software, RFID hardware readers, and custom applications via REST API.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchBackendStats}
            className="flex items-center gap-2 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 px-3 py-2 rounded-xl text-xs font-bold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
            Refresh Backend Status
          </button>
          <button className="flex items-center gap-2 bg-[#007BC4] text-white px-4 py-2 rounded-xl hover:bg-[#006aa9] font-bold text-sm shadow-md transition">
             <Plus className="w-4 h-4" />
             Generate API Key
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6 shrink-0">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Server className="w-4 h-4 text-[#007BC4]" /> Backend Engine</span>
            <span className="text-lg font-black text-slate-900 mt-1 truncate">
              {serverStats?.engine || 'Active REST API Server'}
            </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Database className="w-4 h-4 text-indigo-500" /> Data Collections</span>
            <span className="text-2xl font-black text-slate-900 mt-1">
              {serverStats ? Object.keys(serverStats.data || {}).length : 8} Collections
            </span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> API Availability</span>
            <span className="text-2xl font-black text-slate-900 mt-1">100% Online</span>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Activity className="w-4 h-4 text-[#007BC4]" /> API Endpoints</span>
            <span className="text-2xl font-black text-slate-900 mt-1">14 Connected</span>
        </div>
      </div>

      <div className="bg-white border flex-1 border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0">
        <div className="p-3 border-b border-slate-200 bg-slate-50/50 flex gap-2">
           <button 
             onClick={() => setActiveTab('tester')}
             className={`px-4 py-2 text-sm font-bold rounded-lg transition flex items-center gap-1.5 ${activeTab === 'tester' ? 'bg-white text-[#007BC4] shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
           >
             <Play className="w-4 h-4" /> Live API Tester
           </button>
           <button 
             onClick={() => setActiveTab('keys')}
             className={`px-4 py-2 text-sm font-bold rounded-lg transition flex items-center gap-1.5 ${activeTab === 'keys' ? 'bg-white text-[#007BC4] shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
           >
             <Key className="w-4 h-4" /> API Keys
           </button>
           <button 
             onClick={() => setActiveTab('docs')}
             className={`px-4 py-2 text-sm font-bold rounded-lg transition flex items-center gap-1.5 ${activeTab === 'docs' ? 'bg-white text-[#007BC4] shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
           >
             <Code2 className="w-4 h-4" /> Code Examples & SDK
           </button>
           <button 
             onClick={() => setActiveTab('stats')}
             className={`px-4 py-2 text-sm font-bold rounded-lg transition flex items-center gap-1.5 ${activeTab === 'stats' ? 'bg-white text-[#007BC4] shadow-sm border border-slate-200' : 'text-slate-600 hover:text-slate-900'}`}
           >
             <Database className="w-4 h-4" /> Data Store Collections
           </button>
        </div>

        {activeTab === 'tester' && (
          <div className="p-5 flex-1 overflow-y-auto flex flex-col gap-4">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-2">Preset Quick Endpoints</label>
              <div className="flex flex-wrap gap-2">
                {presetEndpoints.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setMethod(preset.method as any);
                      setEndpoint(preset.url);
                      if (preset.body) setRequestBody(preset.body);
                    }}
                    className="text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 px-3 py-1.5 rounded-lg border border-slate-300 transition flex items-center gap-1.5"
                  >
                    <span className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${preset.method === 'GET' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>
                      {preset.method}
                    </span>
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-12 gap-3 items-center">
              <div className="col-span-2">
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as any)}
                  className="w-full bg-slate-100 border border-slate-300 font-bold text-sm px-3 py-2.5 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#007BC4]"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>
              <div className="col-span-8">
                <input
                  type="text"
                  value={endpoint}
                  onChange={(e) => setEndpoint(e.target.value)}
                  placeholder="/api/data/devices"
                  className="w-full font-mono text-sm border border-slate-300 px-4 py-2.5 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#007BC4]"
                />
              </div>
              <div className="col-span-2">
                <button
                  onClick={handleSendApiRequest}
                  disabled={isExecuting}
                  className="w-full bg-[#007BC4] hover:bg-[#006aa9] text-white font-bold text-sm py-2.5 px-4 rounded-xl transition flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {isExecuting ? 'Sending...' : 'Send Request'}
                </button>
              </div>
            </div>

            {method === 'POST' && (
              <div>
                <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Request Body (JSON)</label>
                <textarea
                  rows={4}
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  className="w-full font-mono text-xs border border-slate-300 p-3 rounded-xl bg-slate-900 text-slate-100 focus:outline-none focus:ring-2 focus:ring-[#007BC4]"
                />
              </div>
            )}

            <div className="flex-1 flex flex-col min-h-[220px]">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
                  Live API Response
                  {responseStatus && (
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${responseStatus >= 200 && responseStatus < 300 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                      HTTP {responseStatus}
                    </span>
                  )}
                </label>
              </div>
              <pre className="flex-1 font-mono text-xs p-4 rounded-xl bg-slate-950 text-emerald-400 overflow-auto border border-slate-800 leading-relaxed shadow-inner">
                {apiResponse}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'keys' && (
          <div className="overflow-y-auto flex-1">
            <Table>
              <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm border-b border-slate-200">
                <TableRow>
                  <TableHead className="py-4">Application Name</TableHead>
                  <TableHead className="py-4">Key Prefix</TableHead>
                  <TableHead className="py-4">Last Used</TableHead>
                  <TableHead className="py-4">Usage (30d)</TableHead>
                  <TableHead className="py-4">Status</TableHead>
                  <TableHead className="py-4 w-[100px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {MOCK_KEYS.map((key) => (
                  <TableRow key={key.id} className="border-slate-100 hover:bg-slate-50 transition-colors">
                    <TableCell>
                      <div className="font-semibold text-slate-900">{key.name}</div>
                      <div className="text-xs text-slate-500 font-medium">Created on {key.created}</div>
                    </TableCell>
                    <TableCell>
                       <div className="flex items-center gap-2">
                          <code className="font-mono text-sm bg-slate-100 px-2 py-1 rounded text-slate-600 border border-slate-200">{key.prefix}••••••••</code>
                          <button 
                             onClick={() => setCopiedKey(key.id)}
                             className="text-slate-400 hover:text-[#007BC4] transition"
                          >
                             {copiedKey === key.id ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                          </button>
                       </div>
                    </TableCell>
                    <TableCell>
                       <span className="text-sm text-slate-600 font-medium">{key.lastUsed}</span>
                    </TableCell>
                    <TableCell>
                       <span className="text-sm text-slate-600 font-medium">{key.usage}</span>
                    </TableCell>
                    <TableCell>
                       {key.status === 'Active' ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-200">Active</Badge>
                       ) : (
                          <Badge className="bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200">Revoked</Badge>
                       )}
                    </TableCell>
                    <TableCell>
                       <button className="text-[#007BC4] font-bold text-xs hover:underline">Manage</button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {activeTab === 'docs' && (
          <div className="p-6 overflow-y-auto flex-1 space-y-6">
            <div>
              <h3 className="font-bold text-slate-900 text-base mb-2">Connecting External Software via cURL</h3>
              <pre className="bg-slate-900 text-slate-200 p-4 rounded-xl text-xs font-mono overflow-x-auto border border-slate-800">
{`# Fetch all registered personnel
curl -X GET "https://${window.location.host}/api/data/registered_people" \\
     -H "Accept: application/json"

# Push an RFID Tag scan from hardware reader
curl -X POST "https://${window.location.host}/api/rfid/scan" \\
     -H "Content-Type: application/json" \\
     -d '{"tagId": "RFID_102", "name": "John Doe", "zone": "Heavy Crane & Exclusion Area", "status": "Active"}'`}
              </pre>
            </div>

            <div>
              <h3 className="font-bold text-slate-900 text-base mb-2">JavaScript / Node.js Integration</h3>
              <pre className="bg-slate-900 text-slate-200 p-4 rounded-xl text-xs font-mono overflow-x-auto border border-slate-800">
{`// Fetch real-time active RFID tags
async function fetchRealtimeTags() {
  const res = await fetch('/api/rfid/realtime');
  const data = await res.json();
  console.log('Active Tags:', data.tags);
}

// Store new record in database store
async function storeDevice(deviceData) {
  const res = await fetch('/api/data/devices', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(deviceData)
  });
  return await res.json();
}`}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="p-6 overflow-y-auto flex-1">
            <h3 className="font-bold text-slate-900 text-base mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-[#007BC4]" />
              Backend Store Collection Summary
            </h3>
            {serverStats && serverStats.data ? (
              <div className="grid grid-cols-2 gap-4">
                {Object.keys(serverStats.data).map((col) => {
                  const info = serverStats.data[col];
                  return (
                    <div key={col} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-sm font-bold text-slate-900">{col}</span>
                        <span className="text-xs bg-[#007BC4] text-white px-2 py-0.5 rounded-full font-bold">
                          {info.count} items
                        </span>
                      </div>
                      {info.sample && (
                        <pre className="bg-white p-2.5 rounded border border-slate-200 text-[11px] font-mono text-slate-600 overflow-hidden text-ellipsis whitespace-nowrap">
                          {JSON.stringify(info.sample)}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center text-slate-500 py-12">Loading backend store metrics...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

