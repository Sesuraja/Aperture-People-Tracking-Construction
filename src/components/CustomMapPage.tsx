import React, { useState, useRef, useEffect } from 'react';
import { 
  Map as MapIcon, Plus, Trash2, Edit3, Save, Upload, Sliders, Radio, 
  Wrench, Truck, Camera, Thermometer, ShieldCheck, AlertTriangle, Box, Compass, RefreshCw, Check,
  Layers, MapPin, Eye, Settings, HelpCircle, HardHat, Building2, Layers3, History, FileCode,
  Sparkles, FileText, ChevronRight, RotateCw, Copy, ShieldAlert, ArrowRight, X, FolderPlus,
  Users, Lock, Unlock, EyeOff, Search, Filter, Flame, Zap, Navigation, Wifi
} from 'lucide-react';
import HardwareConfigModal, { HardwareDevice } from './HardwareConfigModal';
import MapEditorModal, { ZoneBounds } from './MapEditorModal';
import { INITIAL_DEVICES, getBlueprintSvg } from './LiveFloorMap';
import { AssetItem, VehicleItem, CCTVCameraItem, EnvironmentalSensorItem, INITIAL_ASSETS, INITIAL_VEHICLES, INITIAL_INFRASTRUCTURE, INITIAL_CCTVS, INITIAL_ENV_SENSORS } from '../lib/trackingLayers';
import { doc, setDoc, deleteDoc, collection, onSnapshot } from '../lib/db';
import { db } from '../lib/firebase';

export interface MapLayerConfig {
  id: string;
  name: string;
  category: 'personnel' | 'equipment' | 'infrastructure' | 'zones' | 'safety' | 'civil';
  visible: boolean;
  opacity: number;
  locked: boolean;
  count: number;
  iconName: string;
  color: string;
}

export const DEFAULT_LAYER_CONFIGS: Record<string, MapLayerConfig> = {
  workers: { id: 'workers', name: 'Workers', category: 'personnel', visible: true, opacity: 1, locked: false, count: 18, iconName: 'HardHat', color: 'bg-emerald-500 text-white' },
  visitors: { id: 'visitors', name: 'Visitors', category: 'personnel', visible: true, opacity: 1, locked: false, count: 5, iconName: 'Users', color: 'bg-blue-500 text-white' },
  contractors: { id: 'contractors', name: 'Contractors', category: 'personnel', visible: true, opacity: 1, locked: false, count: 12, iconName: 'Building2', color: 'bg-indigo-500 text-white' },
  equipment: { id: 'equipment', name: 'Equipment', category: 'equipment', visible: true, opacity: 1, locked: false, count: 8, iconName: 'Box', color: 'bg-amber-500 text-white' },
  vehicles: { id: 'vehicles', name: 'Vehicles', category: 'equipment', visible: true, opacity: 1, locked: false, count: 6, iconName: 'Truck', color: 'bg-orange-500 text-white' },
  rfidReaders: { id: 'rfidReaders', name: 'RFID Readers', category: 'infrastructure', visible: true, opacity: 0.9, locked: false, count: 6, iconName: 'Radio', color: 'bg-purple-500 text-white' },
  bleGateways: { id: 'bleGateways', name: 'BLE Gateways', category: 'infrastructure', visible: true, opacity: 0.9, locked: false, count: 8, iconName: 'Wifi', color: 'bg-violet-500 text-white' },
  gpsDevices: { id: 'gpsDevices', name: 'GPS Devices', category: 'infrastructure', visible: true, opacity: 0.9, locked: false, count: 10, iconName: 'Navigation', color: 'bg-sky-500 text-white' },
  cctvCameras: { id: 'cctvCameras', name: 'CCTV Cameras', category: 'infrastructure', visible: true, opacity: 0.9, locked: false, count: 7, iconName: 'Camera', color: 'bg-teal-500 text-white' },
  hazardZones: { id: 'hazardZones', name: 'Hazard Zones', category: 'zones', visible: true, opacity: 0.8, locked: true, count: 4, iconName: 'AlertTriangle', color: 'bg-rose-500 text-white' },
  restrictedZones: { id: 'restrictedZones', name: 'Restricted Zones', category: 'zones', visible: true, opacity: 0.8, locked: true, count: 3, iconName: 'ShieldAlert', color: 'bg-red-600 text-white' },
  assemblyPoints: { id: 'assemblyPoints', name: 'Assembly Points', category: 'safety', visible: true, opacity: 1, locked: true, count: 2, iconName: 'ShieldCheck', color: 'bg-emerald-600 text-white' },
  fireEquipment: { id: 'fireEquipment', name: 'Fire Equipment', category: 'safety', visible: true, opacity: 1, locked: false, count: 9, iconName: 'Flame', color: 'bg-red-500 text-white' },
  firstAidStations: { id: 'firstAidStations', name: 'First Aid Stations', category: 'safety', visible: true, opacity: 1, locked: false, count: 3, iconName: 'Plus', color: 'bg-emerald-500 text-white' },
  emergencyRoutes: { id: 'emergencyRoutes', name: 'Emergency Routes', category: 'safety', visible: true, opacity: 0.85, locked: true, count: 4, iconName: 'ArrowUpRight', color: 'bg-green-500 text-white' },
  utilities: { id: 'utilities', name: 'Utilities', category: 'civil', visible: true, opacity: 0.8, locked: false, count: 5, iconName: 'Sliders', color: 'bg-yellow-500 text-white' },
  buildings: { id: 'buildings', name: 'Buildings', category: 'civil', visible: true, opacity: 0.95, locked: true, count: 3, iconName: 'Building2', color: 'bg-slate-600 text-white' },
  roads: { id: 'roads', name: 'Roads', category: 'civil', visible: true, opacity: 0.9, locked: true, count: 2, iconName: 'Compass', color: 'bg-stone-600 text-white' },
};

interface CustomMapPageProps {
  activeProject: string;
  setActiveProject: (id: string) => void;
}

export interface MapVersion {
  id: string;
  versionNumber: string; // e.g. 'v1.0', 'v1.1'
  status: 'published' | 'draft' | 'archived';
  createdAt: string;
  author: string;
  notes: string;
  zones: Record<string, ZoneBounds>;
  floorplanUrl: string | null;
  svgSource?: string | null;
}

export interface BuildingData {
  id: string;
  name: string;
  floors: Array<{
    id: string;
    name: string;
    levelNumber: number;
    activeVersionId: string;
    versions: MapVersion[];
  }>;
}

export interface SiteData {
  id: string;
  name: string;
  contractor: string;
  dimensions: string;
  buildings: BuildingData[];
}

