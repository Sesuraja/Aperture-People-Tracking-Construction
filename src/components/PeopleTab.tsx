import { Person } from '../lib/simulation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { 
  Search, Plus, X, MapPin, Battery, BatteryWarning, 
  Users, ShieldCheck, Download, Printer, 
  FileText, UserCheck, ShieldAlert, Phone, Mail, Heart
} from 'lucide-react';
import { useState, useMemo } from 'react';
import { db } from '../lib/firebase';
import { doc, setDoc } from '../lib/db';
import { exportToCSV, generatePDFReport } from '../lib/exportUtils';

export default function PeopleTab({ people }: { people: Person[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [profileTab, setProfileTab] = useState<'profile' | 'badge' | 'movement' | 'safety' | 'ai'>('profile');

  
  // Add / Edit Modal States
  const [isAddingModalOpen, setIsAddingModalOpen] = useState(false);
  const [newWorker, setNewWorker] = useState({
    name: '',
    role: 'General Subcontractor',
    company: 'Apex Structural',
    hardhatTagId: '',
    phone: '+1 (555) 019-2831',
    emergencyContact: 'Jane Doe (+1 555-992-1100)',
    certifications: 'OSHA 30, Scaffolding Safety'
  });

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const filteredPeople = useMemo(() => {
    return people.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.role.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = roleFilter === 'All' || p.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [people, searchTerm, roleFilter]);

  // Statistics
  const stats = useMemo(() => {
    const total = people.length;
    const active = people.filter(p => p.presenceState === 'MOVING' || p.dwellTime > 0).length;
    const compliantPpe = people.filter(p => p.ppeStatus === 'COMPLIANT' || !p.ppeStatus).length;
    const ppeRate = total > 0 ? Math.round((compliantPpe / total) * 100) : 100;
    const highRisk = people.filter(p => (p.ppeStatus === 'NON_COMPLIANT' || p.currentZone === 'Heavy Crane & Exclusion Area')).length;
    
    return { total, active, ppeRate, highRisk };
  }, [people]);

  const handleExportCSV = () => {
    const data = people.map(p => ({
      TagID: p.hardhatTagId || p.id,
      Name: p.name,
      Role: p.role,
      Company: p.tradeCompany || 'General Contractor',
      Zone: p.currentZone,
      PPEStatus: p.ppeStatus || 'COMPLIANT',
      Battery: `${6 + ((p.id.charCodeAt(0) * 11) % 85)}%`
    }));
    exportToCSV('Workforce_Directory_Roster', data, [
      { key: 'TagID', label: 'HARDHAT TAG' },
      { key: 'Name', label: 'WORKER NAME' },
      { key: 'Role', label: 'ROLE' },
      { key: 'Company', label: 'CONTRACTOR' },
      { key: 'Zone', label: 'CURRENT ZONE' },
      { key: 'PPEStatus', label: 'PPE COMPLIANCE' },
      { key: 'Battery', label: 'TAG BATTERY' }
    ]);
  };

  const handleExportPDF = () => {
    const data = people.map(p => ({
      id: p.hardhatTagId || p.id,
      name: p.name,
      role: p.role,
      zone: p.currentZone,
      ppe: p.ppeStatus || 'COMPLIANT'
    }));
    generatePDFReport(
      'Site Workforce & Safety Compliance Roster',
      'Aperture EHS Personnel Management Log',
      [
        { key: 'id', label: 'Tag ID' },
        { key: 'name', label: 'Name' },
        { key: 'role', label: 'Role' },
        { key: 'zone', label: 'Zone' },
        { key: 'ppe', label: 'PPE Status' }
      ],
      data,
      [
        { label: 'Total Workforce', value: stats.total },
        { label: 'Active On-Site', value: stats.active },
        { label: 'PPE Compliance Rate', value: `${stats.ppeRate}%` }
      ]
    );
  };

  const handleAddWorker = async () => {
    if (!newWorker.name || !newWorker.hardhatTagId) return;
    const tagId = newWorker.hardhatTagId.toUpperCase();
    await setDoc(doc(db, 'registered_people', tagId), {
      ...newWorker,
      hardhatTagId: tagId,
      createdAt: new Date().toISOString()
    });
    setIsAddingModalOpen(false);
    setNewWorker({
      name: '',
      role: 'General Subcontractor',
      company: 'Apex Structural',
      hardhatTagId: '',
      phone: '+1 (555) 019-2831',
      emergencyContact: 'Jane Doe (+1 555-992-1100)',
      certifications: 'OSHA 30, Scaffolding Safety'
    });
  };

  const handleGenerateAiWorkerSummary = (person: Person) => {
    setIsGeneratingAi(true);
    setTimeout(() => {
      setAiSummary(`
👷 **Aperture AI Worker Intelligence Summary for ${person.name}**
• **Tag Identifier:** ${person.hardhatTagId || person.id}
• **Primary Role:** ${person.role} | Subcontractor: ${person.tradeCompany || 'BuildCorp Partner'}
• **Safety Score:** 94/100 (Compliant OSHA 30 certified).
• **Spatial Dwell Analysis:** Spending 68% of shift time in ${person.currentZone}.
• **EHS Compliance:** 0 unexcused PPE violations logged in past 30 days.
• **Equipment Certifications:** Certified for Scaffolding L3, Heavy Crane Rigging & Excavation Pit Access.
      `);
      setIsGeneratingAi(false);
    }, 1000);
  };

  return (
    <div className="flex flex-col gap-6 w-full p-6 max-w-7xl mx-auto relative">
      {/* Header & Main Stats Bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Enterprise Workforce Management</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#007BC4]/10 text-[#007BC4] border border-[#007BC4]/20">
              RBAC Enabled
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-0.5">Manage personnel, contractor onboarding, RFID hardhat assignments & safety certifications</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button 
            onClick={() => setIsAddingModalOpen(true)}
            className="px-4 py-2 bg-[#007BC4] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2"
          >
            <Plus size={15} /> Add Worker Profile
          </button>
          <button 
            onClick={handleExportCSV}
            className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 rounded-xl transition"
            title="Export CSV Roster"
          >
            <Download size={15} />
          </button>
          <button 
            onClick={handleExportPDF}
            className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 text-slate-700 dark:text-slate-300 rounded-xl transition"
            title="Export Official PDF Roster"
          >
            <FileText size={15} />
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Total Workforce</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</span>
          </div>
          <div className="p-3 bg-[#007BC4]/10 text-[#007BC4] rounded-xl">
            <Users size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Active On-Site</span>
            <span className="text-2xl font-black text-emerald-600">{stats.active}</span>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
            <UserCheck size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">PPE Compliance Rate</span>
            <span className="text-2xl font-black text-slate-900 dark:text-white">{stats.ppeRate}%</span>
          </div>
          <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
            <ShieldCheck size={20} />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">High Risk / PPE Alerts</span>
            <span className="text-2xl font-black text-rose-600">{stats.highRisk}</span>
          </div>
          <div className="p-3 bg-rose-500/10 text-rose-600 rounded-xl">
            <ShieldAlert size={20} />
          </div>
        </div>
      </div>

      {/* Directory Filter & Search */}
      <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm flex-1 overflow-hidden flex flex-col">
        <CardHeader className="border-b border-slate-100 dark:border-slate-700 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Active Site Personnel Roster ({filteredPeople.length})</CardTitle>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-4" />
              <Input 
                placeholder="Search worker name, tag ID, role..." 
                className="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus-visible:ring-[#007BC4]"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 rounded-xl px-3 py-2 outline-none"
            >
              <option value="All">All Roles</option>
              <option value="General Subcontractor">General Subcontractor</option>
              <option value="Safety Officer (EHS)">Safety Officer (EHS)</option>
              <option value="Site Inspector / Visitor">Site Inspector</option>
            </select>
          </div>
        </CardHeader>
        
        <CardContent className="p-0 flex-1 overflow-auto">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <TableRow className="border-slate-200 dark:border-slate-700">
                <TableHead className="text-slate-500 font-bold">Tag ID</TableHead>
                <TableHead className="text-slate-500 font-bold">Worker Name</TableHead>
                <TableHead className="text-slate-500 font-bold">Company / Trade</TableHead>
                <TableHead className="text-slate-500 font-bold">Role</TableHead>
                <TableHead className="text-slate-500 font-bold text-center">PPE Compliance</TableHead>
                <TableHead className="text-slate-500 font-bold">Current Sector</TableHead>
                <TableHead className="text-slate-500 font-bold text-center">Tag Battery</TableHead>
                <TableHead className="text-slate-500 font-bold text-center">Safety Score</TableHead>
                <TableHead className="text-slate-500 font-bold text-right">Dwell Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPeople.map((person) => {
                 const mockBattery = 6 + ((person.id.charCodeAt(0) * 11) % 85);
                 const isLowBattery = mockBattery < 20;
                 const tagDisplay = person.hardhatTagId || `HH-${person.id.substring(0, 4).toUpperCase()}`;
                 const ppe = person.ppeStatus || 'COMPLIANT';
                 
                 return (
                <TableRow 
                  key={person.id} 
                  className="border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer" 
                  onClick={() => { setSelectedPerson(person); setProfileTab('profile'); setAiSummary(null); }}
                >
                  <TableCell className="font-mono text-xs text-[#007BC4] font-bold">{tagDisplay}</TableCell>
                  <TableCell className="font-semibold text-slate-900 dark:text-white">
                    <div>{person.name}</div>
                    <div className="text-[10px] text-slate-400 font-normal">OSHA 30 Certified</div>
                  </TableCell>
                  <TableCell className="text-xs font-medium text-slate-700 dark:text-slate-300">{person.tradeCompany || 'Apex Structural'}</TableCell>
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
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-bold text-xs">
                      <MapPin size={12} className="text-[#007BC4]" />
                      {person.currentZone}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      {isLowBattery ? <BatteryWarning size={14} className="text-rose-500" /> : <Battery size={14} className="text-emerald-500" />}
                      <span className={`text-xs font-bold ${isLowBattery ? 'text-rose-600' : 'text-slate-600 dark:text-slate-400'}`}>{mockBattery}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                     <span className="font-extrabold text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                       94 / 100
                     </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs font-bold text-slate-700 dark:text-slate-300">
                    {Math.floor(person.dwellTime / 60)}m {person.dwellTime % 60}s
                  </TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Comprehensive Person Profile Drawer/Modal */}
      {selectedPerson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden relative">
            
            {/* Header */}
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#007BC4] text-white flex items-center justify-center text-xl font-bold uppercase shadow-md">
                  {selectedPerson.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">{selectedPerson.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <span className="font-mono text-[#007BC4] font-bold">{selectedPerson.hardhatTagId || selectedPerson.id}</span>
                    <span>•</span>
                    <span>{selectedPerson.tradeCompany || 'Apex Structural'}</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedPerson(null)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full">
                <X size={20} />
              </button>
            </div>

            {/* Profile Navigation Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-900 px-5 gap-4">
              {[
                { id: 'profile', label: 'Personal & Role' },
                { id: 'badge', label: 'RFID Badge & QR' },
                { id: 'movement', label: 'Zone Movement Log' },
                { id: 'safety', label: 'EHS & Certifications' },
                { id: 'ai', label: 'AI Worker Summary' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => {
                    setProfileTab(t.id as any);
                    if (t.id === 'ai' && !aiSummary) handleGenerateAiWorkerSummary(selectedPerson);
                  }}
                  className={`py-3 text-xs font-bold border-b-2 transition ${profileTab === t.id ? 'border-[#007BC4] text-[#007BC4]' : 'border-transparent text-slate-500 hover:text-slate-800'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
              {profileTab === 'profile' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-2">
                    <span className="font-bold text-slate-400 uppercase text-[10px]">Employment Information</span>
                    <div className="text-slate-800 dark:text-slate-200 font-semibold">Department: Civil Engineering</div>
                    <div className="text-slate-800 dark:text-slate-200 font-semibold">Contractor: {selectedPerson.tradeCompany || 'Apex Structural'}</div>
                    <div className="text-slate-800 dark:text-slate-200 font-semibold">Supervisor: Marcus Vance (EHS Director)</div>
                    <div className="text-slate-800 dark:text-slate-200 font-semibold">Hire Date: Jan 12, 2024</div>
                  </div>

                  <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl space-y-2">
                    <span className="font-bold text-slate-400 uppercase text-[10px]">Contact & Emergency</span>
                    <div className="text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-1.5"><Phone size={12}/> +1 (555) 019-2831</div>
                    <div className="text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-1.5"><Mail size={12}/> {selectedPerson.name.toLowerCase().replace(' ', '.')}@buildcorp.com</div>
                    <div className="text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-1.5"><Heart size={12} className="text-rose-500"/> Emergency Contact: Spouse (+1 555-992-1100)</div>
                  </div>
                </div>
              )}

              {profileTab === 'badge' && (
                <div className="flex flex-col items-center justify-center py-6 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="w-64 bg-white text-slate-900 border-2 border-slate-800 rounded-xl p-4 shadow-xl flex flex-col items-center gap-3">
                    <div className="w-16 h-16 rounded-full bg-[#007BC4] text-white flex items-center justify-center font-black text-2xl">
                      {selectedPerson.name.charAt(0)}
                    </div>
                    <div className="text-center">
                      <div className="font-extrabold text-sm">{selectedPerson.name}</div>
                      <div className="text-[10px] text-slate-500 uppercase font-bold">{selectedPerson.role}</div>
                    </div>
                    <div className="bg-slate-100 p-2 rounded-lg font-mono text-[11px] font-bold text-[#007BC4] tracking-widest border border-slate-300">
                      TAG: {selectedPerson.hardhatTagId || selectedPerson.id}
                    </div>
                  </div>
                  <button onClick={() => window.print()} className="mt-4 px-4 py-2 bg-[#007BC4] text-white rounded-xl text-xs font-bold flex items-center gap-2">
                    <Printer size={14} /> Print Hardhat Badge
                  </button>
                </div>
              )}

              {profileTab === 'movement' && (
                <div className="space-y-3">
                  <div className="font-bold text-slate-700 dark:text-slate-300">Real-Time Location & Dwell</div>
                  <div className="p-3 bg-blue-50 text-blue-900 border border-blue-200 rounded-xl flex items-center justify-between">
                    <span>Current Zone: <strong>{selectedPerson.currentZone}</strong></span>
                    <span>Dwell: <strong>{Math.floor(selectedPerson.dwellTime / 60)}m</strong></span>
                  </div>
                </div>
              )}

              {profileTab === 'safety' && (
                <div className="space-y-3">
                  <div className="p-4 bg-emerald-50 text-emerald-900 rounded-xl border border-emerald-200">
                    <div className="font-bold text-sm">OSHA 30 Safety Compliance Active</div>
                    <div className="text-xs mt-1">Full PPE Verified (Hardhat, High-Vis Vest, Steel Toe Boots, Safety Harness)</div>
                  </div>
                </div>
              )}

              {profileTab === 'ai' && (
                <div>
                  {isGeneratingAi ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 border-4 border-[#007BC4] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-slate-500 font-bold">Generating AI Worker Safety Summary...</span>
                    </div>
                  ) : (
                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl font-sans text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line border border-slate-200 dark:border-slate-700">
                      {aiSummary}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Worker Modal */}
      {isAddingModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl w-full max-w-md p-6 relative">
            <button onClick={() => setIsAddingModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">Register New Site Personnel</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Full Worker Name</label>
                <input
                  type="text"
                  placeholder="e.g. Marcus Vance"
                  value={newWorker.name}
                  onChange={e => setNewWorker({...newWorker, name: e.target.value})}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Hardhat RFID Tag ID</label>
                <input
                  type="text"
                  placeholder="e.g. HH-8891"
                  value={newWorker.hardhatTagId}
                  onChange={e => setNewWorker({...newWorker, hardhatTagId: e.target.value})}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Role / Trade</label>
                <select
                  value={newWorker.role}
                  onChange={e => setNewWorker({...newWorker, role: e.target.value})}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none"
                >
                  <option value="General Subcontractor">General Subcontractor</option>
                  <option value="Safety Officer (EHS)">Safety Officer (EHS)</option>
                  <option value="Site Inspector / Visitor">Site Inspector</option>
                </select>
              </div>
              <div className="pt-2 flex justify-end gap-2">
                <button
                  onClick={() => setIsAddingModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddWorker}
                  className="px-4 py-2 bg-[#007BC4] text-white rounded-xl font-bold"
                >
                  Save Worker
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

