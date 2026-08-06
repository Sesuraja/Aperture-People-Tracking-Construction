import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Box, Compass, Layers, User, Users, Zap, Navigation, MapPin, 
  RotateCw, RotateCcw, Eye, EyeOff, Play, Pause, RefreshCw, Search, 
  Building, Building2, CheckCircle2, AlertTriangle, ShieldAlert, 
  ArrowRight, Clock, Footprints, Shield, Radio, Activity,
  Upload, Image as ImageIcon, Grid, Maximize2, Minimize2, Ruler, 
  Lock, Unlock, Copy, Undo2, Redo2, Sliders, Sun, CloudRain, 
  Wind, Thermometer, Flame, HardHat, Truck, Video, Gauge, Volume2, 
  Sparkles, Plus, Trash2, Edit3, Filter, Layers2, FileCode2, 
  Download, Check, ChevronRight, X, MousePointer, Move, Crop, Group, Ungroup, FileSpreadsheet
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { exportToCSV } from '../lib/exportUtils';

// --- TYPES & INTERFACES ---

export type EntityType = 
  | 'worker' 
  | 'visitor' 
  | 'contractor' 
  | 'reader' 
  | 'ble_gateway' 
  | 'gps_beacon' 
  | 'iot_sensor' 
  | 'equipment' 
  | 'vehicle' 
  | 'camera' 
  | 'env_sensor' 
  | 'emergency' 
  | 'hazard';

export interface TwinEntity {
  id: string;
  name: string;
  type: EntityType;
  siteId: string;
  buildingId: string;
  floorId: string;
  x: number; // percentage or grid coord (0-100)
  y: number; // percentage or grid coord (0-100)
  width: number;
  height: number;
  rotation: number; // degrees
  locked: boolean;
  groupId?: string;
  opacity: number;
  
  // Dynamic Telemetry
  status: 'active' | 'warning' | 'critical' | 'idle' | 'offline';
  tradeCompany?: string;
  tagId?: string;
  battery?: number;
  temperature?: number;
  gasLevel?: number;
  rssi?: number;
  speed?: number;
  details?: string;
  lastUpdated?: string;
}

export interface Site {
  id: string;
  name: string;
  code: string;
  address: string;
  buildings: BuildingData[];
}

export interface BuildingData {
  id: string;
  name: string;
  floors: FloorData[];
}

export interface FloorData {
  id: string;
  name: string;
  elevation: string;
  blueprintVersions: BlueprintVersion[];
}

export interface BlueprintVersion {
  id: string;
  versionNumber: string;
  title: string;
  format: 'SVG CAD' | 'DXF / DWG' | 'Vector PDF' | 'Raster PNG';
  uploadedAt: string;
  uploadedBy: string;
  url?: string;
  active: boolean;
}

// --- MOCK HIERARCHY DATA ---

