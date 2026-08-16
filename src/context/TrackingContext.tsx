import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Person, Asset, Vehicle } from '../types';
import { RealtimeTag, gaoApi } from '../lib/gaoApi';
import { 
  AssetItem, VehicleItem, CCTVCameraItem, EnvironmentalSensorItem, InfrastructureItem,
  INITIAL_ASSETS, INITIAL_VEHICLES, INITIAL_INFRASTRUCTURE, INITIAL_CCTVS, INITIAL_ENV_SENSORS 
} from '../lib/trackingLayers';
import { ZoneBounds } from '../components/MapEditorModal';

export interface MapZoneDefinition {
  id: string;
  zoneId: string;
  name: string;
  aliasNames?: string[];
  category: string;
  hazardLevel?: 'normal' | 'warning' | 'critical';
  capacity?: number;
  siteId?: string;
  buildingId?: string;
  floorId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  readerIds?: string[];
  antennaIds?: number[];
  currentOccupancy?: number;
  polygonPoints?: { x: number; y: number }[];
  proximityAlertEnabled?: boolean;
}

export interface ReaderZoneMapping {
  id: string;
  readerId: string;
  antennaPort: number;
  zoneId: string;
  zoneName: string;
}

export interface TrackingContextType {
  activeProject: string;
  setActiveProject: (id: string) => void;
  mode: 'real' | 'demo';
  setMode: (m: 'real' | 'demo') => void;
  wsConnected: boolean;
  liveTags: RealtimeTag[];
  people: Person[];
  assets: AssetItem[];
  vehicles: VehicleItem[];
  cameras: CCTVCameraItem[];
  envSensors: EnvironmentalSensorItem[];
  infrastructure: InfrastructureItem[];
  zones: MapZoneDefinition[];
  zonesDict: Record<string, ZoneBounds>;
  readerMappings: ReaderZoneMapping[];
  mapConfig: any;
  customFloorplan: string | null;
  customSvgSource: string | null;
  isLoading: boolean;
  lastUpdateTimestamp: string | null;
  // Sync handlers
  saveMapConfig: (cfg: any) => Promise<void>;
  saveZone: (zone: Partial<MapZoneDefinition>) => Promise<void>;
  deleteZone: (zoneId: string) => Promise<void>;
  saveCustomZones: (zones: Record<string, ZoneBounds>, floorplanUrl?: string | null, svgSource?: string | null) => Promise<void>;
  saveAsset: (item: AssetItem) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  saveVehicle: (item: VehicleItem) => Promise<void>;
  deleteVehicle: (id: string) => Promise<void>;
  saveCamera: (item: CCTVCameraItem) => Promise<void>;
  deleteCamera: (id: string) => Promise<void>;
  saveEnvSensor: (item: EnvironmentalSensorItem) => Promise<void>;
  deleteEnvSensor: (id: string) => Promise<void>;
  saveInfrastructure: (item: InfrastructureItem) => Promise<void>;
  deleteInfrastructure: (id: string) => Promise<void>;
  setCustomFloorplan: (url: string | null) => void;
  setCustomSvgSource: (svg: string | null) => void;
  getZoneByNameOrId: (nameOrId: string) => MapZoneDefinition | undefined;
  refreshLiveState: () => Promise<void>;
  reportManualScan: (tagId: string, location: string, name?: string) => Promise<void>;
}

