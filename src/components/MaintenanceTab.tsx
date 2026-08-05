import React from 'react';
import { Activity, Wrench, AlertCircle, SignalHigh, WifiOff, Thermometer, BatteryFull, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const MOCK_READERS = [
  { id: 'R-07', type: 'Gateway RFID', location: 'Gate 1 Access Turnstile', signal: 45, battery: null, health: 65, prediction: 'Failure in 14 Days', status: 'Warning' },
  { id: 'R-12', type: 'Room Anchor', location: 'Confined Shaft & Tunneling Anchor', signal: 98, battery: 85, health: 99, prediction: 'Nominal', status: 'Healthy' },
  { id: 'R-44', type: 'Perimeter Node', location: 'Material Laydown & Crane Node', signal: 22, battery: 15, health: 30, prediction: 'Battery Depletion in 3 Days', status: 'Critical' },
  { id: 'R-01', type: 'Gateway RFID', location: 'Main Construction Site Gate', signal: 95, battery: null, health: 98, prediction: 'Nominal', status: 'Healthy' },
];

export default function MaintenanceTab() {
  return (
    <div className="w-full flex flex-col p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Wrench className="w-6 h-6 text-[#007BC4]" />
            Predictive Maintenance
          </h2>
          <p className="text-slate-500 font-medium tracking-tight">AI-driven predictive health monitoring for physical reader infrastructure.</p>
        </div>
      </div>

       <div className="grid grid-cols-4 gap-4 mb-6 shrink-0">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><Activity className="w-4 h-4 text-emerald-500" /> Avg Network Health</span>
            <span className="text-3xl font-black text-slate-900 mt-2">94.2%</span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-amber-500" /> Maintenance Required</span>
            <span className="text-3xl font-black text-slate-900 mt-2">2</span>
        </div>
      </div>

      <div className="bg-white border flex-1 border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0">
        <div className="overflow-y-auto flex-1">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm border-b border-slate-200">
              <TableRow>
                <TableHead className="py-4">Hardware Node</TableHead>
                <TableHead className="py-4 text-center">Signal Quality</TableHead>
                <TableHead className="py-4 text-center">Power/Battery</TableHead>
                <TableHead className="py-4">AI Prediction</TableHead>
                <TableHead className="py-4">Status</TableHead>
                <TableHead className="py-4 w-[120px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
               {MOCK_READERS.map(reader => (
                  <TableRow key={reader.id} className="border-slate-100 hover:bg-slate-50 transition-colors">
                     <TableCell>
                        <div className="font-bold text-slate-900 flex items-center gap-2">
                           <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{reader.id}</span>
                           {reader.type}
                        </div>
                        <div className="text-xs text-slate-500 font-medium mt-1">{reader.location}</div>
                     </TableCell>
                     <TableCell>
                        <div className="flex flex-col items-center gap-1">
                           <div className="w-full max-w-[80px] bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${reader.signal < 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${reader.signal}%` }} />
                           </div>
                           <span className="text-xs font-mono font-bold text-slate-600">{reader.signal}%</span>
                        </div>
                     </TableCell>
                     <TableCell>
                         <div className="flex flex-col items-center gap-1">
                           {reader.battery === null ? (
                              <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Mains AC</span>
                           ) : (
                              <>
                                 <div className="w-full max-w-[80px] bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${reader.battery < 20 ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${reader.battery}%` }} />
                                 </div>
                                 <span className="text-xs font-mono font-bold text-slate-600">{reader.battery}%</span>
                              </>
                           )}
                        </div>
                     </TableCell>
                     <TableCell>
                        <div className={`text-sm font-bold flex items-center gap-1.5 ${reader.status === 'Warning' ? 'text-amber-600' : reader.status === 'Critical' ? 'text-rose-600' : 'text-slate-600'}`}>
                           {reader.status !== 'Healthy' && <Sparkles className="w-4 h-4 fill-current opacity-50" />}
                           {reader.prediction}
                        </div>
                        {reader.status === 'Warning' && <span className="text-xs text-slate-400 block mt-0.5 border-t border-amber-100 pt-0.5">Signal degradation accelerating.</span>}
                     </TableCell>
                     <TableCell>
                        {reader.status === 'Healthy' && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Healthy</Badge>}
                        {reader.status === 'Warning' && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Warning</Badge>}
                        {reader.status === 'Critical' && <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 animate-pulse">Critical</Badge>}
                     </TableCell>
                     <TableCell>
                        <button className="text-[#007BC4] font-bold text-xs hover:underline bg-[#007BC4]/10 hover:bg-[#007BC4]/20 px-3 py-1.5 rounded transition">Dispatch Tech</button>
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