const MULTI_SITE_DATA: Site[] = [
  {
    id: 'site-metro',
    name: 'Metro Expansion & Excavation Hub',
    code: 'METRO-EXP-01',
    address: 'Sector 4, Central Urban Rapid Transit Corridor',
    buildings: [
      {
        id: 'bldg-tower-alpha',
        name: 'Tower Alpha & Core Shaft',
        floors: [
          {
            id: 'fl-l3',
            name: 'Level 3 - Tower Crane & Deck (+28m)',
            elevation: '+28.0m',
            blueprintVersions: [
              { id: 'v-3.4', versionNumber: 'v3.4', title: 'As-Built Crane Radii Cadastral', format: 'SVG CAD', uploadedAt: '2026-08-01', uploadedBy: 'EHS Cadastral Unit', active: true },
              { id: 'v-3.1', versionNumber: 'v3.1', title: 'Formwork Structural Layout', format: 'DXF / DWG', uploadedAt: '2026-07-15', uploadedBy: 'Civil Design Group', active: false }
            ]
          },
          {
            id: 'fl-l2',
            name: 'Level 2 - Scaffold & Structural Frame (+12m)',
            elevation: '+12.0m',
            blueprintVersions: [
              { id: 'v-2.2', versionNumber: 'v2.2', title: 'Scaffolding & Fall Deck Rev 2', format: 'SVG CAD', uploadedAt: '2026-07-28', uploadedBy: 'BuildCorp EHS', active: true }
            ]
          },
          {
            id: 'fl-l1',
            name: 'Level 1 - Ground Turnstile & Laydown (0m)',
            elevation: '0.0m',
            blueprintVersions: [
              { id: 'v-1.0', versionNumber: 'v1.0', title: 'Ground Access & Logistics Plan', format: 'SVG CAD', uploadedAt: '2026-06-10', uploadedBy: 'Master Site Architect', active: true }
            ]
          },
          {
            id: 'fl-b1',
            name: 'Sub-Basement B1 - Trench & Shaft (-10m)',
            elevation: '-10.0m',
            blueprintVersions: [
              { id: 'v-b1', versionNumber: 'v1.2', title: 'Underground Trench & Power Conduit', format: 'Vector PDF', uploadedAt: '2026-05-20', uploadedBy: 'VoltCraft Substation Dept', active: true }
            ]
          }
        ]
      },
      {
        id: 'bldg-site-office',
        name: 'Site Welfare & Command Complex',
        floors: [
          {
            id: 'fl-off-g',
            name: 'Ground Floor - Command Center (0m)',
            elevation: '0.0m',
            blueprintVersions: [
              { id: 'v-off-1', versionNumber: 'v1.0', title: 'Welfare & Operations Layout', format: 'SVG CAD', uploadedAt: '2026-06-01', uploadedBy: 'Site Facilities Lead', active: true }
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'site-bridge',
    name: 'Highway River Span Project',
    code: 'HWY-SPAN-02',
    address: 'North River Crossing Pier 1-4',
    buildings: [
      {
        id: 'bldg-north-pier',
        name: 'Abutment North Pier 1',
        floors: [
          {
            id: 'fl-deck-1',
            name: 'Level 1 - Riverbank Decking (0m)',
            elevation: '0.0m',
            blueprintVersions: [
              { id: 'v-p1', versionNumber: 'v2.0', title: 'Pier Rebar & Concrete Pour Blueprint', format: 'SVG CAD', uploadedAt: '2026-07-10', uploadedBy: 'Infrastructure Eng', active: true }
            ]
          }
        ]
      }
    ]
  }
];

// INITIAL TWIN ENTITIES ON DIGITAL CANVAS
const INITIAL_ENTITIES: TwinEntity[] = [
  // Workers & Personnel
  { id: 'ent-w1', name: 'Marcus Vance (EHS Director)', type: 'worker', siteId: 'site-metro', buildingId: 'bldg-tower-alpha', floorId: 'fl-l2', x: 22, y: 28, width: 8, height: 8, rotation: 0, locked: false, opacity: 1, status: 'active', tradeCompany: 'BuildCorp Safety', tagId: 'HH-1001', battery: 94, details: 'Conducting Level 2 Scaffold Anchor Inspection', lastUpdated: '10s ago' },
  { id: 'ent-w2', name: 'Carlos Mendez (Rigging Supervisor)', type: 'worker', siteId: 'site-metro', buildingId: 'bldg-tower-alpha', floorId: 'fl-l2', x: 68, y: 32, width: 8, height: 8, rotation: 0, locked: false, opacity: 1, status: 'warning', tradeCompany: 'Apex Rigging Co.', tagId: 'HH-2041', battery: 82, details: 'Near Crane TC-01 Load Swing Area', lastUpdated: '2s ago' },
  { id: 'ent-c1', name: 'VoltCraft Electrical Crew (4 Workers)', type: 'contractor', siteId: 'site-metro', buildingId: 'bldg-tower-alpha', floorId: 'fl-b1', x: 45, y: 65, width: 12, height: 10, rotation: 0, locked: false, opacity: 1, status: 'active', tradeCompany: 'VoltCraft Subcontracting', tagId: 'TAG-VC-90', battery: 88, details: 'Pulling 11kV Feeder Cable in Sub-Basement Trench', lastUpdated: 'Just now' },
  { id: 'ent-v1', name: 'Sven Lindqvist (City Building Inspector)', type: 'visitor', siteId: 'site-metro', buildingId: 'bldg-tower-alpha', floorId: 'fl-l1', x: 15, y: 20, width: 8, height: 8, rotation: 0, locked: false, opacity: 1, status: 'active', tradeCompany: 'Municipal Code Authority', tagId: 'VIS-409', battery: 100, details: 'Escorted by EHS Specialist at Gatehouse', lastUpdated: '1m ago' },

  // Command Office Entities
  { id: 'ent-off-1', name: 'Operations Command Workstation', type: 'reader', siteId: 'site-metro', buildingId: 'bldg-site-office', floorId: 'fl-off-g', x: 30, y: 30, width: 10, height: 10, rotation: 0, locked: true, opacity: 1, status: 'active', details: 'Central UHF RFID Portal & Telemetry Relay', rssi: -38, lastUpdated: 'Realtime' },
  { id: 'ent-off-2', name: 'Sarah Connor (Dispatch Officer)', type: 'worker', siteId: 'site-metro', buildingId: 'bldg-site-office', floorId: 'fl-off-g', x: 50, y: 40, width: 8, height: 8, rotation: 0, locked: false, opacity: 1, status: 'active', tradeCompany: 'Site Ops Command', tagId: 'HH-3012', battery: 98, details: 'Monitoring Live RFID Telemetry', lastUpdated: 'Just now' },

  // Highway River Span Project Entities
  { id: 'ent-br-1', name: 'River Bridge Crane BC-01', type: 'equipment', siteId: 'site-bridge', buildingId: 'bldg-north-pier', floorId: 'fl-deck-1', x: 40, y: 50, width: 16, height: 16, rotation: 25, locked: false, opacity: 1, status: 'active', details: '75-Ton Hydraulic Gantry Crane on River Pier 1', lastUpdated: '1s ago' },
  { id: 'ent-br-2', name: 'Deck Concrete Crew (6 Workers)', type: 'contractor', siteId: 'site-bridge', buildingId: 'bldg-north-pier', floorId: 'fl-deck-1', x: 60, y: 45, width: 12, height: 10, rotation: 0, locked: false, opacity: 1, status: 'active', tradeCompany: 'River Span Structural', tagId: 'TAG-[#007BC4]', battery: 91, details: 'Rebar Placement on North Pier Deck', lastUpdated: 'Realtime' },
  { id: 'ent-br-3', name: 'Environmental Anemometer Pier 1', type: 'env_sensor', siteId: 'site-bridge', buildingId: 'bldg-north-pier', floorId: 'fl-deck-1', x: 20, y: 20, width: 8, height: 8, rotation: 0, locked: true, opacity: 1, status: 'active', temperature: 26, details: 'Wind speed 18 km/h • River Humidity 72%', lastUpdated: 'Live' },

  // Readers & Wireless Infrastructure
  { id: 'ent-r1', name: 'Gate 1 Turnstile Active RFID Portal', type: 'reader', siteId: 'site-metro', buildingId: 'bldg-tower-alpha', floorId: 'fl-l1', x: 10, y: 15, width: 10, height: 10, rotation: 0, locked: true, opacity: 1, status: 'active', details: 'UHF RFID Reader • 915 MHz • 140 Tags/sec Scan Rate', rssi: -42, lastUpdated: 'Realtime' },
  { id: 'ent-ble1', name: 'Scaffold Tower BLE Triangulation Gateway', type: 'ble_gateway', siteId: 'site-metro', buildingId: 'bldg-tower-alpha', floorId: 'fl-l2', x: 50, y: 18, width: 8, height: 8, rotation: 0, locked: true, opacity: 1, status: 'active', details: 'Bluetooth 5.3 AoA Direction Finder Gateway', rssi: -55, lastUpdated: 'Realtime' },
  { id: 'ent-gps1', name: 'RTK GPS Base Station Alpha', type: 'gps_beacon', siteId: 'site-metro', buildingId: 'bldg-tower-alpha', floorId: 'fl-l3', x: 80, y: 10, width: 8, height: 8, rotation: 0, locked: true, opacity: 1, status: 'active', details: '1cm Precision Differential GPS Base Unit', lastUpdated: 'Realtime' },

  // Equipment & Machinery
  { id: 'ent-eq1', name: 'Tower Crane TC-01 (150-Ton Capacity)', type: 'equipment', siteId: 'site-metro', buildingId: 'bldg-tower-alpha', floorId: 'fl-l3', x: 65, y: 55, width: 18, height: 18, rotation: 45, locked: false, opacity: 1, status: 'warning', details: 'Anemometer Wind Speed Alarm: 32 km/h • Load 8.4T', battery: 100, lastUpdated: '1s ago' },
  { id: 'ent-veh1', name: 'CAT 336 Heavy Excavator EX-04', type: 'vehicle', siteId: 'site-metro', buildingId: 'bldg-tower-alpha', floorId: 'fl-l1', x: 75, y: 70, width: 16, height: 12, rotation: 90, locked: false, opacity: 1, status: 'active', speed: 4, details: 'Operating at Excavation Sector B', lastUpdated: '3s ago' },

  // Cameras & Sensors
  { id: 'ent-cam1', name: 'PTZ Dome Camera CAM-TC01-BOOM', type: 'camera', siteId: 'site-metro', buildingId: 'bldg-tower-alpha', floorId: 'fl-l3', x: 60, y: 48, width: 8, height: 8, rotation: 135, locked: false, opacity: 1, status: 'active', details: '4K Optical Zoom • AI Vision Safety Helmet Detect', lastUpdated: 'Live Feed' },
  { id: 'ent-sensor1', name: 'Confined Space Multi-Gas Sensor GS-02', type: 'env_sensor', siteId: 'site-metro', buildingId: 'bldg-tower-alpha', floorId: 'fl-b1', x: 40, y: 70, width: 8, height: 8, rotation: 0, locked: false, opacity: 1, status: 'active', temperature: 24, gasLevel: 12, details: 'O2: 20.9% • H2S: 0.0 ppm • CO: 2 ppm • Temp 24°C', lastUpdated: 'Live' },

  // Emergency & Hazards
  { id: 'ent-em1', name: 'AED Trauma & First Aid Kiosk #1', type: 'emergency', siteId: 'site-metro', buildingId: 'bldg-tower-alpha', floorId: 'fl-l1', x: 48, y: 15, width: 8, height: 8, rotation: 0, locked: true, opacity: 1, status: 'active', details: 'AED Battery 100% • Sealed Medical Kit Inspected', lastUpdated: 'OK' },
  { id: 'ent-hz1', name: 'Heavy Crane Swing Exclusion Radius Zone', type: 'hazard', siteId: 'site-metro', buildingId: 'bldg-tower-alpha', floorId: 'fl-l2', x: 60, y: 50, width: 30, height: 30, rotation: 0, locked: true, opacity: 0.8, status: 'critical', details: 'High-Potential Overhead Lifting Exclusion Zone', lastUpdated: 'Active Warning' }
];

export default function DigitalTwinTab() {
  // --- STATE MANAGEMENT ---
  const [sites, setSites] = useState<Site[]>(MULTI_SITE_DATA);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('site-metro');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('bldg-tower-alpha');
  const [selectedFloorId, setSelectedFloorId] = useState<string>('fl-l2');

  // Blueprint Versioning
  const [selectedVersionId, setSelectedVersionId] = useState<string>('v-2.2');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [newBlueprintTitle, setNewBlueprintTitle] = useState('');
  const [newBlueprintFormat, setNewBlueprintFormat] = useState<'SVG CAD' | 'DXF / DWG' | 'Vector PDF' | 'Raster PNG'>('SVG CAD');

  // Viewport & Mode Settings
  const [viewMode, setViewMode] = useState<'3d' | '2d' | 'split'>('3d');
  const [gridEnabled, setGridEnabled] = useState(true);
  const [gridStyle, setGridStyle] = useState<'isometric' | 'square' | 'dots'>('isometric');
  const [gridSize, setGridSize] = useState<number>(20); // 20px
  const [scaleFactor, setScaleFactor] = useState<string>('1:100 (10px = 1m)');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [miniMapOpen, setMiniMapOpen] = useState(true);
  
  // 3D Canvas Controls
  const [rotationAngle, setRotationAngle] = useState(30); // deg
  const [tiltAngle, setTiltAngle] = useState(45); // deg
  const [zoomLevel, setZoomLevel] = useState(100); // %

  // Layer Manager Toggles
  const [layers, setLayers] = useState({
    workers: true,
    visitors: true,
    contractors: true,
    readers: true,
    bleGps: true,
    equipment: true,
    vehicles: true,
    cameras: true,
    sensors: true,
    emergency: true,
    hazards: true,
    weather: true,
    heatmaps: false,
    cadLayers: {
      architectural: true,
      structural: true,
      electrical: true,
      hvac: true,
      safety: true
    }
  });

  const [heatmapMode, setHeatmapMode] = useState<'density' | 'rssi' | 'hazard'>('density');

  // Entities & Selection
  const [entities, setEntities] = useState<TwinEntity[]>(INITIAL_ENTITIES);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>('ent-w1');
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  
  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'warning' | 'critical'>('all');

  // Measurement Tool State
  const [activeTool, setActiveTool] = useState<'select' | 'measure_ruler' | 'measure_area' | 'add_entity'>('select');
  const [rulerPoints, setRulerPoints] = useState<{ x: number; y: number }[]>([]);
  const [measuredDistance, setMeasuredDistance] = useState<number | null>(null);

  // Undo / Redo History Stack
  const [history, setHistory] = useState<TwinEntity[][]>([INITIAL_ENTITIES]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Time Scrubbing & Playback
  const [isPlaybackRunning, setIsPlaybackRunning] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [playbackProgress, setPlaybackProgress] = useState<number>(100); // 100% = Live
  const [playbackTimeLabel, setPlaybackTimeLabel] = useState<string>('LIVE Realtime Feed');

  // Live Simulation Telemetry Toggle
  const [liveTelemetry, setLiveTelemetry] = useState(true);

  // References
  const containerRef = useRef<HTMLDivElement>(null);

  // --- DERIVED HIERARCHY ---
  const currentSite = useMemo(() => sites.find(s => s.id === selectedSiteId) || sites[0], [sites, selectedSiteId]);
  const currentBuilding = useMemo(() => currentSite.buildings.find(b => b.id === selectedBuildingId) || currentSite.buildings[0], [currentSite, selectedBuildingId]);
  const currentFloor = useMemo(() => currentBuilding.floors.find(f => f.id === selectedFloorId) || currentBuilding.floors[0], [currentBuilding, selectedFloorId]);

  // Sync selection defaults when site/building changes
  useEffect(() => {
    if (currentSite.buildings.length > 0) {
      if (!currentSite.buildings.some(b => b.id === selectedBuildingId)) {
        setSelectedBuildingId(currentSite.buildings[0].id);
      }
    }
  }, [selectedSiteId, currentSite]);

  useEffect(() => {
    if (currentBuilding.floors.length > 0) {
      if (!currentBuilding.floors.some(f => f.id === selectedFloorId)) {
        setSelectedFloorId(currentBuilding.floors[0].id);
      }
    }
  }, [selectedBuildingId, currentBuilding]);

  // Sync blueprint version when selectedFloor changes
  useEffect(() => {
    if (currentFloor?.blueprintVersions && currentFloor.blueprintVersions.length > 0) {
      if (!currentFloor.blueprintVersions.some(v => v.id === selectedVersionId)) {
        setSelectedVersionId(currentFloor.blueprintVersions[0].id);
      }
    }
  }, [selectedFloorId, currentFloor, selectedVersionId]);

  // Push new state to undo history
  const updateEntitiesWithHistory = (newEntities: TwinEntity[]) => {
    const nextHistory = history.slice(0, historyIndex + 1);
    nextHistory.push(newEntities);
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
    setEntities(newEntities);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIdx = historyIndex - 1;
      setHistoryIndex(prevIdx);
      setEntities(history[prevIdx]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIdx = historyIndex + 1;
      setHistoryIndex(nextIdx);
      setEntities(history[nextIdx]);
    }
  };

  // --- LIVE TELEMETRY SIMULATION ---
  useEffect(() => {
    if (!liveTelemetry || playbackProgress < 100) return;

    const interval = setInterval(() => {
      setEntities(prevEntities => {
        return prevEntities.map(ent => {
          if (ent.locked) return ent;

          // Minor organic jitter to simulate real live tracking
          let deltaX = (Math.random() - 0.5) * 0.4;
          let deltaY = (Math.random() - 0.5) * 0.4;

          // Ensure entity stays within 5% - 95% bounds
          const newX = Math.min(92, Math.max(8, ent.x + deltaX));
          const newY = Math.min(92, Math.max(8, ent.y + deltaY));

          return {
            ...ent,
            x: Number(newX.toFixed(2)),
            y: Number(newY.toFixed(2)),
            battery: ent.battery ? Math.max(10, ent.battery - (Math.random() > 0.95 ? 1 : 0)) : ent.battery
          };
        });
      });
    }, 1500);

    return () => clearInterval(interval);
  }, [liveTelemetry, playbackProgress]);

  // --- PLAYBACK TIMELINE ENGINE ---
  useEffect(() => {
    let timer: any = null;
    if (isPlaybackRunning) {
      timer = setInterval(() => {
        setPlaybackProgress(prev => {
          if (prev >= 100) {
            setIsPlaybackRunning(false);
            setPlaybackTimeLabel('LIVE Realtime Feed');
            return 100;
          }
          const next = prev + 1;
          const totalMins = Math.floor((next / 100) * 480); // 8-hour workday scale
          const hour = 8 + Math.floor(totalMins / 60);
          const min = totalMins % 60;
          const formattedTime = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')} AM`;
          setPlaybackTimeLabel(`Historical Replay - ${formattedTime}`);
          return next;
        });
      }, 200 / playbackSpeed);
    }
    return () => clearInterval(timer);
  }, [isPlaybackRunning, playbackSpeed]);

  // --- ENTITY MANIPULATION HANDLERS ---
  const selectedEntity = useMemo(() => entities.find(e => e.id === selectedEntityId) || null, [entities, selectedEntityId]);

  const handleDragEntity = (id: string, newX: number, newY: number) => {
    const updated = entities.map(e => {
      if (e.id === id && !e.locked) {
        return { ...e, x: Math.min(95, Math.max(5, newX)), y: Math.min(95, Math.max(5, newY)) };
      }
      return e;
    });
    updateEntitiesWithHistory(updated);
  };

  const handleRotateEntity = (id: string, deltaAngle: number) => {
    const updated = entities.map(e => {
      if (e.id === id && !e.locked) {
        return { ...e, rotation: (e.rotation + deltaAngle + 360) % 360 };
      }
      return e;
    });
    updateEntitiesWithHistory(updated);
  };

  const handleToggleLock = (id: string) => {
    const updated = entities.map(e => {
      if (e.id === id) {
        return { ...e, locked: !e.locked };
      }
      return e;
    });
    updateEntitiesWithHistory(updated);
  };

  const handleDuplicateEntity = (id: string) => {
    const target = entities.find(e => e.id === id);
    if (!target) return;

    const newId = `ent-copy-${Date.now()}`;
    const copyObj: TwinEntity = {
      ...target,
      id: newId,
      name: `${target.name} (Copy)`,
      x: Math.min(90, target.x + 4),
      y: Math.min(90, target.y + 4),
      locked: false
    };

    updateEntitiesWithHistory([...entities, copyObj]);
    setSelectedEntityId(newId);
  };

  const handleRenameEntity = (id: string, newName: string) => {
    if (!newName.trim()) return;
    const updated = entities.map(e => {
      if (e.id === id) {
        return { ...e, name: newName };
      }
      return e;
    });
    updateEntitiesWithHistory(updated);
  };

  const handleDeleteEntity = (id: string) => {
    const updated = entities.filter(e => e.id !== id);
    updateEntitiesWithHistory(updated);
    if (selectedEntityId === id) setSelectedEntityId(null);
  };

  const handleAddNewEntity = (type: EntityType) => {
    const newId = `ent-${Date.now()}`;
    const newRecord: TwinEntity = {
      id: newId,
      name: `New ${type.toUpperCase().replace('_', ' ')}`,
      type,
      siteId: selectedSiteId,
      buildingId: selectedBuildingId,
      floorId: selectedFloorId,
      x: 50,
      y: 50,
      width: 10,
      height: 10,
      rotation: 0,
      locked: false,
      opacity: 1,
      status: 'active',
      details: 'Newly added spatial object on Digital Twin canvas',
      lastUpdated: 'Just now'
    };

    updateEntitiesWithHistory([...entities, newRecord]);
    setSelectedEntityId(newId);
  };

  // --- FILTERED ENTITIES ON CANVAS ---
  const filteredEntities = useMemo(() => {
    return entities.filter(ent => {
      // Check site/building/floor match
      if (ent.siteId !== selectedSiteId || ent.buildingId !== selectedBuildingId || ent.floorId !== selectedFloorId) {
        return false;
      }

      // Layer Filter Checks
      if (ent.type === 'worker' && !layers.workers) return false;
      if (ent.type === 'visitor' && !layers.visitors) return false;
      if (ent.type === 'contractor' && !layers.contractors) return false;
      if (ent.type === 'reader' && !layers.readers) return false;
      if ((ent.type === 'ble_gateway' || ent.type === 'gps_beacon') && !layers.bleGps) return false;
      if (ent.type === 'equipment' && !layers.equipment) return false;
      if (ent.type === 'vehicle' && !layers.vehicles) return false;
      if (ent.type === 'camera' && !layers.cameras) return false;
      if (ent.type === 'env_sensor' && !layers.sensors) return false;
      if (ent.type === 'emergency' && !layers.emergency) return false;
      if (ent.type === 'hazard' && !layers.hazards) return false;

      // Search Query
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchName = ent.name.toLowerCase().includes(query);
        const matchDetails = ent.details?.toLowerCase().includes(query) || false;
        const matchTag = ent.tagId?.toLowerCase().includes(query) || false;
        if (!matchName && !matchDetails && !matchTag) return false;
      }

      // Status Filter
      if (statusFilter === 'warning' && ent.status !== 'warning') return false;
      if (statusFilter === 'critical' && ent.status !== 'critical') return false;

      return true;
    });
  }, [entities, selectedSiteId, selectedBuildingId, selectedFloorId, layers, searchQuery, statusFilter]);

  // --- MEASUREMENT RULER HANDLER ---
  const handleCanvasClickForMeasurement = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== 'measure_ruler' && activeTool !== 'measure_area') return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = ((e.clientX - rect.left) / rect.width) * 100;
    const clickY = ((e.clientY - rect.top) / rect.height) * 100;

    const newPts = [...rulerPoints, { x: clickX, y: clickY }];
    setRulerPoints(newPts);

    if (newPts.length >= 2) {
      const dx = newPts[1].x - newPts[0].x;
      const dy = newPts[1].y - newPts[0].y;
      // Assume 1% canvas width = 1 meter approx for scale calculation
      const distMeters = Math.sqrt(dx * dx + dy * dy) * 0.8;
      setMeasuredDistance(Number(distMeters.toFixed(2)));
    }
  };

  // Blueprint Upload Handler
  const handleUploadBlueprint = () => {
    const newVer: BlueprintVersion = {
      id: `v-custom-${Date.now()}`,
      versionNumber: `v${(currentFloor.blueprintVersions.length + 1).toFixed(1)}`,
      title: newBlueprintTitle.trim() || 'Uploaded Custom Vector CAD Plan',
      format: newBlueprintFormat,
      uploadedAt: new Date().toISOString().split('T')[0],
      uploadedBy: 'Operational Lead',
      active: true
    };

    setSites(prev => prev.map(site => {
      if (site.id !== selectedSiteId) return site;
      return {
        ...site,
        buildings: site.buildings.map(bldg => {
          if (bldg.id !== selectedBuildingId) return bldg;
          return {
            ...bldg,
            floors: bldg.floors.map(fl => {
              if (fl.id !== selectedFloorId) return fl;
              return {
                ...fl,
                blueprintVersions: [newVer, ...fl.blueprintVersions]
              };
            })
          };
        })
      };
    }));

    setSelectedVersionId(newVer.id);
    setIsUploadModalOpen(false);
    setNewBlueprintTitle('');
  };

  // Export Digital Twin Asset Inventory
  const handleExportCSV = () => {
    const rows = entities.map(e => ({
      ID: e.id,
      Name: e.name,
      Type: e.type,
      Site: e.siteId,
      Building: e.buildingId,
      Floor: e.floorId,
      CoordX: e.x,
      CoordY: e.y,
      Status: e.status,
      TagID: e.tagId || 'N/A',
      Battery: e.battery ? `${e.battery}%` : 'N/A',
      Details: e.details || ''
    }));

    exportToCSV('Digital_Twin_Entity_Inventory', rows, [
      { key: 'ID', label: 'ENTITY ID' },
      { key: 'Name', label: 'ENTITY NAME' },
      { key: 'Type', label: 'CATEGORY' },
      { key: 'Floor', label: 'FLOOR LEVEL' },
      { key: 'CoordX', label: 'GRID X' },
      { key: 'CoordY', label: 'GRID Y' },
      { key: 'Status', label: 'STATUS' },
      { key: 'TagID', label: 'HARDHAT / RFID TAG' },
      { key: 'Battery', label: 'BATTERY %' },
      { key: 'Details', label: 'TELEMETRY DETAILS' }
    ]);
  };

  return (
    <div ref={containerRef} className="w-full flex flex-col p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      
      {/* 1. TOP HEADER & OPERATIONAL CONTROL BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Box className="w-7 h-7 text-[#007BC4]" />
              Digital Twin Operational Hub
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full inline-block mr-1 animate-pulse" />
              Live CAD & Spatial Engine
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-xs md:text-sm mt-0.5">
            Multi-site, multi-building, multi-floor 3D CAD digital twin, IoT sensors, workers, equipment & spatial simulation
          </p>
        </div>

        {/* Global Toolbar Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
            <button
              onClick={() => setViewMode('3d')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === '3d' ? 'bg-[#007BC4] text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Box size={14} /> 3D Spatial Twin
            </button>
            <button
              onClick={() => setViewMode('2d')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === '2d' ? 'bg-[#007BC4] text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Layers size={14} /> 2D CAD Blueprint
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                viewMode === 'split' ? 'bg-[#007BC4] text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              <Layers2 size={14} /> Dual View Mode
            </button>
          </div>

          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-50 transition flex items-center gap-1.5"
          >
            <Upload size={14} className="text-[#007BC4]" /> Upload Blueprint / CAD
          </button>

          <button
            onClick={handleExportCSV}
            className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 transition shadow-sm"
            title="Export Digital Twin Inventory CSV"
          >
            <FileSpreadsheet size={15} />
          </button>
        </div>
      </div>

      {/* 2. MULTI-SITE, MULTI-BUILDING, MULTI-FLOOR SELECTOR STRIP */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          
          {/* Site Selector */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Select Site Location</label>
            <div className="relative">
              <Building2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#007BC4]" />
              <select
                value={selectedSiteId}
                onChange={e => setSelectedSiteId(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#007BC4]"
              >
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Building Selector */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Building Structure</label>
            <div className="relative">
              <Building size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#007BC4]" />
              <select
                value={selectedBuildingId}
                onChange={e => setSelectedBuildingId(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#007BC4]"
              >
                {currentSite.buildings.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Floor Elevation Selector */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Floor Level Elevation</label>
            <div className="relative">
              <Layers size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#007BC4]" />
              <select
                value={selectedFloorId}
                onChange={e => setSelectedFloorId(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#007BC4]"
              >
                {currentBuilding.floors.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Blueprint Cadastral Version Selector */}
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Cadastral Map Version</label>
            <div className="relative">
              <FileCode2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#007BC4]" />
              <select
                value={selectedVersionId}
                onChange={e => setSelectedVersionId(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-[#007BC4]"
              >
                {currentFloor.blueprintVersions.map(v => (
                  <option key={v.id} value={v.id}>{v.versionNumber} - {v.title} ({v.format})</option>
                ))}
              </select>
            </div>
          </div>

        </div>

        {/* Ambient Weather & Live Telemetry Strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/60 text-xs text-slate-600 dark:text-slate-300">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-bold flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Sun size={14} /> Clear 28°C
            </span>
            <span className="flex items-center gap-1">
              <Wind size={14} className="text-blue-500" /> Wind Shear: 32 km/h SSE
            </span>
            <span className="flex items-center gap-1">
              <Thermometer size={14} className="text-rose-500" /> Ground Heat Index: 30°C
            </span>
            <span className="flex items-center gap-1">
              <CloudRain size={14} className="text-teal-500" /> Precip: 0%
            </span>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer select-none font-bold text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                checked={liveTelemetry}
                onChange={e => setLiveTelemetry(e.target.checked)}
                className="rounded accent-[#007BC4]"
              />
              Live Telemetry Feed
            </label>

            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 font-mono text-[10px] text-slate-500">
              Scale: {scaleFactor}
            </span>
          </div>
        </div>
      </div>

      {/* 3. MAIN WORKSPACE GRID: LEFT LAYER MANAGER & TOOLBAR (3 cols) + RIGHT CANVAS WORKSPACE (9 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[620px]">
        
        {/* LEFT COLUMN: Layer Manager, Manipulation Tool Palette, Object Inspector */}
        <div className="lg:col-span-3 space-y-4">
          
          {/* Manipulation Tool Palette */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center justify-between">
              <span>Canvas Tools</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-600 dark:text-slate-300"
                  title="Undo (Ctrl+Z)"
                >
                  <Undo2 size={13} />
                </button>
                <button
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                  className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30 text-slate-600 dark:text-slate-300"
                  title="Redo (Ctrl+Y)"
                >
                  <Redo2 size={13} />
                </button>
              </div>
            </h3>

            {/* Tool Modes */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setActiveTool('select')}
                className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                  activeTool === 'select'
                    ? 'bg-[#007BC4] text-white border-[#007BC4] shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <MousePointer size={13} /> Select / Move
              </button>

              <button
                onClick={() => {
                  setActiveTool('measure_ruler');
                  setRulerPoints([]);
                  setMeasuredDistance(null);
                }}
                className={`p-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                  activeTool === 'measure_ruler'
                    ? 'bg-[#007BC4] text-white border-[#007BC4] shadow-sm'
                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Ruler size={13} /> Measure Ruler
              </button>
            </div>

            {measuredDistance !== null && (
              <div className="p-2 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-xl text-xs font-bold text-blue-900 dark:text-blue-200 flex justify-between items-center">
                <span>Ruler Distance:</span>
                <span className="font-mono text-sm">{measuredDistance} meters</span>
              </div>
            )}

            {/* Entity Insertion Quick Action Buttons */}
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Insert Spatial Entity</span>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { type: 'worker', label: 'Worker', icon: HardHat },
                  { type: 'equipment', label: 'Crane', icon: Box },
                  { type: 'camera', label: 'CCTV', icon: Video },
                  { type: 'reader', label: 'RFID', icon: Radio },
                  { type: 'env_sensor', label: 'Sensor', icon: Gauge },
                  { type: 'hazard', label: 'Hazard', icon: AlertTriangle }
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.type}
                      onClick={() => handleAddNewEntity(item.type as EntityType)}
                      className="p-1.5 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 rounded-lg text-[10px] font-bold text-slate-700 dark:text-slate-300 flex flex-col items-center gap-1 transition"
                    >
                      <Icon size={12} className="text-[#007BC4]" />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Layer Manager Accordion */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Layers size={14} className="text-[#007BC4]" /> Layer Manager
              </span>
              <Badge variant="outline" className="text-[9px]">12 Layers Active</Badge>
            </h3>

            <div className="space-y-1.5 text-xs max-h-60 overflow-y-auto pr-1">
              {[
                { key: 'workers', label: 'Workers & Personnel', count: entities.filter(e => e.type === 'worker').length, color: 'text-blue-600' },
                { key: 'visitors', label: 'Visitors & Inspectors', count: entities.filter(e => e.type === 'visitor').length, color: 'text-purple-600' },
                { key: 'contractors', label: 'Subcontractor Teams', count: entities.filter(e => e.type === 'contractor').length, color: 'text-indigo-600' },
                { key: 'readers', label: 'Fixed RFID Portals', count: entities.filter(e => e.type === 'reader').length, color: 'text-emerald-600' },
                { key: 'bleGps', label: 'BLE & GPS Gateways', count: entities.filter(e => e.type === 'ble_gateway' || e.type === 'gps_beacon').length, color: 'text-teal-600' },
                { key: 'equipment', label: 'Heavy Equipment & Cranes', count: entities.filter(e => e.type === 'equipment').length, color: 'text-amber-600' },
                { key: 'vehicles', label: 'Site Vehicles & Haulers', count: entities.filter(e => e.type === 'vehicle').length, color: 'text-orange-600' },
                { key: 'cameras', label: 'CCTV & Thermal Cameras', count: entities.filter(e => e.type === 'camera').length, color: 'text-rose-600' },
                { key: 'sensors', label: 'Gas / Noise IoT Sensors', count: entities.filter(e => e.type === 'env_sensor').length, color: 'text-violet-600' },
                { key: 'emergency', label: 'Emergency First Aid / AED', count: entities.filter(e => e.type === 'emergency').length, color: 'text-rose-700' },
                { key: 'hazards', label: 'High Hazard Exclusion Zones', count: entities.filter(e => e.type === 'hazard').length, color: 'text-red-600' }
              ].map(layer => (
                <div key={layer.key} className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800 dark:text-slate-200 select-none">
                    <input
                      type="checkbox"
                      checked={(layers as any)[layer.key]}
                      onChange={e => setLayers({ ...layers, [layer.key]: e.target.checked })}
                      className="rounded accent-[#007BC4]"
                    />
                    <span className={layer.color}>{layer.label}</span>
                  </label>
                  <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                    {layer.count}
                  </span>
                </div>
              ))}
            </div>

            {/* Heatmap Overlay Toggle */}
            <div className="pt-2 border-t border-slate-100 dark:border-slate-700 space-y-1.5">
              <label className="flex items-center justify-between cursor-pointer font-bold text-xs text-slate-800 dark:text-slate-200 select-none">
                <span className="flex items-center gap-1.5 text-amber-600">
                  <Flame size={13} /> Spatial Heatmaps
                </span>
                <input
                  type="checkbox"
                  checked={layers.heatmaps}
                  onChange={e => setLayers({ ...layers, heatmaps: e.target.checked })}
                  className="rounded accent-amber-500"
                />
              </label>

              {layers.heatmaps && (
                <div className="flex gap-1 pt-1">
                  {(['density', 'rssi', 'hazard'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setHeatmapMode(mode)}
                      className={`flex-1 py-1 text-[10px] font-bold rounded uppercase ${
                        heatmapMode === mode ? 'bg-amber-500 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Selected Entity Inspector Panel */}
          {selectedEntity && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 shadow-sm space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders size={13} className="text-[#007BC4]" /> Inspector
                </h4>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleToggleLock(selectedEntity.id)}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                    title={selectedEntity.locked ? 'Unlock Element' : 'Lock Element'}
                  >
                    {selectedEntity.locked ? <Lock size={13} className="text-rose-500" /> : <Unlock size={13} />}
                  </button>
                  <button
                    onClick={() => handleDuplicateEntity(selectedEntity.id)}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                    title="Duplicate Element"
                  >
                    <Copy size={13} />
                  </button>
                  <button
                    onClick={() => handleDeleteEntity(selectedEntity.id)}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-rose-500"
                    title="Delete Element"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Entity Label</label>
                  <input
                    type="text"
                    value={selectedEntity.name}
                    onChange={e => handleRenameEntity(selectedEntity.id, e.target.value)}
                    className="w-full mt-0.5 px-2 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  <div className="p-1.5 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 text-[9px] block">GRID COORD X</span>
                    <strong>{selectedEntity.x}%</strong>
                  </div>
                  <div className="p-1.5 bg-slate-50 dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 text-[9px] block">GRID COORD Y</span>
                    <strong>{selectedEntity.y}%</strong>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="font-bold text-slate-500">Rotation Angle:</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleRotateEntity(selectedEntity.id, -15)}
                      className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded font-bold hover:bg-slate-200"
                    >
                      -15°
                    </button>
                    <span className="font-mono font-bold px-1">{selectedEntity.rotation}°</span>
                    <button
                      onClick={() => handleRotateEntity(selectedEntity.id, 15)}
                      className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded font-bold hover:bg-slate-200"
                    >
                      +15°
                    </button>
                  </div>
                </div>

                <p className="text-slate-600 dark:text-slate-400 text-[11px] bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
                  {selectedEntity.details}
                </p>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: CANVAS WORKSPACE WITH 3D / 2D VIEWPORTS, COMPASS, MINI MAP, GRID & PLAYBACK */}
        <div className="lg:col-span-9 bg-slate-950 border border-slate-800 rounded-2xl shadow-inner relative flex flex-col overflow-hidden min-h-[580px]">
          
          {/* Top Canvas HUD Overlay Header */}
          <div className="p-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 z-20">
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search spatial entities..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-slate-200 outline-none focus:border-[#007BC4] w-44 sm:w-56"
                />
              </div>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="py-1 px-2.5 bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-slate-300 outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="warning">Warnings Only</option>
                <option value="critical">Critical Alarms</option>
              </select>
            </div>

            {/* Canvas Controls: Grid, Compass Alignment, Zoom */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setGridEnabled(!gridEnabled)}
                className={`p-1.5 rounded-lg text-xs font-bold border ${
                  gridEnabled ? 'bg-[#007BC4] text-white border-[#007BC4]' : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
                title="Toggle Spatial Grid"
              >
                <Grid size={15} />
              </button>

              {viewMode === '3d' && (
                <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
                  <button
                    onClick={() => setRotationAngle(r => (r - 45 + 360) % 360)}
                    className="p-1 text-slate-300 hover:text-white"
                    title="Rotate Left"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <span className="text-[10px] font-mono text-slate-300 px-1">{rotationAngle}°</span>
                  <button
                    onClick={() => setRotationAngle(r => (r + 45) % 360)}
                    className="p-1 text-slate-300 hover:text-white"
                    title="Rotate Right"
                  >
                    <RotateCw size={14} />
                  </button>
                </div>
              )}

              <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700 text-xs text-slate-300 font-bold">
                <button onClick={() => setZoomLevel(z => Math.max(50, z - 10))} className="px-1.5 hover:text-white">-</button>
                <span className="font-mono text-[10px]">{zoomLevel}%</span>
                <button onClick={() => setZoomLevel(z => Math.min(200, z + 10))} className="px-1.5 hover:text-white">+</button>
              </div>
            </div>
          </div>

          {/* MAIN VIEWPORT RENDER AREA */}
          <div
            onClick={handleCanvasClickForMeasurement}
            className="flex-1 relative flex items-center justify-center p-6 overflow-hidden select-none min-h-[440px]"
          >
            
            {/* Interactive Grid Background */}
            {gridEnabled && (
              <div
                className="absolute inset-0 pointer-events-none opacity-20 transition-all duration-300"
                style={{
                  backgroundImage: gridStyle === 'dots'
                    ? 'radial-gradient(#007BC4 1.5px, transparent 1.5px)'
                    : 'linear-gradient(#007BC4 1px, transparent 1px), linear-gradient(90deg, #007BC4 1px, transparent 1px)',
                  backgroundSize: `${gridSize}px ${gridSize}px`,
                  transform: viewMode === '3d'
                    ? `perspective(800px) rotateX(${tiltAngle}deg) rotateZ(${rotationAngle}deg) scale(${zoomLevel / 100})`
                    : `scale(${zoomLevel / 100})`
                }}
              />
            )}

            {/* Heatmap Layer Effect */}
            {layers.heatmaps && (
              <div className="absolute inset-0 pointer-events-none z-10 opacity-35 mix-blend-screen bg-gradient-to-tr from-rose-600 via-amber-500 to-emerald-400 blur-2xl animate-pulse" />
            )}

            {/* VIEW MODE 1: 3D SPATIAL TWIN */}
            {(viewMode === '3d' || viewMode === 'split') && (
              <div
                className={`relative border-2 border-slate-700/80 rounded-3xl bg-slate-900/70 shadow-[0_25px_60px_rgba(0,0,0,0.8)] transition-all duration-500 p-6 overflow-hidden ${
                  viewMode === 'split' ? 'w-[48%] h-[360px]' : 'w-[560px] h-[400px]'
                }`}
                style={{
                  transform: `perspective(900px) rotateX(${tiltAngle}deg) rotateZ(${rotationAngle}deg) scale(${zoomLevel / 100})`,
                  transformStyle: 'preserve-3d'
                }}
              >
                {/* 3D Blueprint CAD Baseplate */}
                <div className="absolute inset-0 border border-slate-700/50 rounded-2xl pointer-events-none flex items-center justify-center">
                  <span className="text-[10px] font-mono font-black text-slate-700 uppercase tracking-widest">
                    {currentBuilding.name} • {currentFloor.name} CAD BASEPLATE
                  </span>
                </div>

                {/* Filtered Spatial Entities Rendered in 3D */}
                {filteredEntities.map(ent => {
                  const isSelected = selectedEntityId === ent.id;

                  return (
                    <div
                      key={ent.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEntityId(ent.id);
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        if (activeTool === 'select' && !ent.locked) {
                          const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                          if (!rect) return;

                          const onMouseMove = (moveEv: MouseEvent) => {
                            const newX = ((moveEv.clientX - rect.left) / rect.width) * 100;
                            const newY = ((moveEv.clientY - rect.top) / rect.height) * 100;
                            handleDragEntity(ent.id, newX, newY);
                          };

                          const onMouseUp = () => {
                            window.removeEventListener('mousemove', onMouseMove);
                            window.removeEventListener('mouseup', onMouseUp);
                          };

                          window.addEventListener('mousemove', onMouseMove);
                          window.addEventListener('mouseup', onMouseUp);
                        }
                      }}
                      className={`absolute rounded-2xl p-2.5 shadow-xl border-2 backdrop-blur-md cursor-pointer transition-all duration-200 flex flex-col justify-between ${
                        isSelected
                          ? 'ring-4 ring-[#007BC4] scale-110 z-30 bg-[#007BC4]/40 border-[#007BC4] shadow-[0_0_30px_#007BC4]'
                          : ent.status === 'critical'
                          ? 'bg-rose-500/30 border-rose-500 shadow-[0_0_20px_#f43f5e]'
                          : ent.status === 'warning'
                          ? 'bg-amber-500/30 border-amber-500 shadow-[0_0_20px_#f59e0b]'
                          : 'bg-slate-900/80 border-slate-600 hover:border-slate-400'
                      }`}
                      style={{
                        left: `${ent.x}%`,
                        top: `${ent.y}%`,
                        width: `${ent.width * 4.5}px`,
                        height: `${ent.height * 4.5}px`,
                        transform: `translateZ(25px) rotate(${ent.rotation}deg)`,
                        opacity: ent.opacity
                      }}
                    >
                      <div className="flex items-center justify-between gap-1 text-[10px] font-bold text-white">
                        <span className="truncate">{ent.name}</span>
                        {ent.locked && <Lock size={10} className="text-amber-400 shrink-0" />}
                      </div>

                      <div className="flex items-center justify-between text-[9px] font-mono text-slate-300">
                        <span>{ent.type.toUpperCase()}</span>
                        {ent.battery && <span className="text-emerald-400">{ent.battery}%</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* VIEW MODE 2: 2D CAD BLUEPRINT */}
            {(viewMode === '2d' || viewMode === 'split') && (
              <div className={`relative border-2 border-slate-800 rounded-2xl bg-slate-900 shadow-2xl p-4 overflow-hidden flex flex-col justify-between ${
                viewMode === 'split' ? 'w-[48%] h-[360px]' : 'w-[580px] h-[400px]'
              }`}>
                
                {/* Blueprint Header Label */}
                <div className="absolute top-3 left-4 z-20 text-xs font-mono font-bold text-slate-200 bg-slate-950/80 px-2.5 py-1 rounded-lg border border-slate-700 flex items-center gap-2">
                  <FileCode2 size={14} className="text-[#007BC4]" />
                  {currentFloor.name} CAD Vector Blueprint ({currentFloor.blueprintVersions.find(v => v.id === selectedVersionId)?.versionNumber || 'v3.4'})
                </div>

                {/* SVG Vector Map Rendering */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" viewBox="0 0 500 350">
                  <defs>
                    <pattern id="cadGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="1" />
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#cadGrid)" />

                  {/* CAD Layers (Architectural, Structural, Electrical) */}
                  {layers.cadLayers.architectural && (
                    <g stroke="#334155" strokeWidth="2" fill="none">
                      <rect x="20" y="20" width="460" height="310" rx="12" />
                      <line x1="160" y1="20" x2="160" y2="330" />
                      <line x1="320" y1="20" x2="320" y2="330" />
                      <line x1="20" y1="180" x2="480" y2="180" />
                    </g>
                  )}

                  {layers.cadLayers.electrical && (
                    <g stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 4" fill="none">
                      <path d="M 40 40 L 150 40 L 150 160 L 300 160" />
                    </g>
                  )}

                  {/* Measurement Ruler Tool Line */}
                  {rulerPoints.length >= 2 && (
                    <g>
                      <line
                        x1={rulerPoints[0].x * 5}
                        y1={rulerPoints[0].y * 3.5}
                        x2={rulerPoints[1].x * 5}
                        y2={rulerPoints[1].y * 3.5}
                        stroke="#007BC4"
                        strokeWidth="3"
                        strokeDasharray="4 4"
                      />
                      <circle cx={rulerPoints[0].x * 5} cy={rulerPoints[0].y * 3.5} r="5" fill="#007BC4" />
                      <circle cx={rulerPoints[1].x * 5} cy={rulerPoints[1].y * 3.5} r="5" fill="#007BC4" />
                    </g>
                  )}
                </svg>

                {/* 2D Interactive Entity Nodes */}
                <div className="relative w-full h-full z-10">
                  {filteredEntities.map(ent => {
                    const isSelected = selectedEntityId === ent.id;

                    return (
                      <button
                        key={ent.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEntityId(ent.id);
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          if (activeTool === 'select' && !ent.locked) {
                            const rect = e.currentTarget.parentElement?.getBoundingClientRect();
                            if (!rect) return;

                            const onMouseMove = (moveEv: MouseEvent) => {
                              const newX = ((moveEv.clientX - rect.left) / rect.width) * 100;
                              const newY = ((moveEv.clientY - rect.top) / rect.height) * 100;
                              handleDragEntity(ent.id, newX, newY);
                            };

                            const onMouseUp = () => {
                              window.removeEventListener('mousemove', onMouseMove);
                              window.removeEventListener('mouseup', onMouseUp);
                            };

                            window.addEventListener('mousemove', onMouseMove);
                            window.addEventListener('mouseup', onMouseUp);
                          }
                        }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 p-2 rounded-xl border-2 transition-all duration-200 font-bold flex items-center gap-1.5 cursor-grab active:cursor-grabbing ${
                          isSelected
                            ? 'bg-[#007BC4] border-white text-white scale-110 z-20 shadow-[0_0_20px_#007BC4]'
                            : ent.status === 'critical'
                            ? 'bg-rose-600 border-rose-300 text-white'
                            : ent.status === 'warning'
                            ? 'bg-amber-500 border-amber-200 text-white'
                            : 'bg-slate-800 border-slate-600 text-slate-200 hover:scale-105'
                        }`}
                        style={{ left: `${ent.x}%`, top: `${ent.y}%` }}
                      >
                        <MapPin size={12} />
                        <span className="text-[10px] font-mono">{ent.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>

              </div>
            )}

            {/* FLOATING COMPASS ROSE OVERLAY */}
            <div className="absolute top-4 right-4 z-20 bg-slate-900/90 border border-slate-800 rounded-2xl p-2.5 shadow-xl flex flex-col items-center gap-1">
              <Compass size={24} className="text-[#007BC4] animate-spin-slow" />
              <span className="text-[9px] font-mono font-bold text-slate-300">NORTH 0°</span>
              <div className="grid grid-cols-3 gap-0.5 mt-1 text-[8px] font-black">
                <button onClick={() => setRotationAngle(0)} className="px-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded">N</button>
                <button onClick={() => setRotationAngle(90)} className="px-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded">E</button>
                <button onClick={() => setRotationAngle(180)} className="px-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded">S</button>
              </div>
            </div>

            {/* COLLAPSIBLE PIP MINI MAP OVERLAY */}
            {miniMapOpen && (
              <div className="absolute bottom-4 right-4 z-20 w-44 h-32 bg-slate-900/95 border-2 border-slate-700 rounded-2xl p-2 shadow-2xl flex flex-col justify-between">
                <div className="flex justify-between items-center text-[9px] font-bold text-slate-400">
                  <span>SITE MAP OVERVIEW</span>
                  <button onClick={() => setMiniMapOpen(false)} className="hover:text-white">
                    <X size={12} />
                  </button>
                </div>

                <div className="relative flex-1 bg-slate-950 rounded-lg border border-slate-800 overflow-hidden my-1">
                  {/* Viewport Bounds Box */}
                  <div className="absolute inset-2 border-2 border-[#007BC4] rounded bg-[#007BC4]/10 pointer-events-none" />
                  {filteredEntities.map(e => (
                    <div key={e.id} className="absolute w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ left: `${e.x}%`, top: `${e.y}%` }} />
                  ))}
                </div>

                <span className="text-[8px] font-mono text-slate-500 text-center">{currentSite.name}</span>
              </div>
            )}

            {!miniMapOpen && (
              <button
                onClick={() => setMiniMapOpen(true)}
                className="absolute bottom-4 right-4 z-20 px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-[10px] font-bold text-slate-300 hover:bg-slate-800"
              >
                Show Mini Map
              </button>
            )}

          </div>

          {/* BOTTOM TIMELINE SCRUBBER & PLAYBACK CONTROL DOCK */}
          <div className="p-3 bg-slate-900/95 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-300">
            
            {/* Playback Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsPlaybackRunning(!isPlaybackRunning)}
                className="p-2 bg-[#007BC4] hover:bg-blue-600 text-white rounded-xl font-bold shadow-md transition"
              >
                {isPlaybackRunning ? <Pause size={14} /> : <Play size={14} />}
              </button>

              <div className="flex items-center gap-1 bg-slate-800 p-1 rounded-xl border border-slate-700 text-[10px] font-bold">
                {[1, 2, 5, 10].map(s => (
                  <button
                    key={s}
                    onClick={() => setPlaybackSpeed(s)}
                    className={`px-2 py-0.5 rounded ${playbackSpeed === s ? 'bg-[#007BC4] text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    {s}x
                  </button>
                ))}
              </div>

              <span className="font-mono text-xs font-bold text-emerald-400 pl-2">{playbackTimeLabel}</span>
            </div>

            {/* Time Scrubber Slider */}
            <div className="flex-1 w-full flex items-center gap-2">
              <span className="text-[10px] font-mono text-slate-500">08:00 AM</span>
              <input
                type="range"
                min="0"
                max="100"
                value={playbackProgress}
                onChange={e => {
                  setPlaybackProgress(Number(e.target.value));
                  if (Number(e.target.value) < 100) {
                    const totalMins = Math.floor((Number(e.target.value) / 100) * 480);
                    const hour = 8 + Math.floor(totalMins / 60);
                    const min = totalMins % 60;
                    setPlaybackTimeLabel(`Historical Replay - ${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')} AM`);
                  } else {
                    setPlaybackTimeLabel('LIVE Realtime Feed');
                  }
                }}
                className="w-full accent-[#007BC4] bg-slate-800 h-1.5 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] font-mono text-emerald-400 font-bold">LIVE</span>
            </div>

          </div>

        </div>

      </div>

      {/* 4. BLUEPRINT UPLOAD MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <Upload size={18} className="text-[#007BC4]" /> Upload Spatial CAD / SVG Blueprint
              </h3>
              <button onClick={() => setIsUploadModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Import architectural vector files (<strong>.svg, .dxf, .dwg, .pdf</strong>) or floorplan images for {currentBuilding.name} - {currentFloor.name}.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Blueprint Title / CAD Descriptor</label>
                <input
                  type="text"
                  placeholder="e.g., Level 2 Structural Rebar & Conduit CAD"
                  value={newBlueprintTitle}
                  onChange={e => setNewBlueprintTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#007BC4]"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1">CAD Vector Format</label>
                <select
                  value={newBlueprintFormat}
                  onChange={e => setNewBlueprintFormat(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#007BC4]"
                >
                  <option value="SVG CAD">SVG Vector CAD (.svg)</option>
                  <option value="DXF / DWG">Autodesk CAD (.dxf / .dwg)</option>
                  <option value="Vector PDF">Vector Architectural PDF (.pdf)</option>
                  <option value="Raster PNG">High-Res Spatial Raster (.png)</option>
                </select>
              </div>

              <div 
                onClick={handleUploadBlueprint}
                className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-5 flex flex-col items-center justify-center text-center space-y-1.5 hover:border-[#007BC4] transition cursor-pointer bg-slate-50 dark:bg-slate-900"
              >
                <FileCode2 size={28} className="text-[#007BC4]" />
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Click or drop file to select CAD dataset
                </div>
                <span className="text-[10px] text-slate-400">Supports SVG, DXF, DWG, High-Res PNG up to 50MB</span>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <button
                onClick={() => setIsUploadModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                onClick={handleUploadBlueprint}
                className="px-4 py-2 bg-[#007BC4] text-white rounded-xl text-xs font-bold shadow-md hover:bg-blue-600 transition"
              >
                Import CAD Layers
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