const DEFAULT_SITES: Record<string, SiteData> = {
  'metro-tower': {
    id: 'metro-tower',
    name: 'Metro Commercial Tower Construction',
    contractor: 'BuildCorp General Contractors',
    dimensions: '200m x 150m (30,000 m²)',
    buildings: [
      {
        id: 'bldg-main',
        name: 'Building A - Commercial Main Tower',
        floors: [
          {
            id: 'fl-1',
            name: 'Level 1 - Ground Access & Gate Portal',
            levelNumber: 1,
            activeVersionId: 'ver-1.0',
            versions: [
              {
                id: 'ver-1.0',
                versionNumber: 'v1.0',
                status: 'published',
                createdAt: '2026-08-01 09:00',
                author: 'Elena Rostova (EHS Lead)',
                notes: 'Initial approved site safety clearance map and RFID gate boundaries.',
                zones: {
                  'Excavation Shaft': { x: 10, y: 15, width: 34, height: 62, category: 'EXCAVATION & SHORING', hazardLevel: 'warning', capacity: 4 },
                  'Tower Core': { x: 51, y: 25, width: 32, height: 50, category: 'CONCRETE REINFORCEMENT', hazardLevel: 'normal', capacity: 10 },
                  'Crane Swing Zone': { x: 80, y: 5, width: 16, height: 42, category: 'CRANE SWING RADIUS', hazardLevel: 'critical', capacity: 3 },
                  'High Voltage Area': { x: 46, y: 5, width: 14, height: 16, category: 'SUBSTATION PERIMETER', hazardLevel: 'critical', capacity: 1 },
                  'Muster Point A': { x: 2, y: 10, width: 8, height: 12, category: 'MUSTER POINT', hazardLevel: 'normal', capacity: 30 }
                },
                floorplanUrl: null
              }
            ]
          },
          {
            id: 'fl-2',
            name: 'Level 2 - Steel Decking & Scaffolding',
            levelNumber: 2,
            activeVersionId: 'ver-1.0-l2',
            versions: [
              {
                id: 'ver-1.0-l2',
                versionNumber: 'v1.0',
                status: 'published',
                createdAt: '2026-08-02 11:30',
                author: 'Marcus Vance',
                notes: 'Level 2 steel decking and scaffold perimeter layout.',
                zones: {
                  'Scaffold Access Tower': { x: 15, y: 10, width: 30, height: 40, category: 'SCAFFOLDING', hazardLevel: 'normal', capacity: 12 },
                  'High Rise Frame Deck': { x: 50, y: 10, width: 45, height: 75, category: 'BUILDING FOOTPRINT', hazardLevel: 'warning', capacity: 20 },
                  'Emergency Evacuation Stair': { x: 5, y: 60, width: 15, height: 25, category: 'EMERGENCY EXIT', hazardLevel: 'normal', capacity: 50 }
                },
                floorplanUrl: null
              }
            ]
          }
        ]
      },
      {
        id: 'bldg-logistics',
        name: 'Building B - Logistics & Equipment Hub',
        floors: [
          {
            id: 'fl-b1-1',
            name: 'Ground Level - Heavy Staging & Parking',
            levelNumber: 1,
            activeVersionId: 'ver-1.0-b2',
            versions: [
              {
                id: 'ver-1.0-b2',
                versionNumber: 'v1.0',
                status: 'published',
                createdAt: '2026-08-03 14:00',
                author: 'G. Hopper (Fleet Manager)',
                notes: 'Heavy machinery parking and material storage laydown.',
                zones: {
                  'Rebar & Steel Laydown': { x: 10, y: 10, width: 40, height: 35, category: 'MATERIAL LAYDOWN', hazardLevel: 'normal', capacity: 15 },
                  'Contractor Parking': { x: 55, y: 10, width: 40, height: 35, category: 'PARKING', hazardLevel: 'normal', capacity: 25 },
                  'Site Office Container': { x: 10, y: 55, width: 30, height: 35, category: 'SITE OFFICE', hazardLevel: 'normal', capacity: 8 }
                },
                floorplanUrl: null
              }
            ]
          }
        ]
      }
    ]
  }
};

