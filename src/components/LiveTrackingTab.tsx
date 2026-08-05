import React, { useState, useEffect, useMemo } from 'react';
import { Person, Asset, Vehicle, CameraDevice, EnvSensor } from '../types';
import LiveFloorMap, { MapMode, ReaderDevice, AccessGate, MaterialAsset, VisibleLayers } from './LiveFloorMap';
import LiveTrackingContextDrawer, { SelectedEntity } from './LiveTrackingContextDrawer';
import { 
  Search, AlertTriangle, UserCheck, Building2, 
  Layers, Users, Maximize2, Minimize2, Truck, HardHat, Camera, Thermometer,
  Radio, Navigation, Eye, EyeOff, Map as MapIcon, Layout, ShieldAlert, Activity,
  Database, Info, Terminal, Zap, ChevronDown, Filter, Settings, Bell, Flame,
  Box, Warehouse, MoreVertical, SlidersHorizontal, Trash2, BarChart3, ShieldCheck, Check
} from 'lucide-react';
import { useLocation } from 'react-router-dom';
import ManageWorkforceModal from './ManageWorkforceModal';
import { db, collection, onSnapshot, doc } from '../lib/db';
import { ZoneBounds } from './MapEditorModal';
import { HardwareDevice } from './HardwareConfigModal';

// Mock additional entities for enterprise view
const MOCK_READERS: ReaderDevice[] = [
  { id: 'RDR-001', name: 'West Gate Reader', x: 5, y: 50, range: 12, health: 98, status: 'online' },
  { id: 'RDR-002', name: 'Crane Area Reader', x: 85, y: 30, range: 15, health: 94, status: 'online' },
  { id: 'RDR-003', name: 'Core Shaft Reader', x: 65, y: 50, range: 10, health: 82, status: 'online' },
  { id: 'RDR-004', name: 'Storage Yard Reader', x: 30, y: 80, range: 20, health: 100, status: 'online' },
];

const MOCK_GATES: AccessGate[] = [
  { id: 'GAT-01', name: 'Main Vehicle Entry', x: 2, y: 50, status: 'locked' },
  { id: 'GAT-02', name: 'Staff Turnstile West', x: 2, y: 55, status: 'unlocked' },
  { id: 'GAT-03', name: 'Staff Turnstile East', x: 98, y: 50, status: 'locked' },
];

const MOCK_MATERIALS: MaterialAsset[] = [
  { id: 'MAT-101', name: 'Structural Steel Bundles', type: 'Steel', x: 25, y: 75 },
  { id: 'MAT-102', name: 'Concrete Formwork', type: 'Wood', x: 45, y: 40 },
  { id: 'MAT-103', name: 'Piping Assemblies', type: 'PVC/Copper', x: 15, y: 30 },
];

export interface ProjectProperties {
  id: string;
  name: string;
  contractor: string;
  sizeSqFt: number;
  dimensions: string;
  floorplanUrl: string;
  localPeople?: Person[];
  customZones?: Record<string, ZoneBounds>;
  hardwareDevices?: HardwareDevice[];
}

const INITIAL_PROJECT_PROPERTIES: Record<string, ProjectProperties> = {
  'metro-tower': {
    id: 'metro-tower',
    name: 'Metro Commercial Tower Site',
    contractor: 'Apex Construction JV',
    sizeSqFt: 350000,
    dimensions: '250m x 180m',
    floorplanUrl: 'https://images.unsplash.com/photo-1581094288338-2314dddb7ecc?auto=format&fit=crop&q=80&w=1200',
    customZones: {
      'Excavation Shaft': { x: 10, y: 15, width: 34, height: 62, category: 'EXCAVATION & SHORING', hazardLevel: 'warning' },
      'Tower Core': { x: 51, y: 25, width: 32, height: 50, category: 'CONCRETE REINFORCEMENT' },
      'Crane Swing Zone': { x: 80, y: 5, width: 16, height: 42, category: 'CRANE SWING RADIUS', hazardLevel: 'critical' },
      'Muster Point A': { x: 2, y: 10, width: 8, height: 12, category: 'MUSTER POINT' }
    }
  }
};

