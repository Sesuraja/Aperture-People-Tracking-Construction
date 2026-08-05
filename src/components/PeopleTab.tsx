import { Person } from '../lib/simulation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Search, Plus, X, Save, Clock, MapPin, Activity, Battery, BatteryWarning } from 'lucide-react';
import { useState } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc } from '../lib/db';

export default function PeopleTab({ people }: { people: Person[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedTimelinePerson, setSelectedTimelinePerson] = useState<Person | null>(null);
  
  const [newTagId, setNewTagId] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('Employee');
  const [isSaving, setIsSaving] = useState(false);

  const filteredPeople = people.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSavePerson = async () => {
    if (!newTagId || !newName) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'registered_people', newTagId), {
         name: newName,
         role: newRole,
         createdAt: new Date(),
      });
      setIsAdding(false);
      setNewTagId('');
      setNewName('');
      setNewRole('Employee');
    } catch (e) {
      console.error(e);
      alert('Failed to save person');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full p-6 max-w-7xl mx-auto relative">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Construction Worker Directory</h2>
          <p className="text-slate-500 font-medium">Manage and monitor all construction site personnel, subcontractors, and safety compliance.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <Input 
              placeholder="Search name, trade, hardhat tag, role..." 
              className="pl-9 bg-white border-slate-200 shadow-sm text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#007BC4]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-2 rounded-lg text-xs font-bold shadow-sm">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
             Aperture API Sync Active
          </div>
        </div>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm flex-1 overflow-hidden flex flex-col">
        <CardHeader className="border-b border-slate-100 pb-4">
          <CardTitle className="text-lg text-slate-900">Active Site Personnel ({filteredPeople.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-slate-50 border-b border-slate-200">
              <TableRow className="border-slate-200 hover:bg-slate-50">
                <TableHead className="text-slate-500 font-bold">Hardhat / Tag</TableHead>
                <TableHead className="text-slate-500 font-bold">Worker Name</TableHead>
                <TableHead className="text-slate-500 font-bold">Trade / Company</TableHead>
                <TableHead className="text-slate-500 font-bold">Role</TableHead>
                <TableHead className="text-slate-500 font-bold text-center">PPE Compliance</TableHead>
                <TableHead className="text-slate-500 font-bold">Current Sector</TableHead>
                <TableHead className="text-slate-500 font-bold text-center">Tag Battery</TableHead>
                <TableHead className="text-slate-500 font-bold text-center">Risk Score</TableHead>
                <TableHead className="text-slate-500 font-bold text-right">Dwell Time</TableHead>
                <TableHead className="text-slate-500 font-bold text-right">State</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPeople.map((person) => {
                 let riskScore = 12;
                 if (person.role === 'Site Inspector / Visitor' && (person.currentZone === 'Heavy Crane & Exclusion Area' || person.currentZone === 'Confined Shaft & Tunneling')) {
                    riskScore = 95;
                 } else if (person.ppeStatus === 'NON_COMPLIANT') {
                    riskScore = 88;
                 } else if (person.ppeStatus === 'WARNING' || person.currentZone === 'Heavy Crane & Exclusion Area') {
                    riskScore = 55;
                 } else {
                    riskScore = 15;
                 }
                 const isHighRisk = riskScore > 60;
                 const tagDisplay = person.hardhatTagId || `HH-${person.id.substring(0, 4).toUpperCase()}`;
                 const companyDisplay = person.tradeCompany || 'General Subcontractor';
                 const ppe = person.ppeStatus || 'COMPLIANT';
                 
                 return (
                <TableRow key={person.id} className="border-slate-100 hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedTimelinePerson(person)}>
                  <TableCell className="font-mono text-xs text-[#007BC4] font-bold">{tagDisplay}</TableCell>
                  <TableCell className="font-semibold text-slate-900">
                    <div>{person.name}</div>
                    {person.certifications && person.certifications.length > 0 && (
                      <div className="text-[9px] text-slate-400 font-normal">{person.certifications.join(', ')}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-xs font-medium text-slate-700">{companyDisplay}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      person.role === 'Safety Officer (EHS)' ? 'border-emerald-200 text-emerald-700 bg-emerald-50' :
                      person.role === 'Site Inspector / Visitor' ? 'border-amber-200 text-amber-700 bg-amber-50' :
                      'border-[#007BC4]/20 text-[#007BC4] bg-[#007BC4]/5'
                    }>
                      {person.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline" className={
                      ppe === 'COMPLIANT' ? 'border-emerald-200 text-emerald-700 bg-emerald-50 font-bold' :
                      ppe === 'WARNING' ? 'border-amber-200 text-amber-700 bg-amber-50 font-bold' :
                      'border-rose-200 text-rose-700 bg-rose-50 font-bold'
                    }>
                      {ppe === 'COMPLIANT' ? '✓ FULL PPE' : ppe === 'WARNING' ? '⚠️ CHECK PPE' : '❌ NO PPE'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-slate-700 font-medium text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#007BC4]" />
                      {person.currentZone}
                    </div>
                  </TableCell>
                  <TableCell className="text-center w-28">
                    {(() => {
                       const mockBattery = 6 + ((person.id.charCodeAt(0) * 11 + person.id.charCodeAt(person.id.length-1) * 3) % 94);
                       const isLow = mockBattery < 20;
                       return (
                          <div className="flex items-center justify-center gap-1.5" title={`${mockBattery}% Battery`}>
                             {isLow ? <BatteryWarning className="w-4 h-4 text-rose-500" /> : <Battery className="w-4 h-4 text-emerald-500" />}
                             <span className={`text-xs font-bold w-8 text-left ${isLow ? 'text-rose-600' : 'text-slate-500'}`}>{mockBattery}%</span>
                          </div>
                       );
                    })()}
                  </TableCell>
                  <TableCell className="text-center">
                     <div className="flex items-center justify-center gap-2 bg-slate-50 rounded-full border border-slate-100 py-1 px-3 w-fit mx-auto">
                        <Activity className={`w-3 h-3 ${isHighRisk ? 'text-rose-500 animate-pulse' : 'text-slate-400'}`} />
                        <span className={`text-sm font-bold ${isHighRisk ? 'text-rose-600' : 'text-slate-600'}`}>{riskScore}</span>
                     </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-slate-700 font-medium">
                    {Math.floor(person.dwellTime / 60)}m {person.dwellTime % 60}s
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary" className={
                      person.presenceState === 'MOVING' ? 'bg-[#007BC4]/10 text-[#007BC4]' : 'bg-slate-100 text-slate-600'
                    }>
                      {person.presenceState}
                    </Badge>
                  </TableCell>
                </TableRow>
              )})}
              {filteredPeople.length === 0 && (
                <TableRow className="border-slate-100 hover:bg-transparent">
                  <TableCell colSpan={6} className="h-32 text-center text-slate-500 font-medium">
                    No matching personnel found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

       {/* Person Timeline Modal */}
       {selectedTimelinePerson && (
         <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 p-4">
           <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center bg-slate-50 p-5 border-b border-slate-100 shrink-0">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#007BC4]/10 text-[#007BC4] flex items-center justify-center text-xl font-bold border border-[#007BC4]/20">
                       {selectedTimelinePerson.name.charAt(0)}
                    </div>
                    <div>
                       <h3 className="text-xl font-bold text-slate-900">{selectedTimelinePerson.name}</h3>
                       <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                          <Badge variant="outline">{selectedTimelinePerson.role}</Badge>
                          <span className="font-mono text-xs">{selectedTimelinePerson.id}</span>
                          <Badge variant="outline" className={`border-0 ${selectedTimelinePerson.role === 'Visitor' && selectedTimelinePerson.currentZone === 'Server Room' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>Risk: {selectedTimelinePerson.role === 'Visitor' && selectedTimelinePerson.currentZone === 'Server Room' ? 96 : 12}</Badge>
                       </div>
                    </div>
                 </div>
                 <button onClick={() => setSelectedTimelinePerson(null)} className="text-slate-400 hover:text-slate-700 transition bg-white p-1.5 rounded-full shadow-sm border border-slate-200">
                    <X className="w-5 h-5" />
                 </button>
              </div>
              <div className="p-5 flex-1 overflow-y-auto w-full">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-1">
                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Clock className="w-3 h-3 text-emerald-500"/> First Entry</span>
                       <span className="text-lg font-bold text-slate-800">07:42 AM</span>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-1">
                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Clock className="w-3 h-3 text-rose-500"/> Last Exit</span>
                       <span className="text-lg font-bold text-slate-800">--:--</span>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex flex-col gap-1">
                       <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5"><Activity className="w-3 h-3 text-[#007BC4]"/> Total Hours</span>
                       <span className="text-lg font-bold text-slate-800">4h 15m</span>
                    </div>
                 </div>

                 <h4 className="text-sm font-bold text-slate-900 mb-4 px-1">Movement Timeline (Today)</h4>
                 <div className="pl-4 border-l-2 border-slate-200 space-y-6 relative before:border-l-2">
                    <div className="relative">
                       <span className="absolute -left-[23px] top-1 w-3 h-3 bg-white border-2 border-[#007BC4] rounded-full shadow-sm"></span>
                       <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-slate-500 mb-1">07:42 AM</span>
                          <span className="text-sm font-bold text-slate-800">Entered Facility</span>
                          <span className="text-xs font-medium text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3"/> Main Entrance Checkout</span>
                       </div>
                    </div>
                    <div className="relative">
                       <span className="absolute -left-[23px] top-1 w-3 h-3 bg-white border-2 border-emerald-500 rounded-full shadow-sm"></span>
                       <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-slate-500 mb-1">08:05 AM</span>
                          <span className="text-sm font-bold text-slate-800">Zone Change</span>
                          <span className="text-xs font-medium text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3"/> Moved from Lobby to Engineering Lab</span>
                       </div>
                    </div>
                    <div className="relative">
                       <span className="absolute -left-[23px] top-1 w-3 h-3 bg-white border-2 border-amber-500 rounded-full shadow-sm"></span>
                       <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-slate-500 mb-1">11:30 AM</span>
                          <span className="text-sm font-bold text-amber-600 flex items-center gap-1.5">Loitering Detected</span>
                          <span className="text-xs font-medium text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3"/> Stationary in Server Room for &gt; 45 mins</span>
                       </div>
                    </div>
                    <div className="relative">
                       <span className="absolute -left-[23px] top-1 w-3 h-3 bg-white border-2 border-[#007BC4] rounded-full shadow-sm animate-pulse"></span>
                       <div className="flex flex-col gap-0.5">
                          <span className="text-xs font-bold text-slate-500 mb-1">Current</span>
                          <span className="text-sm font-bold text-[#007BC4]">Active</span>
                          <span className="text-xs font-medium text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3"/> {selectedTimelinePerson.currentZone}</span>
                       </div>
                    </div>
                 </div>
              </div>
           </div>
         </div>
       )}
    </div>
  );
}
