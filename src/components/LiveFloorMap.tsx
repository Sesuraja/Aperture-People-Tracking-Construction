import { motion, AnimatePresence } from 'motion/react';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
  Radio, User, AlertTriangle, ShieldCheck, Truck, HardHat, Camera, Thermometer,
  Layers, Navigation, Maximize2, ZoomIn, ZoomOut, RotateCcw, Ruler, Box, BarChart3, Flame
} from 'lucide-react';
import { SelectedEntity } from './LiveTrackingContextDrawer';
import { Person, Asset, Vehicle, CameraDevice, EnvSensor } from '../types';

export interface ReaderDevice { id: string; name: string; x: number; y: number; range: number; health: number; status: 'online' | 'offline'; }
export interface AccessGate { id: string; name: string; x: number; y: number; status: 'locked' | 'unlocked'; }
export interface MaterialAsset { id: string; name: string; type: string; x: number; y: number; }

export type MapMode = 'standard' | 'bim' | 'satellite' | 'heatmap' | 'coverage' | 'evacuation' | 'asset' | 'hardware' | 'productivity' | 'security' | 'inventory' | 'environment';

export function getBlueprintSvg(projectId: string, title: string, contractor: string, dimensions: string, mode: MapMode = 'standard'): string {
  const isSatellite = mode === 'satellite';
  const isBim = mode === 'bim';
  const isSecurity = mode === 'security';

  const svg = `
    <svg width="1000" height="700" viewBox="0 0 1000 700" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="blueprintGrid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="${isSatellite ? 'rgba(56,189,248,0.1)' : 'rgba(0,123,196,0.1)'}" stroke-width="0.8"/>
        </pattern>
        <pattern id="blueprintSubGrid" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M 8 0 L 0 0 0 8" fill="none" stroke="${isSatellite ? 'rgba(56,189,248,0.05)' : 'rgba(0,123,196,0.03)'}" stroke-width="0.4"/>
        </pattern>
        <pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(100,116,139,0.1)" stroke-width="1" />
        </pattern>
        <pattern id="hazardStripes" width="20" height="20" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="10" height="20" fill="rgba(234,179,8,0.1)" />
          <rect x="10" width="10" height="20" fill="rgba(15,23,42,0.05)" />
        </pattern>
      </defs>
      
      <rect width="100%" height="100%" fill="${isSatellite ? '#020617' : isBim ? '#f8fafc' : isSecurity ? '#0f172a' : '#ffffff'}"/>
      <rect width="100%" height="100%" fill="url(#blueprintSubGrid)"/>
      <rect width="100%" height="100%" fill="url(#blueprintGrid)"/>

      <!-- Site Foundation & Structural Elements -->
      <g opacity="${isSatellite ? '0.2' : isSecurity ? '0.3' : '1'}">
        <!-- Site Boundary -->
        <path d="M 50 50 L 950 50 L 950 650 L 50 650 Z" fill="none" stroke="${isSecurity ? '#334155' : '#64748b'}" stroke-width="2" stroke-dasharray="12,6" />
        
        <!-- Main Structure Slab -->
        <path d="M 150 100 L 850 100 L 850 600 L 150 600 Z" fill="url(#hatch)" stroke="#334155" stroke-width="3" />
        
        <!-- Hazard Zones -->
        <rect x="780" y="50" width="170" height="250" fill="url(#hazardStripes)" stroke="#eab308" stroke-width="1" stroke-dasharray="4,2" />
        
        <!-- Internal Core Walls -->
        <rect x="400" y="250" width="200" height="200" fill="white" stroke="#1e293b" stroke-width="3" />
        <path d="M 400 350 L 600 350 M 500 250 L 500 450" stroke="#475569" stroke-width="1" stroke-dasharray="6,3" />
        
        <!-- Staircases -->
        <g stroke="#94a3b8" stroke-width="1">
          <rect x="415" y="265" width="50" height="50" fill="#f1f5f9" />
          <path d="M 415 265 L 465 315 M 465 265 L 415 315" />
          <rect x="535" y="265" width="50" height="50" fill="#f1f5f9" />
          <path d="M 535 265 L 585 315 M 585 265 L 535 315" />
        </g>
      </g>

      <!-- Technical Annotations -->
      <g fill="${isSatellite ? '#38bdf8' : isSecurity ? '#94a3b8' : '#007BC4'}" font-family="monospace">
        <text x="40" y="35" font-size="16" font-weight="900" opacity="0.9">GAO DIGITAL TWIN ENGINE v6.2 [${projectId.toUpperCase()}]</text>
        <text x="40" y="55" font-size="11" fill="#64748b" font-weight="bold">LIVE TELEMETRY: CONNECTED | REFRESH: 1.0s</text>
      </g>

      <!-- North Arrow -->
      <g transform="translate(940, 70) scale(0.7)">
        <path d="M 0 -45 L 12 0 L 0 6 L -12 0 Z" fill="#007BC4" />
        <text x="-6" y="-50" font-family="serif" font-size="18" font-weight="900" fill="#007BC4">N</text>
      </g>
    </svg>
  `;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export interface VisibleLayers {
  workers?: boolean;
  assets?: boolean;
  vehicles?: boolean;
  readers?: boolean;
  zones?: boolean;
  cameras?: boolean;
  sensors?: boolean;
  heatmapOverlay?: boolean;
}

export const INITIAL_DEVICES = [];

export default function LiveFloorMap({
  people,
  assets = [],
  vehicles = [],
  cameras = [],
  envSensors = [],
  readers = [],
  gates = [],
  materials = [],
  zones,
  highlightedPersonId,
  initialFocusZone,
  floorplanUrl,
  onSelectEntity,
  customZones,
  projectId = 'metro-tower',
  projectName = 'Metro Tower Site',
  contractor = 'Apex Construction',
  dimensions = '250m x 180m',
  mode = 'standard',
  visibleLayers
}: {
  people: Person[];
  assets?: Asset[];
  vehicles?: Vehicle[];
  cameras?: CameraDevice[];
  envSensors?: EnvSensor[];
  readers?: ReaderDevice[];
  gates?: AccessGate[];
  materials?: MaterialAsset[];
  zones: Record<string, {x:number; y:number; width:number; height:number}>;
  highlightedPersonId?: string | null;
  initialFocusZone?: string | null;
  floorplanUrl?: string | null;
  onSelectEntity?: (entity: SelectedEntity) => void;
  customZones?: Record<string, any>;
  projectId?: string;
  projectName?: string;
  contractor?: string;
  dimensions?: string;
  mode?: MapMode;
  visibleLayers?: VisibleLayers;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const activeZones = customZones || zones;
  const currentBlueprintUrl = floorplanUrl || getBlueprintSvg(projectId, projectName, contractor, dimensions, mode);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.5, Math.min(5, prev * delta)));
  };

  const isProductivity = mode === 'productivity';
  const isSecurity = mode === 'security';

  return (
    <div 
      className={`absolute inset-0 overflow-hidden flex items-center justify-center p-4 group/map select-none transition-colors duration-500 cursor-grab active:cursor-grabbing ${
        mode === 'satellite' ? 'bg-[#020617]' : isSecurity ? 'bg-[#0a0a0a]' : 'bg-[#f8fafc]'
      }`}
      ref={mapRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      <div 
        className="relative w-full h-full rounded-xl shadow-2xl transition-transform duration-75 ease-out border-4 border-white overflow-hidden bg-white"
        style={{ transform: `scale(${zoom}) translate(${offset.x / zoom}px, ${offset.y / zoom}px)` }}
      >
        <img 
          src={currentBlueprintUrl} 
          alt="Site Blueprint" 
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
            mode === 'satellite' ? 'opacity-100' : 'opacity-60'
          }`}
          loading="eager"
        />

        {/* Technical grid overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[radial-gradient(#007BC4_1px,transparent_1px)] [background-size:24px_24px]" />

        {/* Heatmap Layer */}
        {(mode === 'heatmap' || visibleLayers?.heatmapOverlay) && (
          <div className="absolute inset-0 pointer-events-none z-10">
             {people.map(p => (
               <div 
                 key={`heat-${p.id}`} 
                 className="absolute w-36 h-36 rounded-full blur-3xl opacity-40 animate-pulse" 
                 style={{ 
                   left: `${p.x}%`, 
                   top: `${p.y}%`, 
                   transform: 'translate(-50%, -50%)',
                   background: 'radial-gradient(circle, rgba(244,63,94,0.9) 0%, rgba(245,158,11,0.5) 45%, transparent 70%)'
                 }} 
               />
             ))}
             {Object.entries(activeZones).map(([zName, bounds]: [string, any]) => (
               <div
                 key={`heat-zone-${zName}`}
                 className="absolute rounded-2xl blur-2xl opacity-20 pointer-events-none"
                 style={{
                   left: `${bounds.x}%`,
                   top: `${bounds.y}%`,
                   width: `${bounds.width}%`,
                   height: `${bounds.height}%`,
                   background: bounds.hazardLevel === 'critical' 
                     ? 'radial-gradient(circle, rgba(225,29,72,0.8) 0%, transparent 80%)'
                     : 'radial-gradient(circle, rgba(14,165,233,0.8) 0%, transparent 80%)'
                 }}
               />
             ))}
          </div>
        )}

        {/* Reader Coverage Layer */}
        {mode === 'coverage' && readers.map(r => (
          <div 
            key={`coverage-${r.id}`}
            className="absolute border-2 border-sky-400/30 bg-sky-400/5 rounded-full pointer-events-none flex items-center justify-center"
            style={{
              left: `${r.x}%`,
              top: `${r.y}%`,
              width: `${r.range * 2}%`,
              height: `${r.range * 2}%`,
              transform: 'translate(-50%, -50%)'
            }}
          >
            <div className="w-1 h-1 bg-sky-500 rounded-full" />
          </div>
        ))}

        {/* Zones */}
        {(visibleLayers?.zones ?? true) && mode !== 'heatmap' && Object.entries(activeZones).map(([name, bounds]: [string, any]) => {
           const isHazard = bounds.hazardLevel === 'critical';
           const isWarning = bounds.hazardLevel === 'warning';
           const isMusterPoint = bounds.category === 'MUSTER POINT';
           const isEvacMode = mode === 'evacuation';

           return (
             <div 
               key={name}
               onClick={(e) => {
                 e.stopPropagation();
                 onSelectEntity?.({ 
                   type: 'infrastructure', 
                   data: { 
                     id: `zone-${name.replace(/\s+/g, '-').toLowerCase()}`, 
                     name: `Geofence Zone: ${name}`, 
                     type: 'UHF RFID Reader',
                     location: name,
                     ipAddress: '192.168.10.50',
                     macAddress: '00:1A:2B:3C:4D:5E',
                     status: isHazard ? 'Warning' : 'Online', 
                     signalRssi: -45,
                     battery: 100,
                     x: bounds.x,
                     y: bounds.y
                   } 
                 });
               }}
               className={`absolute border-2 transition-all duration-300 group/zone cursor-pointer hover:border-sky-400 hover:ring-2 hover:ring-sky-400/30 ${
                 isHazard ? 'bg-rose-500/5 border-rose-500/30' : 
                 isWarning ? 'bg-amber-500/5 border-amber-500/30' : 
                 isMusterPoint && isEvacMode ? 'bg-emerald-500/20 border-emerald-500 ring-4 ring-emerald-500/20 animate-pulse' :
                 'bg-sky-500/5 border-sky-500/10'
               }`}
               style={{
                 left: `${bounds.x}%`,
                 top: `${bounds.y}%`,
                 width: `${bounds.width}%`,
                 height: `${bounds.height}%`
               }}
             >
                <div className={`absolute top-0 left-0 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                  isHazard ? 'bg-rose-600 text-white' : 
                  isWarning ? 'bg-amber-600 text-white' : 
                  isMusterPoint && isEvacMode ? 'bg-emerald-600 text-white' :
                  'bg-sky-700 text-white'
                }`}>
                  {name}
                </div>
             </div>
           );
        })}

        {/* RFID Readers & Gates */}
        {(visibleLayers?.readers ?? true) && (
          <>
            {(mode === 'coverage' || mode === 'hardware' || mode === 'standard') && readers.map(r => (
              <div 
                key={r.id} 
                className="absolute flex flex-col items-center gap-1 z-30 cursor-pointer group" 
                style={{ left: `${r.x}%`, top: `${r.y}%`, transform: 'translate(-50%, -50%)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEntity?.({
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
                  });
                }}
              >
                <div className={`p-1.5 rounded-lg shadow-lg border-2 border-white transition-transform hover:scale-125 ${r.status === 'online' ? 'bg-indigo-600' : 'bg-slate-500 opacity-50'}`}>
                  <Radio className="w-3.5 h-3.5 text-white" />
                </div>
                {zoom > 1.2 && <span className="text-[8px] font-black bg-slate-900 text-white px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">{r.name}</span>}
              </div>
            ))}

            {gates.map(g => (
              <div 
                key={g.id} 
                className="absolute flex flex-col items-center gap-1 z-30 cursor-pointer group" 
                style={{ left: `${g.x}%`, top: `${g.y}%`, transform: 'translate(-50%, -50%)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEntity?.({
                    type: 'infrastructure',
                    data: {
                      id: g.id,
                      name: g.name,
                      type: 'IoT Edge Gateway',
                      location: 'Perimeter Access Point',
                      ipAddress: '10.0.2.15',
                      macAddress: 'AA:BB:CC:DD:EE:22',
                      status: g.status === 'unlocked' ? 'Online' : 'Warning',
                      signalRssi: -42,
                      battery: 98,
                      x: g.x,
                      y: g.y
                    }
                  });
                }}
              >
                <div className={`p-1.5 rounded-md shadow-lg border-2 border-white transition-transform hover:scale-125 ${g.status === 'unlocked' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
                  <Navigation className={`w-3.5 h-3.5 text-white ${g.status === 'locked' ? 'rotate-0' : 'rotate-90'}`} />
                </div>
              </div>
            ))}
          </>
        )}

        {/* Assets & Materials */}
        {(visibleLayers?.assets ?? true) && (mode === 'asset' || mode === 'standard' || mode === 'satellite') && (
          <>
            {assets.map(a => (
              <div 
                key={a.id} 
                className="absolute flex flex-col items-center gap-1 z-30 cursor-pointer group" 
                style={{ left: `${a.x}%`, top: `${a.y}%`, transform: 'translate(-50%, -50%)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEntity?.({
                    type: 'asset',
                    data: {
                      id: a.id,
                      name: a.name,
                      category: 'Power Tool',
                      location: 'Active Construction Sector',
                      assignedWorker: 'Unassigned',
                      status: 'Operating',
                      utilization: 88,
                      lastMovement: 'Just now',
                      battery: a.battery || 92,
                      x: a.x,
                      y: a.y
                    }
                  });
                }}
              >
                <div className="bg-emerald-600 p-1.5 rounded-lg shadow-lg border-2 border-white ring-2 ring-emerald-500/20 transition-transform hover:scale-125"><HardHat className="w-3.5 h-3.5 text-white" /></div>
                {zoom > 1.1 && <span className="text-[9px] font-black bg-white/95 backdrop-blur-sm border border-slate-200 px-1.5 py-0.5 rounded shadow-sm text-slate-800">{a.name}</span>}
              </div>
            ))}
            {materials.map(m => (
              <div 
                key={m.id} 
                className="absolute flex flex-col items-center gap-1 z-25 cursor-pointer group" 
                style={{ left: `${m.x}%`, top: `${m.y}%`, transform: 'translate(-50%, -50%)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEntity?.({
                    type: 'asset',
                    data: {
                      id: m.id,
                      name: m.name,
                      category: 'Material Pallet',
                      location: 'Material Staging Yard',
                      assignedWorker: 'Logistics Team',
                      status: 'Standby',
                      utilization: 15,
                      lastMovement: '1 hour ago',
                      battery: 100,
                      x: m.x,
                      y: m.y
                    }
                  });
                }}
              >
                 <div className="bg-sky-600 p-1.5 rounded-sm shadow-md border border-white hover:scale-125 transition-transform"><Layers className="w-3.5 h-3.5 text-white" /></div>
                 {zoom > 1.3 && <span className="text-[8px] font-black bg-white/90 px-1 rounded truncate">{m.name}</span>}
              </div>
            ))}
          </>
        )}

        {/* Vehicles */}
        {(visibleLayers?.vehicles ?? true) && vehicles.map(v => (
          <div 
            key={v.id} 
            className="absolute flex flex-col items-center gap-1 z-30 cursor-pointer group" 
            style={{ left: `${v.x}%`, top: `${v.y}%`, transform: 'translate(-50%, -50%)' }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectEntity?.({
                type: 'vehicle',
                data: {
                  id: v.id,
                  name: v.name,
                  type: 'Hydraulic Excavator',
                  operator: 'Site Certified Operator',
                  location: 'Excavation Sector',
                  speed: v.speed || 12,
                  direction: 180,
                  status: 'Active',
                  fuel: 85,
                  x: v.x,
                  y: v.y
                }
              });
            }}
          >
            <div className="bg-amber-600 p-2 rounded-full shadow-lg border-2 border-white ring-2 ring-amber-500/20 hover:scale-125 transition-transform"><Truck className="w-4 h-4 text-white" /></div>
            {zoom > 1.1 && <span className="text-[9px] font-black bg-white/95 backdrop-blur-sm border border-slate-200 px-1.5 py-0.5 rounded shadow-sm text-slate-800">{v.name}</span>}
          </div>
        ))}

        {/* Hardware (Sensors, Cameras) */}
        {(mode === 'standard' || mode === 'hardware') && (
          <>
            {(visibleLayers?.cameras ?? true) && cameras.map(c => (
              <div 
                key={c.id} 
                className="absolute z-20 cursor-pointer hover:scale-125 transition-transform" 
                style={{ left: `${c.x}%`, top: `${c.y}%`, transform: 'translate(-50%, -50%)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEntity?.({
                    type: 'camera',
                    data: {
                      id: c.id,
                      name: c.name,
                      zone: 'Core Perimeter',
                      status: c.status === 'offline' ? 'Offline' : 'Online',
                      aiStatus: 'Active',
                      aiFeatures: ['PPE Optical Check', 'Geofence Breach', 'Facial Rec'],
                      recentEvent: 'PPE Verification OK',
                      streamResolution: '4K UltraHD',
                      x: c.x,
                      y: c.y,
                      angle: 45
                    }
                  });
                }}
              >
                 <Camera className="w-5 h-5 text-purple-600 bg-white/90 backdrop-blur-[2px] rounded p-1 border border-purple-200 shadow-sm" />
              </div>
            ))}
            {(visibleLayers?.sensors ?? true) && envSensors.map(s => (
              <div 
                key={s.id} 
                className="absolute z-20 cursor-pointer hover:scale-125 transition-transform" 
                style={{ left: `${s.x}%`, top: `${s.y}%`, transform: 'translate(-50%, -50%)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEntity?.({
                    type: 'sensor',
                    data: {
                      id: s.id,
                      name: s.name,
                      zone: 'Deep Basement Pit',
                      temperature: 24.2,
                      gasLevel: 0.02,
                      dustPM25: 14.5,
                      noiseDb: 68,
                      humidity: 58,
                      status: 'Normal',
                      x: s.x,
                      y: s.y
                    }
                  });
                }}
              >
                 <Thermometer className="w-5 h-5 text-rose-600 animate-pulse bg-white/90 backdrop-blur-[2px] rounded-full p-1 border border-rose-200 shadow-sm" />
              </div>
            ))}
          </>
        )}

        {/* People Pins */}
        {(visibleLayers?.workers ?? true) && (
          <AnimatePresence>
            {people.map((person) => {
              const isHighlighted = highlightedPersonId === person.id;
              const isAlert = person.ppeStatus === "NON_COMPLIANT";
              const isMuster = mode === 'evacuation' && person.currentZone === 'Muster Point A';
              
              return (
                <motion.div
                  key={person.id}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ 
                    opacity: 1, 
                    scale: isHighlighted ? 1.3 : 1
                  }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className={`absolute z-40 cursor-pointer ${isHighlighted ? 'z-50' : ''}`}
                  style={{ 
                    left: `${person.x}%`, 
                    top: `${person.y}%`, 
                    transform: 'translate(-50%, -50%)' 
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEntity?.({ type: 'person', data: person });
                  }}
                >
                  <div className="relative group">
                    {/* Pulse Effect */}
                    {isAlert && (
                      <span className="absolute -inset-1 rounded-full bg-rose-500 opacity-60 animate-ping" />
                    )}
                    {isHighlighted && (
                      <span className="absolute -inset-2 rounded-full border-2 border-[#007BC4] opacity-60 animate-ping" />
                    )}

                    {/* Marker Pin */}
                    <div className={`w-8 h-8 rounded-full shadow-xl flex items-center justify-center border-2 transition-transform hover:scale-125 ${
                      isAlert ? 'bg-rose-600 border-white ring-2 ring-rose-400' : 
                      isMuster ? 'bg-emerald-600 border-white ring-2 ring-emerald-400 shadow-emerald-200' :
                      isHighlighted ? 'bg-[#007BC4] border-white ring-2 ring-sky-300' : 
                      'bg-white border-[#007BC4]'
                    }`}>
                      <User className={`w-4 h-4 ${isAlert || isHighlighted || isMuster ? 'text-white' : 'text-[#007BC4]'}`} />
                    </div>

                    {/* Tooltip */}
                    {zoom > 1.1 && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-50 border border-slate-700">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-sky-400 font-mono tracking-tight font-black">{person.id}</span>
                          {isAlert && <span className="text-rose-400 font-extrabold">⚠️ PPE ALERT</span>}
                        </div>
                        <div className="text-xs font-black">{person.name}</div>
                        <div className="text-slate-300 text-[9px]">{person.role} • <span className="text-emerald-400">{person.currentZone}</span></div>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Floating Map Navigation & Controls Panel */}
      <div className="absolute bottom-6 right-6 z-50 flex flex-col items-end gap-2 pointer-events-auto">
         <div className="bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl p-1.5 flex flex-col items-center gap-1 text-white">
            <button 
              onClick={() => setZoom(z => Math.min(5, +(z + 0.35).toFixed(2)))} 
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition flex items-center justify-center" 
              title="Zoom In (+)"
            >
               <ZoomIn className="w-4 h-4" />
            </button>
            <div className="px-2 py-0.5 bg-slate-800/80 rounded-md font-mono text-[9px] font-black text-sky-400 select-none">
               {Math.round(zoom * 100)}%
            </div>
            <button 
              onClick={() => setZoom(z => Math.max(0.5, +(z - 0.35).toFixed(2)))} 
              className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl transition flex items-center justify-center" 
              title="Zoom Out (-)"
            >
               <ZoomOut className="w-4 h-4" />
            </button>
            <div className="w-full h-px bg-slate-800 my-0.5" />
            <button 
              onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }} 
              className="px-2.5 py-1.5 bg-sky-600/90 hover:bg-sky-500 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition flex items-center gap-1.5 shadow-md active:scale-95" 
              title="Reset View and Center Map"
            >
               <RotateCcw className="w-3 h-3" />
               <span>Reset</span>
            </button>
         </div>

         <div className={`backdrop-blur-md text-white px-3 py-2 rounded-xl border shadow-xl flex items-center gap-3 transition-colors duration-500 ${
           mode === 'evacuation' ? 'bg-rose-600/90 border-rose-500' : 'bg-slate-900/90 border-slate-700'
         }`}>
            <Navigation className={`w-4 h-4 ${mode === 'evacuation' ? 'text-white' : 'text-sky-400'}`} />
            <span className="text-[10px] font-black uppercase tracking-widest leading-none">
              {mode === 'evacuation' ? 'EMERGENCY PROTOCOL ACTIVE' : 'RTLS ENGINE ACTIVE'}
            </span>
         </div>
      </div>
    </div>
  );
}