const DEFAULT_INITIAL_ZONES: MapZoneDefinition[] = [
  {
    id: 'zone_excavation_shaft',
    zoneId: 'zone_excavation_shaft',
    name: 'Excavation Shaft',
    aliasNames: ['Excavation Shaft', 'Excavation & Foundation Pit', 'Zone2'],
    category: 'EXCAVATION & SHORING',
    hazardLevel: 'warning',
    capacity: 8,
    siteId: 'metro-tower',
    x: 10,
    y: 15,
    width: 34,
    height: 62
  },
  {
    id: 'zone_tower_core',
    zoneId: 'zone_tower_core',
    name: 'Tower Core',
    aliasNames: ['Tower Core', 'Structure & Scaffolding (L1-L4)', 'Building A', 'Zone1', 'd6'],
    category: 'CONCRETE REINFORCEMENT',
    hazardLevel: 'normal',
    capacity: 25,
    siteId: 'metro-tower',
    x: 51,
    y: 25,
    width: 32,
    height: 50
  },
  {
    id: 'zone_crane_area',
    zoneId: 'zone_crane_area',
    name: 'Crane Swing Zone',
    aliasNames: ['Crane Swing Zone', 'Heavy Crane & Exclusion Area', 'd8'],
    category: 'CRANE SWING RADIUS',
    hazardLevel: 'critical',
    capacity: 4,
    siteId: 'metro-tower',
    x: 80,
    y: 5,
    width: 16,
    height: 42
  },
  {
    id: 'zone_high_voltage',
    zoneId: 'zone_high_voltage',
    name: 'High Voltage Area',
    aliasNames: ['High Voltage Area', 'Substation Area'],
    category: 'SUBSTATION PERIMETER',
    hazardLevel: 'critical',
    capacity: 2,
    siteId: 'metro-tower',
    x: 46,
    y: 5,
    width: 14,
    height: 16
  },
  {
    id: 'zone_muster_point_a',
    zoneId: 'zone_muster_point_a',
    name: 'Muster Point A',
    aliasNames: ['Muster Point A', 'Gate 1', 'Main Access Gate'],
    category: 'MUSTER POINT',
    hazardLevel: 'normal',
    capacity: 50,
    siteId: 'metro-tower',
    x: 2,
    y: 10,
    width: 8,
    height: 12
  }
];

const INITIAL_PEOPLE_ROSTER: Person[] = [
  {
    id: '1',
    name: 'Alice Smith',
    role: 'Steel Fixer Lead',
    tradeCompany: 'Apex Structural JV',
    ppeStatus: 'COMPLIANT',
    shiftStatus: 'ON_SITE',
    trainingStatus: 'COMPLIANT',
    hardhatTagId: '1',
    currentZone: 'Tower Core',
    presenceState: 'MOVING',
    dwellTime: 42,
    x: 55,
    y: 35,
    rssi: -62,
    battery: 92,
    lastSeen: new Date(),
    trail: [{ x: 55, y: 35 }]
  },
  {
    id: '2',
    name: 'Marcus Vance',
    role: 'Scaffolder Lead',
    tradeCompany: 'BuildCorp Structural',
    ppeStatus: 'COMPLIANT',
    shiftStatus: 'ON_SITE',
    trainingStatus: 'COMPLIANT',
    hardhatTagId: '2',
    currentZone: 'Muster Point A',
    presenceState: 'MOVING',
    dwellTime: 18,
    x: 6,
    y: 18,
    rssi: -58,
    battery: 88,
    lastSeen: new Date(),
    trail: [{ x: 6, y: 18 }]
  },
  {
    id: '3',
    name: 'Carlos Mendez',
    role: 'Excavation Supervisor',
    tradeCompany: 'TerraEarth Groundworks',
    ppeStatus: 'WARNING',
    shiftStatus: 'ON_SITE',
    trainingStatus: 'COMPLIANT',
    hardhatTagId: '3',
    currentZone: 'Excavation Shaft',
    presenceState: 'IDLE',
    dwellTime: 75,
    x: 22,
    y: 38,
    rssi: -71,
    battery: 64,
    lastSeen: new Date(),
    trail: [{ x: 22, y: 38 }]
  },
  {
    id: '4',
    name: 'David Kim',
    role: 'Crane Logistics Specialist',
    tradeCompany: 'Heavy Lift Engineering',
    ppeStatus: 'COMPLIANT',
    shiftStatus: 'ON_SITE',
    trainingStatus: 'COMPLIANT',
    hardhatTagId: '4',
    currentZone: 'Crane Swing Zone',
    presenceState: 'MOVING',
    dwellTime: 29,
    x: 84,
    y: 20,
    rssi: -65,
    battery: 95,
    lastSeen: new Date(),
    trail: [{ x: 84, y: 20 }]
  }
];

const TrackingContext = createContext<TrackingContextType | undefined>(undefined);

