import React, { useState, useEffect } from 'react';
import { UserPlus, QrCode, ClipboardCheck, ArrowRight, Clock, MapPin, Search, X, Calendar, User, Mail, Building, Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { collection, onSnapshot, doc, setDoc, updateDoc, getDocs } from '../lib/db';
import { db } from '../lib/firebase';
import QRCode from 'react-qr-code';

const INITIAL_MOCK_VISITORS = [
  { id: 'VIS-452', name: 'Sven Lindqvist', company: 'City Structural Audit Dept', host: 'marcus.vance@buildcorp.com', status: 'Pre-Registered', time: '10:00 AM Today', tag: 'Not Assigned', email: 'sven.l@citygov.org', location: 'Gate 1 Gatehouse', duration: '', path: [] },
  { id: 'VIS-451', name: 'David Chen', company: 'Apex Scaffold Solutions', host: 'elena.r@buildcorp.com', status: 'Active', time: 'Arrived 09:12 AM', tag: 'HH-7721 (Temp Hardhat Tag)', email: 'david.chen@apexscaffold.com', location: 'Structure & Scaffolding (L1-L4)', duration: '2h 15m', path: ['Gate 1', 'Site Office', 'Structure & Scaffolding'] },
  { id: 'VIS-450', name: 'Carlos Mendez', company: 'VoltCraft Electrical', host: 'site.super@buildcorp.com', status: 'Active', time: 'Arrived 09:30 AM', tag: 'HH-4011 (Subcontractor Tag)', email: 'carlos@voltcraft.com', location: 'Confined Shaft & Tunneling', duration: '1h 50m', path: ['Gate 1', 'Confined Shaft & Tunneling'] },
  { id: 'VIS-449', name: 'Frank Reynolds', company: 'Titan Heavy Machinery', host: 'jake.m@buildcorp.com', status: 'Active', time: 'Arrived 06:15 AM', tag: 'HH-9921 (Crane Tech Tag)', email: 'frank.r@titanmachinery.com', location: 'Heavy Crane & Exclusion Area', duration: '4h 40m', path: ['Gate 1', 'Laydown Yard', 'Heavy Crane Area'], isOverstayed: true, arrivalTime: Date.now() - 5 * 3600 * 1000 },
  { id: 'VIS-448', name: 'Elena Rostova', company: 'BuildCorp Safety EHS', host: 'marcus.vance@buildcorp.com', status: 'Completed', time: 'Left 08:45 AM', tag: 'Returned', email: 'elena.r@buildcorp.com', location: 'Checked Out', duration: '45m', path: ['Gate 1', 'Site Office', 'Gate 1'] },
  { id: 'VIS-447', name: 'Jose Rodriguez', company: 'ReadyMix Concrete Delivery', host: 'dispatch@buildcorp.com', status: 'Pre-Registered', time: '02:00 PM Today', tag: 'Not Assigned', email: 'jose@readymix.com', location: 'Pending Entry', duration: '', path: [] },
  { id: 'VIS-446', name: 'Dr. Sarah Lin', company: 'Geotechnical Soil Testing', host: 'marcus.vance@buildcorp.com', status: 'Active', time: 'Arrived 10:05 AM', tag: 'HH-1042 (Inspector Tag)', email: 'slin@geotech.io', location: 'Excavation & Foundation Pit', duration: '1h 10m', path: ['Gate 1', 'Site Office', 'Excavation & Foundation Pit'] }
];

export default function VisitorsTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Pre-Registered' | 'Completed' | 'Overstayed'>('All');
  const [visitors, setVisitors] = useState<any[]>([]);
  const [isPreRegisterModalOpen, setIsPreRegisterModalOpen] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState<any>(null);
  const [isFeeding, setIsFeeding] = useState(false);
  
  const [newVisitor, setNewVisitor] = useState({ name: '', company: '', host: '', email: '', date: '', time: '' });

  useEffect(() => {
    // Seed initial data if empty
    const seedData = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'visitors'));
        if (snapshot.empty) {
          for (const visitor of INITIAL_MOCK_VISITORS) {
            await setDoc(doc(db, 'visitors', visitor.id), visitor);
          }
        }
      } catch (err) {
        console.error("Error seeding visitors:", err);
      }
    };
    seedData();

    // Subscribe to visitors
    const unsubscribe = onSnapshot(collection(db, 'visitors'), (snapshot) => {
      const visitorsData = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setVisitors(visitorsData.sort((a, b) => b.id.localeCompare(a.id)));
    }, (error) => {
      console.error('Error fetching visitors:', error);
    });

    return () => unsubscribe();
  }, []);

  const handleFeedSampleVisitors = async () => {
    setIsFeeding(true);
    try {
      const sampleNames = [
        { name: 'Marcus Vance', company: 'Apex Structural Inspections', host: 'safety@aperturestaff.com', loc: 'Structure & Scaffolding (L1-L4)' },
        { name: 'Aisha Patel', company: 'Heavy Crane Logistics Inc.', host: 'site.manager@aperturestaff.com', loc: 'Heavy Crane & Exclusion Area' },
        { name: 'David Kim', company: 'Geotechnical Soil Audits', host: 'ground.lead@aperturestaff.com', loc: 'Excavation & Foundation Pit' },
        { name: 'Emma Watson', company: 'EcoEnergy Electrical Subcontractor', host: 'mep.lead@aperturestaff.com', loc: 'Confined Shaft & Tunneling' }
      ];

      for (let i = 0; i < sampleNames.length; i++) {
        const item = sampleNames[i];
        const newId = `VIS-${Math.floor(Math.random() * 800) + 500}`;
        const tagNum = Math.floor(Math.random() * 80) + 10;
        const freshRecord = {
          id: newId,
          name: item.name,
          company: item.company,
          host: item.host,
          email: `${item.name.toLowerCase().replace(' ', '.')}@partner.com`,
          status: i % 2 === 0 ? 'Active' : 'Pre-Registered',
          time: i % 2 === 0 ? `Arrived ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : `11:${15 * (i + 1)} AM Today`,
          tag: i % 2 === 0 ? `T0${tagNum} (Visitor Badge)` : 'Not Assigned',
          location: i % 2 === 0 ? item.loc : 'Pending Arrival',
          duration: i % 2 === 0 ? '15m' : '',
          path: i % 2 === 0 ? ['Lobby', item.loc] : [],
          qrCodeRef: `QR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        };
        await setDoc(doc(db, 'visitors', newId), freshRecord);
      }
    } catch (err) {
      console.error("Error feeding visitors:", err);
    } finally {
      setIsFeeding(false);
    }
  };

  useEffect(() => {
    // Background effect to identify overstayed visitors
    const interval = setInterval(() => {
      visitors.forEach(async (v) => {
        if (v.status === 'Active' && v.arrivalTime && !v.isOverstayed) {
          // For demo purposes, we consider overstayed if Duration > 4 hours
          if (Date.now() - v.arrivalTime > 4 * 60 * 60 * 1000) {
            try {
              await updateDoc(doc(db, 'visitors', v.id), { isOverstayed: true });
            } catch (err) {
              console.error("Error flagging overstayed visitor:", err);
            }
          }
        }
      });
    }, 60000); // Check every 60s
    return () => clearInterval(interval);
  }, [visitors]);

  const filteredVisitors = visitors.filter(v => {
    const matchesSearch = v.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      v.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;
    if (statusFilter === 'Active') return v.status === 'Active' && !v.isOverstayed;
    if (statusFilter === 'Pre-Registered') return v.status === 'Pre-Registered';
    if (statusFilter === 'Completed') return v.status === 'Completed';
    if (statusFilter === 'Overstayed') return v.status === 'Active' && v.isOverstayed;
    return true;
  });

  const handlePreRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `VIS-${Math.floor(Math.random() * 1000) + 500}`;
    const qrRef = `QR-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    const visitorRecord = {
      id: newId,
      name: newVisitor.name,
      company: newVisitor.company,
      host: newVisitor.host || 'admin@gaostaff.com',
      email: newVisitor.email,
      status: 'Pre-Registered',
      time: `${newVisitor.time || '09:00 AM'} ${newVisitor.date || 'Today'}`,
      tag: 'Not Assigned',
      location: '',
      duration: '',
      path: [],
      qrCodeRef: qrRef
    };

    try {
       await setDoc(doc(db, 'visitors', newId), visitorRecord);
       setIsPreRegisterModalOpen(false);
       setNewVisitor({ name: '', company: '', host: '', email: '', date: '', time: '' });
    } catch (err) {
       console.error("Error creating visitor:", err);
    }
  };

  const handleAssignTag = async (visitorId: string) => {
    try {
       await updateDoc(doc(db, 'visitors', visitorId), {
          status: 'Active', 
          tag: `T0${Math.floor(Math.random() * 90) + 10} (Visitor Badge)`,
          time: `Arrived ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
          location: 'Lobby',
          duration: '0m',
          path: ['Lobby'],
          arrivalTime: Date.now(),
          isOverstayed: false
       });
       setSelectedVisitor(null);
    } catch (err) {
       console.error("Error assigning tag:", err);
    }
  };

  const handleForceCheckout = async (visitorId: string) => {
     try {
       await updateDoc(doc(db, 'visitors', visitorId), {
          status: 'Completed', 
          tag: 'Returned',
          time: `Left ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`,
          location: 'Checked Out'
       });
       setSelectedVisitor(null);
     } catch (err) {
        console.error("Error checking out visitor:", err);
     }
  };

  return (
    <div className="w-full flex flex-col p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-[#007BC4]" />
            Visitor Lifecycle
          </h2>
          <p className="text-slate-500 font-medium tracking-tight">Manage pre-registrations, tag assignments, and live visitor tracking.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search visitors..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm w-52 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#007BC4]/20 focus:border-[#007BC4] transition"
            />
          </div>
          
          <button 
            onClick={handleFeedSampleVisitors}
            disabled={isFeeding}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" />
            {isFeeding ? 'Feeding Visitors...' : 'Feed New Visitors'}
          </button>

          <button 
            onClick={() => setIsPreRegisterModalOpen(true)}
            className="px-4 py-2 bg-[#007BC4] hover:bg-[#006aa9] text-white rounded-lg text-xs font-bold shadow-sm transition flex items-center gap-1.5"
          >
            <UserPlus className="w-4 h-4" />
            Pre-Register Visitor
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-slate-100 p-1.5 rounded-xl">
        <div className="flex items-center gap-1 overflow-x-auto">
          {(['All', 'Active', 'Pre-Registered', 'Completed', 'Overstayed'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
                statusFilter === tab 
                  ? 'bg-white text-slate-900 shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {tab === 'All' && `All (${visitors.length})`}
              {tab === 'Active' && `Active On-Site (${visitors.filter(v => v.status === 'Active' && !v.isOverstayed).length})`}
              {tab === 'Pre-Registered' && `Pre-Registered (${visitors.filter(v => v.status === 'Pre-Registered').length})`}
              {tab === 'Completed' && `Completed (${visitors.filter(v => v.status === 'Completed').length})`}
              {tab === 'Overstayed' && `Overstayed (${visitors.filter(v => v.status === 'Active' && v.isOverstayed).length})`}
            </button>
          ))}
        </div>
        <div className="text-xs text-slate-500 font-medium px-2">
           Showing <span className="font-bold text-slate-900">{filteredVisitors.length}</span> of {visitors.length} visitor records
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-8 shrink-0">
         <div className="col-span-5 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex items-center justify-between">
            <div className="flex-1 flex flex-col items-center relative z-10">
               <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center border-4 border-white shadow-sm mb-2 text-indigo-600">
                  <UserPlus className="w-5 h-5"/>
               </div>
               <span className="text-xs font-bold text-slate-600 uppercase">1. Pre-Register</span>
            </div>
            <div className="h-0.5 bg-slate-200 flex-1 -mx-8 relative top-[-10px] z-0" />
            <div className="flex-1 flex flex-col items-center relative z-10">
               <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center border-4 border-white shadow-sm mb-2 text-amber-600">
                  <QrCode className="w-5 h-5"/>
               </div>
               <span className="text-xs font-bold text-slate-600 uppercase">2. QR Check-In</span>
            </div>
            <div className="h-0.5 bg-slate-200 flex-1 -mx-8 relative top-[-10px] z-0" />
            <div className="flex-1 flex flex-col items-center relative z-10">
               <div className="w-12 h-12 bg-[#007BC4]/20 rounded-full flex items-center justify-center border-4 border-white shadow-sm mb-2 text-[#007BC4]">
                  <ArrowRight className="w-5 h-5"/>
               </div>
               <span className="text-xs font-bold text-slate-600 uppercase">3. Issue RFID</span>
            </div>
            <div className="h-0.5 bg-slate-200 flex-1 -mx-8 relative top-[-10px] z-0" />
            <div className="flex-1 flex flex-col items-center relative z-10">
               <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center border-4 border-white shadow-sm mb-2 text-emerald-600">
                  <MapPin className="w-5 h-5"/>
               </div>
               <span className="text-xs font-bold text-slate-600 uppercase">4. Live Tracking</span>
            </div>
            <div className="h-0.5 bg-slate-200 flex-1 -mx-8 relative top-[-10px] z-0" />
            <div className="flex-1 flex flex-col items-center relative z-10 opacity-50">
               <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center border-4 border-white shadow-sm mb-2 text-slate-500">
                  <ClipboardCheck className="w-5 h-5"/>
               </div>
               <span className="text-xs font-bold text-slate-600 uppercase">5. Auto Checkout</span>
            </div>
         </div>
      </div>

      <div className="bg-white border flex-1 border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col min-h-0">
        <div className="overflow-y-auto flex-1">
          <Table>
            <TableHeader className="bg-slate-50 sticky top-0 z-10 shadow-sm border-b border-slate-200">
              <TableRow>
                <TableHead className="py-4">Visitor Details</TableHead>
                <TableHead className="py-4">Host</TableHead>
                <TableHead className="py-4">Schedule / Time</TableHead>
                <TableHead className="py-4">RFID Tag</TableHead>
                <TableHead className="py-4 text-right">Status</TableHead>
                <TableHead className="py-4 w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVisitors.map((v) => (
                <TableRow key={v.id} className="border-slate-100 hover:bg-slate-50 transition-colors">
                  <TableCell>
                    <div className="font-semibold text-slate-900">{v.name}</div>
                    <div className="text-xs text-slate-500 font-medium">{v.company}</div>
                  </TableCell>
                  <TableCell>
                     <div className="text-sm font-medium text-slate-700">{v.host}</div>
                  </TableCell>
                  <TableCell>
                     <div className="text-sm font-medium text-slate-600 flex items-center gap-1.5"><Clock className="w-3 h-3 text-slate-400"/> {v.time}</div>
                  </TableCell>
                  <TableCell>
                     <div className="font-mono text-sm">{v.tag}</div>
                  </TableCell>
                  <TableCell className="text-right">
                     {v.status === 'Pre-Registered' && <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">Pre-Registered</Badge>}
                     {v.status === 'Active' && !v.isOverstayed && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse">Active</Badge>}
                     {v.status === 'Active' && v.isOverstayed && <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 shadow-sm border">Overstayed</Badge>}
                     {v.status === 'Completed' && <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">Completed</Badge>}
                  </TableCell>
                  <TableCell>
                     <button 
                       onClick={() => setSelectedVisitor(v)}
                       className="text-[#007BC4] font-bold text-xs hover:underline"
                     >
                       Manage
                     </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedVisitor && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200 flex items-start justify-between bg-slate-50/50">
               <div className="flex gap-4 items-center">
                 <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-600 border-2 border-white shadow-sm text-lg">
                    {selectedVisitor.name.charAt(0)}
                 </div>
                 <div>
                    <h3 className="text-xl font-bold text-slate-900">{selectedVisitor.name}</h3>
                    <div className="text-sm font-medium text-slate-500 mt-0.5">{selectedVisitor.company}</div>
                 </div>
               </div>
               <button onClick={() => setSelectedVisitor(null)} className="text-slate-400 hover:text-slate-700 transition">
                 <X className="w-6 h-6" />
               </button>
            </div>
            
            <div className="p-6">
              <div className="space-y-4 mb-6">
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Status</span>
                    {selectedVisitor.status === 'Pre-Registered' && <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">Pre-Registered</Badge>}
                    {selectedVisitor.status === 'Active' && !selectedVisitor.isOverstayed && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse">Active On-Site</Badge>}
                    {selectedVisitor.status === 'Active' && selectedVisitor.isOverstayed && <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 border shadow-sm">Flagged: Overstayed</Badge>}
                    {selectedVisitor.status === 'Completed' && <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">Visit Completed</Badge>}
                 </div>
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Host</span>
                    <span className="font-semibold text-slate-700">{selectedVisitor.host}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">{selectedVisitor.status === 'Pre-Registered' ? 'Scheduled' : selectedVisitor.status === 'Active' ? 'Check-in Time' : 'Check-out Time'}</span>
                    <span className="font-semibold text-slate-700">{selectedVisitor.time}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500 font-medium">Assigned Tag</span>
                    <span className="font-mono font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{selectedVisitor.tag}</span>
                 </div>
                 {selectedVisitor.status === 'Active' && (
                   <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-100">
                      <span className="text-slate-500 font-medium">Current Location</span>
                      <span className="font-bold text-[#007BC4] flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5"/> {selectedVisitor.location}</span>
                   </div>
                 )}
                 {selectedVisitor.status === 'Completed' && (
                   <div className="pt-2 border-t border-slate-100 space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                         <span className="text-slate-500 font-medium">Total Duration</span>
                         <span className="font-semibold text-slate-700">{selectedVisitor.duration}</span>
                      </div>
                      <div className="flex flex-col mt-2">
                         <span className="text-slate-500 font-medium mb-1">Path Travelled</span>
                         <div className="text-xs text-slate-600 font-medium leading-relaxed">
                            {selectedVisitor.path?.join(' → ') || 'No data'}
                         </div>
                      </div>
                   </div>
                 )}
              </div>

              {selectedVisitor.status === 'Pre-Registered' && selectedVisitor.qrCodeRef && (
                 <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl flex flex-col items-center">
                    <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm mb-3">
                       <QRCode value={selectedVisitor.qrCodeRef} size={100} />
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-500">{selectedVisitor.qrCodeRef}</span>
                    <span className="text-xs text-slate-400 mt-1">Scan for quick check-in verification</span>
                 </div>
              )}

              {selectedVisitor.status === 'Pre-Registered' && (
                <button 
                  onClick={() => handleAssignTag(selectedVisitor.id)}
                  className="w-full bg-[#007BC4] text-white py-3 rounded-xl font-bold text-sm hover:bg-[#006aa9] transition shadow-md flex items-center justify-center gap-2"
                >
                   <ArrowRight className="w-4 h-4" /> Issue Tag & Complete Check-In
                </button>
              )}
              {selectedVisitor.status === 'Active' && (
                <button 
                  onClick={() => handleForceCheckout(selectedVisitor.id)}
                  className="w-full bg-rose-50 border border-rose-200 text-rose-600 py-3 rounded-xl font-bold text-sm hover:bg-rose-100 transition shadow-sm flex items-center justify-center gap-2"
                >
                   <ClipboardCheck className="w-4 h-4" /> Force Checkout & Reclaim Tag
                </button>
              )}
              {selectedVisitor.status === 'Completed' && (
                <button 
                  onClick={() => setSelectedVisitor(null)}
                  className="w-full bg-slate-100 text-slate-700 py-3 rounded-xl font-bold text-sm hover:bg-slate-200 transition shadow-sm"
                >
                   View Visit Report
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pre-Register Modal */}
      {isPreRegisterModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#007BC4]" />
                Pre-Register New Visitor
              </h3>
              <button onClick={() => setIsPreRegisterModalOpen(false)} className="text-slate-400 hover:text-slate-700 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handlePreRegisterSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Visitor Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Eleanor Vance"
                    value={newVisitor.name}
                    onChange={e => setNewVisitor({ ...newVisitor, name: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#007BC4]/20 focus:border-[#007BC4]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Company / Org</label>
                  <div className="relative">
                    <Building className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Apex Dynamics"
                      value={newVisitor.company}
                      onChange={e => setNewVisitor({ ...newVisitor, company: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#007BC4]/20 focus:border-[#007BC4]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Visitor Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="email" 
                      required 
                      placeholder="e.g. eleanor@apex.com"
                      value={newVisitor.email}
                      onChange={e => setNewVisitor({ ...newVisitor, email: e.target.value })}
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#007BC4]/20 focus:border-[#007BC4]"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Host Email / Staff Member</label>
                <div className="relative">
                  <Briefcase className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input 
                    type="text" 
                    placeholder="sarah.j@gaostaff.com"
                    value={newVisitor.host}
                    onChange={e => setNewVisitor({ ...newVisitor, host: e.target.value })}
                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#007BC4]/20 focus:border-[#007BC4]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Expected Date</label>
                  <input 
                    type="text" 
                    placeholder="Today or YYYY-MM-DD"
                    value={newVisitor.date}
                    onChange={e => setNewVisitor({ ...newVisitor, date: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#007BC4]/20 focus:border-[#007BC4]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Expected Time</label>
                  <input 
                    type="text" 
                    placeholder="10:30 AM"
                    value={newVisitor.time}
                    onChange={e => setNewVisitor({ ...newVisitor, time: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#007BC4]/20 focus:border-[#007BC4]"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsPreRegisterModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-[#007BC4] hover:bg-[#006aa9] text-white rounded-lg text-sm font-bold shadow-md transition"
                >
                  Create Pre-Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
