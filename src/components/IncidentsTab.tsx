import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, Clock, Paperclip, ChevronRight, FileText, Plus, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ExportReportModal from './ExportReportModal';

const MOCK_INCIDENTS = [
  { id: 'INC-2026-089', type: 'Exclusion Zone Breach', location: 'Heavy Crane Exclusion Zone', severity: 'High', status: 'Open', assignedTo: 'mark.s@aperturestaff.com', time: '10 mins ago', descriptions: 'Subcontractor worker detected inside active crane swing radius without high-risk lift clearance.' },
  { id: 'INC-2026-088', type: 'Perimeter Breach', location: 'Gate 4 - Material Laydown & Concrete', severity: 'Critical', status: 'Investigating', assignedTo: 'sarah.j@aperturestaff.com', time: '45 mins ago', descriptions: 'Unregistered personnel movement detected near heavy excavation pit after site shift close.' },
  { id: 'INC-2026-087', type: 'Offline Hardhat Reader', location: 'Scaffolding Tower Level 3', severity: 'Medium', status: 'Resolved', assignedTo: 'tech.support@aperturetech.com', time: '2 hours ago', descriptions: 'Rugged RFID mesh relay node lost battery signal. Solar battery pack replaced by site technician.' },
];

export default function IncidentsTab() {
  const [selectedIncident, setSelectedIncident] = useState<any>(MOCK_INCIDENTS[0]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  return (
    <div className="w-full flex flex-col p-6 max-w-7xl mx-auto">
      <ExportReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        defaultCategory="incidents"
        customData={MOCK_INCIDENTS}
      />
      <div className="flex items-center justify-between mb-8 shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-[#007BC4]" />
            Incident Management Center
          </h2>
          <p className="text-slate-500 font-medium tracking-tight">Track, assign, investigate, and resolve security events and system anomalies.</p>
        </div>
        <button 
          onClick={() => setIsExportModalOpen(true)}
          className="flex items-center gap-2 bg-[#007BC4] text-white px-4 py-2 rounded-xl hover:bg-[#006aa9] font-bold text-sm shadow-md transition"
        >
           <Download className="w-4 h-4" />
           Export Incident Report
        </button>
      </div>

      <div className="flex flex-1 gap-6 min-h-0">
         {/* Incident List */}
         <div className="w-1/3 flex flex-col gap-3 overflow-y-auto pr-2">
            {MOCK_INCIDENTS.map(inc => (
               <div 
                 key={inc.id}
                 onClick={() => setSelectedIncident(inc)}
                 className={`p-4 rounded-xl border ${selectedIncident?.id === inc.id ? 'bg-[#007BC4]/5 border-[#007BC4]/30 ring-1 ring-[#007BC4]/20' : 'bg-white border-slate-200 hover:border-slate-300'} cursor-pointer transition shadow-sm`}
               >
                  <div className="flex justify-between items-start mb-2">
                     <span className="font-mono text-xs font-bold text-slate-500">{inc.id}</span>
                     {inc.status === 'Open' && <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">Open</Badge>}
                     {inc.status === 'Investigating' && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 animate-pulse">Investigating</Badge>}
                     {inc.status === 'Resolved' && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Resolved</Badge>}
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm mb-1">{inc.type}</h3>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5"><AlertTriangle className="w-3 h-3"/> {inc.location}</p>
                  <div className="mt-3 flex justify-between items-center text-xs">
                     <div className="flex items-center gap-1.5 font-medium text-slate-600">
                        <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[8px] font-bold text-slate-600">{inc.assignedTo.charAt(0).toUpperCase()}</div>
                        Officer
                     </div>
                     <span className="text-slate-400 font-medium flex items-center gap-1"><Clock className="w-3 h-3"/> {inc.time}</span>
                  </div>
               </div>
            ))}
         </div>

         {/* Incident Details */}
         <div className="flex-1 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col min-h-0 overflow-hidden">
            {selectedIncident ? (
               <div className="p-6 overflow-y-auto flex-1">
                  <div className="flex justify-between items-start">
                     <div>
                        <div className="flex items-center gap-3 mb-2">
                           <h2 className="text-2xl font-black text-slate-900">{selectedIncident.type}</h2>
                           {selectedIncident.severity === 'Critical' && <Badge className="bg-rose-600">Critical</Badge>}
                           {selectedIncident.severity === 'High' && <Badge className="bg-rose-500">High</Badge>}
                           {selectedIncident.severity === 'Medium' && <Badge className="bg-amber-500">Medium</Badge>}
                        </div>
                        <p className="text-slate-500 font-medium flex items-center gap-2">
                           <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200">{selectedIncident.id}</span>
                           •
                           <span>{selectedIncident.location}</span>
                           •
                           <span>Occurred {selectedIncident.time}</span>
                        </p>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6 mt-8">
                     <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 border-b border-slate-100 pb-2">Description</h4>
                        <p className="text-sm text-slate-700 leading-relaxed">{selectedIncident.descriptions}</p>
                     </div>
                     <div>
                        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2 border-b border-slate-100 pb-2">Resolution Workflow</h4>
                        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-slate-200 before:to-transparent">
                           <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                              <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-white bg-[#007BC4] text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                 <CheckCircle className="w-3 h-3" />
                              </div>
                              <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] bg-slate-50 p-3 rounded-lg border border-slate-200 shadow-sm">
                                 <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">Alert Generated <span className="text-slate-400 font-mono">10:00</span></div>
                                 <p className="text-xs text-slate-500">System detected anomaly.</p>
                              </div>
                           </div>

                           <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                              <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-white bg-amber-500 text-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 animate-pulse">
                                 <Clock className="w-3 h-3" />
                              </div>
                              <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] bg-amber-50/50 p-3 rounded-lg border border-amber-200 shadow-sm">
                                 <div className="flex justify-between text-xs font-bold text-amber-800 mb-1">Investigation <span className="text-amber-500 font-mono">Current</span></div>
                                 <p className="text-xs text-amber-700/80">Assigned to: {selectedIncident.assignedTo}</p>
                              </div>
                           </div>

                             <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                              <div className="flex items-center justify-center w-6 h-6 rounded-full border-2 border-slate-200 bg-white text-slate-400 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                 <CheckCircle className="w-3 h-3 opacity-0" />
                              </div>
                              <div className="w-[calc(100%-2.5rem)] md:w-[calc(50%-1.5rem)] bg-slate-50/50 p-3 rounded-lg border border-slate-100 shadow-sm opacity-50">
                                 <div className="flex justify-between text-xs font-bold text-slate-400 mb-1">Resolved</div>
                                 <p className="text-xs text-slate-400">Awaiting clearance.</p>
                              </div>
                           </div>
                        </div>
                     </div>
                  </div>

                  <div className="mt-8 border-t border-slate-200 pt-6">
                     <h4 className="text-xs font-bold text-slate-500 uppercase mb-4 flex items-center gap-2"><Paperclip className="w-4 h-4"/> Evidence & Attachments</h4>
                     <div className="grid grid-cols-3 gap-4">
                        <div className="bg-slate-100 aspect-video rounded-xl border border-slate-200 overflow-hidden relative group cursor-pointer hover:border-[#007BC4] transition">
                           <div className="absolute inset-0 flex items-center justify-center">
                              <span className="text-xs font-mono font-bold text-slate-400 flex items-center gap-1.5 bg-white/80 px-2 py-1 rounded backdrop-blur-sm"><ShieldAlert className="w-3 h-3"/> CCTV Snapshot</span>
                           </div>
                        </div>
                        <div className="bg-slate-50 aspect-video rounded-xl border border-slate-200 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition hover:border-[#007BC4]">
                           <Plus className="w-6 h-6 text-slate-400 mb-2"/>
                           <span className="text-xs font-bold text-slate-500">Attach Log</span>
                        </div>
                     </div>
                  </div>

                  <div className="mt-8 flex gap-3">
                     <button className="bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 px-6 py-3 rounded-xl font-bold text-sm shadow-sm transition flex-1 flex items-center justify-center gap-2">
                        <CheckCircle className="w-4 h-4"/> Mark as Resolved
                     </button>
                      <button className="bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 px-6 py-3 rounded-xl font-bold text-sm shadow-sm transition flex-1">
                        Add Investigation Note...
                     </button>
                  </div>
               </div>
            ) : (
               <div className="flex-1 flex items-center justify-center text-slate-400 p-6 flex-col">
                  <ShieldAlert className="w-12 h-12 mb-4 opacity-20" />
                  <p className="font-medium">Select an incident to view details.</p>
               </div>
            )}
         </div>
      </div>
    </div>
  );
}