export default function CustomMapPage({ activeProject, setActiveProject }: CustomMapPageProps) {
  // Sites, Buildings, Floors State
  const [sites, setSites] = useState<Record<string, SiteData>>(() => {
    try {
      const saved = localStorage.getItem('gao_custom_sites_v2');
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.warn('Failed to load sites:', err);
    }
    return DEFAULT_SITES;
  });

  const currentSite = sites[activeProject] || sites['metro-tower'] || DEFAULT_SITES['metro-tower'];
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>(currentSite.buildings[0]?.id || 'bldg-main');
  const currentBuilding = currentSite.buildings.find(b => b.id === selectedBuildingId) || currentSite.buildings[0];
  const [selectedFloorId, setSelectedFloorId] = useState<string>(currentBuilding?.floors[0]?.id || 'fl-1');
  const currentFloor = currentBuilding?.floors.find(f => f.id === selectedFloorId) || currentBuilding?.floors[0];

  const activeVersion = currentFloor?.versions.find(v => v.id === currentFloor.activeVersionId) || currentFloor?.versions[0];

  const [assets, setAssets] = useState<AssetItem[]>(INITIAL_ASSETS);
  const [vehicles, setVehicles] = useState<VehicleItem[]>(INITIAL_VEHICLES);
  const [cameras, setCameras] = useState<CCTVCameraItem[]>(INITIAL_CCTVS);
  const [envSensors, setEnvSensors] = useState<EnvironmentalSensorItem[]>(INITIAL_ENV_SENSORS);
  const [hardwareDevices, setHardwareDevices] = useState<HardwareDevice[]>(INITIAL_DEVICES);
  const [customFloorplan, setCustomFloorplan] = useState<string | null>(activeVersion?.floorplanUrl || null);
  const [customSvgSource, setCustomSvgSource] = useState<string | null>(activeVersion?.svgSource || null);
  const [customZones, setCustomZones] = useState<Record<string, ZoneBounds>>(activeVersion?.zones || {});

  const [activeSidebarTab, setActiveSidebarTab] = useState<'layers' | 'inventory' | 'zones' | 'sites'>('layers');
  const [layerConfigs, setLayerConfigs] = useState<Record<string, MapLayerConfig>>(DEFAULT_LAYER_CONFIGS);
  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [mapCategoryFilter, setMapCategoryFilter] = useState<string>('all');
  const [globalOpacity, setGlobalOpacity] = useState<number>(100);

  const toggleLayerVisibility = (key: string) => {
    setLayerConfigs(prev => ({
      ...prev,
      [key]: { ...prev[key], visible: !prev[key].visible }
    }));
  };

  const setLayerOpacity = (key: string, opacity: number) => {
    setLayerConfigs(prev => ({
      ...prev,
      [key]: { ...prev[key], opacity }
    }));
  };

  const toggleLayerLock = (key: string) => {
    setLayerConfigs(prev => ({
      ...prev,
      [key]: { ...prev[key], locked: !prev[key].locked }
    }));
  };

  const handleShowAllLayers = () => {
    setLayerConfigs(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { next[k] = { ...next[k], visible: true }; });
      return next;
    });
  };

  const handleHideAllLayers = () => {
    setLayerConfigs(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { next[k] = { ...next[k], visible: false }; });
      return next;
    });
  };

  const handleLockAllLayers = () => {
    setLayerConfigs(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { next[k] = { ...next[k], locked: true }; });
      return next;
    });
  };

  const handleUnlockAllLayers = () => {
    setLayerConfigs(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { next[k] = { ...next[k], locked: false }; });
      return next;
    });
  };

  const handleGlobalOpacityChange = (val: number) => {
    setGlobalOpacity(val);
    const factor = val / 100;
    setLayerConfigs(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { next[k] = { ...next[k], opacity: factor }; });
      return next;
    });
  };

  // Modals state
  const [isMapEditorOpen, setIsMapEditorOpen] = useState(false);
  const [isCadImporterOpen, setIsCadImporterOpen] = useState(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [isCreateSiteOpen, setIsCreateSiteOpen] = useState(false);
  const [isCreateBuildingOpen, setIsCreateBuildingOpen] = useState(false);
  const [isCreateFloorOpen, setIsCreateFloorOpen] = useState(false);

  // New Site Form
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteContractor, setNewSiteContractor] = useState('Aperture EHS Corp');
  const [newSiteDimensions, setNewSiteDimensions] = useState('250m x 200m (50,000 m²)');

  // New Building Form
  const [newBldgName, setNewBldgName] = useState('');

  // New Floor Form
  const [newFloorName, setNewFloorName] = useState('');
  const [newFloorLevel, setNewFloorLevel] = useState(2);

  // CAD Importer Workflow State
  const [cadFileName, setCadFileName] = useState<string | null>(null);
  const [cadScaleMeters, setCadScaleMeters] = useState(1.0);
  const [cadDetectedLayers, setCadDetectedLayers] = useState<Array<{ name: string; category: string; count: number; selected: boolean }>>([
    { name: 'CAD_WALLS_EXTERIOR', category: 'building', count: 14, selected: true },
    { name: 'CAD_SITE_ROADS', category: 'road', count: 6, selected: true },
    { name: 'CAD_SCAFFOLD_DECK', category: 'scaffolding', count: 8, selected: true },
    { name: 'CAD_CRANE_SWING', category: 'crane_zone', count: 2, selected: true },
    { name: 'CAD_EXCAVATION_PIT', category: 'excavation_zone', count: 3, selected: true },
    { name: 'CAD_PARKING_STAGING', category: 'parking', count: 4, selected: true },
    { name: 'CAD_MATERIAL_LAYDOWN', category: 'storage', count: 5, selected: true },
    { name: 'CAD_OFFICE_TRAILERS', category: 'office', count: 3, selected: true },
    { name: 'CAD_EMERGENCY_EXIT', category: 'emergency_exit', count: 4, selected: true },
    { name: 'CAD_MUSTER_POINT_A', category: 'assembly_point', count: 2, selected: true },
    { name: 'CAD_SUBSTATION_HAZARD', category: 'hazard_zone', count: 2, selected: true },
    { name: 'CAD_BLAST_EXCLUSION', category: 'restricted_zone', count: 1, selected: true }
  ]);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const [draggedItem, setDraggedItem] = useState<{ id: string; type: 'asset' | 'vehicle' | 'camera' | 'sensor' | 'device' } | null>(null);
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [selectedDeviceForConfig, setSelectedDeviceForConfig] = useState<HardwareDevice | null>(null);

  // Sync floor & version when switching building/floor
  useEffect(() => {
    if (activeVersion) {
      setCustomZones(activeVersion.zones || {});
      setCustomFloorplan(activeVersion.floorplanUrl || null);
      setCustomSvgSource(activeVersion.svgSource || null);
    }
  }, [selectedBuildingId, selectedFloorId, currentSite]);

  const saveSitesState = (newSites: Record<string, SiteData>) => {
    setSites(newSites);
    localStorage.setItem('gao_custom_sites_v2', JSON.stringify(newSites));
    window.dispatchEvent(new Event('gao_project_updated'));
  };

  // Save map layout zones to current active version
  const handleSaveZonesFromEditor = (updatedZones: Record<string, ZoneBounds>, newFloorplanUrl: string | null, newSvgSource?: string | null) => {
    setCustomZones(updatedZones);
    setCustomFloorplan(newFloorplanUrl);
    if (newSvgSource !== undefined) setCustomSvgSource(newSvgSource);

    const updatedSites = { ...sites };
    const siteObj = updatedSites[activeProject] || updatedSites['metro-tower'];

    if (siteObj && currentBuilding && currentFloor && activeVersion) {
      const bldgIndex = siteObj.buildings.findIndex(b => b.id === currentBuilding.id);
      if (bldgIndex !== -1) {
        const floorIndex = siteObj.buildings[bldgIndex].floors.findIndex(f => f.id === currentFloor.id);
        if (floorIndex !== -1) {
          const verIndex = siteObj.buildings[bldgIndex].floors[floorIndex].versions.findIndex(v => v.id === activeVersion.id);
          if (verIndex !== -1) {
            siteObj.buildings[bldgIndex].floors[floorIndex].versions[verIndex] = {
              ...activeVersion,
              zones: updatedZones,
              floorplanUrl: newFloorplanUrl,
              svgSource: newSvgSource !== undefined ? newSvgSource : activeVersion.svgSource
            };
            saveSitesState(updatedSites);
          }
        }
      }
    }

    setSuccessMsg('Digital Twin vector map zones & blueprint overlay updated successfully!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Create New Version Draft
  const handleCreateNewVersion = () => {
    if (!currentBuilding || !currentFloor || !activeVersion) return;

    const nextVerNum = `v1.${currentFloor.versions.length}`;
    const newVer: MapVersion = {
      id: `ver-${Date.now()}`,
      versionNumber: nextVerNum,
      status: 'draft',
      createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      author: 'EHS Operations Lead',
      notes: `Draft revision created from ${activeVersion.versionNumber} for updated sector configuration.`,
      zones: JSON.parse(JSON.stringify(customZones)),
      floorplanUrl: customFloorplan,
      svgSource: customSvgSource
    };

    const updatedSites = { ...sites };
    const siteObj = updatedSites[activeProject];
    if (siteObj) {
      const bldg = siteObj.buildings.find(b => b.id === currentBuilding.id);
      if (bldg) {
        const fl = bldg.floors.find(f => f.id === currentFloor.id);
        if (fl) {
          fl.versions.unshift(newVer);
          fl.activeVersionId = newVer.id;
          saveSitesState(updatedSites);
        }
      }
    }

    setSuccessMsg(`Created new version draft ${nextVerNum} for ${currentFloor.name}`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Publish Draft Version
  const handlePublishVersion = (verId: string) => {
    if (!currentBuilding || !currentFloor) return;
    const updatedSites = { ...sites };
    const siteObj = updatedSites[activeProject];
    if (siteObj) {
      const bldg = siteObj.buildings.find(b => b.id === currentBuilding.id);
      if (bldg) {
        const fl = bldg.floors.find(f => f.id === currentFloor.id);
        if (fl) {
          fl.versions.forEach(v => {
            if (v.id === verId) v.status = 'published';
            else if (v.status === 'published') v.status = 'archived';
          });
          fl.activeVersionId = verId;
          saveSitesState(updatedSites);
        }
      }
    }
    setSuccessMsg('Published map version is now active on Live Tracking!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Execute CAD Import Workflow
  const handleExecuteCadImport = () => {
    const importedZones: Record<string, ZoneBounds> = { ...customZones };

    cadDetectedLayers.filter(l => l.selected).forEach((layer, idx) => {
      const name = `${layer.name.replace('CAD_', '').replace(/_/g, ' ')} (${idx + 1})`;
      importedZones[name] = {
        x: 10 + (idx * 7) % 70,
        y: 15 + (idx * 6) % 65,
        width: 20,
        height: 18,
        category: layer.category.toUpperCase(),
        hazardLevel: layer.category.includes('restricted') || layer.category.includes('hazard') ? 'critical' : 'normal',
        capacity: 15
      };
    });

    handleSaveZonesFromEditor(importedZones, customFloorplan, customSvgSource);
    setIsCadImporterOpen(false);
    setSuccessMsg(`CAD vectors parsed and converted ${cadDetectedLayers.filter(l => l.selected).length} layers into Digital Twin Map elements!`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  // Create Site
  const handleCreateSite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteName.trim()) return;
    const id = `site-${Date.now()}`;
    const newSiteObj: SiteData = {
      id,
      name: newSiteName,
      contractor: newSiteContractor,
      dimensions: newSiteDimensions,
      buildings: [
        {
          id: `bldg-${Date.now()}`,
          name: 'Main Building Structure',
          floors: [
            {
              id: `fl-${Date.now()}`,
              name: 'Level 1 - Ground Access',
              levelNumber: 1,
              activeVersionId: `ver-${Date.now()}`,
              versions: [
                {
                  id: `ver-${Date.now()}`,
                  versionNumber: 'v1.0',
                  status: 'published',
                  createdAt: new Date().toISOString().slice(0, 10),
                  author: 'Site Admin',
                  notes: 'Initial site setup',
                  zones: { 'Primary Gate Sector': { x: 10, y: 10, width: 35, height: 35, capacity: 20 } },
                  floorplanUrl: null
                }
              ]
            }
          ]
        }
      ]
    };

    const nextSites = { ...sites, [id]: newSiteObj };
    saveSitesState(nextSites);
    setActiveProject(id);
    setIsCreateSiteOpen(false);
    setNewSiteName('');
    setSuccessMsg(`Created new construction site "${newSiteName}"!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Create Building
  const handleCreateBuilding = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBldgName.trim()) return;
    const newBldg: BuildingData = {
      id: `bldg-${Date.now()}`,
      name: newBldgName,
      floors: [
        {
          id: `fl-${Date.now()}`,
          name: 'Level 1 - Ground Floor',
          levelNumber: 1,
          activeVersionId: `ver-${Date.now()}`,
          versions: [
            {
              id: `ver-${Date.now()}`,
              versionNumber: 'v1.0',
              status: 'published',
              createdAt: new Date().toISOString().slice(0, 10),
              author: 'Site Engineer',
              notes: 'Building initial layout',
              zones: { 'Entrance Lobby': { x: 20, y: 20, width: 30, height: 30 } },
              floorplanUrl: null
            }
          ]
        }
      ]
    };

    const updatedSites = { ...sites };
    if (updatedSites[activeProject]) {
      updatedSites[activeProject].buildings.push(newBldg);
      saveSitesState(updatedSites);
      setSelectedBuildingId(newBldg.id);
    }
    setIsCreateBuildingOpen(false);
    setNewBldgName('');
    setSuccessMsg(`Added new building "${newBldgName}" to ${currentSite.name}`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Create Floor
  const handleCreateFloor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFloorName.trim() || !currentBuilding) return;

    const newFloor = {
      id: `fl-${Date.now()}`,
      name: newFloorName,
      levelNumber: Number(newFloorLevel),
      activeVersionId: `ver-${Date.now()}`,
      versions: [
        {
          id: `ver-${Date.now()}`,
          versionNumber: 'v1.0',
          status: 'published' as const,
          createdAt: new Date().toISOString().slice(0, 10),
          author: 'Site Engineer',
          notes: 'Floor initial layout',
          zones: { 'Main Corridor': { x: 15, y: 15, width: 40, height: 30 } },
          floorplanUrl: null
        }
      ]
    };

    const updatedSites = { ...sites };
    const siteObj = updatedSites[activeProject];
    if (siteObj) {
      const bldg = siteObj.buildings.find(b => b.id === currentBuilding.id);
      if (bldg) {
        bldg.floors.push(newFloor);
        saveSitesState(updatedSites);
        setSelectedFloorId(newFloor.id);
      }
    }
    setIsCreateFloorOpen(false);
    setNewFloorName('');
    setSuccessMsg(`Added floor "${newFloorName}" to ${currentBuilding.name}`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // File Blueprint Upload
  const handleUploadBlueprint = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      setCustomFloorplan(url);
      handleSaveZonesFromEditor(customZones, url, customSvgSource);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900 overflow-y-auto p-6 font-sans">
      
      {/* Top Header Card */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2.5 bg-blue-50 dark:bg-blue-900/40 text-[#007BC4] rounded-xl">
              <MapIcon size={22} />
            </span>
            <div>
              <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Digital Twin & Multi-Site Custom Vector Map Studio
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                Manage multiple sites, buildings, floors, versioned blueprints, CAD/DWG vector imports & interactive 12-category zone shapes.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsCadImporterOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 rounded-xl text-xs font-bold hover:bg-purple-100 transition shadow-sm"
          >
            <FileCode size={16} />
            CAD / DWG Import Workflow
          </button>

          <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer transition shadow-sm">
            <Upload size={16} />
            Blueprint Upload
            <input type="file" accept="image/*,application/pdf,.svg" onChange={handleUploadBlueprint} className="hidden" />
          </label>

          <button
            onClick={() => setIsMapEditorOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#007BC4] hover:bg-[#00629c] text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-500/20"
          >
            <Edit3 size={16} />
            Open Vector Canvas Editor
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold rounded-xl flex items-center gap-3 shadow-sm animate-in fade-in">
          <Check size={16} className="text-emerald-600" />
          {successMsg}
        </div>
      )}

      {/* Site, Building & Floor Hierarchical Selection Bar */}
      <div className="mb-6 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap w-full md:w-auto">
          
          {/* Site Selector */}
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#007BC4]" />
            <span className="text-xs font-extrabold uppercase text-slate-500">Site:</span>
            <select
              value={activeProject}
              onChange={e => {
                if (e.target.value === '__new_site__') {
                  setIsCreateSiteOpen(true);
                } else {
                  setActiveProject(e.target.value);
                }
              }}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black text-slate-900 dark:text-white"
            >
              {Object.values(sites).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              <option value="__new_site__">+ Create New Site...</option>
            </select>
          </div>

          <ChevronRight className="w-4 h-4 text-slate-400 hidden sm:block" />

          {/* Building Selector */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-purple-600" />
            <span className="text-xs font-extrabold uppercase text-slate-500">Building:</span>
            <select
              value={selectedBuildingId}
              onChange={e => {
                if (e.target.value === '__new_bldg__') {
                  setIsCreateBuildingOpen(true);
                } else {
                  setSelectedBuildingId(e.target.value);
                }
              }}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
            >
              {currentSite.buildings.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
              <option value="__new_bldg__">+ Add Building...</option>
            </select>
          </div>

          <ChevronRight className="w-4 h-4 text-slate-400 hidden sm:block" />

          {/* Floor Selector */}
          <div className="flex items-center gap-2">
            <Layers3 className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-extrabold uppercase text-slate-500">Floor:</span>
            <select
              value={selectedFloorId}
              onChange={e => {
                if (e.target.value === '__new_floor__') {
                  setIsCreateFloorOpen(true);
                } else {
                  setSelectedFloorId(e.target.value);
                }
              }}
              className="px-3 py-1.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white"
            >
              {currentBuilding?.floors.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
              <option value="__new_floor__">+ Add Floor...</option>
            </select>
          </div>

        </div>

        {/* Version Badge & Version Controls */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <History className="w-4 h-4 text-[#007BC4]" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Active Version: <strong className="text-[#007BC4] font-mono">{activeVersion?.versionNumber || 'v1.0'}</strong> ({activeVersion?.status})
            </span>
          </div>

          <button
            onClick={() => setIsVersionHistoryOpen(true)}
            className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          >
            <History size={14} />
            Version History ({currentFloor?.versions.length || 1})
          </button>
        </div>
      </div>

      {/* Main Grid Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 items-start">
        
        {/* Left Sidebar: Site Inventory, Zones & Layer Controls */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
          <div className="flex border-b border-slate-200 dark:border-slate-700 pb-2 gap-3 overflow-x-auto">
            <button
              onClick={() => setActiveSidebarTab('layers')}
              className={`pb-1.5 text-xs font-extrabold uppercase tracking-wider transition-all whitespace-nowrap relative ${activeSidebarTab === 'layers' ? 'text-[#007BC4]' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Layer Controls ({Object.values(layerConfigs).filter(l => l.visible).length}/18)
              {activeSidebarTab === 'layers' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007BC4] rounded-full" />}
            </button>
            <button
              onClick={() => setActiveSidebarTab('inventory')}
              className={`pb-1.5 text-xs font-extrabold uppercase tracking-wider transition-all whitespace-nowrap relative ${activeSidebarTab === 'inventory' ? 'text-[#007BC4]' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Hardware Fleet
              {activeSidebarTab === 'inventory' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007BC4] rounded-full" />}
            </button>
            <button
              onClick={() => setActiveSidebarTab('zones')}
              className={`pb-1.5 text-xs font-extrabold uppercase tracking-wider transition-all whitespace-nowrap relative ${activeSidebarTab === 'zones' ? 'text-[#007BC4]' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Zones ({Object.keys(customZones).length})
              {activeSidebarTab === 'zones' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007BC4] rounded-full" />}
            </button>
          </div>
          
          <div className="flex flex-col gap-3 max-h-[580px] overflow-y-auto pr-1">
            {activeSidebarTab === 'layers' && (
              <div className="space-y-3">
                {/* Search & Filter Header */}
                <div className="space-y-2 bg-slate-50 dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search assets, workers, zones..."
                      value={mapSearchQuery}
                      onChange={e => setMapSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-[#007BC4]"
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-[10px] text-slate-500 font-bold uppercase">
                      <Filter size={12} />
                      Filter:
                    </div>
                    <select
                      value={mapCategoryFilter}
                      onChange={e => setMapCategoryFilter(e.target.value)}
                      className="px-2 py-1 text-[11px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg font-bold text-slate-700 dark:text-slate-300"
                    >
                      <option value="all">All Categories (18)</option>
                      <option value="personnel">Personnel & Contractors</option>
                      <option value="equipment">Machinery & Fleet</option>
                      <option value="infrastructure">Infrastructure & IoT</option>
                      <option value="zones">Hazard & Restricted</option>
                      <option value="safety">Safety & First Aid</option>
                      <option value="civil">Civil & Structural</option>
                    </select>
                  </div>

                  {/* Bulk Layer Controls */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between flex-wrap gap-1">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleShowAllLayers}
                        className="px-2 py-1 text-[10px] font-bold bg-[#007BC4] text-white rounded hover:bg-[#00629c]"
                      >
                        Show All
                      </button>
                      <button
                        onClick={handleHideAllLayers}
                        className="px-2 py-1 text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded hover:bg-slate-300"
                      >
                        Hide All
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleLockAllLayers}
                        className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                        title="Lock All Layers"
                      >
                        <Lock size={12} />
                      </button>
                      <button
                        onClick={handleUnlockAllLayers}
                        className="p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                        title="Unlock All Layers"
                      >
                        <Unlock size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Global Opacity Slider */}
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase">
                      <span>Global Opacity</span>
                      <span>{globalOpacity}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      value={globalOpacity}
                      onChange={e => handleGlobalOpacityChange(Number(e.target.value))}
                      className="w-full accent-[#007BC4] h-1 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                    />
                  </div>
                </div>

                {/* 18 Layer Items List */}
                <div className="space-y-1.5">
                  {Object.entries(layerConfigs)
                    .filter(([_, conf]) => mapCategoryFilter === 'all' || conf.category === mapCategoryFilter)
                    .map(([key, conf]) => (
                      <div
                        key={key}
                        className={`p-2.5 rounded-xl border transition-all flex flex-col gap-2 ${conf.visible ? 'bg-slate-50 dark:bg-slate-900/80 border-slate-200 dark:border-slate-700' : 'bg-slate-100/50 dark:bg-slate-950/40 border-slate-200/50 dark:border-slate-800/50 opacity-60'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`px-2 py-0.5 text-[10px] font-black rounded-lg ${conf.color}`}>
                              {conf.count}
                            </span>
                            <span className="text-xs font-extrabold text-slate-800 dark:text-white truncate">
                              {conf.name}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => toggleLayerLock(key)}
                              className={`p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 ${conf.locked ? 'text-amber-500' : 'text-slate-400'}`}
                              title={conf.locked ? 'Unlock Layer' : 'Lock Layer'}
                            >
                              {conf.locked ? <Lock size={13} /> : <Unlock size={13} />}
                            </button>

                            <button
                              onClick={() => toggleLayerVisibility(key)}
                              className={`p-1 rounded transition ${conf.visible ? 'text-[#007BC4] bg-blue-50 dark:bg-blue-950/40' : 'text-slate-400 hover:text-slate-600'}`}
                              title={conf.visible ? 'Hide Layer' : 'Show Layer'}
                            >
                              {conf.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                          </div>
                        </div>

                        {/* Per-Layer Opacity Controls when visible */}
                        {conf.visible && (
                          <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800/60">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Opacity</span>
                            <input
                              type="range"
                              min="0.1"
                              max="1"
                              step="0.05"
                              value={conf.opacity}
                              onChange={e => setLayerOpacity(key, Number(e.target.value))}
                              className="flex-1 h-1 accent-[#007BC4] bg-slate-200 dark:bg-slate-700 rounded cursor-pointer"
                            />
                            <span className="text-[9px] font-mono text-slate-500 font-bold">{Math.round(conf.opacity * 100)}%</span>
                          </div>
                        )}
                      </div>
                    ))}
                </div>
              </div>
            )}

            {activeSidebarTab === 'inventory' && (
              <>
                <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">RFID Readers & Portals</div>
                {hardwareDevices.map(d => (
                  <div key={d.id} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="p-2 bg-purple-50 dark:bg-purple-950/50 text-purple-600 rounded-lg"><Radio size={14} /></span>
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-800 dark:text-white truncate">{d.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{d.zone}</div>
                      </div>
                    </div>
                    <button onClick={() => setSelectedDeviceForConfig(d)} className="text-slate-400 hover:text-purple-600 p-1">
                      <Settings size={13} />
                    </button>
                  </div>
                ))}

                <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mt-3 mb-1">Heavy Machinery Assets</div>
                {assets.slice(0, 4).map(a => (
                  <div key={a.id} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5 truncate">
                      <span className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-lg"><Wrench size={14} /></span>
                      <div className="truncate">
                        <div className="text-xs font-bold text-slate-800 dark:text-white truncate">{a.name}</div>
                        <div className="text-[10px] text-slate-400">{a.location}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {activeSidebarTab === 'zones' && (
              <>
                <button
                  onClick={() => setIsMapEditorOpen(true)}
                  className="mb-3 w-full py-2 bg-[#007BC4] hover:bg-[#0062a0] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
                >
                  <Plus size={14} />
                  Add / Edit Zones in Vector Editor
                </button>

                {Object.entries(customZones).map(([zName, bounds]: [string, any]) => (
                  <div key={zName} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
                    <div className="flex flex-col min-w-0 flex-1 pr-2">
                      <div className="text-xs font-black text-slate-800 dark:text-white truncate">{zName}</div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className="px-1.5 py-0.5 text-[8px] font-extrabold uppercase rounded bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {bounds.category || 'ZONE'}
                        </span>
                        <span className="text-[9px] text-slate-400">Cap: {bounds.capacity || 10}</span>
                      </div>
                    </div>
                    <button onClick={() => setIsMapEditorOpen(true)} className="text-slate-400 hover:text-sky-500 p-1">
                      <Edit3 size={13} />
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Center / Right Column: Live Vector Blueprint Map Display */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm flex flex-col h-[680px] relative overflow-hidden">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <span className="text-xs font-bold text-[#007BC4] uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={14} /> Active Digital Twin Vector Map & Assets
              </span>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                {currentSite.name} — {currentBuilding?.name} ({currentFloor?.name})
              </h3>
            </div>
            
            {/* Quick Map Controls Toolbar */}
            <div className="flex items-center gap-2">
              <div className="px-2.5 py-1 bg-slate-100 dark:bg-slate-900 border rounded-lg text-[10px] font-mono text-slate-600 dark:text-slate-300 font-bold">
                Layers Active: {Object.values(layerConfigs).filter(l => l.visible).length}/18
              </div>
              <button
                onClick={handleShowAllLayers}
                className="px-2.5 py-1 bg-blue-50 text-[#007BC4] border border-blue-200 rounded-lg text-[10px] font-bold hover:bg-blue-100"
              >
                Show All
              </button>
              <button
                onClick={handleHideAllLayers}
                className="px-2.5 py-1 bg-slate-100 text-slate-600 border rounded-lg text-[10px] font-bold hover:bg-slate-200"
              >
                Hide All
              </button>
            </div>
          </div>

          {/* Map Surface */}
          <div 
            ref={mapRef}
            className="flex-1 relative rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-950 overflow-hidden shadow-inner select-none"
          >
            {/* SVG Source, Custom Blueprint, or Fallback Vector Graphic */}
            {customSvgSource ? (
              <div 
                className="absolute inset-0 opacity-50 pointer-events-none overflow-hidden" 
                dangerouslySetInnerHTML={{ __html: customSvgSource }} 
              />
            ) : customFloorplan ? (
              <img src={customFloorplan} alt="Custom Blueprint" className="absolute inset-0 w-full h-full object-cover opacity-80" />
            ) : (
              <img 
                src={getBlueprintSvg(activeProject, currentSite.name, currentSite.contractor, currentSite.dimensions)} 
                alt="Site Blueprint" 
                className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none" 
              />
            )}

            {/* Custom Vector Zones Overlays */}
            {(layerConfigs.hazardZones?.visible || layerConfigs.restrictedZones?.visible) &&
              Object.entries(customZones).map(([zName, bounds]: [string, any]) => {
                const isHazard = bounds.hazardLevel === 'critical';
                const isWarning = bounds.hazardLevel === 'warning';
                
                if (isHazard && !layerConfigs.restrictedZones?.visible) return null;
                if (isWarning && !layerConfigs.hazardZones?.visible) return null;

                const opacity = (isHazard ? layerConfigs.restrictedZones?.opacity : layerConfigs.hazardZones?.opacity) ?? 1;
                const isLocked = isHazard ? layerConfigs.restrictedZones?.locked : layerConfigs.hazardZones?.locked;

                let zoneColor = 'border-sky-500 bg-sky-500/15 text-sky-300';
                if (isHazard) zoneColor = 'border-rose-500 bg-rose-500/20 text-rose-400';
                else if (isWarning) zoneColor = 'border-amber-500 bg-amber-500/15 text-amber-300';

                const matched = mapSearchQuery.trim() && zName.toLowerCase().includes(mapSearchQuery.toLowerCase());

                return (
                  <div
                    key={`map-zone-${zName}`}
                    className={`absolute border-2 border-dashed rounded-xl p-2.5 flex flex-col justify-between group pointer-events-none transition-all ${zoneColor} ${matched ? 'ring-4 ring-yellow-400 animate-pulse' : ''}`}
                    style={{
                      left: `${bounds.x}%`,
                      top: `${bounds.y}%`,
                      width: `${bounds.width}%`,
                      height: `${bounds.height}%`,
                      opacity,
                      transform: `rotate(${bounds.rotation || 0}deg)`
                    }}
                  >
                    <div className="text-[10px] font-black uppercase tracking-wider truncate flex items-center justify-between">
                      <span>{zName}</span>
                      {isLocked && <Lock size={10} className="text-amber-400" />}
                    </div>
                    <div className="text-[8px] font-mono opacity-80 mt-auto flex justify-between">
                      <span>{bounds.category || 'ZONE'}</span>
                      <span>Cap: {bounds.capacity || 10}</span>
                    </div>
                  </div>
                );
              })}

            {/* RFID Readers Layer Overlay */}
            {layerConfigs.rfidReaders?.visible && (
              <div style={{ opacity: layerConfigs.rfidReaders.opacity }}>
                {hardwareDevices.map(d => {
                  const matched = mapSearchQuery.trim() && (d.name.toLowerCase().includes(mapSearchQuery.toLowerCase()) || d.zone.toLowerCase().includes(mapSearchQuery.toLowerCase()));
                  return (
                    <div
                      key={d.id}
                      onDoubleClick={() => setSelectedDeviceForConfig(d)}
                      className={`absolute z-30 p-2 rounded-xl shadow-lg border backdrop-blur-md flex items-center gap-2 bg-purple-900/90 text-white border-purple-700 cursor-pointer hover:scale-105 transition ${matched ? 'ring-4 ring-yellow-400 animate-pulse' : ''}`}
                      style={{ left: `${d.x}%`, top: `${d.y}%`, transform: 'translate(-50%, -50%)' }}
                    >
                      <Radio size={14} className="text-purple-300 animate-pulse" />
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold leading-tight">{d.name}</span>
                        <span className="text-[9px] text-purple-200 font-mono">{d.zone}</span>
                      </div>
                      {layerConfigs.rfidReaders.locked && <Lock size={10} className="text-amber-300 ml-1" />}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Workers Layer Overlay */}
            {layerConfigs.workers?.visible && (
              <div style={{ opacity: layerConfigs.workers.opacity }}>
                {[
                  { id: 'W-101', name: 'Alice Smith', role: 'Steel Fixer', x: 55, y: 32 },
                  { id: 'W-102', name: 'Marcus Vance', role: 'Scaffolder Lead', x: 28, y: 22 },
                  { id: 'W-103', name: 'Carlos Rodriguez', role: 'Rigging Specialist', x: 82, y: 15 },
                  { id: 'W-104', name: 'David Kim', role: 'Concrete Pour Op', x: 18, y: 35 },
                ].map(w => {
                  const matched = mapSearchQuery.trim() && (w.name.toLowerCase().includes(mapSearchQuery.toLowerCase()) || w.role.toLowerCase().includes(mapSearchQuery.toLowerCase()));
                  return (
                    <div
                      key={w.id}
                      className={`absolute z-30 px-2 py-1 rounded-full shadow-md border flex items-center gap-1.5 bg-emerald-900/90 text-emerald-100 border-emerald-500 cursor-pointer ${matched ? 'ring-4 ring-yellow-400 animate-bounce' : ''}`}
                      style={{ left: `${w.x}%`, top: `${w.y}%`, transform: 'translate(-50%, -50%)' }}
                    >
                      <HardHat size={12} className="text-emerald-300" />
                      <span className="text-[10px] font-extrabold">{w.name}</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Visitors Layer Overlay */}
            {layerConfigs.visitors?.visible && (
              <div style={{ opacity: layerConfigs.visitors.opacity }}>
                {[
                  { id: 'V-201', name: 'Inspector Green (OSHA)', x: 22, y: 82 },
                  { id: 'V-202', name: 'Sarah Jenkins (Client Rep)', x: 8, y: 14 },
                ].map(v => {
                  const matched = mapSearchQuery.trim() && v.name.toLowerCase().includes(mapSearchQuery.toLowerCase());
                  return (
                    <div
                      key={v.id}
                      className={`absolute z-30 px-2 py-1 rounded-full shadow-md border flex items-center gap-1.5 bg-blue-900/90 text-blue-100 border-blue-400 cursor-pointer ${matched ? 'ring-4 ring-yellow-400' : ''}`}
                      style={{ left: `${v.x}%`, top: `${v.y}%`, transform: 'translate(-50%, -50%)' }}
                    >
                      <Users size={12} className="text-blue-300" />
                      <span className="text-[10px] font-extrabold">{v.name}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* CCTV Cameras Layer Overlay */}
            {layerConfigs.cctvCameras?.visible && (
              <div style={{ opacity: layerConfigs.cctvCameras.opacity }}>
                {cameras.map(c => {
                  const matched = mapSearchQuery.trim() && (c.name.toLowerCase().includes(mapSearchQuery.toLowerCase()) || c.zone.toLowerCase().includes(mapSearchQuery.toLowerCase()));
                  return (
                    <div
                      key={c.id}
                      className={`absolute z-30 p-1.5 rounded-lg shadow-md border bg-teal-900/90 text-teal-100 border-teal-500 flex items-center gap-1 cursor-pointer ${matched ? 'ring-4 ring-yellow-400' : ''}`}
                      style={{ left: `${c.x}%`, top: `${c.y}%`, transform: 'translate(-50%, -50%)' }}
                    >
                      <Camera size={12} className="text-teal-300" />
                      <span className="text-[9px] font-bold">{c.name}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Equipment & Vehicles Overlay */}
            {layerConfigs.equipment?.visible && (
              <div style={{ opacity: layerConfigs.equipment.opacity }}>
                {assets.map(a => {
                  const matched = mapSearchQuery.trim() && a.name.toLowerCase().includes(mapSearchQuery.toLowerCase());
                  return (
                    <div
                      key={a.id}
                      className={`absolute z-20 p-1.5 rounded-lg shadow-md border bg-amber-950/90 text-amber-200 border-amber-600 flex items-center gap-1.5 cursor-pointer ${matched ? 'ring-4 ring-yellow-400' : ''}`}
                      style={{ left: `${a.x}%`, top: `${a.y}%`, transform: 'translate(-50%, -50%)' }}
                    >
                      <Box size={12} className="text-amber-400" />
                      <span className="text-[9px] font-bold">{a.name}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Vehicles Layer Overlay */}
            {layerConfigs.vehicles?.visible && (
              <div style={{ opacity: layerConfigs.vehicles.opacity }}>
                {vehicles.map(v => {
                  const matched = mapSearchQuery.trim() && (v.name.toLowerCase().includes(mapSearchQuery.toLowerCase()) || v.type.toLowerCase().includes(mapSearchQuery.toLowerCase()));
                  return (
                    <div
                      key={v.id}
                      className={`absolute z-25 p-1.5 rounded-xl shadow-lg border bg-orange-950/90 text-orange-200 border-orange-500 flex items-center gap-1.5 cursor-pointer ${matched ? 'ring-4 ring-yellow-400' : ''}`}
                      style={{ left: `${v.x}%`, top: `${v.y}%`, transform: 'translate(-50%, -50%)' }}
                    >
                      <Truck size={13} className="text-orange-400" />
                      <div className="flex flex-col">
                        <span className="text-[9px] font-bold leading-tight">{v.name}</span>
                        <span className="text-[8px] text-orange-300 font-mono">{v.status} ({v.speed}km/h)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Safety Items (Assembly Points, Fire Equipment, First Aid) */}
            {layerConfigs.assemblyPoints?.visible && (
              <div
                className="absolute z-20 p-2 rounded-xl bg-emerald-900/80 border border-emerald-500 text-emerald-200 flex items-center gap-1.5"
                style={{ left: '5%', top: '10%', opacity: layerConfigs.assemblyPoints.opacity }}
              >
                <ShieldCheck size={14} className="text-emerald-400" />
                <span className="text-[10px] font-black">MUSTER POINT A</span>
              </div>
            )}

            {layerConfigs.fireEquipment?.visible && (
              <div
                className="absolute z-20 p-1.5 rounded-lg bg-red-950/80 border border-red-500 text-red-200 flex items-center gap-1"
                style={{ left: '20%', top: '78%', opacity: layerConfigs.fireEquipment.opacity }}
              >
                <Flame size={13} className="text-red-400 animate-pulse" />
                <span className="text-[9px] font-bold">CO2 Fire Extinguisher #1</span>
              </div>
            )}

            {layerConfigs.firstAidStations?.visible && (
              <div
                className="absolute z-20 p-1.5 rounded-lg bg-emerald-950/80 border border-emerald-500 text-emerald-200 flex items-center gap-1"
                style={{ left: '24%', top: '78%', opacity: layerConfigs.firstAidStations.opacity }}
              >
                <Plus size={13} className="text-emerald-400" />
                <span className="text-[9px] font-bold">Medic First Aid Station</span>
              </div>
            )}

          </div>
        </div>

      </div>

      {/* Map Canvas Vector Editor Modal */}
      {isMapEditorOpen && (
        <MapEditorModal
          isOpen={isMapEditorOpen}
          onClose={() => setIsMapEditorOpen(false)}
          zones={customZones}
          floorplanUrl={customFloorplan}
          svgSource={customSvgSource}
          onSaveZones={handleSaveZonesFromEditor}
          siteName={currentSite.name}
          buildingName={currentBuilding?.name}
          floorName={currentFloor?.name}
        />
      )}

      {/* CAD / DWG Import Workflow Modal */}
      {isCadImporterOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                  <FileCode className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">CAD / DWG Import & Layer Vector Extraction</h3>
                  <p className="text-xs text-slate-500">Auto-detect CAD layers, scale parameters and map to site elements</p>
                </div>
              </div>
              <button onClick={() => setIsCadImporterOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center bg-slate-50 dark:bg-slate-950">
                <Upload className="w-8 h-8 text-[#007BC4] mx-auto mb-2 animate-bounce" />
                <p className="text-xs font-bold text-slate-800 dark:text-white">Drag & drop .DWG, .DXF or .CAD files here</p>
                <p className="text-[10px] text-slate-400 mt-1">Simulated parser extracts vector layers automatically</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Scale Ratio (CAD Units to Meters)</label>
                <input
                  type="number"
                  step="0.1"
                  value={cadScaleMeters}
                  onChange={e => setCadScaleMeters(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <span className="text-xs font-black text-slate-800 dark:text-white uppercase block mb-2">Detected CAD Vector Layers ({cadDetectedLayers.length})</span>
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {cadDetectedLayers.map((layer, i) => (
                    <label key={i} className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-bold cursor-pointer hover:bg-slate-100">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={layer.selected}
                          onChange={e => {
                            const copy = [...cadDetectedLayers];
                            copy[i].selected = e.target.checked;
                            setCadDetectedLayers(copy);
                          }}
                          className="accent-[#007BC4]"
                        />
                        <span className="text-slate-800 dark:text-white font-mono">{layer.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-400 uppercase font-mono">{layer.category} ({layer.count} shapes)</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
              <button onClick={() => setIsCadImporterOpen(false)} className="px-4 py-2 text-xs font-bold border rounded-xl">Cancel</button>
              <button onClick={handleExecuteCadImport} className="px-5 py-2 text-xs font-bold bg-[#007BC4] text-white rounded-xl shadow-md">
                Convert & Import CAD Layers
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Version History Modal */}
      {isVersionHistoryOpen && currentFloor && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl animate-in fade-in">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800 mb-4">
              <div className="flex items-center gap-3">
                <History className="w-6 h-6 text-[#007BC4]" />
                <div>
                  <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Versioned Maps Timeline</h3>
                  <p className="text-xs text-slate-500">{currentFloor.name} map revision history and rollback controls</p>
                </div>
              </div>
              <button onClick={() => setIsVersionHistoryOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {currentFloor.versions.map(ver => (
                <div key={ver.id} className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm text-slate-900 dark:text-white">{ver.versionNumber}</span>
                      <span className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded-full ${ver.status === 'published' ? 'bg-emerald-100 text-emerald-800' : ver.status === 'draft' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-600'}`}>
                        {ver.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 font-medium">{ver.notes}</p>
                    <span className="text-[10px] text-slate-400">{ver.createdAt} • Author: {ver.author}</span>
                  </div>

                  {ver.status !== 'published' && (
                    <button onClick={() => handlePublishVersion(ver.id)} className="px-3 py-1.5 bg-[#007BC4] text-white rounded-lg text-xs font-bold shrink-0">
                      Publish & Activate
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <button onClick={handleCreateNewVersion} className="px-4 py-2 bg-[#007BC4] text-white font-bold rounded-xl text-xs flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Create New Draft Revision
              </button>
              <button onClick={() => setIsVersionHistoryOpen(false)} className="px-4 py-2 text-xs font-bold border rounded-xl">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Create Site Modal */}
      {isCreateSiteOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateSite} className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Create New Construction Site</h3>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Site Title</label>
              <input type="text" required placeholder="e.g. Highway Bridge Expansion" value={newSiteName} onChange={e => setNewSiteName(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-xs font-bold" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">General Contractor</label>
              <input type="text" value={newSiteContractor} onChange={e => setNewSiteContractor(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-xs font-bold" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Dimensions & Area</label>
              <input type="text" value={newSiteDimensions} onChange={e => setNewSiteDimensions(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-xs font-bold" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsCreateSiteOpen(false)} className="px-4 py-2 text-xs font-bold border rounded-xl">Cancel</button>
              <button type="submit" className="px-5 py-2 text-xs font-bold bg-[#007BC4] text-white rounded-xl">Create Site</button>
            </div>
          </form>
        </div>
      )}

      {/* Create Building Modal */}
      {isCreateBuildingOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateBuilding} className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Add Building to {currentSite.name}</h3>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Building Name</label>
              <input type="text" required placeholder="e.g. Building B - Energy Substation" value={newBldgName} onChange={e => setNewBldgName(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-xs font-bold" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsCreateBuildingOpen(false)} className="px-4 py-2 text-xs font-bold border rounded-xl">Cancel</button>
              <button type="submit" className="px-5 py-2 text-xs font-bold bg-[#007BC4] text-white rounded-xl">Add Building</button>
            </div>
          </form>
        </div>
      )}

      {/* Create Floor Modal */}
      {isCreateFloorOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleCreateFloor} className="bg-white dark:bg-slate-900 p-6 rounded-2xl max-w-md w-full shadow-2xl space-y-4">
            <h3 className="font-extrabold text-lg text-slate-900 dark:text-white">Add Floor Level to {currentBuilding?.name}</h3>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Floor Name</label>
              <input type="text" required placeholder="e.g. Level 3 Roof Deck" value={newFloorName} onChange={e => setNewFloorName(e.target.value)} className="w-full px-3 py-2 border rounded-xl text-xs font-bold" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Level Number</label>
              <input type="number" value={newFloorLevel} onChange={e => setNewFloorLevel(Number(e.target.value))} className="w-full px-3 py-2 border rounded-xl text-xs font-bold" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setIsCreateFloorOpen(false)} className="px-4 py-2 text-xs font-bold border rounded-xl">Cancel</button>
              <button type="submit" className="px-5 py-2 text-xs font-bold bg-[#007BC4] text-white rounded-xl">Add Floor</button>
            </div>
          </form>
        </div>
      )}

      {/* Hardware Device Configuration Modal */}
      {selectedDeviceForConfig && (
        <HardwareConfigModal
          isOpen={true}
          onClose={() => setSelectedDeviceForConfig(null)}
          device={selectedDeviceForConfig}
          onSave={(dev) => {
            const updated = hardwareDevices.map(d => d.id === dev.id ? dev : d);
            setHardwareDevices(updated);
            setSelectedDeviceForConfig(null);
          }}
          availableZones={Object.keys(customZones)}
        />
      )}

    </div>
  );
}
