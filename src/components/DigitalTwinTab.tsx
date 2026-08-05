import React, { useState, useEffect } from 'react';
import { 
  Box, Compass, Layers, User, Zap, Navigation, MapPin, 
  RotateCw, RotateCcw, Eye, Play, Pause, RefreshCw, Search, 
  Building, CheckCircle2, AlertTriangle, ShieldAlert, 
  ArrowRight, Clock, Footprints, Shield, Radio, Activity,
  Upload, Building2, Image as ImageIcon
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface IndoorTarget {
  id: string;
  facilityId: string;
  name: string;
  type: 'visitor' | 'staff' | 'room' | 'safety' | 'amenity';
  floor: 'Level 1' | 'Level 2' | 'Level 3';
  zoneName: string;
  coords2D: { x: number; y: number };
  distanceMeters: number;
  estTime: string;
  requiredAccess: string;
  status?: string;
  tagId?: string;
  description: string;
  steps: Array<{
    stepNumber: number;
    text: string;
    distance: string;
    icon: 'straight' | 'turn-left' | 'turn-right' | 'elevator' | 'destination';
  }>;
}

interface FacilityRoom {
  id: string;
  facilityId: string;
  level: 'Level 1' | 'Level 2' | 'Level 3';
  name: string;
  subtitle: string;
  code: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z?: number;
  colorType: 'blue' | 'amber' | 'emerald' | 'purple' | 'slate' | 'rose';
}

const FACILITIES = [
  { id: 'metro', name: 'Metro Tower & Deep Excavation Site', levels: ['Level 1', 'Level 2', 'Level 3'] },
  { id: 'highway', name: 'Highway Bridge Span Site', levels: ['Level 1', 'Level 2'] },
  { id: 'highrise', name: 'High-Rise Commercial Tower Site', levels: ['Level 1', 'Level 2', 'Level 3'] },
  { id: 'substation', name: 'Industrial Energy Substation Site', levels: ['Level 1', 'Level 2'] }
];

const START_LOCATIONS = [
  { id: 'GATE1', name: 'Gate 1 - Main Turnstile RFID Portal (Level 1)', coords: { x: 15, y: 15 } },
  { id: 'OFFICE_TRAILER', name: 'Site Office & Welfare Container (Level 1)', coords: { x: 50, y: 20 } },
  { id: 'CRANE_HOIST', name: 'Heavy Crane Hoist Base (Level 1)', coords: { x: 10, y: 80 } },
  { id: 'SCAFFOLD_STAIR', name: 'Scaffold Access Tower Stairwell (Level 2)', coords: { x: 25, y: 35 } }
];

const FACILITY_ROOMS: FacilityRoom[] = [
  // --- Metro Tower & Deep Excavation Site (metro) ---
  { id: 'm-l1-gate', facilityId: 'metro', level: 'Level 1', name: 'Gate 1 Access Turnstile', subtitle: 'Main Entry RFID Portal', code: 'GATE-1', x: 5, y: 5, width: 40, height: 40, z: 15, colorType: 'slate' },
  { id: 'm-l1-pit', facilityId: 'metro', level: 'Level 1', name: 'Excavation & Foundation Pit', subtitle: 'Deep Dig Ground Sector', code: 'PIT-1', x: 5, y: 52, width: 40, height: 42, z: 20, colorType: 'blue' },
  { id: 'm-l1-office', facilityId: 'metro', level: 'Level 1', name: 'Site Office & Welfare', subtitle: 'Superintendent Container', code: 'OFF-1', x: 50, y: 5, width: 45, height: 40, z: 15, colorType: 'purple' },
  { id: 'm-l1-med', facilityId: 'metro', level: 'Level 1', name: 'First Aid & Safety Bunker', subtitle: 'AED & Trauma Kit Kiosk', code: 'MED-1', x: 50, y: 52, width: 45, height: 42, z: 25, colorType: 'rose' },

  { id: 'm-l2-scaffold', facilityId: 'metro', level: 'Level 2', name: 'Structure & Scaffolding (L1-L4)', subtitle: 'Fall Protection Deck', code: 'SCAF-1', x: 50, y: 5, width: 45, height: 40, z: 25, colorType: 'blue' },
  { id: 'm-l2-crane', facilityId: 'metro', level: 'Level 2', name: 'Heavy Crane Exclusion Area', subtitle: 'High Hazard Lifting Radius', code: 'CRN-1', x: 50, y: 52, width: 45, height: 42, z: 30, colorType: 'amber' },
  { id: 'm-l2-tunnel', facilityId: 'metro', level: 'Level 2', name: 'Confined Shaft & Tunneling', subtitle: 'Underground Trench Zone', code: 'TUN-1', x: 5, y: 52, width: 40, height: 42, z: 20, colorType: 'emerald' },
  { id: 'm-l2-muster', facilityId: 'metro', level: 'Level 2', name: 'Muster Point A (Emergency)', subtitle: 'Assembly & Evacuation Sector', code: 'MUST-1', x: 5, y: 5, width: 40, height: 40, z: 15, colorType: 'rose' },

  { id: 'm-l3-crane-cab', facilityId: 'metro', level: 'Level 3', name: 'Tower Crane Operator Cab', subtitle: 'Heavy Lift Controls', code: 'CAB-1', x: 5, y: 5, width: 42, height: 42, z: 25, colorType: 'amber' },
  { id: 'm-l3-deck', facilityId: 'metro', level: 'Level 3', name: 'High-Rise Steel Decking', subtitle: 'Level 4 Frame Assembly', code: 'DECK-4', x: 52, y: 5, width: 43, height: 42, z: 30, colorType: 'blue' },

  // --- Highway Bridge Span Site (highway) ---
  { id: 'hw-l1-pier', facilityId: 'highway', level: 'Level 1', name: 'Abutment North Pier', subtitle: 'Foundation Concrete', code: 'PIER-N', x: 5, y: 5, width: 42, height: 42, z: 20, colorType: 'amber' },
  { id: 'hw-l1-crane', facilityId: 'highway', level: 'Level 1', name: 'Riverbank Heavy Crane Sector', subtitle: '150-Ton Crawler Crane', code: 'CRN-R', x: 52, y: 5, width: 43, height: 42, z: 30, colorType: 'blue' },
  { id: 'hw-l1-batch', facilityId: 'highway', level: 'Level 1', name: 'Concrete Batching & Laydown', subtitle: 'Rebar & Gravel Staging', code: 'BATCH-1', x: 5, y: 52, width: 42, height: 42, z: 22, colorType: 'purple' },

  { id: 'hw-l2-deck', facilityId: 'highway', level: 'Level 2', name: 'Deck Formwork & Rebar', subtitle: 'Bridge Span Decking', code: 'DECK-1', x: 5, y: 5, width: 90, height: 42, z: 25, colorType: 'blue' },

  // --- High-Rise Commercial Tower Site (highrise) ---
  { id: 'hr-l1-ground', facilityId: 'highrise', level: 'Level 1', name: 'Ground Access & Delivery', subtitle: 'Material Truck Unloading', code: 'GRD-1', x: 5, y: 5, width: 42, height: 42, z: 25, colorType: 'purple' },
  { id: 'hr-l1-parking', facilityId: 'highrise', level: 'Level 1', name: 'Basement Parking Slab', subtitle: 'Concrete Pour Sector', code: 'BASE-1', x: 52, y: 5, width: 43, height: 42, z: 20, colorType: 'blue' },

  { id: 'hr-l2-frame', facilityId: 'highrise', level: 'Level 2', name: 'Structural Steel Frame (L1-L5)', subtitle: 'Ironworker Columns', code: 'FRM-1', x: 5, y: 5, width: 90, height: 42, z: 28, colorType: 'blue' },

  { id: 'hr-l3-crane', facilityId: 'highrise', level: 'Level 3', name: 'Tower Crane Alpha Swing', subtitle: 'High Elevation Radius', code: 'CRN-A', x: 15, y: 5, width: 70, height: 42, z: 32, colorType: 'amber' },

  // --- Industrial Energy Substation Site (substation) ---
  { id: 'sub-l1-trench', facilityId: 'substation', level: 'Level 1', name: 'Cable Trenching Shaft', subtitle: 'High Voltage Conduit', code: 'TRNCH-1', x: 5, y: 5, width: 42, height: 42, z: 25, colorType: 'amber' },
  { id: 'sub-l1-loto', facilityId: 'substation', level: 'Level 1', name: 'High Voltage Enclosure', subtitle: 'LOTO Lockout Zone', code: 'LOTO-1', x: 52, y: 5, width: 43, height: 42, z: 30, colorType: 'rose' },
  { id: 'sub-l2-ctrl', facilityId: 'substation', level: 'Level 2', name: 'Control Building Deck', subtitle: 'Electrical Relay Frame', code: 'CTRL-1', x: 5, y: 5, width: 90, height: 42, z: 25, colorType: 'blue' }
];

const INDOOR_TARGETS: IndoorTarget[] = [
  // --- Metro Tower Construction Targets ---
  {
    id: 'w-elena',
    facilityId: 'metro',
    name: 'Elena Rostova (Safety Officer EHS)',
    type: 'staff',
    floor: 'Level 2',
    zoneName: 'Structure & Scaffolding (L1-L4)',
    coords2D: { x: 70, y: 25 },
    distanceMeters: 85,
    estTime: '1 min 10 sec',
    requiredAccess: 'EHS Supervisor Hardhat Tag',
    status: 'Inspecting Scaffold L2 Anchor',
    tagId: 'HH-1044',
    description: 'BuildCorp EHS Officer performing daily harness and scaffold clip-on safety audit.',
    steps: [
      { stepNumber: 1, text: 'Start at Gate 1 Main Turnstile', distance: '0m', icon: 'straight' },
      { stepNumber: 2, text: 'Walk past Site Office Container', distance: '25m', icon: 'straight' },
      { stepNumber: 3, text: 'Ascend Scaffold Access Tower Stairwell to Level 2', distance: '20m', icon: 'elevator' },
      { stepNumber: 4, text: 'Head East along North Scaffold Decking', distance: '40m', icon: 'turn-right' },
      { stepNumber: 5, text: 'Arrive at Elena Rostova (HH-1044)', distance: '0m', icon: 'destination' }
    ]
  },
  {
    id: 'w-jake',
    facilityId: 'metro',
    name: 'Jake Miller (Heavy Crane Operator)',
    type: 'staff',
    floor: 'Level 2',
    zoneName: 'Heavy Crane Exclusion Area',
    coords2D: { x: 72, y: 72 },
    distanceMeters: 140,
    estTime: '1 min 45 sec',
    requiredAccess: 'Crane Operator Cert & Tag HH-3392',
    status: 'Active Heavy Lift Operations',
    tagId: 'HH-3392',
    description: 'Titan Heavy Machinery Operator managing steel girder hoisting in Crane Exclusion Zone.',
    steps: [
      { stepNumber: 1, text: 'Start at Gate 1 Main Turnstile', distance: '0m', icon: 'straight' },
      { stepNumber: 2, text: 'Proceed East past Material Laydown Area', distance: '60m', icon: 'straight' },
      { stepNumber: 3, text: 'Enter Crane Exclusion Zone Warning Perimeter', distance: '40m', icon: 'turn-right' },
      { stepNumber: 4, text: 'Arrive at Crane Base Platform (HH-3392)', distance: '40m', icon: 'destination' }
    ]
  },
  {
    id: 'w-carlos',
    facilityId: 'metro',
    name: 'Carlos Mendez (Subcontractor Electrician)',
    type: 'staff',
    floor: 'Level 2',
    zoneName: 'Confined Shaft & Tunneling',
    coords2D: { x: 20, y: 70 },
    distanceMeters: 110,
    estTime: '1 min 25 sec',
    requiredAccess: 'Confined Space Permit & LOTO Badge',
    status: 'In Shaft Trench B-3',
    tagId: 'HH-4011',
    description: 'VoltCraft Master Electrician installing temporary power conduits in underground trench.',
    steps: [
      { stepNumber: 1, text: 'Start at Gate 1 Main Turnstile', distance: '0m', icon: 'straight' },
      { stepNumber: 2, text: 'Walk South towards Confined Shaft Entrance', distance: '50m', icon: 'straight' },
      { stepNumber: 3, text: 'Descend Shaft Portal Access Stairs', distance: '25m', icon: 'elevator' },
      { stepNumber: 4, text: 'Locate Carlos Mendez in Shaft Section B-3', distance: '35m', icon: 'destination' }
    ]
  },
  {
    id: 'vis-sven',
    facilityId: 'metro',
    name: 'Sven Lindqvist (City Structural Inspector)',
    type: 'visitor',
    floor: 'Level 1',
    zoneName: 'Gate 1 Access Turnstile',
    coords2D: { x: 20, y: 20 },
    distanceMeters: 30,
    estTime: '25 sec',
    requiredAccess: 'Visitor Temp Hardhat & Escort',
    status: 'Checked-in at Gatehouse',
    tagId: 'HH-8812',
    description: 'City Building Code Inspector conducting foundation concrete pour verification.',
    steps: [
      { stepNumber: 1, text: 'Start at Gate 1 Main Turnstile', distance: '0m', icon: 'straight' },
      { stepNumber: 2, text: 'Proceed to Gatehouse Safety Briefing Area', distance: '30m', icon: 'destination' }
    ]
  },
  {
    id: 'zone-crane',
    facilityId: 'metro',
    name: 'Heavy Crane Exclusion Area (High Hazard)',
    type: 'safety',
    floor: 'Level 2',
    zoneName: 'Heavy Crane Exclusion Area',
    coords2D: { x: 72, y: 72 },
    distanceMeters: 130,
    estTime: '1 min 30 sec',
    requiredAccess: 'Certified Rigger / Operator Clearance Only',
    description: 'Restricted 30-meter swing radius around 150-ton mobile crane.',
    steps: [
      { stepNumber: 1, text: 'Start at Gate 1 Turnstile', distance: '0m', icon: 'straight' },
      { stepNumber: 2, text: 'Follow Red Warning Stanchions East', distance: '80m', icon: 'straight' },
      { stepNumber: 3, text: 'Stop at High-Visibility Warning Barrier', distance: '50m', icon: 'destination' }
    ]
  },
  {
    id: 'zone-muster',
    facilityId: 'metro',
    name: 'Muster Point A (Emergency Assembly)',
    type: 'safety',
    floor: 'Level 1',
    zoneName: 'Muster Point A (Emergency)',
    coords2D: { x: 85, y: 10 },
    distanceMeters: 90,
    estTime: '1 min',
    requiredAccess: 'All Site Personnel Open Access',
    description: 'Primary emergency evacuation assembly yard with active RFID roll-call scanner.',
    steps: [
      { stepNumber: 1, text: 'Follow Green Evacuation Arrows', distance: '0m', icon: 'straight' },
      { stepNumber: 2, text: 'Exit via Gate 1 Perimeter Route', distance: '60m', icon: 'straight' },
      { stepNumber: 3, text: 'Assemble in Marked Muster Bay A', distance: '30m', icon: 'destination' }
    ]
  }
];

export default function DigitalTwinTab() {
  const [viewMode, setViewMode] = useState<'3d' | '2d'>('3d');
  const [selectedFacility, setSelectedFacility] = useState<string>('metro');
  const [customFloorplanUrl, setCustomFloorplanUrl] = useState<string | null>(null);
  const [selectedStart, setSelectedStart] = useState<string>('GATE1');
  const [selectedTargetId, setSelectedTargetId] = useState<string>('w-elena');
  const [targetFilter, setTargetFilter] = useState<'All' | 'People' | 'Rooms' | 'Safety'>('All');
  const [selectedLevel, setSelectedLevel] = useState<'Level 1' | 'Level 2' | 'Level 3'>('Level 2');
  
  // 3D Controls
  const [rotationAngle, setRotationAngle] = useState<number>(30);
  const [tiltAngle, setTiltAngle] = useState<number>(45);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  // Simulation State
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simProgress, setSimProgress] = useState<number>(0);

  const activeFacility = FACILITIES.find(f => f.id === selectedFacility) || FACILITIES[0];
  const facilityTargets = INDOOR_TARGETS.filter(t => t.facilityId === selectedFacility);

  const filteredTargets = facilityTargets.filter(t => {
    if (targetFilter === 'People') return t.type === 'visitor' || t.type === 'staff';
    if (targetFilter === 'Rooms') return t.type === 'room' || t.type === 'amenity';
    if (targetFilter === 'Safety') return t.type === 'safety';
    return true;
  });

  const selectedTarget = INDOOR_TARGETS.find(t => t.id === selectedTargetId) || facilityTargets[0] || INDOOR_TARGETS[0];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setCustomFloorplanUrl(url);
    }
  };

  // Sync selected target when facility changes
  useEffect(() => {
    if (facilityTargets.length > 0) {
      const exists = facilityTargets.some(t => t.id === selectedTargetId);
      if (!exists) {
        setSelectedTargetId(facilityTargets[0].id);
      }
    }
  }, [selectedFacility]);

  // Sync selected level when active facility changes or target changes
  useEffect(() => {
    if (activeFacility) {
      if (!activeFacility.levels.includes(selectedLevel)) {
        setSelectedLevel(activeFacility.levels[0] as any);
      }
    }
  }, [selectedFacility]);

  // Sync level when target changes
  useEffect(() => {
    if (selectedTarget) {
      setSelectedLevel(selectedTarget.floor);
    }
  }, [selectedTargetId]);

  const currentLevelRooms = FACILITY_ROOMS.filter(
    r => r.facilityId === selectedFacility && r.level === selectedLevel
  );

  // Simulation loop
  useEffect(() => {
    let interval: any = null;
    if (isSimulating) {
      interval = setInterval(() => {
        setSimProgress(prev => {
          if (prev >= 100) {
            setIsSimulating(false);
            return 100;
          }
          return prev + 2;
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isSimulating]);

  const handleStartSimulation = () => {
    setSimProgress(0);
    setIsSimulating(true);
  };

  return (
    <div className="w-full flex flex-col p-6 max-w-7xl mx-auto gap-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Box className="w-6 h-6 text-[#007BC4]" />
            Digital Twin & Indoor Navigation
          </h2>
          <p className="text-slate-500 font-medium tracking-tight">
            Real-time 3D spatial mapping, target location tracking, and turn-by-turn route guidance.
          </p>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => setViewMode('3d')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              viewMode === '3d' 
                ? 'bg-[#007BC4] text-white shadow-md' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Box className="w-4 h-4" />
            3D Isometric Twin
          </button>
          <button 
            onClick={() => setViewMode('2d')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-2 ${
              viewMode === '2d' 
                ? 'bg-[#007BC4] text-white shadow-md' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Layers className="w-4 h-4" />
            2D Floor Plan
          </button>
        </div>
      </div>

      {/* Main Grid: Left Navigation Control Panel, Right 3D/2D Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[640px]">
        {/* Left Panel - Target Selection & Directions (4 Cols) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl shadow-sm p-5 flex flex-col gap-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Navigation className="w-5 h-5 text-[#007BC4]" />
              Indoor Navigation Control
            </h3>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono text-[10px]">
              GPS / RFID SYNCED
            </Badge>
          </div>

          {/* Quick Target Category Filters */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Select Facility & Floor Plan</label>
            <div className="space-y-2">
              <div className="relative">
                <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#007BC4]" />
                <select
                  value={selectedFacility}
                  onChange={e => setSelectedFacility(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#007BC4]/20"
                >
                  {FACILITIES.map(fac => (
                    <option key={fac.id} value={fac.id}>{fac.name}</option>
                  ))}
                </select>
              </div>

              {/* Upload Custom Floorplan Button */}
              <div className="flex items-center gap-2">
                <label className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 cursor-pointer transition">
                  <Upload className="w-4 h-4 text-[#007BC4]" />
                  {customFloorplanUrl ? 'Change Floorplan Image' : 'Upload Floorplan Image'}
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
                {customFloorplanUrl && (
                  <button 
                    onClick={() => setCustomFloorplanUrl(null)}
                    className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition"
                    title="Remove custom floor plan"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">Target Filter</label>
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
              {(['All', 'People', 'Rooms', 'Safety'] as const).map(cat => (
                <button
                  key={cat}
                  onClick={() => setTargetFilter(cat)}
                  className={`flex-1 py-1 rounded text-xs font-bold transition ${
                    targetFilter === cat ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Start Location */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Starting Point</label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={selectedStart}
                onChange={e => setSelectedStart(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#007BC4]/20"
              >
                {START_LOCATIONS.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Target Location Select */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Target Destination / Person</label>
            <div className="relative">
              <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#007BC4]" />
              <select
                value={selectedTargetId}
                onChange={e => setSelectedTargetId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-[#007BC4]/20"
              >
                {filteredTargets.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.floor})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Target Info Summary Box */}
          {selectedTarget && (
            <div className="bg-[#007BC4]/5 border border-[#007BC4]/20 rounded-xl p-3 text-xs space-y-2">
              <div className="flex items-center justify-between font-bold text-slate-900">
                <span className="flex items-center gap-1.5 text-[#007BC4]">
                  <Activity className="w-3.5 h-3.5" />
                  {selectedTarget.zoneName}
                </span>
                <Badge className="bg-[#007BC4] text-white text-[10px]">{selectedTarget.floor}</Badge>
              </div>
              <p className="text-slate-600">{selectedTarget.description}</p>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#007BC4]/10 text-slate-700 font-semibold">
                <div>Distance: <span className="font-mono text-slate-900">{selectedTarget.distanceMeters}m</span></div>
                <div>Walk Time: <span className="font-mono text-slate-900">{selectedTarget.estTime}</span></div>
                <div className="col-span-2 text-[11px] text-slate-500">Access: <span className="text-slate-800">{selectedTarget.requiredAccess}</span></div>
              </div>
            </div>
          )}

          {/* Action Simulation Controls */}
          <div className="flex gap-2">
            <button 
              onClick={handleStartSimulation}
              disabled={isSimulating}
              className="flex-1 bg-[#007BC4] hover:bg-[#006aa9] text-white py-2.5 rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSimulating ? <Pause className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {isSimulating ? 'Navigating...' : 'Simulate Walkthrough'}
            </button>
            <button 
              onClick={() => setSimProgress(0)}
              className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition"
              title="Reset Route"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Simulation Progress Bar */}
          {simProgress > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-600">
                <span>Route Progress</span>
                <span>{simProgress}%</span>
              </div>
              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-[#007BC4] transition-all duration-300"
                  style={{ width: `${simProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Turn-by-Turn Navigation Steps */}
          {selectedTarget && (
            <div className="flex-1 overflow-y-auto max-h-[220px] pr-1 space-y-3 pt-2 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Turn-by-turn Directions</h4>
              <div className="space-y-3 relative before:absolute before:inset-0 before:ml-[11px] before:h-full before:w-0.5 before:bg-slate-200">
                {selectedTarget.steps.map((step, idx) => {
                  const stepThreshold = ((idx + 1) / selectedTarget.steps.length) * 100;
                  const isCompletedStep = simProgress >= stepThreshold;
                  return (
                    <div key={idx} className="relative flex items-start gap-3">
                      <div className={`w-6 h-6 rounded-full border-2 border-white flex items-center justify-center z-10 shrink-0 text-[10px] font-bold ${
                        isCompletedStep 
                          ? 'bg-emerald-500 text-white shadow-sm' 
                          : idx === selectedTarget.steps.length - 1 
                            ? 'bg-[#007BC4] text-white shadow-sm' 
                            : 'bg-slate-200 text-slate-700'
                      }`}>
                        {isCompletedStep ? '✓' : step.stepNumber}
                      </div>
                      <div className="pt-0.5">
                        <div className={`text-xs ${isCompletedStep ? 'font-bold text-emerald-800' : 'font-medium text-slate-800'}`}>
                          {step.text}
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">{step.distance}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Canvas - 3D / 2D Viewport (8 Cols) */}
        <div className="lg:col-span-8 bg-slate-950 rounded-2xl border border-slate-800 shadow-inner relative overflow-hidden flex flex-col">
          {/* Top Canvas Bar Controls */}
          <div className="p-4 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 z-20">
            <div className="flex items-center gap-2">
              <Badge className="bg-slate-800 text-emerald-400 border-slate-700 font-mono text-xs">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse mr-1.5 inline-block"/>
                LIVE TWIN ENGINE
              </Badge>
              <span className="text-slate-400 text-xs font-mono font-bold hidden sm:inline">{activeFacility.name}</span>
            </div>

            {/* Level Selector Buttons */}
            <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
              {activeFacility.levels.map(lvl => (
                <button
                  key={lvl}
                  onClick={() => setSelectedLevel(lvl as any)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    selectedLevel === lvl 
                      ? 'bg-[#007BC4] text-white shadow-sm' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>

            {/* 3D Rotation Controls */}
            {viewMode === '3d' && (
              <div className="flex items-center gap-1 bg-slate-800/90 p-1 rounded-xl border border-slate-700">
                <button 
                  onClick={() => setRotationAngle(r => r - 45)}
                  className="p-1.5 text-slate-300 hover:text-white transition"
                  title="Rotate Left"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setRotationAngle(0)}
                  className="px-2 text-xs font-bold text-slate-300 hover:text-white transition"
                  title="Reset Angle"
                >
                  Reset
                </button>
                <button 
                  onClick={() => setRotationAngle(r => r + 45)}
                  className="p-1.5 text-slate-300 hover:text-white transition"
                  title="Rotate Right"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Viewport Render Area */}
          <div className="flex-1 relative flex items-center justify-center p-6 min-h-[460px] overflow-hidden select-none">
            {/* Background 3D Grid Pattern */}
            <div 
              className="absolute inset-0 opacity-20 pointer-events-none transition-all duration-500" 
              style={{
                backgroundImage: 'linear-gradient(#007BC4 1px, transparent 1px), linear-gradient(90deg, #007BC4 1px, transparent 1px)',
                backgroundSize: '40px 40px',
                transform: viewMode === '3d' ? `perspective(800px) rotateX(${tiltAngle}deg) rotateZ(${rotationAngle}deg) scale(${zoomLevel / 100})` : 'scale(1)',
              }} 
            />

            {/* 3D VIEW MODE */}
            {viewMode === '3d' && (
              <div 
                className="relative w-[520px] h-[360px] border-2 border-slate-700/60 rounded-3xl bg-slate-900/60 shadow-[0_20px_60px_rgba(0,0,0,0.8)] transition-all duration-700 flex flex-col justify-between p-6 overflow-hidden"
                style={{
                  transform: `perspective(900px) rotateX(${tiltAngle}deg) rotateZ(${rotationAngle}deg) scale(${zoomLevel / 100})`,
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Dynamic 3D Room Blocks for Active Facility & Level */}
                {currentLevelRooms.map(room => {
                  const isTargetRoom = selectedTarget && (
                    selectedTarget.zoneName.toLowerCase().includes(room.name.toLowerCase()) || 
                    room.name.toLowerCase().includes(selectedTarget.zoneName.toLowerCase())
                  );

                  return (
                    <div 
                      key={room.id}
                      onClick={() => {
                        const matchingTarget = facilityTargets.find(
                          t => t.zoneName.toLowerCase().includes(room.name.toLowerCase()) || room.name.toLowerCase().includes(t.zoneName.toLowerCase())
                        );
                        if (matchingTarget) setSelectedTargetId(matchingTarget.id);
                      }}
                      className={`absolute rounded-2xl p-3 shadow-lg border-2 backdrop-blur-md cursor-pointer transition-all duration-300 flex flex-col justify-between ${
                        isTargetRoom 
                          ? 'ring-4 ring-[#007BC4] scale-105 z-20 bg-[#007BC4]/40 border-[#007BC4] shadow-[0_0_30px_rgba(0,123,196,0.6)]' 
                          : room.colorType === 'blue' ? 'bg-[#007BC4]/20 border-[#007BC4] hover:bg-[#007BC4]/30'
                          : room.colorType === 'amber' ? 'bg-amber-500/20 border-amber-500/80 hover:bg-amber-500/30'
                          : room.colorType === 'emerald' ? 'bg-emerald-500/20 border-emerald-500/80 hover:bg-emerald-500/30'
                          : room.colorType === 'purple' ? 'bg-purple-500/20 border-purple-500/80 hover:bg-purple-500/30'
                          : room.colorType === 'rose' ? 'bg-rose-500/20 border-rose-500/80 hover:bg-rose-500/30'
                          : 'bg-slate-800/80 border-slate-600 hover:bg-slate-700/80'
                      }`}
                      style={{
                        left: `${room.x}%`,
                        top: `${room.y}%`,
                        width: `${room.width}%`,
                        height: `${room.height}%`,
                        transform: `translateZ(${room.z || 20}px)`
                      }}
                    >
                      <div className="text-[11px] font-bold text-slate-100 flex items-center justify-between gap-1">
                        <span className="truncate">{room.name}</span>
                        <Badge className={`text-[9px] font-bold shrink-0 ${
                          isTargetRoom ? 'bg-[#007BC4] text-white' : 'bg-slate-800 text-slate-200 border-slate-600'
                        }`}>{room.code}</Badge>
                      </div>
                      <div className="text-[10px] text-slate-300 font-mono truncate">{room.subtitle}</div>
                    </div>
                  );
                })}

                {/* Glowing 3D Navigation Path Overlay */}
                {selectedTarget && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" style={{ transform: 'translateZ(35px)' }}>
                    <line 
                      x1="120" y1="80" 
                      x2="260" y2="180" 
                      stroke="#007BC4" strokeWidth="4" strokeDasharray="6 6"
                      className="animate-pulse"
                    />
                    <line 
                      x1="260" y1="180" 
                      x2={selectedTarget.coords2D.x * 5} y2={selectedTarget.coords2D.y * 3.4} 
                      stroke="#007BC4" strokeWidth="4" strokeDasharray="6 6"
                      className="animate-pulse"
                    />

                    {/* Animated Simulated Walker Dot */}
                    {simProgress > 0 && (
                      <circle 
                        cx={120 + ((selectedTarget.coords2D.x * 5 - 120) * (simProgress / 100))} 
                        cy={80 + ((selectedTarget.coords2D.y * 3.4 - 80) * (simProgress / 100))} 
                        r="7" 
                        fill="#38bdf8" 
                        className="shadow-[0_0_20px_#38bdf8] animate-bounce"
                      />
                    )}
                  </svg>
                )}

                {/* Target Marker Pin */}
                {selectedTarget && (
                  <div 
                    className="absolute z-20 transition-all duration-500 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none"
                    style={{
                      left: `${selectedTarget.coords2D.x}%`,
                      top: `${selectedTarget.coords2D.y}%`,
                      transform: 'translateZ(45px)'
                    }}
                  >
                    <div className="bg-[#007BC4] text-white p-2 rounded-full border-2 border-white shadow-[0_0_25px_#007BC4] animate-bounce">
                      <MapPin className="w-5 h-5 text-white" />
                    </div>
                    <div className="bg-slate-900/90 text-white font-bold text-[10px] px-2 py-0.5 rounded shadow-md mt-1 border border-slate-700 whitespace-nowrap">
                      {selectedTarget.name}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2D VIEW MODE */}
            {viewMode === '2d' && (
              <div className="relative w-full max-w-xl h-[380px] bg-slate-900 border-2 border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden flex flex-col justify-between">
                <div className="absolute top-3 left-4 z-20 text-xs font-mono font-bold text-slate-200 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-700 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#007BC4]" />
                  {activeFacility.name} • {selectedLevel} {customFloorplanUrl ? '(Custom Uploaded Map)' : '(Vector Blueprint)'}
                </div>

                {customFloorplanUrl ? (
                  <div className="absolute inset-0 z-0">
                    <img 
                      src={customFloorplanUrl} 
                      alt="Uploaded Floorplan" 
                      className="w-full h-full object-cover opacity-70"
                    />
                    <div className="absolute inset-0 bg-slate-950/40" />
                  </div>
                ) : (
                  /* Vector Grid Blueprint SVG */
                  <svg className="absolute inset-0 w-full h-full p-4 pointer-events-none z-0" viewBox="0 0 500 350">
                    {/* Grid Lines */}
                    <defs>
                      <pattern id="grid" width="25" height="25" patternUnits="userSpaceOnUse">
                        <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#1e293b" strokeWidth="1" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />

                    {/* Dynamic Room Outlines for Selected Facility & Level */}
                    {currentLevelRooms.map(r => {
                      const isTargetRoom = selectedTarget && (
                        selectedTarget.zoneName.toLowerCase().includes(r.name.toLowerCase()) || 
                        r.name.toLowerCase().includes(selectedTarget.zoneName.toLowerCase())
                      );

                      return (
                        <g key={r.id}>
                          <rect 
                            x={r.x * 4.6 + 10} 
                            y={r.y * 3.1 + 10} 
                            width={r.width * 4.6} 
                            height={r.height * 3.1} 
                            fill={isTargetRoom ? "#007BC4" : "#0f172a"} 
                            stroke={isTargetRoom ? "#38bdf8" : r.colorType === 'amber' ? '#f59e0b' : r.colorType === 'emerald' ? '#10b981' : r.colorType === 'purple' ? '#a855f7' : r.colorType === 'rose' ? '#f43f5e' : '#007BC4'} 
                            strokeWidth={isTargetRoom ? "3" : "2"} 
                            rx="8" 
                          />
                          <text 
                            x={r.x * 4.6 + 20} 
                            y={r.y * 3.1 + 32} 
                            fill={isTargetRoom ? "#ffffff" : "#94a3b8"} 
                            fontSize="10" 
                            fontWeight="bold"
                          >
                            {r.name.toUpperCase()}
                          </text>
                        </g>
                      );
                    })}

                    {/* Navigation Path Line */}
                    {selectedTarget && (
                      <path 
                        d={`M 90 85 L 230 85 L ${selectedTarget.coords2D.x * 4.8} ${selectedTarget.coords2D.y * 3.2}`} 
                        fill="none" 
                        stroke="#007BC4" 
                        strokeWidth="3" 
                        strokeDasharray="6 6"
                      />
                    )}

                    {/* Animated Simulated Walker Dot */}
                    {simProgress > 0 && selectedTarget && (
                      <circle 
                        cx={90 + ((selectedTarget.coords2D.x * 4.8 - 90) * (simProgress / 100))} 
                        cy={85 + ((selectedTarget.coords2D.y * 3.2 - 85) * (simProgress / 100))} 
                        r="6" 
                        fill="#38bdf8" 
                      />
                    )}
                  </svg>
                )}

                {/* Clickable Target Waypoints on 2D Map filtered by facility & level */}
                <div className="relative w-full h-full z-10">
                  {facilityTargets.filter(t => t.floor === selectedLevel).map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTargetId(t.id)}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 p-1.5 rounded-full border-2 transition-all duration-300 ${
                        selectedTargetId === t.id 
                          ? 'bg-[#007BC4] border-white scale-125 z-20 shadow-[0_0_20px_#007BC4]' 
                          : 'bg-slate-800 border-slate-600 hover:scale-110 z-10'
                      }`}
                      style={{ left: `${t.coords2D.x}%`, top: `${t.coords2D.y}%` }}
                      title={`${t.name} (${t.zoneName})`}
                    >
                      <MapPin className="w-3.5 h-3.5 text-white" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Bottom Control Dock */}
          <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-300 gap-4">
            <div className="flex items-center gap-4">
              <span className="font-bold text-slate-400">Selected Route:</span>
              <span className="font-semibold text-white">{START_LOCATIONS.find(s => s.id === selectedStart)?.name.split(' - ')[0]} → {selectedTarget?.name || 'Destination'}</span>
            </div>

            {selectedTarget && (
              <div className="flex items-center gap-6 font-mono text-[11px]">
                <div>Distance: <span className="text-[#007BC4] font-bold">{selectedTarget.distanceMeters}m</span></div>
                <div>ETA: <span className="text-emerald-400 font-bold">{selectedTarget.estTime}</span></div>
                <div>Steps: <span className="text-slate-200 font-bold">{selectedTarget.steps.length} Waypoints</span></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
