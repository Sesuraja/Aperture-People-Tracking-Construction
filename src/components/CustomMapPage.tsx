import React, { useState, useRef, useEffect } from 'react';
import { 
  Map as MapIcon, Plus, Trash2, Edit3, Save, Upload, Sliders, Radio, 
  Wrench, Truck, Camera, Thermometer, ShieldCheck, AlertTriangle, Box, Compass, RefreshCw, Check
} from 'lucide-react';
import { HardwareDevice } from './HardwareConfigModal';
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

    const p = projectProperties[activeProject];
    if (p) {
      setHardwareDevices(p.hardwareDevices || INITIAL_DEVICES);
      setCustomFloorplan(p.floorplanUrl || null);
    }

    return () => {
      unsubAssets(); unsubVehicles(); unsubCameras(); unsubSensors();
    };
  }, [activeProject]);

  const saveToDb = async (updated: any) => {
    const nextProj = { ...currentProj, ...updated };
    const nextMap = { ...projectProperties, [activeProject]: nextProj };
    setProjectProperties(nextMap);
    localStorage.setItem('gao_project_properties', JSON.stringify(nextMap));
    window.dispatchEvent(new Event('gao_project_updated'));
    
    try {
      // Save project metadata
      await setDoc(doc(db, 'projects', activeProject), {
        id: activeProject,
        name: nextProj.name,
        contractor: nextProj.contractor,
        dimensions: nextProj.dimensions,
        floorplanUrl: nextProj.floorplanUrl
      }, { merge: true });

      // If we have updated collections, sync them individually to respective collections
      // This ensures real-time listeners on individual collections (assets, vehicles, etc) work
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
        // devices aren't in a separate collection yet but good to have
      }
      setSuccessMsg('Item removed and synchronized across system.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      console.warn('Delete failed:', err);
    }
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
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Site Inventory & Hardware ({assets.length + vehicles.length + cameras.length + envSensors.length + hardwareDevices.length})</h2>
          
          <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-1">
            {hardwareDevices.map(d => (
              <div key={d.id} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between group">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 bg-purple-50 dark:bg-purple-950/50 text-purple-600 rounded-lg"><Radio size={14} /></span>
                  <div>
                    <div className="text-xs font-bold text-slate-800 dark:text-white truncate max-w-[130px]">{d.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{d.macAddress}</div>
                  </div>
                </div>
                <button onClick={() => handleDeleteItem(d.id, 'device')} className="text-slate-400 hover:text-red-500 transition p-1"><Trash2 size={14} /></button>
              </div>
            ))}

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

            {hardwareDevices.map(d => {
              const pos = dragPositions[d.id] || { x: d.x, y: d.y };
              const isDragging = draggedItem?.id === d.id;
              return (
                <div
                  key={d.id}
                  onMouseDown={(e) => { e.stopPropagation(); handleMouseDown(d.id, 'device'); }}
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
