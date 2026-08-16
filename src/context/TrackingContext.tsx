import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Person, Asset, Vehicle } from '../types';
import { RealtimeTag, gaoApi } from '../lib/gaoApi';
import { INITIAL_ASSETS, INITIAL_VEHICLES } from '../lib/trackingLayers';
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
  x: number;
  y: number;
  width: number;
  height: number;
  readerIds?: string[];
  antennaIds?: number[];
  currentOccupancy?: number;
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
  assets: Asset[];
  vehicles: Vehicle[];
  zones: MapZoneDefinition[];
  zonesDict: Record<string, ZoneBounds>;
  readerMappings: ReaderZoneMapping[];
  mapConfig: any;
  isLoading: boolean;
  lastUpdateTimestamp: string | null;
  saveMapConfig: (cfg: any) => Promise<void>;
  saveZone: (zone: Partial<MapZoneDefinition>) => Promise<void>;
  deleteZone: (zoneId: string) => Promise<void>;
  getZoneByNameOrId: (nameOrId: string) => MapZoneDefinition | undefined;
  refreshLiveState: () => Promise<void>;
  reportManualScan: (tagId: string, location: string, name?: string) => Promise<void>;
}

const DEFAULT_INITIAL_ZONES: MapZoneDefinition[] = [
  {
    id: 'zone_excavation_shaft',
    zoneId: 'zone_excavation_shaft',
    name: 'Excavation & Foundation Pit',
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
    name: 'Structure & Scaffolding (L1-L4)',
    aliasNames: ['Tower Core', 'Structure & Scaffolding (L1-L4)', 'Zone1', 'd6'],
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
    name: 'Heavy Crane & Exclusion Area',
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
    id: 'zone_gate_1',
    zoneId: 'zone_gate_1',
    name: 'Gate 1 / Main Access Gate',
    aliasNames: ['Gate 1', 'Main Access Gate', 'Muster Point A'],
    category: 'MUSTER POINT & ACCESS',
    hazardLevel: 'normal',
    capacity: 50,
    siteId: 'metro-tower',
    x: 2,
    y: 10,
    width: 12,
    height: 16
  },
  {
    id: 'zone_material_laydown',
    zoneId: 'zone_material_laydown',
    name: 'Material Laydown & Loading',
    aliasNames: ['Material Laydown & Loading', 'Storage Yard'],
    category: 'MATERIAL STORAGE',
    hazardLevel: 'normal',
    capacity: 15,
    siteId: 'metro-tower',
    x: 20,
    y: 75,
    width: 30,
    height: 20
  },
  {
    id: 'zone_site_office',
    zoneId: 'zone_site_office',
    name: 'Site Office & Welfare Container',
    aliasNames: ['Site Office', 'Welfare Container'],
    category: 'ADMINISTRATION',
    hazardLevel: 'normal',
    capacity: 30,
    siteId: 'metro-tower',
    x: 5,
    y: 40,
    width: 15,
    height: 25
  },
  {
    id: 'zone_confined_shaft',
    zoneId: 'zone_confined_shaft',
    name: 'Confined Shaft & Tunneling',
    aliasNames: ['Confined Shaft', 'Tunneling'],
    category: 'CONFINED SPACE',
    hazardLevel: 'critical',
    capacity: 4,
    siteId: 'metro-tower',
    x: 60,
    y: 75,
    width: 25,
    height: 20
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
    currentZone: 'Structure & Scaffolding (L1-L4)',
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
    role: 'Crane Operator Lead',
    tradeCompany: 'Apex Structural JV',
    ppeStatus: 'COMPLIANT',
    shiftStatus: 'ON_SITE',
    trainingStatus: 'COMPLIANT',
    hardhatTagId: '2',
    currentZone: 'Gate 1 / Main Access Gate',
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
    currentZone: 'Excavation & Foundation Pit',
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
    role: 'Material Logistics Tech',
    tradeCompany: 'Apex Structural JV',
    ppeStatus: 'COMPLIANT',
    shiftStatus: 'ON_SITE',
    trainingStatus: 'COMPLIANT',
    hardhatTagId: '4',
    currentZone: 'Material Laydown & Loading',
    presenceState: 'MOVING',
    dwellTime: 29,
    x: 32,
    y: 82,
    rssi: -65,
    battery: 95,
    lastSeen: new Date(),
    trail: [{ x: 32, y: 82 }]
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
  const [people, setPeople] = useState<Person[]>(INITIAL_PEOPLE_ROSTER);
  const [assets] = useState<Asset[]>(INITIAL_ASSETS as any);
  const [vehicles] = useState<Vehicle[]>(INITIAL_VEHICLES as any);
  const [zones, setZones] = useState<MapZoneDefinition[]>(DEFAULT_INITIAL_ZONES);
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
    // Notify WebSocket server about mode change
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: newMode === 'demo' ? 'enable_demo_mode' : 'disable_demo_mode',
        payload: { mode: newMode }
      }));
    }
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
        capacity: z.capacity
      };
      if (z.zoneId && z.zoneId !== z.name) {
        dict[z.zoneId] = dict[z.name];
      }
    }
    return dict;
  }, [zones]);

  // Fetch initial database entities
  const loadDatabaseConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      const [zonesRes, mapRes, readersRes] = await Promise.allSettled([
        fetch('/api/data/zones').then(r => r.ok ? r.json() : []),
        fetch(`/api/data/map_configurations/${activeProject}`).then(r => r.ok ? r.json() : null),
        fetch('/api/data/reader_zone_mappings').then(r => r.ok ? r.json() : [])
      ]);

      if (zonesRes.status === 'fulfilled' && Array.isArray(zonesRes.value) && zonesRes.value.length > 0) {
        setZones(zonesRes.value);
      }

      if (mapRes.status === 'fulfilled' && mapRes.value) {
        setMapConfig(mapRes.value);
      }

      if (readersRes.status === 'fulfilled' && Array.isArray(readersRes.value)) {
        setReaderMappings(readersRes.value);
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
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = payload;
          return next;
        }
        return [...prev, payload];
      });
    } catch (err) {
      console.error('[TrackingContext] Failed to save zone to DB:', err);
      throw err;
    }
  }, [activeProject]);

  // Delete zone definition from DB
  const deleteZone = useCallback(async (zoneId: string) => {
    try {
      await fetch(`/api/data/zones/${zoneId}`, { method: 'DELETE' });
      setZones(prev => prev.filter(z => z.zoneId !== zoneId && z.id !== zoneId));
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

    const locName = String(tagUpdate.Location || tagUpdate.LocationName || tagUpdate.zoneName || tagUpdate.zone || 'Zone1').trim();
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

    // Update liveTags list
    setLiveTags(prev => {
      const idx = prev.findIndex(t => t.TagID === tagId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = normalizedTag;
        return next;
      }
      return [normalizedTag, ...prev.slice(0, 49)];
    });

    // Update or add to people list
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
          console.log('[TrackingContext] Connected to GAO RFID WebSocket server.');
          setWsConnected(true);
          // Handshake mode status
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
          } catch (e) {
            // Ignored parsing error
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          if (!isCleanedUp) {
            reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
          }
        };

        ws.onerror = (err) => {
          console.warn('[TrackingContext] WebSocket error:', err);
          ws?.close();
        };
      } catch (err) {
        console.warn('[TrackingContext] WebSocket connect exception:', err);
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

  // Periodic fallback polling in real mode to keep live_tags completely updated
  useEffect(() => {
    const pollInterval = setInterval(() => {
      refreshLiveState();
    }, 4000);

    return () => clearInterval(pollInterval);
  }, [refreshLiveState]);

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
        zones,
        zonesDict,
        readerMappings,
        mapConfig,
        isLoading,
        lastUpdateTimestamp,
        saveMapConfig,
        saveZone,
        deleteZone,
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