export function TrackingProvider({ children }: { children: React.ReactNode }) {
  const [activeProject, setActiveProjectState] = useState<string>(() => {
    return localStorage.getItem('gao_active_project') || 'metro-tower';
  });

  const [mode, setModeState] = useState<'real' | 'demo'>(() => {
    return (localStorage.getItem('gao_app_mode') as 'real' | 'demo') || 'real';
  });

  const [wsConnected, setWsConnected] = useState(false);
  const [liveTags, setLiveTags] = useState<RealtimeTag[]>([]);
  const [people, setPeople] = useState<Person[]>([]);

  // Entities initialized from persistent MongoDB storage
  const [assets, setAssets] = useState<AssetItem[]>(() => {
    try {
      const saved = localStorage.getItem('gao_db_assets');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [vehicles, setVehicles] = useState<VehicleItem[]>(() => {
    try {
      const saved = localStorage.getItem('gao_db_vehicles');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [cameras, setCameras] = useState<CCTVCameraItem[]>(() => {
    try {
      const saved = localStorage.getItem('gao_db_cameras');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [envSensors, setEnvSensors] = useState<EnvironmentalSensorItem[]>(() => {
    try {
      const saved = localStorage.getItem('gao_db_sensors');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [infrastructure, setInfrastructure] = useState<InfrastructureItem[]>(() => {
    try {
      const saved = localStorage.getItem('gao_db_infrastructure');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [zones, setZones] = useState<MapZoneDefinition[]>(() => {
    try {
      const saved = localStorage.getItem('gao_db_zones');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_INITIAL_ZONES;
  });

  const [customFloorplan, setCustomFloorplanState] = useState<string | null>(() => {
    return localStorage.getItem('gao_custom_floorplan') || null;
  });

  const [customSvgSource, setCustomSvgSourceState] = useState<string | null>(() => {
    return localStorage.getItem('gao_custom_svg_source') || null;
  });

  const [readerMappings, setReaderMappings] = useState<ReaderZoneMapping[]>([]);
  const [mapConfig, setMapConfig] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdateTimestamp, setLastUpdateTimestamp] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<any>(null);

  const setActiveProject = useCallback((id: string) => {
    setActiveProjectState(id);
    localStorage.setItem('gao_active_project', id);
  }, []);

  const setMode = useCallback((newMode: 'real' | 'demo') => {
    setModeState(newMode);
    localStorage.setItem('gao_app_mode', newMode);
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: newMode === 'demo' ? 'enable_demo_mode' : 'disable_demo_mode',
        payload: { mode: newMode }
      }));
    }
  }, []);

  const setCustomFloorplan = useCallback((url: string | null) => {
    setCustomFloorplanState(url);
    if (url) {
      localStorage.setItem('gao_custom_floorplan', url);
    } else {
      localStorage.removeItem('gao_custom_floorplan');
    }
    window.dispatchEvent(new CustomEvent('gao_map_data_updated'));
  }, []);

  const setCustomSvgSource = useCallback((svg: string | null) => {
    setCustomSvgSourceState(svg);
    if (svg) {
      localStorage.setItem('gao_custom_svg_source', svg);
    } else {
      localStorage.removeItem('gao_custom_svg_source');
    }
    window.dispatchEvent(new CustomEvent('gao_map_data_updated'));
  }, []);

  // Helper to find zone by name or zoneId
  const getZoneByNameOrId = useCallback((nameOrId: string): MapZoneDefinition | undefined => {
    if (!nameOrId) return undefined;
    const lower = nameOrId.toLowerCase().trim();
    return zones.find(z => 
      z.zoneId.toLowerCase() === lower || 
      z.id.toLowerCase() === lower || 
      z.name.toLowerCase() === lower ||
      (z.aliasNames && z.aliasNames.some(a => a.toLowerCase() === lower || lower.includes(a.toLowerCase())))
    );
  }, [zones]);

  // Derived dictionary of zone bounds for LiveFloorMap
  const zonesDict = React.useMemo(() => {
    const dict: Record<string, ZoneBounds> = {};
    for (const z of zones) {
      dict[z.name] = {
        x: z.x,
        y: z.y,
        width: z.width,
        height: z.height,
        category: z.category,
        hazardLevel: z.hazardLevel,
        capacity: z.capacity,
        polygonPoints: z.polygonPoints,
        proximityAlertEnabled: z.proximityAlertEnabled
      };
      if (z.zoneId && z.zoneId !== z.name) {
        dict[z.zoneId] = dict[z.name];
      }
    }
    return dict;
  }, [zones]);

  // Save full set of custom zones from Map Editor or Custom Map Page
  const saveCustomZones = useCallback(async (
    newZones: Record<string, ZoneBounds>, 
    newFloorplanUrl?: string | null, 
    newSvgSource?: string | null
  ) => {
    const zoneDefinitions: MapZoneDefinition[] = Object.entries(newZones).map(([name, bounds]) => {
      const zoneId = `zone_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')}`;
      return {
        id: zoneId,
        zoneId,
        name,
        category: bounds.category || 'GENERAL',
        hazardLevel: bounds.hazardLevel || 'normal',
        capacity: bounds.capacity || 10,
        siteId: activeProject,
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        polygonPoints: bounds.polygonPoints,
        proximityAlertEnabled: bounds.proximityAlertEnabled,
        aliasNames: [name]
      };
    });

    setZones(zoneDefinitions);
    localStorage.setItem('gao_db_zones', JSON.stringify(zoneDefinitions));

    if (newFloorplanUrl !== undefined) {
      setCustomFloorplan(newFloorplanUrl);
    }
    if (newSvgSource !== undefined) {
      setCustomSvgSource(newSvgSource);
    }

    try {
      await fetch('/api/data/zones_bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zones: zoneDefinitions, siteId: activeProject })
      });
    } catch {}

    window.dispatchEvent(new CustomEvent('gao_map_data_updated'));
  }, [activeProject, setCustomFloorplan, setCustomSvgSource]);

  // Asset CRUD
  const saveAsset = useCallback(async (item: AssetItem) => {
    setAssets(prev => {
      const idx = prev.findIndex(a => a.id === item.id);
      const next = idx >= 0 ? [...prev] : [item, ...prev];
      if (idx >= 0) next[idx] = item;
      localStorage.setItem('gao_db_assets', JSON.stringify(next));
      return next;
    });
    try {
      await fetch('/api/data/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
    } catch {}
    window.dispatchEvent(new CustomEvent('gao_map_data_updated'));
  }, []);

  const deleteAsset = useCallback(async (id: string) => {
    setAssets(prev => {
      const next = prev.filter(a => a.id !== id);
      localStorage.setItem('gao_db_assets', JSON.stringify(next));
      return next;
    });
    try {
      await fetch(`/api/data/assets/${id}`, { method: 'DELETE' });
    } catch {}
    window.dispatchEvent(new CustomEvent('gao_map_data_updated'));
  }, []);

  // Vehicle CRUD
  const saveVehicle = useCallback(async (item: VehicleItem) => {
    setVehicles(prev => {
      const idx = prev.findIndex(v => v.id === item.id);
      const next = idx >= 0 ? [...prev] : [item, ...prev];
      if (idx >= 0) next[idx] = item;
      localStorage.setItem('gao_db_vehicles', JSON.stringify(next));
      return next;
    });
    try {
      await fetch('/api/data/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
    } catch {}
    window.dispatchEvent(new CustomEvent('gao_map_data_updated'));
  }, []);

  const deleteVehicle = useCallback(async (id: string) => {
    setVehicles(prev => {
      const next = prev.filter(v => v.id !== id);
      localStorage.setItem('gao_db_vehicles', JSON.stringify(next));
      return next;
    });
    try {
      await fetch(`/api/data/vehicles/${id}`, { method: 'DELETE' });
    } catch {}
    window.dispatchEvent(new CustomEvent('gao_map_data_updated'));
  }, []);

  // Camera CRUD
  const saveCamera = useCallback(async (item: CCTVCameraItem) => {
    setCameras(prev => {
      const idx = prev.findIndex(c => c.id === item.id);
      const next = idx >= 0 ? [...prev] : [item, ...prev];
      if (idx >= 0) next[idx] = item;
      localStorage.setItem('gao_db_cameras', JSON.stringify(next));
      return next;
    });
    window.dispatchEvent(new CustomEvent('gao_map_data_updated'));
  }, []);

  const deleteCamera = useCallback(async (id: string) => {
    setCameras(prev => {
      const next = prev.filter(c => c.id !== id);
      localStorage.setItem('gao_db_cameras', JSON.stringify(next));
      return next;
    });
    window.dispatchEvent(new CustomEvent('gao_map_data_updated'));
  }, []);

  // Sensor CRUD
  const saveEnvSensor = useCallback(async (item: EnvironmentalSensorItem) => {
    setEnvSensors(prev => {
      const idx = prev.findIndex(s => s.id === item.id);
      const next = idx >= 0 ? [...prev] : [item, ...prev];
      if (idx >= 0) next[idx] = item;
      localStorage.setItem('gao_db_sensors', JSON.stringify(next));
      return next;
    });
    window.dispatchEvent(new CustomEvent('gao_map_data_updated'));
  }, []);

  const deleteEnvSensor = useCallback(async (id: string) => {
    setEnvSensors(prev => {
      const next = prev.filter(s => s.id !== id);
      localStorage.setItem('gao_db_sensors', JSON.stringify(next));
      return next;
    });
    window.dispatchEvent(new CustomEvent('gao_map_data_updated'));
  }, []);

  // Infrastructure CRUD
  const saveInfrastructure = useCallback(async (item: InfrastructureItem) => {
    setInfrastructure(prev => {
      const idx = prev.findIndex(i => i.id === item.id);
      const next = idx >= 0 ? [...prev] : [item, ...prev];
      if (idx >= 0) next[idx] = item;
      localStorage.setItem('gao_db_infrastructure', JSON.stringify(next));
      return next;
    });
    window.dispatchEvent(new CustomEvent('gao_map_data_updated'));
  }, []);

  const deleteInfrastructure = useCallback(async (id: string) => {
    setInfrastructure(prev => {
      const next = prev.filter(i => i.id !== id);
      localStorage.setItem('gao_db_infrastructure', JSON.stringify(next));
      return next;
    });
    window.dispatchEvent(new CustomEvent('gao_map_data_updated'));
  }, []);

  // Fetch initial database entities
  const loadDatabaseConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const [zonesRes, mapRes, readersRes, assetsRes, vehiclesRes, peopleRes] = await Promise.allSettled([
        fetch('/api/data/zones').then(r => r.ok ? r.json() : []),
        fetch(`/api/data/map_configurations/${activeProject}`).then(r => r.ok ? r.json() : null),
        fetch('/api/data/reader_zone_mappings').then(r => r.ok ? r.json() : []),
        fetch('/api/data/assets').then(r => r.ok ? r.json() : []),
        fetch('/api/data/vehicles').then(r => r.ok ? r.json() : []),
        fetch('/api/data/registered_people').then(r => r.ok ? r.json() : [])
      ]);

      if (zonesRes.status === 'fulfilled' && Array.isArray(zonesRes.value) && zonesRes.value.length > 0) {
        setZones(zonesRes.value);
        localStorage.setItem('gao_db_zones', JSON.stringify(zonesRes.value));
      }

      if (mapRes.status === 'fulfilled' && mapRes.value) {
        setMapConfig(mapRes.value);
      }

      if (readersRes.status === 'fulfilled' && Array.isArray(readersRes.value)) {
        setReaderMappings(readersRes.value);
      }

      if (assetsRes.status === 'fulfilled' && Array.isArray(assetsRes.value)) {
        setAssets(assetsRes.value);
        localStorage.setItem('gao_db_assets', JSON.stringify(assetsRes.value));
      }

      if (vehiclesRes.status === 'fulfilled' && Array.isArray(vehiclesRes.value)) {
        setVehicles(vehiclesRes.value);
        localStorage.setItem('gao_db_vehicles', JSON.stringify(vehiclesRes.value));
      }

      if (peopleRes.status === 'fulfilled' && Array.isArray(peopleRes.value)) {
        const loadedPeople: Person[] = peopleRes.value.map((p: any) => ({
          id: p.id || p.tagId || p.TagID,
          name: p.name || p.personName || 'Personnel',
          role: p.role || 'Field Personnel',
          tradeCompany: p.company || p.tradeCompany || 'Contractor',
          ppeStatus: p.ppeStatus || 'COMPLIANT',
          shiftStatus: p.shiftStatus || 'ON_SITE',
          trainingStatus: p.trainingStatus || 'COMPLIANT',
          hardhatTagId: p.hardhatTagId || p.tagId || p.TagID || p.id,
          currentZone: p.currentZone || p.location || 'Tower Core',
          presenceState: p.presenceState || 'MOVING',
          dwellTime: p.dwellTime || 0,
          x: p.x || 50,
          y: p.y || 50,
          rssi: p.rssi || -65,
          battery: p.battery || 90,
          lastSeen: p.lastSeen ? new Date(p.lastSeen) : new Date(),
          trail: p.trail || []
        }));
        setPeople(loadedPeople);
      }
    } catch (err) {
      console.warn('[TrackingContext] Initial config load error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeProject]);

  // Save map configuration to DB
  const saveMapConfig = useCallback(async (cfg: any) => {
    try {
      const payload = {
        id: cfg.id || activeProject,
        siteId: activeProject,
        ...cfg,
        updatedAt: new Date().toISOString()
      };
      await fetch('/api/data/map_configurations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setMapConfig(payload);
      window.dispatchEvent(new CustomEvent('gao_map_data_updated'));
    } catch (err) {
      console.error('[TrackingContext] Failed to save map config to DB:', err);
      throw err;
    }
  }, [activeProject]);

  // Save zone definition to DB
  const saveZone = useCallback(async (zoneData: Partial<MapZoneDefinition>) => {
    try {
      const zoneId = zoneData.zoneId || zoneData.id || `zone_${Date.now()}`;
      const payload: MapZoneDefinition = {
        id: zoneId,
        zoneId,
        name: zoneData.name || 'Unnamed Zone',
        category: zoneData.category || 'GENERAL',
        hazardLevel: zoneData.hazardLevel || 'normal',
        capacity: zoneData.capacity || 10,
        siteId: zoneData.siteId || activeProject,
        x: zoneData.x ?? 50,
        y: zoneData.y ?? 50,
        width: zoneData.width ?? 20,
        height: zoneData.height ?? 20,
        polygonPoints: zoneData.polygonPoints,
        proximityAlertEnabled: zoneData.proximityAlertEnabled,
        aliasNames: zoneData.aliasNames || [zoneData.name || 'Unnamed Zone'],
        readerIds: zoneData.readerIds || [],
        antennaIds: zoneData.antennaIds || [1]
      };

      await fetch('/api/data/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setZones(prev => {
        const idx = prev.findIndex(z => z.zoneId === zoneId || z.id === zoneId);
        const next = idx >= 0 ? [...prev] : [...prev, payload];
        if (idx >= 0) next[idx] = payload;
        localStorage.setItem('gao_db_zones', JSON.stringify(next));
        return next;
      });
      window.dispatchEvent(new CustomEvent('gao_map_data_updated'));
    } catch (err) {
      console.error('[TrackingContext] Failed to save zone to DB:', err);
      throw err;
    }
  }, [activeProject]);

  // Delete zone definition from DB
  const deleteZone = useCallback(async (zoneId: string) => {
    try {
      await fetch(`/api/data/zones/${zoneId}`, { method: 'DELETE' });
      setZones(prev => {
        const next = prev.filter(z => z.zoneId !== zoneId && z.id !== zoneId);
        localStorage.setItem('gao_db_zones', JSON.stringify(next));
        return next;
      });
      window.dispatchEvent(new CustomEvent('gao_map_data_updated'));
    } catch (err) {
      console.error('[TrackingContext] Failed to delete zone from DB:', err);
      throw err;
    }
  }, []);

  // Handler for normalized tag update
  const handleNormalizedTagUpdate = useCallback((tagUpdate: any) => {
    if (!tagUpdate) return;
    const tagId = String(tagUpdate.TagID || tagUpdate.tagId || tagUpdate.id || '').trim();
    if (!tagId) return;

    const locName = String(tagUpdate.Location || tagUpdate.LocationName || tagUpdate.zoneName || tagUpdate.zone || 'Tower Core').trim();
    const timestamp = tagUpdate.Timestamp || tagUpdate.timestamp || new Date().toISOString();
    const rssi = tagUpdate.rssi !== undefined ? Number(tagUpdate.rssi) : -65;
    const readerId = tagUpdate.readerId;

    // Resolve zone coordinates
    const matchedZone = getZoneByNameOrId(tagUpdate.zoneId || locName);
    let targetX = tagUpdate.x !== undefined ? tagUpdate.x : (matchedZone ? Math.round(matchedZone.x + matchedZone.width / 2) : 50);
    let targetY = tagUpdate.y !== undefined ? tagUpdate.y : (matchedZone ? Math.round(matchedZone.y + matchedZone.height / 2) : 50);

    const hashOffset = (tagId.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0) % 7) - 3;
    targetX = Math.max(5, Math.min(95, targetX + hashOffset));
    targetY = Math.max(5, Math.min(95, targetY + hashOffset));

    const normalizedTag: RealtimeTag = {
      TagID: tagId,
      Timestamp: timestamp,
      Location: matchedZone ? matchedZone.name : locName,
      LocationName: matchedZone ? matchedZone.name : locName,
      zoneId: matchedZone ? matchedZone.zoneId : (tagUpdate.zoneId || undefined),
      zoneName: matchedZone ? matchedZone.name : locName,
      personName: tagUpdate.personName,
      personId: tagUpdate.personId,
      x: targetX,
      y: targetY,
      rssi,
      readerId
    };

    setLastUpdateTimestamp(timestamp);

    setLiveTags(prev => {
      const idx = prev.findIndex(t => t.TagID === tagId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = normalizedTag;
        return next;
      }
      return [normalizedTag, ...prev.slice(0, 49)];
    });

    setPeople(prev => {
      const personIdx = prev.findIndex(p => 
        p.hardhatTagId === tagId || 
        p.id === tagId || 
        (tagUpdate.personId && p.id === tagUpdate.personId) ||
        (tagUpdate.personName && p.name.toLowerCase() === tagUpdate.personName.toLowerCase())
      );

      if (personIdx >= 0) {
        const existing = prev[personIdx];
        const nextPeople = [...prev];
        nextPeople[personIdx] = {
          ...existing,
          currentZone: matchedZone ? matchedZone.name : locName,
          x: targetX,
          y: targetY,
          rssi,
          lastReader: readerId || existing.lastReader,
          lastSeen: new Date(timestamp),
          presenceState: 'MOVING',
          trail: [...(existing.trail || []).slice(-10), { x: targetX, y: targetY }]
        };
        return nextPeople;
      } else {
        const newPerson: Person = {
          id: tagUpdate.personId || `P-${tagId}`,
          name: tagUpdate.personName || `Worker (Tag ${tagId.slice(-4)})`,
          role: 'Field Personnel',
          tradeCompany: 'Site Contractor',
          ppeStatus: 'COMPLIANT',
          shiftStatus: 'ON_SITE',
          trainingStatus: 'COMPLIANT',
          hardhatTagId: tagId,
          currentZone: matchedZone ? matchedZone.name : locName,
          presenceState: 'MOVING',
          dwellTime: 1,
          x: targetX,
          y: targetY,
          rssi,
          lastReader: readerId,
          lastSeen: new Date(timestamp),
          trail: [{ x: targetX, y: targetY }]
        };
        return [...prev, newPerson];
      }
    });
  }, [getZoneByNameOrId]);

  // Refresh live state on demand
  const refreshLiveState = useCallback(async () => {
    try {
      const tags = await gaoApi.getTagsInRealtime();
      if (Array.isArray(tags)) {
        for (const t of tags) {
          handleNormalizedTagUpdate(t);
        }
      }
    } catch (err) {
      console.warn('[TrackingContext] Real-time tag refresh notice:', err);
    }
  }, [handleNormalizedTagUpdate]);

  // Manual RFID scan reporting
  const reportManualScan = useCallback(async (tagId: string, location: string, name?: string) => {
    try {
      const payload = {
        TagID: tagId,
        Location: location,
        name: name || 'Manual Worker',
        timestamp: new Date().toISOString()
      };

      await fetch('/api/rfid/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      handleNormalizedTagUpdate(payload);
    } catch (err) {
      console.error('[TrackingContext] Manual scan report error:', err);
    }
  }, [handleNormalizedTagUpdate]);

  // Central WebSocket connection management
  useEffect(() => {
    let ws: WebSocket | null = null;
    let isCleanedUp = false;

    const connectWebSocket = () => {
      if (isCleanedUp) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;

      try {
        ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setWsConnected(true);
          ws?.send(JSON.stringify({
            type: mode === 'demo' ? 'enable_demo_mode' : 'disable_demo_mode',
            payload: { mode }
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const msgType = (data.type || '').toLowerCase();

            if (msgType === 'tag_update' || msgType === 'rfid_scan' || msgType === 'tag_location_update') {
              handleNormalizedTagUpdate(data.payload || data);
            } else if (msgType === 'synthetic_rfid_scan' || msgType === 'demo_tag_update') {
              if (mode === 'demo') {
                handleNormalizedTagUpdate(data.payload || data);
              }
            } else if (msgType === 'GetTagsInRealtime_response') {
              if (Array.isArray(data.payload)) {
                for (const item of data.payload) {
                  handleNormalizedTagUpdate(item);
                }
              }
            }
          } catch {}
        };

        ws.onclose = () => {
          setWsConnected(false);
          if (!isCleanedUp) {
            reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
          }
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        if (!isCleanedUp) {
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 4000);
        }
      }
    };

    connectWebSocket();
    loadDatabaseConfig();

    return () => {
      isCleanedUp = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (ws) ws.close();
    };
  }, [loadDatabaseConfig, handleNormalizedTagUpdate, mode]);

  // Periodic fallback polling in real mode
  useEffect(() => {
    const pollInterval = setInterval(() => {
      refreshLiveState();
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [refreshLiveState]);

  // Listen to cross-tab/cross-component map updates
  useEffect(() => {
    const handleStorageOrDataUpdate = () => {
      try {
        const savedAssets = localStorage.getItem('gao_db_assets');
        if (savedAssets) setAssets(JSON.parse(savedAssets));

        const savedVehicles = localStorage.getItem('gao_db_vehicles');
        if (savedVehicles) setVehicles(JSON.parse(savedVehicles));

        const savedCameras = localStorage.getItem('gao_db_cameras');
        if (savedCameras) setCameras(JSON.parse(savedCameras));

        const savedSensors = localStorage.getItem('gao_db_sensors');
        if (savedSensors) setEnvSensors(JSON.parse(savedSensors));

        const savedZones = localStorage.getItem('gao_db_zones');
        if (savedZones) setZones(JSON.parse(savedZones));

        const savedFloorplan = localStorage.getItem('gao_custom_floorplan');
        if (savedFloorplan !== null) setCustomFloorplanState(savedFloorplan);

        const savedSvg = localStorage.getItem('gao_custom_svg_source');
        if (savedSvg !== null) setCustomSvgSourceState(savedSvg);
      } catch {}
    };

    window.addEventListener('gao_map_data_updated', handleStorageOrDataUpdate);
    window.addEventListener('storage', handleStorageOrDataUpdate);

    return () => {
      window.removeEventListener('gao_map_data_updated', handleStorageOrDataUpdate);
      window.removeEventListener('storage', handleStorageOrDataUpdate);
    };
  }, []);

  return (
    <TrackingContext.Provider
      value={{
        activeProject,
        setActiveProject,
        mode,
        setMode,
        wsConnected,
        liveTags,
        people,
        assets,
        vehicles,
        cameras,
        envSensors,
        infrastructure,
        zones,
        zonesDict,
        readerMappings,
        mapConfig,
        customFloorplan,
        customSvgSource,
        isLoading,
        lastUpdateTimestamp,
        saveMapConfig,
        saveZone,
        deleteZone,
        saveCustomZones,
        saveAsset,
        deleteAsset,
        saveVehicle,
        deleteVehicle,
        saveCamera,
        deleteCamera,
        saveEnvSensor,
        deleteEnvSensor,
        saveInfrastructure,
        deleteInfrastructure,
        setCustomFloorplan,
        setCustomSvgSource,
        getZoneByNameOrId,
        refreshLiveState,
        reportManualScan
      }}
    >
      {children}
    </TrackingContext.Provider>
  );
}

export function useTracking() {
  const context = useContext(TrackingContext);
  if (!context) {
    throw new Error('useTracking must be used within a TrackingProvider');
  }
  return context;
}

