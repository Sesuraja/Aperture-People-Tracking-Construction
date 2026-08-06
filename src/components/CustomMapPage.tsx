import React, { useState, useRef, useEffect } from 'react';
import { 
  Map as MapIcon, Plus, Trash2, Edit3, Save, Upload, Sliders, Radio, 
  Wrench, Truck, Camera, Thermometer, ShieldCheck, AlertTriangle, Box, Compass, RefreshCw, Check,
  Layers, MapPin, Eye, Settings, HelpCircle, HardHat
} from 'lucide-react';
import HardwareConfigModal, { HardwareDevice } from './HardwareConfigModal';
import { INITIAL_DEVICES, getBlueprintSvg } from './LiveFloorMap';
import { AssetItem, VehicleItem, CCTVCameraItem, EnvironmentalSensorItem, INITIAL_ASSETS, INITIAL_VEHICLES, INITIAL_INFRASTRUCTURE, INITIAL_CCTVS, INITIAL_ENV_SENSORS } from '../lib/trackingLayers';
import { doc, setDoc, deleteDoc, collection, onSnapshot } from '../lib/db';
import { db } from '../lib/firebase';

interface CustomMapPageProps {
  activeProject: string;
  setActiveProject: (id: string) => void;
}

export default function CustomMapPage({ activeProject, setActiveProject }: CustomMapPageProps) {
  const [projectProperties, setProjectProperties] = useState<Record<string, any>>(() => {
    try {
      const saved = localStorage.getItem('gao_project_properties');
      if (saved) return JSON.parse(saved);
    } catch (err) {
      console.warn('Failed to load project properties:', err);
    }
    return {
      'metro-tower': {
        id: 'metro-tower',
        name: 'Metro Commercial Tower Construction',
        contractor: 'BuildCorp General Contractors',
        dimensions: '200m x 150m (30,000 m²)',
        floorplanUrl: null,
        assets: INITIAL_ASSETS,
        vehicles: INITIAL_VEHICLES,
        infrastructure: INITIAL_INFRASTRUCTURE,
        cameras: INITIAL_CCTVS,
        envSensors: INITIAL_ENV_SENSORS,
        hardwareDevices: INITIAL_DEVICES,
      }
    };
  });

  const currentProj = projectProperties[activeProject] || projectProperties['metro-tower'] || {
    id: activeProject,
    name: 'Construction Site Active Project',
    contractor: 'Aperture EHS Operations',
    dimensions: '180m x 140m',
    floorplanUrl: null,
    assets: INITIAL_ASSETS,
    vehicles: INITIAL_VEHICLES,
    infrastructure: INITIAL_INFRASTRUCTURE,
    cameras: INITIAL_CCTVS,
    envSensors: INITIAL_ENV_SENSORS,
    hardwareDevices: INITIAL_DEVICES,
  };

  const [assets, setAssets] = useState<AssetItem[]>(currentProj.assets || INITIAL_ASSETS);
  const [vehicles, setVehicles] = useState<VehicleItem[]>(currentProj.vehicles || INITIAL_VEHICLES);
  const [cameras, setCameras] = useState<CCTVCameraItem[]>(currentProj.cameras || INITIAL_CCTVS);
  const [envSensors, setEnvSensors] = useState<EnvironmentalSensorItem[]>(currentProj.envSensors || INITIAL_ENV_SENSORS);
  const [hardwareDevices, setHardwareDevices] = useState<HardwareDevice[]>(currentProj.hardwareDevices || INITIAL_DEVICES);
  const [customFloorplan, setCustomFloorplan] = useState<string | null>(currentProj.floorplanUrl || null);
  
  const [customZones, setCustomZones] = useState<Record<string, any>>(() => {
    return currentProj.customZones || {
      'Excavation Shaft': { x: 10, y: 15, width: 34, height: 62, category: 'EXCAVATION & SHORING', hazardLevel: 'warning', maxCapacity: 4 },
      'Tower Core': { x: 51, y: 25, width: 32, height: 50, category: 'CONCRETE REINFORCEMENT', hazardLevel: 'standard', maxCapacity: 10 },
      'Crane Swing Zone': { x: 80, y: 5, width: 16, height: 42, category: 'CRANE SWING RADIUS', hazardLevel: 'critical', maxCapacity: 3 },
      'High Voltage Area': { x: 46, y: 5, width: 14, height: 16, category: 'SUBSTATION PERIMETER', hazardLevel: 'critical', maxCapacity: 1 },
      'Muster Point A': { x: 2, y: 10, width: 8, height: 12, category: 'MUSTER POINT', hazardLevel: 'standard', maxCapacity: 30 }
    };
  });

  const [activeSidebarTab, setActiveSidebarTab] = useState<'inventory' | 'zones'>('inventory');

  useEffect(() => {
    const unsubAssets = onSnapshot(collection(db, 'assets'), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const filtered = items.filter(a => a.projectId === activeProject);
      if (filtered.length > 0) setAssets(filtered);
    });
    const unsubVehicles = onSnapshot(collection(db, 'vehicles'), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const filtered = items.filter(v => v.projectId === activeProject);
      if (filtered.length > 0) setVehicles(filtered);
    });
    const unsubCameras = onSnapshot(collection(db, 'cameras'), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const filtered = items.filter(c => c.projectId === activeProject);
      if (filtered.length > 0) setCameras(filtered);
    });
    const unsubSensors = onSnapshot(collection(db, 'sensors'), (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      const filtered = items.filter(s => s.projectId === activeProject);
      if (filtered.length > 0) setEnvSensors(filtered);
    });

    const unsubProject = onSnapshot(doc(db, 'projects', activeProject), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.customZones) setCustomZones(data.customZones);
        if (data.hardwareDevices) setHardwareDevices(data.hardwareDevices);
        if (data.floorplanUrl) setCustomFloorplan(data.floorplanUrl);
      }
    });

    const p = projectProperties[activeProject];
    if (p) {
      setHardwareDevices(p.hardwareDevices || INITIAL_DEVICES);
      setCustomFloorplan(p.floorplanUrl || null);
      if (p.customZones) setCustomZones(p.customZones);
    }

    return () => {
      unsubAssets(); unsubVehicles(); unsubCameras(); unsubSensors(); unsubProject();
    };
  }, [activeProject]);

  const saveToDb = async (updated: any) => {
    const nextProj = { ...currentProj, ...updated };
    const nextMap = { ...projectProperties, [activeProject]: nextProj };
    setProjectProperties(nextMap);
    localStorage.setItem('gao_project_properties', JSON.stringify(nextMap));
    window.dispatchEvent(new Event('gao_project_updated'));
    
    try {
      // Save project metadata including customZones & hardwareDevices to synchronize with tracking map
      await setDoc(doc(db, 'projects', activeProject), {
        id: activeProject,
        name: nextProj.name,
        contractor: nextProj.contractor,
        dimensions: nextProj.dimensions,
        floorplanUrl: nextProj.floorplanUrl,
        customZones: nextProj.customZones || null,
        hardwareDevices: nextProj.hardwareDevices || null,
      }, { merge: true });

      // If we have updated collections, sync them individually to respective collections
      if (updated.assets) {
        for (const asset of updated.assets) {
          await setDoc(doc(db, 'assets', asset.id), { ...asset, projectId: activeProject });
        }
      }
      if (updated.vehicles) {
        for (const vehicle of updated.vehicles) {
          await setDoc(doc(db, 'vehicles', vehicle.id), { ...vehicle, projectId: activeProject });
        }
      }
      if (updated.cameras) {
        for (const camera of updated.cameras) {
          await setDoc(doc(db, 'cameras', camera.id), { ...camera, projectId: activeProject });
        }
      }
      if (updated.envSensors) {
        for (const sensor of updated.envSensors) {
          await setDoc(doc(db, 'sensors', sensor.id), { ...sensor, projectId: activeProject });
        }
      }
    } catch (err) {
      console.warn('Firestore sync failed:', err);
    }
  };

  const mapRef = useRef<HTMLDivElement>(null);
  const [draggedItem, setDraggedItem] = useState<{ id: string; type: 'asset' | 'vehicle' | 'camera' | 'sensor' | 'device' } | null>(null);
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newItemType, setNewItemType] = useState<'asset' | 'vehicle' | 'camera' | 'sensor' | 'device'>('asset');
  const [newItemName, setNewItemName] = useState('');
  const [newItemZone, setNewItemZone] = useState('Deep Excavation Pit (Basement B3)');

  // Selected device for full configuration modal
  const [selectedDeviceForConfig, setSelectedDeviceForConfig] = useState<HardwareDevice | null>(null);

  // Custom Site Layout Zone creation & editing state
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [editingZoneKey, setEditingZoneKey] = useState<string | null>(null);
  const [zoneFormName, setZoneFormName] = useState('');
  const [zoneFormCategory, setZoneFormCategory] = useState('WORK_ZONE');
  const [zoneFormHazard, setZoneFormHazard] = useState('standard');
  const [zoneFormCapacity, setZoneFormCapacity] = useState(10);
  const [zoneFormX, setZoneFormX] = useState(30);
  const [zoneFormY, setZoneFormY] = useState(30);
  const [zoneFormWidth, setZoneFormWidth] = useState(25);
  const [zoneFormHeight, setZoneFormHeight] = useState(25);

  const handleMouseDown = (id: string, type: 'asset' | 'vehicle' | 'camera' | 'sensor' | 'device') => {
    setDraggedItem({ id, type });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!draggedItem || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = Math.max(5, Math.min(95, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(5, Math.min(95, ((e.clientY - rect.top) / rect.height) * 100));

    setDragPositions(prev => ({
      ...prev,
      [draggedItem.id]: { x, y }
    }));
  };

  const handleMouseUp = () => {
    if (!draggedItem) return;
    const pos = dragPositions[draggedItem.id];
    if (pos) {
      if (draggedItem.type === 'device') {
        const updated = hardwareDevices.map(d => d.id === draggedItem.id ? { ...d, x: pos.x, y: pos.y } : d);
        setHardwareDevices(updated);
        saveToDb({ hardwareDevices: updated });
      } else if (draggedItem.type === 'asset') {
        const updated = assets.map(a => a.id === draggedItem.id ? { ...a, x: pos.x, y: pos.y } : a);
        setAssets(updated);
        saveToDb({ assets: updated });
      } else if (draggedItem.type === 'vehicle') {
        const updated = vehicles.map(v => v.id === draggedItem.id ? { ...v, x: pos.x, y: pos.y } : v);
        setVehicles(updated);
        saveToDb({ vehicles: updated });
      } else if (draggedItem.type === 'camera') {
        const updated = cameras.map(c => c.id === draggedItem.id ? { ...c, x: pos.x, y: pos.y } : c);
        setCameras(updated);
        saveToDb({ cameras: updated });
      } else if (draggedItem.type === 'sensor') {
        const updated = envSensors.map(s => s.id === draggedItem.id ? { ...s, x: pos.x, y: pos.y } : s);
        setEnvSensors(updated);
        saveToDb({ envSensors: updated });
      }
      setSuccessMsg('Coordinates updated & synchronized successfully!');
      setTimeout(() => setSuccessMsg(null), 3000);
    }
    setDraggedItem(null);
  };

  const handleUploadBlueprint = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      setCustomFloorplan(url);
      saveToDb({ floorplanUrl: url });
    };
    reader.readAsDataURL(file);
  };

  const handleCreateNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    const id = `CUSTOM-${Math.floor(1000 + Math.random() * 9000)}`;

    if (newItemType === 'asset') {
      const item: AssetItem = { id, name: newItemName, category: 'Heavy Equipment', location: newItemZone, assignedWorker: 'Assigned Crew', status: 'Operating', utilization: 85, lastMovement: 'Just now', battery: 95, x: 50, y: 50 };
      const updated = [item, ...assets];
      setAssets(updated);
      saveToDb({ assets: updated });
    } else if (newItemType === 'vehicle') {
      const item: VehicleItem = { id, name: newItemName, type: 'Hydraulic Excavator', operator: 'Assigned Crew', location: newItemZone, speed: 10, direction: 45, status: 'Active', fuel: 90, x: 50, y: 50 };
      const updated = [item, ...vehicles];
      setVehicles(updated);
      saveToDb({ vehicles: updated });
    } else if (newItemType === 'camera') {
      const item: CCTVCameraItem = { id, name: newItemName, zone: newItemZone, status: 'Online', aiStatus: 'Active', aiFeatures: ['PPE Hardhat Detection'], recentEvent: 'Normal scan', streamResolution: '1080p', x: 50, y: 50, angle: 90 };
      const updated = [item, ...cameras];
      setCameras(updated);
      saveToDb({ cameras: updated });
    } else if (newItemType === 'sensor') {
      const item: EnvironmentalSensorItem = { id, name: newItemName, zone: newItemZone, temperature: 24, gasLevel: 0, dustPM25: 12, noiseDb: 65, humidity: 45, status: 'Normal', x: 50, y: 50 };
      const updated = [item, ...envSensors];
      setEnvSensors(updated);
      saveToDb({ envSensors: updated });
    } else if (newItemType === 'device') {
      const item: HardwareDevice = { id, name: newItemName, macAddress: `GAO-UHF-${Math.floor(1000 + Math.random() * 9000)}`, ipAddress: '192.168.1.150', port: 8080, x: 50, y: 50, zone: newItemZone, type: 'UHF RFID Gate Portal', orientation: 'horizontal', powerDbm: 28, antennaGainDbi: 10, frequencyBand: 'US 902-928 MHz', scanIntervalMs: 250, rssiThreshold: -75, status: 'Online', alertsEnabled: { unauthorizedAccess: true, ppeViolation: true, loiteringDwell: false } };
      const updated = [...hardwareDevices, item];
      setHardwareDevices(updated);
      saveToDb({ hardwareDevices: updated });
    }

    setNewItemName('');
    setIsAddModalOpen(false);
    setSuccessMsg('Successfully added new custom asset/hardware to site map!');
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleDeleteItem = async (id: string, type: 'asset' | 'vehicle' | 'camera' | 'sensor' | 'device') => {
    try {
      if (type === 'asset') {
        const updated = assets.filter(a => a.id !== id);
        setAssets(updated);
        saveToDb({ assets: updated });
        await deleteDoc(doc(db, 'assets', id));
      } else if (type === 'vehicle') {
        const updated = vehicles.filter(v => v.id !== id);
        setVehicles(updated);
        saveToDb({ vehicles: updated });
        await deleteDoc(doc(db, 'vehicles', id));
      } else if (type === 'camera') {
        const updated = cameras.filter(c => c.id !== id);
        setCameras(updated);
        saveToDb({ cameras: updated });
        await deleteDoc(doc(db, 'cameras', id));
      } else if (type === 'sensor') {
        const updated = envSensors.filter(s => s.id !== id);
        setEnvSensors(updated);
        saveToDb({ envSensors: updated });
        await deleteDoc(doc(db, 'sensors', id));
      } else if (type === 'device') {
        const updated = hardwareDevices.filter(d => d.id !== id);
        setHardwareDevices(updated);
        saveToDb({ hardwareDevices: updated });
      }
      setSuccessMsg('Item removed and synchronized across system.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.warn('Delete failed:', err);
    }
  };

  const handleSaveHardwareDevice = (updatedDevice: HardwareDevice) => {
    const updated = hardwareDevices.map(d => d.id === updatedDevice.id ? updatedDevice : d);
    setHardwareDevices(updated);
    saveToDb({ hardwareDevices: updated });
    setSuccessMsg(`Reader "${updatedDevice.name}" connectivity parameters & coverage updated successfully!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleSaveZone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!zoneFormName.trim()) return;

    const nextZones = { ...customZones };
    
    if (editingZoneKey && editingZoneKey !== zoneFormName) {
      delete nextZones[editingZoneKey];
    }

    nextZones[zoneFormName] = {
      x: Number(zoneFormX),
      y: Number(zoneFormY),
      width: Number(zoneFormWidth),
      height: Number(zoneFormHeight),
      category: zoneFormCategory,
      hazardLevel: zoneFormHazard,
      maxCapacity: Number(zoneFormCapacity)
    };

    setCustomZones(nextZones);
    saveToDb({ customZones: nextZones });
    setIsZoneModalOpen(false);
    setSuccessMsg(`Site layout element "${zoneFormName}" successfully synchronized with Live Tracking!`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const handleDeleteZone = (zName: string) => {
    const nextZones = { ...customZones };
    delete nextZones[zName];
    setCustomZones(nextZones);
    saveToDb({ customZones: nextZones });
    setSuccessMsg(`Layout zone "${zName}" removed and synchronized.`);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900 overflow-y-auto p-6 font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2.5 bg-blue-50 dark:bg-blue-900/40 text-[#007BC4] rounded-xl">
              <MapIcon size={22} />
            </span>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Custom Construction Site Map & Asset Studio</h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Drag and drop custom assets, vehicles, CCTV security cameras, environmental sensors, and UHF RFID hardware gateways onto your interactive construction site map.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer transition shadow-sm">
            <Upload size={16} />
            Upload Custom Site Map
            <input type="file" accept="image/*" onChange={handleUploadBlueprint} className="hidden" />
          </label>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#007BC4] hover:bg-[#00629c] text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-500/20"
          >
            <Plus size={16} />
            Add Custom Asset / Hardware
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="mb-4 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 text-xs font-bold rounded-xl flex items-center gap-3 shadow-sm animate-in fade-in">
          <Check size={16} className="text-emerald-600" />
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 items-start">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm flex flex-col gap-4">
          <div className="flex border-b border-slate-200 dark:border-slate-700 pb-2 gap-4">
            <button
              onClick={() => setActiveSidebarTab('inventory')}
              className={`pb-1.5 text-xs font-extrabold uppercase tracking-wider transition-all relative ${activeSidebarTab === 'inventory' ? 'text-[#007BC4]' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}
            >
              Inventory ({assets.length + vehicles.length + cameras.length + envSensors.length + hardwareDevices.length})
              {activeSidebarTab === 'inventory' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007BC4] rounded-full" />}
            </button>
            <button
              onClick={() => setActiveSidebarTab('zones')}
              className={`pb-1.5 text-xs font-extrabold uppercase tracking-wider transition-all relative ${activeSidebarTab === 'zones' ? 'text-[#007BC4]' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}
            >
              Site Zones ({Object.keys(customZones).length})
              {activeSidebarTab === 'zones' && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007BC4] rounded-full" />}
            </button>
          </div>
          
          <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-1">
            {activeSidebarTab === 'inventory' && (
              <>
                <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">RFID Readers & Gateways</div>
                {hardwareDevices.map(d => (
                  <div key={d.id} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between group">
                    <div className="flex items-center gap-2.5">
                      <span className="p-2 bg-purple-50 dark:bg-purple-950/50 text-purple-600 rounded-lg"><Radio size={14} /></span>
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-white truncate max-w-[110px]">{d.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{d.zone}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => setSelectedDeviceForConfig(d)} 
                        title="Configure RFID Hardware Gateway Settings"
                        className="text-slate-400 hover:text-purple-600 transition p-1"
                      >
                        <Settings size={13} />
                      </button>
                      <button onClick={() => handleDeleteItem(d.id, 'device')} className="text-slate-400 hover:text-red-500 transition p-1"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}

                <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mt-3 mb-1">Tracked Machinery Assets</div>
                {assets.map(a => (
                  <div key={a.id} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between group">
                    <div className="flex items-center gap-2.5">
                      <span className="p-2 bg-blue-50 dark:bg-blue-950/50 text-blue-600 rounded-lg"><Wrench size={14} /></span>
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-white truncate max-w-[130px]">{a.name}</div>
                        <div className="text-[10px] text-slate-400">{a.location}</div>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteItem(a.id, 'asset')} className="text-slate-400 hover:text-red-500 transition p-1"><Trash2 size={14} /></button>
                  </div>
                ))}

                <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mt-3 mb-1">Fleet Vehicles</div>
                {vehicles.map(v => (
                  <div key={v.id} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between group">
                    <div className="flex items-center gap-2.5">
                      <span className="p-2 bg-amber-50 dark:bg-amber-950/50 text-amber-600 rounded-lg"><Truck size={14} /></span>
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-white truncate max-w-[130px]">{v.name}</div>
                        <div className="text-[10px] text-slate-400">{v.location}</div>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteItem(v.id, 'vehicle')} className="text-slate-400 hover:text-red-500 transition p-1"><Trash2 size={14} /></button>
                  </div>
                ))}

                <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mt-3 mb-1">CCTV & Environment Sensors</div>
                {cameras.map(c => (
                  <div key={c.id} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between group">
                    <div className="flex items-center gap-2.5">
                      <span className="p-2 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 rounded-lg"><Camera size={14} /></span>
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-white truncate max-w-[130px]">{c.name}</div>
                        <div className="text-[10px] text-slate-400">{c.zone}</div>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteItem(c.id, 'camera')} className="text-slate-400 hover:text-red-500 transition p-1"><Trash2 size={14} /></button>
                  </div>
                ))}
              </>
            )}

            {activeSidebarTab === 'zones' && (
              <>
                <button
                  onClick={() => {
                    setEditingZoneKey(null);
                    setZoneFormName('');
                    setZoneFormCategory('WORK_ZONE');
                    setZoneFormHazard('standard');
                    setZoneFormCapacity(10);
                    setZoneFormX(35);
                    setZoneFormY(35);
                    setZoneFormWidth(25);
                    setZoneFormHeight(25);
                    setIsZoneModalOpen(true);
                  }}
                  className="mb-3 w-full py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition"
                >
                  <Plus size={14} />
                  Add Layout Zone Element
                </button>

                {Object.entries(customZones).map(([zName, bounds]: [string, any]) => {
                  const isHazard = bounds.hazardLevel === 'critical';
                  const isWarning = bounds.hazardLevel === 'warning';
                  
                  let colorBadge = 'bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-400';
                  if (bounds.category === 'MUSTER POINT' || bounds.category?.toLowerCase().includes('emergency')) {
                    colorBadge = 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600';
                  } else if (isHazard) {
                    colorBadge = 'bg-rose-50 dark:bg-rose-950/30 text-rose-600';
                  } else if (isWarning) {
                    colorBadge = 'bg-amber-50 dark:bg-amber-950/30 text-amber-600';
                  }

                  return (
                    <div key={zName} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between group">
                      <div className="flex flex-col min-w-0 flex-1 pr-2">
                        <div className="text-xs font-black text-slate-800 dark:text-white truncate">{zName}</div>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className={`px-1.5 py-0.5 text-[8px] font-extrabold uppercase rounded ${colorBadge}`}>
                            {bounds.category || 'WORK ZONE'}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            Cap: {bounds.maxCapacity || 10}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => {
                            setEditingZoneKey(zName);
                            setZoneFormName(zName);
                            setZoneFormCategory(bounds.category || 'WORK_ZONE');
                            setZoneFormHazard(bounds.hazardLevel || 'standard');
                            setZoneFormCapacity(bounds.maxCapacity || 10);
                            setZoneFormX(bounds.x);
                            setZoneFormY(bounds.y);
                            setZoneFormWidth(bounds.width);
                            setZoneFormHeight(bounds.height);
                            setIsZoneModalOpen(true);
                          }}
                          className="text-slate-400 hover:text-sky-500 transition p-1"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button 
                          onClick={() => handleDeleteZone(zName)} 
                          className="text-slate-400 hover:text-red-500 transition p-1"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm flex flex-col h-[700px] relative overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <span className="text-xs font-bold text-[#007BC4] uppercase tracking-wider">Interactive Drag & Drop Studio</span>
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Drag items across the site map to update real-time coordinates</h3>
            </div>
            <div className="text-xs text-slate-400 font-mono">Project: {currentProj.name}</div>
          </div>

          <div 
            ref={mapRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="flex-1 relative rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 overflow-hidden shadow-inner select-none cursor-default"
          >
            {customFloorplan ? (
              <img src={customFloorplan} alt="Custom Blueprint" className="absolute inset-0 w-full h-full object-cover opacity-85" />
            ) : (
              <img 
                src={getBlueprintSvg(activeProject, currentProj.name, currentProj.contractor, currentProj.dimensions)} 
                alt="Site Blueprint" 
                className="absolute inset-0 w-full h-full object-cover opacity-60 pointer-events-none" 
              />
            )}

            {/* Custom Zones Overlays on Editor Map */}
            {Object.entries(customZones).map(([zName, bounds]: [string, any]) => {
              const isHazard = bounds.hazardLevel === 'critical';
              const isWarning = bounds.hazardLevel === 'warning';
              
              let zoneColor = 'border-sky-500 bg-sky-500/10 text-sky-400 dark:text-sky-300';
              if (bounds.category === 'MUSTER POINT' || bounds.category?.toLowerCase().includes('emergency')) {
                zoneColor = 'border-emerald-500 bg-emerald-500/10 text-emerald-400 dark:text-emerald-300';
              } else if (bounds.category?.toLowerCase().includes('road') || bounds.category?.toLowerCase().includes('lane')) {
                zoneColor = 'border-slate-400 bg-slate-400/10 text-slate-500 dark:text-slate-400';
              } else if (isHazard) {
                zoneColor = 'border-rose-500 bg-rose-500/15 text-rose-500 dark:text-rose-400';
              } else if (isWarning) {
                zoneColor = 'border-amber-500 bg-amber-500/10 text-amber-500 dark:text-amber-400';
              }

              return (
                <div
                  key={`editor-zone-${zName}`}
                  className={`absolute border-2 border-dashed rounded-xl p-2.5 flex flex-col justify-between group pointer-events-none ${zoneColor}`}
                  style={{
                    left: `${bounds.x}%`,
                    top: `${bounds.y}%`,
                    width: `${bounds.width}%`,
                    height: `${bounds.height}%`
                  }}
                >
                  <div className="text-[10px] font-black uppercase tracking-wider truncate">
                    {zName}
                  </div>
                  <div className="text-[8px] font-mono opacity-80 mt-auto flex justify-between">
                    <span>{bounds.category || 'ZONE'}</span>
                    <span>Cap: {bounds.maxCapacity || 10}</span>
                  </div>
                </div>
              );
            })}

            {hardwareDevices.map(d => {
              const pos = dragPositions[d.id] || { x: d.x, y: d.y };
              const isDragging = draggedItem?.id === d.id;
              return (
                <div
                  key={d.id}
                  onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(d.id, 'device'); }}
                  onDoubleClick={() => setSelectedDeviceForConfig(d)}
                  className={`absolute z-30 cursor-grab active:cursor-grabbing p-2.5 rounded-xl shadow-lg border backdrop-blur-md flex items-center gap-2 transition-transform ${isDragging ? 'scale-110 z-50 ring-4 ring-purple-500/30' : 'hover:scale-105'} ${d.status === 'Online' ? 'bg-purple-900/90 text-white border-purple-700' : 'bg-slate-900/90 text-slate-300 border-slate-700'}`}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)', transition: isDragging ? 'none' : 'left 0.8s ease-out, top 0.8s ease-out' }}
                >
                  <Radio size={14} className="text-purple-300 animate-pulse" />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold leading-tight">{d.name}</span>
                    <span className="text-[9px] text-purple-200 font-mono">{d.zone}</span>
                  </div>
                </div>
              );
            })}

            {assets.map(a => {
              const pos = dragPositions[a.id] || { x: a.x, y: a.y };
              const isDragging = draggedItem?.id === a.id;
              return (
                <div
                  key={a.id}
                  onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(a.id, 'asset'); }}
                  className={`absolute z-30 cursor-grab active:cursor-grabbing p-2.5 rounded-xl shadow-lg border backdrop-blur-md flex items-center gap-2 transition-transform ${isDragging ? 'scale-110 z-50 ring-4 ring-blue-500/30' : 'hover:scale-105'} bg-blue-900/90 text-white border-blue-700`}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)', transition: isDragging ? 'none' : 'left 0.8s ease-out, top 0.8s ease-out' }}
                >
                  <Wrench size={14} className="text-blue-300" />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold leading-tight">{a.name}</span>
                    <span className="text-[9px] text-blue-200">{a.location}</span>
                  </div>
                </div>
              );
            })}

            {vehicles.map(v => {
              const pos = dragPositions[v.id] || { x: v.x, y: v.y };
              const isDragging = draggedItem?.id === v.id;
              return (
                <div
                  key={v.id}
                  onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(v.id, 'vehicle'); }}
                  className={`absolute z-30 cursor-grab active:cursor-grabbing p-2.5 rounded-xl shadow-lg border backdrop-blur-md flex items-center gap-2 transition-transform ${isDragging ? 'scale-110 z-50 ring-4 ring-amber-500/30' : 'hover:scale-105'} bg-amber-900/90 text-white border-amber-700`}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)', transition: isDragging ? 'none' : 'left 0.8s ease-out, top 0.8s ease-out' }}
                >
                  <Truck size={14} className="text-amber-300" />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold leading-tight">{v.name}</span>
                    <span className="text-[9px] text-amber-200">{v.location}</span>
                  </div>
                </div>
              );
            })}

            {cameras.map(c => {
              const pos = dragPositions[c.id] || { x: c.x, y: c.y };
              const isDragging = draggedItem?.id === c.id;
              return (
                <div
                  key={c.id}
                  onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(c.id, 'camera'); }}
                  className={`absolute z-30 cursor-grab active:cursor-grabbing p-2.5 rounded-xl shadow-lg border backdrop-blur-md flex items-center gap-2 transition-transform ${isDragging ? 'scale-110 z-50 ring-4 ring-emerald-500/30' : 'hover:scale-105'} bg-emerald-900/90 text-white border-emerald-700`}
                  style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: 'translate(-50%, -50%)', transition: isDragging ? 'none' : 'left 0.8s ease-out, top 0.8s ease-out' }}
                >
                  <Camera size={14} className="text-emerald-300" />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold leading-tight">{c.name}</span>
                    <span className="text-[9px] text-emerald-200">{c.zone}</span>
                  </div>
                </div>
              );
            })}

          </div>
        </div>

      </div>

      {/* Reader Parameters Config Modal */}
      {selectedDeviceForConfig && (
        <HardwareConfigModal
          isOpen={true}
          onClose={() => setSelectedDeviceForConfig(null)}
          device={selectedDeviceForConfig}
          onSave={handleSaveHardwareDevice}
          availableZones={Object.keys(customZones)}
        />
      )}

      {/* Site Layout Zone Modal */}
      {isZoneModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in-95 overflow-y-auto max-h-[90vh]">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
              {editingZoneKey ? `Edit Site Zone: ${editingZoneKey}` : 'Add Construction Site Layout Zone'}
            </h3>
            <form onSubmit={handleSaveZone} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">Zone Name / Identifier</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Steel Staging Area B"
                  value={zoneFormName}
                  onChange={e => setZoneFormName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">Category Type</label>
                  <select 
                    value={zoneFormCategory} 
                    onChange={e => setZoneFormCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white"
                  >
                    <option value="EXCAVATION & SHORING">EXCAVATION & SHORING</option>
                    <option value="CONCRETE REINFORCEMENT">CONCRETE REINFORCEMENT</option>
                    <option value="CRANE SWING RADIUS">CRANE SWING RADIUS</option>
                    <option value="SUBSTATION PERIMETER">SUBSTATION PERIMETER</option>
                    <option value="MUSTER POINT">MUSTER POINT (SAFE ZONE)</option>
                    <option value="BUILDING">BUILDING / TOWER BLOCK</option>
                    <option value="FLOOR">FLOOR LEVEL</option>
                    <option value="WORK_ZONE">GENERAL WORK ZONE</option>
                    <option value="ROAD">ACCESS ROAD / LANE</option>
                    <option value="RESTRICTED_AREA">RESTRICTED EXCLUSION ZONE</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">Hazard Level</label>
                  <select 
                    value={zoneFormHazard} 
                    onChange={e => setZoneFormHazard(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white"
                  >
                    <option value="standard">Standard (No Threat)</option>
                    <option value="warning">Warning (PPE Required)</option>
                    <option value="critical">Critical (Exclusion/Danger Area)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">Max Capacity (Personnel)</label>
                  <input 
                    type="number" 
                    min="1"
                    required
                    value={zoneFormCapacity}
                    onChange={e => setZoneFormCapacity(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white"
                  />
                </div>
                <div className="flex items-center pt-5">
                  <p className="text-[10px] text-slate-400 font-medium">Triggers collision alerts on over-occupancy.</p>
                </div>
              </div>

              <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
                <span className="block text-xs font-black uppercase tracking-wider text-slate-500 mb-2">Geometric Placement (Percentage %)</span>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">Left Position (X %)</label>
                    <input 
                      type="number" 
                      min="0"
                      max="90"
                      required
                      value={zoneFormX}
                      onChange={e => setZoneFormX(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">Top Position (Y %)</label>
                    <input 
                      type="number" 
                      min="0"
                      max="90"
                      required
                      value={zoneFormY}
                      onChange={e => setZoneFormY(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">Width (Horizontal %)</label>
                    <input 
                      type="number" 
                      min="5"
                      max="95"
                      required
                      value={zoneFormWidth}
                      onChange={e => setZoneFormWidth(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">Height (Vertical %)</label>
                    <input 
                      type="number" 
                      min="5"
                      max="95"
                      required
                      value={zoneFormHeight}
                      onChange={e => setZoneFormHeight(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-4">
                <button 
                  type="button" 
                  onClick={() => setIsZoneModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-[#007BC4] hover:bg-[#00629c] text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20"
                >
                  Synchronize Zone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Add Custom Asset or Hardware Gateway</h3>
            <form onSubmit={handleCreateNewItem} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">Item Category Type</label>
                <select 
                  value={newItemType} 
                  onChange={e => setNewItemType(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white"
                >
                  <option value="asset">Heavy Tool / Machinery Asset</option>
                  <option value="vehicle">Heavy Equipment Vehicle</option>
                  <option value="camera">AI CCTV Security Camera</option>
                  <option value="sensor">Environmental Sensor</option>
                  <option value="device">UHF RFID Gateway / BLE Beacon</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">Name / Identifier</label>
                <input 
                  type="text" 
                  required
                  placeholder="e.g. Tower Crane 3 Crawler"
                  value={newItemName}
                  onChange={e => setNewItemName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1">Assigned Zone</label>
                <input 
                  type="text" 
                  value={newItemZone}
                  onChange={e => setNewItemZone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 mt-4">
                <button 
                  type="button" 
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  className="px-5 py-2 bg-[#007BC4] hover:bg-[#00629c] text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20"
                >
                  Create & Place on Map
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
