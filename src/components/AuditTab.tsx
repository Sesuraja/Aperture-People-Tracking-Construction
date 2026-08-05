import React, { useState } from 'react';
import { History, Download, Filter, FileText, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const MOCK_AUDIT = [
  { id: '1', time: '10:45:22 AM', user: 'admin@aperturestaff.com', action: 'Rule Created', details: 'Added new alert rule: "Subcontractor in Heavy Crane Exclusion Zone"', type: 'config' },
  { id: '2', time: '10:30:00 AM', user: 'System', action: 'Report Exported', details: 'Automated Daily Headcount & Trades Report exported to Site Supervisor', type: 'export' },
  { id: '3', time: '09:15:10 AM', user: 'mike.t@aperturestaff.com', action: 'Alert Acknowledged', details: 'Acknowledged perimeter breach alert at Gate 4 Logistics', type: 'security' },
  { id: '4', time: '08:05:45 AM', user: 'admin@aperturestaff.com', action: 'Settings Changed', details: 'Updated global emergency muster timeout from 15m to 10m', type: 'config' },
  { id: '5', time: 'Yesterday', user: 'system_api', action: 'Integration Sync', details: 'Hardhat RFID gateway timestamps synchronized successfully', type: 'system' },
];

export default function AuditTab() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div className="w-full flex flex-col p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <History className="w-6 h-6 text-[#007BC4]" />
            Audit & Compliance
          </h2>
          <p className="text-slate-500 font-medium tracking-tight">Immutable log of system changes, exports, and security actions.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search audit logs..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm w-64 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#007BC4]/20 focus:border-[#007BC4] transition"
            />
          </div>
          <button className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 font-bold text-sm shadow-sm transition">
             <Filter className="w-4 h-4" />
             Filters
          </button>
          <button className="flex items-center gap-2 bg-[#007BC4] text-white px-4 py-2 rounded-xl hover:bg-[#006aa9] font-bold text-sm shadow-md transition">
             <Download className="w-4 h-4" />
             Export CSV
          </button>
        </div>
      </div>

      <div className="bg-white border flex-1 border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0">
        <div className="overflow-y-auto flex-1">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm border-b border-slate-200">
              <TableRow>
                <TableHead className="py-4">Timestamp</TableHead>
                <TableHead className="py-4">Actor</TableHead>
                <TableHead className="py-4">Action</TableHead>
                <TableHead className="py-4">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_AUDIT.map((log) => (
                <TableRow key={log.id} className="border-slate-100 hover:bg-slate-50 transition-colors">
                  <TableCell className="font-mono text-xs text-slate-500 whitespace-nowrap">
                    {log.time}
                  </TableCell>
                  <TableCell>
                     <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 uppercase">
                           {log.user === 'System' || log.user === 'system_api' ? 'S' : log.user.charAt(0)}
                        </div>
                        <span className="text-sm font-semibold text-slate-700">{log.user}</span>
                     </div>
                  </TableCell>
                  <TableCell>
                     <Badge variant="outline" className={`
                        ${log.type === 'config' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : ''}
                        ${log.type === 'security' ? 'bg-rose-50 text-rose-700 border-rose-200' : ''}
                        ${log.type === 'export' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : ''}
                        ${log.type === 'system' ? 'bg-slate-50 text-slate-700 border-slate-200' : ''}
                     `}>
                        {log.action}
                     </Badge>
                  </TableCell>
                  <TableCell>
                     <div className="text-sm text-slate-600">{log.details}</div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