export default function LiveTrackingTab({ 
  people: propPeople, 
  assets: propAssets,
  vehicles: propVehicles,
  zones: defaultZones, 
  highlightedPersonId, 
  activeProject: propActiveProject,
  setActiveProject: propSetActiveProject
}: { 
  people: Person[]; 
  assets: Asset[];
  vehicles: Vehicle[];
  zones: Record<string, {x:number; y:number; width:number; height:number}>; 
  highlightedPersonId?: string | null; 
  activeProject?: string;
  setActiveProject?: (id: string) => void;
}) {
  const location = useLocation();
  const focusZone = location.state?.focusZone || null;
  const [localActiveProject, setLocalActiveProject] = useState('metro-tower');
  const activeProject = propActiveProject !== undefined ? propActiveProject : localActiveProject;

  const currentProject = INITIAL_PROJECT_PROPERTIES[activeProject] || INITIAL_PROJECT_PROPERTIES['metro-tower'];
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntity, setSelectedEntity] = useState<SelectedEntity>(null);
  const [isWorkforceModalOpen, setIsWorkforceModalOpen] = useState(false);
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);
  const [activeTab, setActiveTab] = useState<'people' | 'assets' | 'hardware' | 'zones'>('people');
  const [mapMode, setMapMode] = useState<MapMode>('standard');
  const [activeFloor, setActiveFloor] = useState('B1');
  const [selectedTrade, setSelectedTrade] = useState<string>('ALL');
  const [isMapFullScreen, setIsMapFullScreen] = useState(false);

  const [visibleLayers, setVisibleLayers] = useState<VisibleLayers>({
    workers: true,
    assets: true,
    vehicles: true,
    readers: true,
    zones: true,
    cameras: true,
    sensors: true,
    heatmapOverlay: false,
  });
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState(false);
  
  const [dbPeople, setDbPeople] = useState<Person[]>([]);
  const [dbAssets, setDbAssets] = useState<Asset[]>([]);
  const [dbVehicles, setDbVehicles] = useState<Vehicle[]>([]);
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [sensors, setSensors] = useState<EnvSensor[]>([]);
  const [projectMeta, setProjectMeta] = useState<any>(null);

  // Combine props (simulated/real-time) with DB items, avoiding duplicates
  const people = useMemo(() => {
    const combined = [...dbPeople];
    propPeople.forEach(simP => {
      if (!combined.find(p => p.id === simP.id)) combined.push(simP);
    });
    return combined;
  }, [dbPeople, propPeople]);

  const assets = useMemo(() => {
    const combined = [...dbAssets];
    propAssets.forEach(simA => {
      if (!combined.find(a => a.id === simA.id)) combined.push(simA);
    });
    return combined;
  }, [propAssets, dbAssets]);

  const vehicles = useMemo(() => {
    const combined = [...dbVehicles];
    propVehicles.forEach(simV => {
      if (!combined.find(v => v.id === simV.id)) combined.push(simV);
    });
    return combined;
  }, [propVehicles, dbVehicles]);

  useEffect(() => {
    const unsubProject = onSnapshot(doc(db, 'projects', activeProject), (snap: any) => {
      if (snap.exists()) setProjectMeta(snap.data());
    });
    const unsubPeople = onSnapshot(collection(db, 'people'), (snap: any) => {
      const items = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
      setDbPeople(items.filter((p: any) => p.projectId === activeProject));
    });
    const unsubAssets = onSnapshot(collection(db, 'assets'), (snap: any) => setDbAssets(snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))));
    const unsubVehicles = onSnapshot(collection(db, 'vehicles'), (snap: any) => setDbVehicles(snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))));
    const unsubCameras = onSnapshot(collection(db, 'cameras'), (snap: any) => setCameras(snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))));
    const unsubSensors = onSnapshot(collection(db, 'sensors'), (snap: any) => setSensors(snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))));

    return () => { unsubProject(); unsubPeople(); unsubAssets(); unsubVehicles(); unsubCameras(); unsubSensors(); };
  }, [activeProject]);

  useEffect(() => {
    if (highlightedPersonId) {
      const found = people.find(p => p.id === highlightedPersonId);
      if (found) setSelectedEntity({ type: 'person', data: found });
    }
  }, [highlightedPersonId, people]);

  const filteredPeople = useMemo(() => {
    if (!searchQuery) return people;
    const q = searchQuery.toLowerCase();
    return people.filter(p => 
      p.name.toLowerCase().includes(q) || p.id.toLowerCase().includes(q) || 
      p.role.toLowerCase().includes(q) || p.currentZone.toLowerCase().includes(q)
    );
  }, [people, searchQuery]);

  const displayedPeople = useMemo(() => {
    let result = filteredPeople;
    if (selectedTrade !== 'ALL') {
      const tradeLower = selectedTrade.toLowerCase();
      result = result.filter(p => p.role.toLowerCase().includes(tradeLower));
    }
    return result;
  }, [filteredPeople, selectedTrade]);

  const TRADE_OPTIONS = useMemo(() => {
    const list = [
      { id: 'ALL', label: 'All Trades', icon: '👷' },
      { id: 'Electrician', label: 'Electricians', icon: '⚡' },
      { id: 'Steelworker', label: 'Steelworkers', icon: '🏗️' },
      { id: 'Scaffolder', label: 'Scaffolders', icon: '🪜' },
      { id: 'Inspector', label: 'Inspectors', icon: '📋' },
      { id: 'Concrete', label: 'Concrete Crew', icon: '🧱' },
      { id: 'EHS', label: 'EHS Officers', icon: '🛡️' },
      { id: 'Operator', label: 'Heavy Operators', icon: '🚜' },
    ];
    return list.map(t => {
      const count = t.id === 'ALL' 
        ? people.length 
        : people.filter(p => p.role.toLowerCase().includes(t.id.toLowerCase())).length;
      return { ...t, count };
    });
  }, [people]);

  const highRiskZoneCount = people.filter(p => 
    p.currentZone === 'Crane Swing Zone' || p.currentZone === 'Excavation Shaft'
  ).length;

  return (
    <div className="w-full flex flex-col bg-slate-50 p-4 md:p-6 max-w-[1800px] mx-auto min-h-screen space-y-4 font-sans transition-all">
      
      {/* 1. TOP BAR DASHBOARD HEADER */}
      <div className="bg-white rounded-2xl p-4 shadow-md border border-slate-200 flex flex-col xl:flex-row justify-between items-stretch xl:items-center gap-4">
        <div className="flex items-center gap-4 border-r border-slate-200 pr-6 mr-2">
          <div className="p-3 bg-slate-900 rounded-xl text-white">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight">{projectMeta?.name || currentProject.name}</h1>
              <ChevronDown className="w-4 h-4 text-slate-400" />
            </div>
            <div className="flex items-center gap-3 text-xs font-bold text-slate-500">
               <span className="flex items-center gap-1"><MapIcon className="w-3 h-3" /> Area A Sector 4</span>
               <span className="flex items-center gap-1 border-l pl-3 border-slate-200"><Info className="w-3 h-3" /> {currentProject.contractor}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center gap-4">
          {/* Floor Selector */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
             {['B3', 'B2', 'B1', 'L1', 'L2', 'L3', 'L15'].map(floor => (
               <button 
                 key={floor} 
                 onClick={() => setActiveFloor(floor)}
                 className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest transition ${
                   activeFloor === floor ? 'bg-white text-sky-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                 }`}
               >
                 {floor}
               </button>
             ))}
          </div>

          <div className="flex bg-slate-100 border border-slate-200 rounded-xl overflow-hidden flex-1 max-w-md focus-within:ring-2 focus-within:ring-sky-500/50 transition-all">
            <div className="pl-3 py-2.5 text-slate-400 flex items-center">
              <Search className="w-4 h-4" />
            </div>
            <input 
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search Personnel, Assets, Tags..."
              className="bg-transparent pl-2 pr-3 py-2 text-sm font-semibold text-slate-900 outline-none w-full placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
          </button>
          <button
            onClick={() => {
              setIsEmergencyMode(!isEmergencyMode);
              if (!isEmergencyMode) setMapMode('evacuation');
              else setMapMode('standard');
            }}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider transition shadow-lg ${
              isEmergencyMode 
                ? 'bg-rose-600 text-white animate-pulse' 
                : 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            {isEmergencyMode ? 'EVACUATION ACTIVE' : 'SOS EMERGENCY'}
          </button>
        </div>
      </div>

      {/* 2. KPI STATUS DASHBOARD */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Personnel Onsite', val: people.length, icon: Users, color: 'text-sky-600', bg: 'bg-sky-50' },
          { label: 'Heavy Equipment', val: vehicles.length, icon: Truck, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Active Materials', val: MOCK_MATERIALS.length, icon: Box, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Hazard Breaches', val: highRiskZoneCount, icon: AlertTriangle, color: highRiskZoneCount > 0 ? 'text-rose-600' : 'text-slate-400', bg: highRiskZoneCount > 0 ? 'bg-rose-50 animate-pulse' : 'bg-slate-50' },
          { label: 'System Health', val: '98%', icon: Zap, color: 'text-emerald-600', bg: 'bg-emerald-50' }
        ].map((kpi, i) => (
          <div key={i} className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
             <div className={`p-3 ${kpi.bg} ${kpi.color} rounded-xl`}><kpi.icon className="w-5 h-5" /></div>
             <div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{kpi.label}</div>
                <div className="text-xl font-black text-slate-900">{kpi.val}</div>
             </div>
          </div>
        ))}
      </div>

      {/* 3. MAIN WORKSPACE ENGINE */}
      <div className="flex flex-col xl:flex-row gap-4 items-stretch h-[calc(100vh-320px)] min-h-[600px]">
        
        {/* LEFT NAV PANEL - Lists */}
        <div className={`${isMapFullScreen ? 'hidden' : 'w-full xl:w-80'} bg-white rounded-2xl border border-slate-200 shadow-md flex flex-col overflow-hidden shrink-0`}>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
             <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">System Entities</h2>
             <button className="text-slate-400 hover:text-slate-600"><SlidersHorizontal className="w-4 h-4" /></button>
          </div>
          
          <div className="flex bg-slate-50 border-b border-slate-100">
            {[
              { id: 'people', icon: UserCheck, label: 'Workers' },
              { id: 'assets', icon: Box, label: 'Assets' },
              { id: 'hardware', icon: Radio, label: 'Readers' },
              { id: 'zones', icon: Layout, label: 'Zones' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-3 text-[9px] font-black uppercase tracking-wider flex flex-col items-center gap-1 transition ${
                  activeTab === tab.id ? 'bg-white text-sky-600 border-b-2 border-sky-600' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-white">
             {activeTab === 'people' && filteredPeople.map(p => (
                <div key={p.id} onClick={() => setSelectedEntity({ type: 'person', data: p })} className="group p-2 rounded-xl hover:bg-sky-50 cursor-pointer transition border border-transparent hover:border-sky-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center font-black text-slate-500 text-xs">
                       {p.name.substring(0, 1)}
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900">{p.name}</div>
                      <div className="text-[10px] font-bold text-slate-400">{p.role}</div>
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${p.ppeStatus === 'NON_COMPLIANT' ? 'bg-rose-500 animate-pulse' : 'bg-emerald-500'}`} />
                </div>
              ))}

              {activeTab === 'assets' && (
                <div className="space-y-4 p-2">
                   {assets.length > 0 && (
                     <>
                       <div className="text-[10px] font-black text-slate-400 uppercase border-b pb-1">Site Equipment & Tools</div>
                       {assets.map(a => (
                         <div 
                           key={a.id} 
                           onClick={() => setSelectedEntity({ 
                             type: 'asset', 
                             data: { 
                               id: a.id, 
                               name: a.name, 
                               category: 'Power Tool', 
                               location: 'Active Construction Zone', 
                               assignedWorker: 'Unassigned', 
                               status: 'Operating', 
                               utilization: 85, 
                               lastMovement: 'Just now', 
                               battery: a.battery || 90, 
                               x: a.x || 50, 
                               y: a.y || 50 
                             } 
                           })} 
                           className="flex items-center justify-between p-2 hover:bg-emerald-50 rounded-lg cursor-pointer transition border border-transparent hover:border-emerald-100"
                         >
                            <div className="flex items-center gap-2">
                               <HardHat className="w-4 h-4 text-emerald-600" />
                               <div>
                                 <span className="text-xs font-bold text-slate-900 block leading-tight">{a.name}</span>
                                 <span className="text-[9px] text-slate-400 font-mono">{a.type || 'Equipment'}</span>
                               </div>
                            </div>
                            <span className="text-[9px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                              {a.status?.toUpperCase() || 'ONLINE'}
                            </span>
                         </div>
                       ))}
                     </>
                   )}

                   <div className="text-[10px] font-black text-slate-400 uppercase border-b pb-1">Heavy Vehicles</div>
                   {vehicles.map(v => (
                     <div 
                       key={v.id} 
                       onClick={() => setSelectedEntity({ 
                         type: 'vehicle', 
                         data: { 
                           id: v.id, 
                           name: v.name, 
                           type: 'Hydraulic Excavator', 
                           operator: 'Certified Operator', 
                           location: 'Excavation Sector', 
                           speed: v.speed || 0, 
                           direction: 90, 
                           status: 'Active', 
                           fuel: 88, 
                           x: v.x || 30, 
                           y: v.y || 40 
                         } 
                       })} 
                       className="flex items-center justify-between p-2 hover:bg-amber-50 rounded-lg cursor-pointer transition border border-transparent hover:border-amber-100"
                     >
                        <div className="flex items-center gap-2">
                           <Truck className="w-4 h-4 text-amber-600" />
                           <div>
                             <span className="text-xs font-bold text-slate-900 block leading-tight">{v.name}</span>
                             <span className="text-[9px] text-slate-400 font-mono">{v.type || 'Vehicle'}</span>
                           </div>
                        </div>
                        <span className={`text-[9px] font-black ${v.status === 'Active' || v.status === 'Moving' ? 'text-emerald-600' : 'text-slate-400'}`}>
                           {v.status?.toUpperCase() || 'ONLINE'}
                        </span>
                     </div>
                   ))}

                   <div className="text-[10px] font-black text-slate-400 uppercase border-b pb-1 mt-4">Structural Materials</div>
                   {MOCK_MATERIALS.map(m => (
                     <div 
                       key={m.id} 
                       onClick={() => setSelectedEntity({ 
                         type: 'asset', 
                         data: { 
                           id: m.id, 
                           name: m.name, 
                           category: 'Material Pallet', 
                           location: 'Material Yard B', 
                           assignedWorker: 'Logistics Team', 
                           status: 'Standby', 
                           utilization: 10, 
                           lastMovement: '1 hour ago', 
                           battery: 100, 
                           x: m.x, 
                           y: m.y 
                         } 
                       })} 
                       className="flex items-center justify-between p-2 hover:bg-indigo-50 rounded-lg cursor-pointer border border-transparent hover:border-indigo-100"
                     >
                        <div className="flex items-center gap-2">
                           <Box className="w-4 h-4 text-indigo-600" />
                           <span className="text-xs font-bold text-slate-900">{m.name}</span>
                        </div>
                        <span className="text-[9px] font-black text-slate-400">STATIC</span>
                     </div>
                   ))}
                </div>
              )}

              {activeTab === 'hardware' && (
                 <div className="space-y-3 p-2">
                   <div className="text-[10px] font-black text-slate-400 uppercase border-b pb-1">GAO RFID Readers</div>
                   {MOCK_READERS.map(r => (
                     <div 
                       key={r.id} 
                       onClick={() => setSelectedEntity({
                         type: 'infrastructure',
                         data: {
                           id: r.id,
                           name: r.name,
                           type: 'UHF RFID Reader',
                           location: 'Portal Sector West',
                           ipAddress: '10.0.1.12',
                           macAddress: 'AA:BB:CC:DD:EE:11',
                           status: r.status === 'online' ? 'Online' : 'Offline',
                           signalRssi: -55,
                           battery: r.health,
                           x: r.x,
                           y: r.y
                         }
                       })}
                       className="p-2.5 bg-slate-50 hover:bg-indigo-50/50 rounded-xl border border-slate-200 cursor-pointer transition"
                     >
                        <div className="flex items-center justify-between mb-1">
                           <div className="flex items-center gap-2">
                              <Radio className="w-3.5 h-3.5 text-indigo-600" />
                              <span className="text-xs font-black text-slate-900">{r.name}</span>
                           </div>
                           <span className={`w-2 h-2 rounded-full ${r.status === 'online' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        </div>
                        <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                           <span>Health: <span className="text-slate-800 font-extrabold">{r.health}%</span></span>
                           <span>Range: <span className="text-indigo-600 font-extrabold">{r.range}m</span></span>
                        </div>
                     </div>
                   ))}

                   {cameras.length > 0 && (
                     <>
                       <div className="text-[10px] font-black text-slate-400 uppercase border-b pb-1 mt-4">CCTV AI Cameras</div>
                       {cameras.map(c => (
                         <div 
                           key={c.id} 
                           onClick={() => setSelectedEntity({
                             type: 'camera',
                             data: {
                               id: c.id,
                               name: c.name,
                               zone: 'Building Core',
                               status: c.status === 'offline' ? 'Offline' : 'Online',
                               aiStatus: 'Active',
                               aiFeatures: ['PPE Optical Check', 'Geofence Breach', 'Facial Rec'],
                               recentEvent: 'PPE Verification OK',
                               streamResolution: '4K UltraHD',
                               x: c.x,
                               y: c.y,
                               angle: 45
                             }
                           })}
                           className="p-2.5 bg-slate-50 hover:bg-purple-50/50 rounded-xl border border-slate-200 cursor-pointer transition flex items-center justify-between"
                         >
                            <div className="flex items-center gap-2">
                               <Camera className="w-3.5 h-3.5 text-purple-600" />
                               <span className="text-xs font-black text-slate-900">{c.name}</span>
                            </div>
                            <span className="text-[9px] font-black text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">4K AI</span>
                         </div>
                       ))}
                     </>
                   )}
                 </div>
              )}

              {activeTab === 'zones' && (
                 <div className="space-y-3 p-2">
                   <div className="text-[10px] font-black text-slate-400 uppercase border-b pb-1">Geofenced Site Zones</div>
                   {Object.entries(projectMeta?.customZones || currentProject.customZones || defaultZones).map(([zName, zBounds]: [string, any]) => {
                     const isHazard = zBounds.hazardLevel === 'critical' || zBounds.hazardLevel === 'warning';
                     const occupantCount = people.filter(p => p.currentZone === zName).length;

                     return (
                       <div 
                         key={zName} 
                         onClick={() => setSelectedEntity({
                           type: 'infrastructure',
                           data: {
                             id: `zone-${zName.replace(/\s+/g, '-').toLowerCase()}`,
                             name: zName,
                             type: 'UHF RFID Reader',
                             location: zName,
                             ipAddress: '192.168.10.100',
                             macAddress: 'FF:EE:DD:CC:BB:AA',
                             status: isHazard ? 'Warning' : 'Online',
                             signalRssi: -50,
                             battery: 100,
                             x: zBounds.x,
                             y: zBounds.y
                           }
                         })}
                         className={`p-3 rounded-xl border transition cursor-pointer ${
                           isHazard ? 'bg-rose-50/60 border-rose-200 hover:bg-rose-100/80' : 'bg-slate-50 border-slate-200 hover:bg-sky-50'
                         }`}
                       >
                          <div className="flex items-center justify-between mb-1">
                             <span className="text-xs font-black text-slate-900">{zName}</span>
                             <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                               isHazard ? 'bg-rose-600 text-white' : 'bg-sky-100 text-sky-700'
                             }`}>
                               {isHazard ? 'Hazard' : 'Active'}
                             </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                             <span>Category: <span className="text-slate-800">{zBounds.category || 'General'}</span></span>
                             <span className="text-sky-600 font-extrabold">{occupantCount} Workers</span>
                          </div>
                       </div>
                     );
                   })}
                 </div>
              )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100">
             <button onClick={() => setIsWorkforceModalOpen(true)} className="w-full bg-slate-900 text-white py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-lg hover:bg-slate-800 transition">
                <Settings className="w-4 h-4" /> System Calibration
             </button>
          </div>
        </div>

        {/* CENTER INTERACTIVE MAP CANVAS */}
        <div className={`transition-all duration-300 ${
          isMapFullScreen 
            ? 'fixed inset-0 z-50 bg-slate-950 rounded-none border-none flex flex-col h-screen w-screen p-0' 
            : 'flex-1 bg-white rounded-2xl border border-slate-200 shadow-md flex flex-col overflow-hidden'
        }`}>
          {/* Map Mode Selector Top Bar & Layer Controls */}
          <div className="p-2 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
             <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1 sm:pb-0 scroll-smooth">
                {[
                  { id: 'standard', label: '2D Layout', icon: MapIcon },
                  { id: 'bim', label: 'Digital Twin', icon: Warehouse },
                  { id: 'satellite', label: 'Satellite', icon: MapIcon },
                  { id: 'heatmap', label: 'Heat Map', icon: Activity },
                  { id: 'coverage', label: 'RFID Coverage', icon: Radio },
                  { id: 'evacuation', label: 'Evacuation', icon: ShieldAlert },
                  { id: 'asset', label: 'Asset Tracking', icon: Box },
                  { id: 'hardware', label: 'Health Status', icon: Zap },
                  { id: 'productivity', label: 'Productivity', icon: BarChart3 },
                  { id: 'security', label: 'Security', icon: ShieldCheck },
                ].map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setMapMode(mode.id as MapMode)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition whitespace-nowrap ${
                      mapMode === mode.id ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <mode.icon className="w-3.5 h-3.5" />
                    {mode.label}
                  </button>
                ))}
             </div>
             
             {/* Layer Control Dropdown & Fullscreen Toggle */}
             <div className="flex items-center gap-2 px-3 border-l border-slate-100 ml-2 relative shrink-0">
                {/* Full Screen Toggle Button */}
                <button
                  onClick={() => setIsMapFullScreen(!isMapFullScreen)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition shadow-sm ${
                    isMapFullScreen 
                      ? 'bg-rose-600 text-white hover:bg-rose-700 ring-2 ring-rose-300' 
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                  title={isMapFullScreen ? 'Exit Full Screen' : 'Expand Map to Full Screen'}
                >
                  {isMapFullScreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{isMapFullScreen ? 'Exit Full Screen' : 'Full Screen'}</span>
                </button>

                <div className="relative">
                  <button
                    onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition shadow-sm ${
                      isLayerMenuOpen || Object.values(visibleLayers).some(v => v === false) || visibleLayers.heatmapOverlay
                        ? 'bg-sky-600 text-white ring-2 ring-sky-300'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>Layers</span>
                    <span className="px-1.5 py-0.5 bg-black/20 rounded-full text-[9px] font-black">
                      {Object.values(visibleLayers).filter(Boolean).length}/8
                    </span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${isLayerMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Layer Control Popover */}
                  {isLayerMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                        <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 uppercase tracking-tight">
                          <Layers className="w-4 h-4 text-sky-600" />
                          <span>Map Visibility Layers</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setVisibleLayers({ workers: true, assets: true, vehicles: true, readers: true, zones: true, cameras: true, sensors: true, heatmapOverlay: true })}
                            className="text-[9px] font-bold text-sky-600 hover:underline px-1.5 py-0.5 rounded hover:bg-sky-50"
                          >
                            All On
                          </button>
                          <span className="text-slate-300">|</span>
                          <button
                            onClick={() => setVisibleLayers({ workers: false, assets: false, vehicles: false, readers: false, zones: false, cameras: false, sensors: false, heatmapOverlay: false })}
                            className="text-[9px] font-bold text-slate-400 hover:underline px-1.5 py-0.5 rounded hover:bg-slate-100"
                          >
                            Hide All
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        {[
                          { key: 'workers', label: 'Personnel & Workers', icon: Users, color: 'text-sky-600 bg-sky-50 border-sky-200', count: people.length },
                          { key: 'assets', label: 'Equipment & Materials', icon: Box, color: 'text-emerald-600 bg-emerald-50 border-emerald-200', count: assets.length + MOCK_MATERIALS.length },
                          { key: 'vehicles', label: 'Heavy Machinery', icon: Truck, color: 'text-amber-600 bg-amber-50 border-amber-200', count: vehicles.length },
                          { key: 'readers', label: 'RFID Readers & Gates', icon: Radio, color: 'text-indigo-600 bg-indigo-50 border-indigo-200', count: MOCK_READERS.length + MOCK_GATES.length },
                          { key: 'zones', label: 'Geofenced Safety Zones', icon: Layout, color: 'text-sky-700 bg-sky-50 border-sky-200', count: Object.keys(defaultZones).length },
                          { key: 'cameras', label: 'AI CCTV Cameras', icon: Camera, color: 'text-purple-600 bg-purple-50 border-purple-200', count: cameras.length },
                          { key: 'sensors', label: 'EHS Environmental Sensors', icon: Thermometer, color: 'text-rose-600 bg-rose-50 border-rose-200', count: sensors.length },
                          { key: 'heatmapOverlay', label: 'Worker Density Heatmap', icon: Flame, color: 'text-rose-600 bg-rose-50 border-rose-200', count: `${people.length} density points` },
                        ].map((layer) => {
                          const isVisible = visibleLayers[layer.key as keyof VisibleLayers] ?? true;
                          const LayerIcon = layer.icon;

                          return (
                            <button
                              key={layer.key}
                              onClick={() => setVisibleLayers(prev => ({ ...prev, [layer.key]: !isVisible }))}
                              className={`w-full flex items-center justify-between p-2 rounded-xl transition border text-left ${
                                isVisible 
                                  ? 'bg-slate-50 border-slate-200 hover:bg-sky-50/50' 
                                  : 'bg-white border-transparent opacity-50 hover:opacity-80'
                              }`}
                            >
                              <div className="flex items-center gap-2.5">
                                <div className={`p-1.5 rounded-lg border ${layer.color}`}>
                                  <LayerIcon className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-slate-800">{layer.label}</div>
                                  <div className="text-[9px] font-semibold text-slate-400">{layer.count} items active</div>
                                </div>
                              </div>

                              <div className={`w-5 h-5 rounded-md flex items-center justify-center transition ${
                                isVisible ? 'bg-sky-600 text-white' : 'bg-slate-200 text-slate-400'
                              }`}>
                                {isVisible ? <Check className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 border-l border-slate-100 pl-2">
                   <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest hidden sm:inline">Live Connect</span>
                </div>
             </div>
          </div>

          {/* Trade Filter Pills Row */}
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth shrink-0">
            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0 pr-2 border-r border-slate-200">
              <Filter className="w-3.5 h-3.5 text-sky-600" />
              <span>Trades:</span>
            </div>
            <div className="flex items-center gap-1.5">
              {TRADE_OPTIONS.map(trade => {
                const isSelected = selectedTrade === trade.id;
                return (
                  <button
                    key={trade.id}
                    onClick={() => setSelectedTrade(trade.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shadow-sm border ${
                      isSelected
                        ? 'bg-sky-600 text-white border-sky-600 ring-2 ring-sky-300'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                    }`}
                  >
                    <span>{trade.icon}</span>
                    <span>{trade.label}</span>
                    <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {trade.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 relative bg-slate-100">
            <LiveFloorMap 
              people={displayedPeople}
              assets={assets}
              vehicles={vehicles}
              cameras={cameras}
              envSensors={sensors}
              readers={MOCK_READERS}
              gates={MOCK_GATES}
              materials={MOCK_MATERIALS}
              zones={defaultZones}
              highlightedPersonId={selectedEntity?.type === 'person' ? selectedEntity.data.id : highlightedPersonId}
              initialFocusZone={focusZone}
              floorplanUrl={projectMeta?.floorplanUrl || currentProject.floorplanUrl}
              onSelectEntity={(entity) => setSelectedEntity(entity)}
              customZones={projectMeta?.customZones || currentProject.customZones}
              projectId={projectMeta?.id || currentProject.id}
              projectName={projectMeta?.name || currentProject.name}
              contractor={projectMeta?.contractor || currentProject.contractor}
              dimensions={projectMeta?.dimensions || currentProject.dimensions}
              mode={mapMode}
              visibleLayers={visibleLayers}
            />
          </div>

          {/* BOTTOM TELEMETRY DRAWER */}
          <div className="h-40 border-t border-slate-200 bg-white flex overflow-hidden">
             <div className="w-1/3 border-r border-slate-100 flex flex-col">
                <div className="px-4 py-2 border-b border-slate-50 bg-slate-50 flex items-center gap-2">
                   <Terminal className="w-3 h-3 text-slate-500" />
                   <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Live RFID Event Stream</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 font-mono text-[9px] space-y-1">
                   <div className="text-slate-400">[{new Date().toLocaleTimeString()}] <span className="text-sky-600 font-bold">RFID_READ:</span> Tag #RFID-4029 detected at Core Shaft Reader</div>
                   <div className="text-slate-400">[{new Date().toLocaleTimeString()}] <span className="text-amber-600 font-bold">ZONE_ENTRY:</span> Worker W-102 entered Restricted Zone B</div>
                   <div className="text-slate-400">[{new Date().toLocaleTimeString()}] <span className="text-emerald-600 font-bold">HEALTH_OK:</span> West Gate Reader heartbeat verified</div>
                   <div className="text-slate-400">[{new Date().toLocaleTimeString()}] <span className="text-indigo-600 font-bold">ASSET_MVMT:</span> Excavator-01 speed at 4km/h</div>
                </div>
             </div>
             <div className="flex-1 flex flex-col">
                <div className="px-4 py-2 border-b border-slate-50 bg-slate-50 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <Activity className="w-3 h-3 text-sky-500" />
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Site Activity Heat Profile</span>
                   </div>
                   <div className="flex gap-2">
                      <div className="flex items-center gap-1 text-[8px] font-bold"><div className="w-1.5 h-1.5 rounded-full bg-sky-500" /> Low</div>
                      <div className="flex items-center gap-1 text-[8px] font-bold"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Med</div>
                      <div className="flex items-center gap-1 text-[8px] font-bold"><div className="w-1.5 h-1.5 rounded-full bg-rose-500" /> High</div>
                   </div>
                </div>
                <div className="flex-1 p-4 flex items-end gap-1 overflow-hidden">
                   {Array.from({ length: 48 }).map((_, i) => (
                      <div key={i} className="flex-1 bg-sky-500/20 rounded-t-sm" style={{ height: `${20 + Math.random() * 80}%` }} />
                   ))}
                </div>
             </div>
          </div>
        </div>
      </div>

      <LiveTrackingContextDrawer 
        onClose={() => setSelectedEntity(null)}
        entity={selectedEntity}
      />

      <ManageWorkforceModal
        isOpen={isWorkforceModalOpen}
        onClose={() => setIsWorkforceModalOpen(false)}
        people={people}
        availableZones={Object.keys(defaultZones)}
        onAddPerson={() => {}} 
        onUpdatePerson={() => {}} 
        onDeletePerson={() => {}}
      />
    </div>
  );
}

