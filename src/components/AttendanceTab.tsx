import React, { useState, useMemo } from 'react';
import { Person } from '../lib/simulation';
import { Clock, CheckCircle2, UserX, AlertTriangle, Download, Search, Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import ExportReportModal from './ExportReportModal';

export default function AttendanceTab({ people }: { people: Person[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const attendanceData = useMemo(() => {
    return people.map(p => {
      // Mock data for attendance
      const firstInH = 7 + Math.floor(Math.random() * 2);
      const firstInM = Math.floor(Math.random() * 60);
      const lastOutH = 16 + Math.floor(Math.random() * 3);
      const lastOutM = Math.floor(Math.random() * 60);
      
      const isLate = firstInH >= 9 && firstInM > 0;
      const isOvertime = lastOutH >= 18;
      
      const totalMins = ((lastOutH * 60) + lastOutM) - ((firstInH * 60) + firstInM);
      const hoursStr = `${Math.floor(totalMins / 60)}h ${totalMins % 60}m`;
      
      return {
        ...p,
        firstIn: `${firstInH.toString().padStart(2, '0')}:${firstInM.toString().padStart(2, '0')}`,
        lastOut: `${lastOutH.toString().padStart(2, '0')}:${lastOutM.toString().padStart(2, '0')}`,
        totalTime: hoursStr,
        isLate,
        isOvertime,
      };
    });
  }, [people]);

  const filteredData = attendanceData.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="w-full flex flex-col p-6 max-w-7xl mx-auto">
      <ExportReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        defaultCategory="attendance"
        customData={attendanceData}
      />
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Clock className="w-6 h-6 text-[#007BC4]" />
            Site Shift Attendance & Gate Scans
          </h2>
          <p className="text-slate-500 font-medium tracking-tight">Monitor worker turnstile check-ins, subcontractor hours, and shift safety compliance.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search personnel..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm w-64 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#007BC4]/20 focus:border-[#007BC4] transition"
            />
          </div>
          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 font-bold text-sm shadow-sm transition"
          >
             <Download className="w-4 h-4" />
             Export Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6 shrink-0">
         <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-sm font-bold text-slate-500 uppercase flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Present Today</span>
            <span className="text-3xl font-black text-slate-900 mt-2">{attendanceData.length}</span>
         </div>
         <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-sm font-bold text-slate-500 uppercase flex items-center gap-1.5"><AlertTriangle className="w-4 h-4 text-amber-500" /> Late Arrivals</span>
            <span className="text-3xl font-black text-slate-900 mt-2">{attendanceData.filter(a => a.isLate).length}</span>
         </div>
         <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-sm font-bold text-slate-500 uppercase flex items-center gap-1.5"><UserX className="w-4 h-4 text-rose-500" /> Absent</span>
            <span className="text-3xl font-black text-slate-900 mt-2">2</span>
         </div>
         <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
            <span className="text-sm font-bold text-slate-500 uppercase flex items-center gap-1.5"><Clock className="w-4 h-4 text-[#007BC4]" /> Overtime Tracked</span>
            <span className="text-3xl font-black text-slate-900 mt-2">{attendanceData.filter(a => a.isOvertime).length}</span>
         </div>
      </div>

      <div className="bg-white border flex-1 border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0 relative">
        <div className="overflow-y-auto flex-1">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm">
              <TableRow>
                <TableHead className="py-4">Personnel</TableHead>
                <TableHead className="py-4">First In</TableHead>
                <TableHead className="py-4">Last Out</TableHead>
                <TableHead className="py-4">Total Hours</TableHead>
                <TableHead className="py-4 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((person) => (
                <TableRow key={person.id} className="border-slate-100 hover:bg-slate-50 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs">
                        {person.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{person.name}</div>
                        <div className="text-xs font-mono text-slate-500">{person.hardhatTagId || person.id} • {person.tradeCompany || person.role}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                     <div className="font-mono text-sm font-medium">{person.firstIn} AM</div>
                     {person.isLate && <div className="text-[10px] text-rose-500 font-bold uppercase">Late</div>}
                  </TableCell>
                  <TableCell>
                     <div className="font-mono text-sm font-medium">{person.lastOut} PM</div>
                  </TableCell>
                  <TableCell className="font-semibold text-slate-700">{person.totalTime}</TableCell>
                  <TableCell className="text-right">
                     {person.isOvertime ? (
                        <Badge className="bg-[#007BC4] hover:bg-[#006aa9]">Overtime</Badge>
                     ) : person.isLate ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">Late Entry</Badge>
                     ) : (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-300 bg-emerald-50">On Time</Badge>
                     )}
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
