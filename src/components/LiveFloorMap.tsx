import { motion, AnimatePresence } from 'motion/react';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
  Radio, User, AlertTriangle, ShieldCheck, Truck, HardHat, Camera, Thermometer,
  Layers, Navigation, Maximize2, ZoomIn, ZoomOut, RotateCcw, Ruler, Box, BarChart3, Flame,
  PenTool, Check, X, ShieldAlert, BellRing, Eye, EyeOff, Filter, Sliders, ChevronUp, ChevronDown, Info
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
  const isHeatmap = mode === 'heatmap';

  const bgColor = isSatellite ? '#020617' : isBim ? '#0f172a' : isSecurity ? '#020617' : '#ffffff';
  const gridColor = isSatellite ? 'rgba(56,189,248,0.12)' : isBim ? 'rgba(148,163,184,0.15)' : 'rgba(0,123,196,0.12)';
  const subGridColor = isSatellite ? 'rgba(56,189,248,0.04)' : isBim ? 'rgba(148,163,184,0.05)' : 'rgba(0,123,196,0.04)';
  const lineStroke = isSatellite || isSecurity || isBim ? '#38bdf8' : '#0284c7';
  const wallFill = isSatellite ? 'rgba(15,23,42,0.8)' : isBim ? '#1e293b' : '#f8fafc';
  const wallStroke = isSatellite || isSecurity || isBim ? '#0284c7' : '#1e293b';

  const svg = `
    <svg width="1200" height="800" viewBox="0 0 1200 800" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="cadGrid" width="60" height="60" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 60" fill="none" stroke="${gridColor}" stroke-width="1"/>
        </pattern>
        <pattern id="cadSubGrid" width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M 12 0 L 0 0 0 12" fill="none" stroke="${subGridColor}" stroke-width="0.5"/>
        </pattern>
        <pattern id="concreteHatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="10" stroke="${isSatellite ? 'rgba(56,189,248,0.2)' : 'rgba(100,116,139,0.2)'}" stroke-width="1" />
        </pattern>
        <pattern id="rebarGrid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="${isSatellite ? 'rgba(56,189,248,0.08)' : 'rgba(148,163,184,0.15)'}" stroke-width="0.75" stroke-dasharray="2,2"/>
        </pattern>
        <pattern id="hazardZone" width="24" height="24" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="12" height="24" fill="rgba(234,179,8,0.15)" />
          <rect x="12" width="12" height="24" fill="rgba(15,23,42,0.08)" />
        </pattern>
      </defs>
      
      <!-- Canvas Background -->
      <rect width="100%" height="100%" fill="${bgColor}"/>
      <rect width="100%" height="100%" fill="url(#cadSubGrid)"/>
      <rect width="100%" height="100%" fill="url(#cadGrid)"/>

      <!-- Architectural Site Boundary Fence & Gate Portals -->
      <g opacity="0.95">
        <rect x="60" y="60" width="1080" height="680" fill="none" stroke="${wallStroke}" stroke-width="2.5" stroke-dasharray="8,4" />
        
        <!-- Main Foundation Slab & Structural Footprint -->
        <path d="M 120 120 L 1080 120 L 1080 680 L 120 680 Z" fill="url(#concreteHatch)" stroke="${wallStroke}" stroke-width="3" />
        <path d="M 120 120 L 1080 120 L 1080 680 L 120 680 Z" fill="url(#rebarGrid)" />

        <!-- Structural Grid Lines & Axis Callout Bubbles -->
        <g stroke="${lineStroke}" stroke-width="0.8" stroke-dasharray="6,3" opacity="0.75" font-family="monospace">
          <!-- Vertical Grid Axes Callouts (1 through 5) -->
          <line x1="160" y1="35" x2="160" y2="725" />
          <circle cx="160" cy="24" r="12" fill="${bgColor}" stroke="${lineStroke}" stroke-width="1.5" />
          <text x="160" y="28" text-anchor="middle" font-size="10" font-weight="900" fill="${lineStroke}">1</text>
          <circle cx="160" cy="736" r="12" fill="${bgColor}" stroke="${lineStroke}" stroke-width="1.5" />
          <text x="160" y="740" text-anchor="middle" font-size="10" font-weight="900" fill="${lineStroke}">1</text>

          <line x1="380" y1="35" x2="380" y2="725" />
          <circle cx="380" cy="24" r="12" fill="${bgColor}" stroke="${lineStroke}" stroke-width="1.5" />
          <text x="380" y="28" text-anchor="middle" font-size="10" font-weight="900" fill="${lineStroke}">2</text>
          <circle cx="380" cy="736" r="12" fill="${bgColor}" stroke="${lineStroke}" stroke-width="1.5" />
          <text x="380" y="740" text-anchor="middle" font-size="10" font-weight="900" fill="${lineStroke}">2</text>

          <line x1="600" y1="35" x2="600" y2="725" />
          <circle cx="600" cy="24" r="12" fill="${bgColor}" stroke="${lineStroke}" stroke-width="1.5" />
          <text x="600" y="28" text-anchor="middle" font-size="10" font-weight="900" fill="${lineStroke}">3</text>
          <circle cx="600" cy="736" r="12" fill="${bgColor}" stroke="${lineStroke}" stroke-width="1.5" />
          <text x="600" y="740" text-anchor="middle" font-size="10" font-weight="900" fill="${lineStroke}">3</text>

          <line x1="820" y1="35" x2="820" y2="725" />
          <circle cx="820" cy="24" r="12" fill="${bgColor}" stroke="${lineStroke}" stroke-width="1.5" />
          <text x="820" y="28" text-anchor="middle" font-size="10" font-weight="900" fill="${lineStroke}">4</text>
          <circle cx="820" cy="736" r="12" fill="${bgColor}" stroke="${lineStroke}" stroke-width="1.5" />
          <text x="820" y="740" text-anchor="middle" font-size="10" font-weight="900" fill="${lineStroke}">4</text>

          <line x1="1040" y1="35" x2="1040" y2="725" />
          <circle cx="1040" cy="24" r="12" fill="${bgColor}" stroke="${lineStroke}" stroke-width="1.5" />
          <text x="1040" y="28" text-anchor="middle" font-size="10" font-weight="900" fill="${lineStroke}">5</text>
          <circle cx="1040" cy="736" r="12" fill="${bgColor}" stroke="${lineStroke}" stroke-width="1.5" />
          <text x="1040" y="740" text-anchor="middle" font-size="10" font-weight="900" fill="${lineStroke}">5</text>

          <!-- Horizontal Grid Axes Callouts (A through D) -->
          <line x1="35" y1="160" x2="1145" y2="160" />
          <circle cx="24" cy="160" r="12" fill="${bgColor}" stroke="${lineStroke}" stroke-width="1.5" />
          <text x="24" y="164" text-anchor="middle" font-size="10" font-weight="900" fill="${lineStroke}">A</text>
          <circle cx="1156" cy="160" r="12" fill="${bgColor}" stroke="${lineStroke}" stroke-width="1.5" />
          <text x="1156" y="164" text-anchor="middle" font-size="10" font-weight="900" fill="${lineStroke}">A</text>

          <line x1="35" y1="320" x2="1145" y2="320" />
          <circle cx="24" cy="320" r="12" fill="${bgColor}" stroke="${lineStroke}" stroke-width="1.5" />
          <text x="24" y="324" text-anchor="middle" font-size="10" font-weight="900" fill="${lineStroke}">B</text>
          <circle cx="1156" cy="320" r="12" fill="${bgColor}" stroke="${lineStroke}" stroke-width="1.5" />
          <text x="1156" y="324" text-anchor="middle" font-size="10" font-weight="900" fill="${lineStroke}">B</text>

          <line x1="35" y1="480" x2="1145" y2="480" />
          <circle cx="24" cy="480" r="12" fill="${bgColor}" stroke="${lineStroke}" stroke-width="1.5" />
          <text x="24" y="484" text-anchor="middle" font-size="10" font-weight="900" fill="${lineStroke}">C</text>
          <circle cx="1156" cy="480" r="12" fill="${bgColor}" stroke="${lineStroke}" stroke-width="1.5" />
          <text x="1156" y="484" text-anchor="middle" font-size="10" font-weight="900" fill="${lineStroke}">C</text>

          <line x1="35" y1="640" x2="1145" y2="640" />
          <circle cx="24" cy="640" r="12" fill="${bgColor}" stroke="${lineStroke}" stroke-width="1.5" />
          <text x="24" y="644" text-anchor="middle" font-size="10" font-weight="900" fill="${lineStroke}">D</text>
          <circle cx="1156" cy="640" r="12" fill="${bgColor}" stroke="${lineStroke}" stroke-width="1.5" />
          <text x="1156" y="644" text-anchor="middle" font-size="10" font-weight="900" fill="${lineStroke}">D</text>
        </g>

        <!-- Structural Steel Girders & Connecting Truss Lines -->
        <g stroke="${lineStroke}" stroke-width="1.5" opacity="0.4">
          <line x1="160" y1="160" x2="1040" y2="160" />
          <line x1="160" y1="320" x2="1040" y2="320" />
          <line x1="160" y1="480" x2="1040" y2="480" />
          <line x1="160" y1="640" x2="1040" y2="640" />
          <line x1="160" y1="160" x2="160" y2="640" />
          <line x1="380" y1="160" x2="380" y2="640" />
          <line x1="600" y1="160" x2="600" y2="640" />
          <line x1="820" y1="160" x2="820" y2="640" />
          <line x1="1040" y1="160" x2="1040" y2="640" />
        </g>

        <!-- Heavy Structural Column Footings (W14 Structural Steel Pads) -->
        <g fill="${wallStroke}" stroke="${lineStroke}" stroke-width="1">
          <rect x="150" y="150" width="20" height="20" rx="2" />
          <rect x="370" y="150" width="20" height="20" rx="2" />
          <rect x="590" y="150" width="20" height="20" rx="2" />
          <rect x="810" y="150" width="20" height="20" rx="2" />
          <rect x="1030" y="150" width="20" height="20" rx="2" />

          <rect x="150" y="310" width="20" height="20" rx="2" />
          <rect x="370" y="310" width="20" height="20" rx="2" />
          <rect x="590" y="310" width="20" height="20" rx="2" />
          <rect x="810" y="310" width="20" height="20" rx="2" />
          <rect x="1030" y="310" width="20" height="20" rx="2" />

          <rect x="150" y="470" width="20" height="20" rx="2" />
          <rect x="370" y="470" width="20" height="20" rx="2" />
          <rect x="590" y="470" width="20" height="20" rx="2" />
          <rect x="810" y="470" width="20" height="20" rx="2" />
          <rect x="1030" y="470" width="20" height="20" rx="2" />

          <rect x="150" y="630" width="20" height="20" rx="2" />
          <rect x="370" y="630" width="20" height="20" rx="2" />
          <rect x="590" y="630" width="20" height="20" rx="2" />
          <rect x="810" y="630" width="20" height="20" rx="2" />
          <rect x="1030" y="630" width="20" height="20" rx="2" />
        </g>

        <!-- Building Core Shear Walls & Elevator Shaft (Tower Core) -->
        <g stroke="${wallStroke}" stroke-width="4" fill="${wallFill}">
          <rect x="500" y="240" width="220" height="240" rx="4" />
          <!-- Shear Walls -->
          <line x1="500" y1="360" x2="720" y2="360" stroke-width="3" />
          <line x1="610" y1="240" x2="610" y2="480" stroke-width="3" />
          
          <!-- Elevator Cab Wells & Hoist Mechanism -->
          <rect x="520" y="260" width="70" height="80" fill="none" stroke="${lineStroke}" stroke-width="1.5" stroke-dasharray="3,3" />
          <rect x="630" y="260" width="70" height="80" fill="none" stroke="${lineStroke}" stroke-width="1.5" stroke-dasharray="3,3" />
          <path d="M 520 260 L 590 340 M 590 260 L 520 340" stroke="${lineStroke}" stroke-width="0.8" opacity="0.5" />
          <path d="M 630 260 L 700 340 M 700 260 L 630 340" stroke="${lineStroke}" stroke-width="0.8" opacity="0.5" />
          <text x="610" y="228" text-anchor="middle" font-family="monospace" font-size="11" font-weight="900" fill="${lineStroke}">TOWER CORE & SHAFT [SECTOR A]</text>
        </g>

        <!-- Deep Excavation Pit Section & Shoring -->
        <g>
          <rect x="140" y="140" width="300" height="420" fill="none" stroke="#eab308" stroke-width="2.5" stroke-dasharray="8,4" />
          <text x="155" y="165" font-family="sans-serif" font-size="11" font-weight="900" fill="#eab308">PIT SHORING PERIMETER [-14.5m ELEV]</text>
        </g>

        <!-- Crane Swing Hazard Area -->
        <g>
          <circle cx="880" cy="220" r="140" fill="url(#hazardZone)" stroke="#ef4444" stroke-width="2" stroke-dasharray="6,4" />
          <circle cx="880" cy="220" r="8" fill="#ef4444" stroke="#ffffff" stroke-width="2" />
          <line x1="880" y1="220" x2="1000" y2="160" stroke="#ef4444" stroke-width="2.5" />
          <text x="880" y="195" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="900" fill="#ef4444">CRANE T-01 JIB SWING RADIUS</text>
        </g>

        <!-- Architectural Dimension Lines -->
        <g stroke="${lineStroke}" stroke-width="1" font-family="monospace" font-size="10" fill="${lineStroke}">
          <!-- Top Dimension Line -->
          <line x1="160" y1="70" x2="1040" y2="70" />
          <line x1="160" y1="62" x2="160" y2="78" />
          <line x1="1040" y1="62" x2="1040" y2="78" />
          <text x="600" y="65" text-anchor="middle" font-weight="bold">SITE SPAN: 88.00 METERS</text>

          <!-- Side Dimension Line -->
          <line x1="1110" y1="160" x2="1110" y2="640" />
          <line x1="1102" y1="160" x2="1118" y2="160" />
          <line x1="1102" y1="640" x2="1118" y2="640" />
          <text x="1125" y="400" font-weight="bold" transform="rotate(90 1125 400)">DEPTH: 48.00 METERS</text>
        </g>
      </g>

      <!-- Technical Architectural Scale Bar Indicator -->
      <g transform="translate(60, 690)" font-family="monospace" font-size="9" fill="${lineStroke}">
        <rect x="0" y="0" width="160" height="4" fill="${lineStroke}" />
        <rect x="40" y="0" width="40" height="4" fill="${bgColor}" stroke="${lineStroke}" stroke-width="0.5" />
        <rect x="120" y="0" width="40" height="4" fill="${bgColor}" stroke="${lineStroke}" stroke-width="0.5" />
        <text x="0" y="-4">0m</text>
        <text x="40" y="-4">10m</text>
        <text x="80" y="-4">20m</text>
        <text x="160" y="-4">40m</text>
      </g>

      <!-- Technical CAD Block Title Header & Stamp -->
      <g transform="translate(240, 715)" font-family="monospace">
        <rect x="0" y="0" width="540" height="52" fill="${bgColor}" stroke="${wallStroke}" stroke-width="1.5" rx="4" />
        <text x="14" y="20" font-size="12" font-weight="900" fill="${lineStroke}">GAO RFID VECTOR CAD ARCHITECTURE ENGINE</text>
        <text x="14" y="38" font-size="10" fill="#64748b">PROJ: ${title.toUpperCase()} | DWG-REV: 2026.4 | SCALE 1:200 | CAD-VERIFIED</text>
        <!-- Stamp Badge -->
        <rect x="420" y="8" width="105" height="36" fill="rgba(2,132,199,0.1)" stroke="${lineStroke}" stroke-width="1" rx="3" />
        <text x="472" y="24" text-anchor="middle" font-size="8" font-weight="900" fill="${lineStroke}">APPROVED CAD</text>
        <text x="472" y="36" text-anchor="middle" font-size="8" font-weight="bold" fill="#0284c7">SITE BLUEPRINT</text>
      </g>

      <!-- Compass North Indicator -->
      <g transform="translate(1120, 720) scale(0.85)">
        <circle cx="0" cy="0" r="24" fill="${bgColor}" stroke="${lineStroke}" stroke-width="1.5" />
        <path d="M 0 -20 L 6 0 L 0 4 L -6 0 Z" fill="#0284c7" />
        <text x="0" y="-26" text-anchor="middle" font-family="sans-serif" font-size="14" font-weight="900" fill="#0284c7">N</text>
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
  people = [],
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
  visibleLayers,
  zoneCapacities = {},
  emergencySosState = null,
  isDrawingGeofence = false,
  onSaveCustomGeofence,
  onCancelDrawing
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
  zoneCapacities?: Record<string, number>;
  emergencySosState?: { active: boolean; workerId?: string; workerName?: string; zone?: string; timestamp?: string; x?: number; y?: number } | null;
  isDrawingGeofence?: boolean;
  onSaveCustomGeofence?: (newZone: { name: string; bounds: { x: number; y: number; width: number; height: number; points?: {x:number; y:number}[] }; hazardLevel: string; maxCapacity: number }) => void;
  onCancelDrawing?: () => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Geofence drawing state
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([]);
  const [isGeofenceModalOpen, setIsGeofenceModalOpen] = useState(false);
  const [newZoneName, setNewZoneName] = useState('New Custom Geofence');
  const [newZoneHazard, setNewZoneHazard] = useState('critical');
  const [newZoneCapacity, setNewZoneCapacity] = useState(5);

  // Individual Geofenced Zone Visibility Toggle State
  const [hiddenZones, setHiddenZones] = useState<Record<string, boolean>>({});
  const [isZoneManagerOpen, setIsZoneManagerOpen] = useState(false);

  // Interactive Legend State & Category Marker Filter
  const [isLegendOpen, setIsLegendOpen] = useState(true);
  const [activeLegendFilter, setActiveLegendFilter] = useState<string | null>(null);

  const activeZones = customZones || zones;
  const totalZoneCount = Object.keys(activeZones).length;
  const visibleZoneCount = totalZoneCount - Object.keys(hiddenZones).filter(k => hiddenZones[k]).length;

  const toggleZoneVisibility = (zoneName: string) => {
    setHiddenZones(prev => ({ ...prev, [zoneName]: !prev[zoneName] }));
  };

  const showAllZones = () => setHiddenZones({});
  const hideAllZones = () => {
    const hidden: Record<string, boolean> = {};
    Object.keys(activeZones).forEach(k => { hidden[k] = true; });
    setHiddenZones(hidden);
  };
  const showHazardOnlyZones = () => {
    const hidden: Record<string, boolean> = {};
    Object.entries(activeZones).forEach(([k, bounds]: [string, any]) => {
      if (bounds.hazardLevel !== 'critical' && bounds.hazardLevel !== 'warning') {
        hidden[k] = true;
      }
    });
    setHiddenZones(hidden);
  };

  const currentBlueprintUrl = floorplanUrl || getBlueprintSvg(projectId, projectName, contractor, dimensions, mode);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isDrawingGeofence) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || isDrawingGeofence) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(prev => Math.max(0.5, Math.min(5, prev * delta)));
  };

  const handleBlueprintClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawingGeofence || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const percentX = Math.max(2, Math.min(98, Math.round((clickX / rect.width) * 100)));
    const percentY = Math.max(2, Math.min(98, Math.round((clickY / rect.height) * 100)));

    setDrawingPoints(prev => [...prev, { x: percentX, y: percentY }]);
  };

  const handleOpenGeofenceModal = () => {
    if (drawingPoints.length < 3) return;
    setIsGeofenceModalOpen(true);
  };

  const handleSaveGeofence = () => {
    if (drawingPoints.length < 3) return;
    const minX = Math.min(...drawingPoints.map(p => p.x));
    const maxX = Math.max(...drawingPoints.map(p => p.x));
    const minY = Math.min(...drawingPoints.map(p => p.y));
    const maxY = Math.max(...drawingPoints.map(p => p.y));
    const width = Math.max(10, maxX - minX);
    const height = Math.max(10, maxY - minY);

    onSaveCustomGeofence?.({
      name: newZoneName.trim() || 'Custom Geofence',
      bounds: {
        x: minX,
        y: minY,
        width,
        height,
        points: drawingPoints
      },
      hazardLevel: newZoneHazard,
      maxCapacity: Number(newZoneCapacity) || 5
    });

    setIsGeofenceModalOpen(false);
    setDrawingPoints([]);
  };

  const isProductivity = mode === 'productivity';
  const isSecurity = mode === 'security';

  return (
    <div 
      className={`absolute inset-0 overflow-hidden flex items-center justify-center p-4 group/map select-none transition-colors duration-500 ${
        emergencySosState?.active ? 'ring-8 ring-rose-600 animate-pulse bg-rose-950/20' : ''
      } ${
        isDrawingGeofence ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
      } ${
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
        ref={containerRef}
        onClick={handleBlueprintClick}
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
                   background: 'radial-gradient(circle, rgba(244,63,94,0.9) 0%, rgba(245,158,11,0.5) 45%, transparent 70%)',
                   transition: 'left 0.9s cubic-bezier(0.25, 1, 0.5, 1), top 0.9s cubic-bezier(0.25, 1, 0.5, 1)'
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

        {/* Zones with Real-Time Capacity & Over-Occupancy Threshold Alerts */}
        {(visibleLayers?.zones ?? true) && mode !== 'heatmap' && Object.entries(activeZones)
          .filter(([name]) => !hiddenZones[name])
          .map(([name, bounds]: [string, any]) => {
           const isHazard = bounds.hazardLevel === 'critical';
           const isWarning = bounds.hazardLevel === 'warning';
           const isMusterPoint = bounds.category === 'MUSTER POINT';
           const isEvacMode = mode === 'evacuation';

           const zoneWorkerCount = (people || []).filter(p => p && p.currentZone && p.currentZone.toLowerCase() === name.toLowerCase()).length;
           const maxCapacity = zoneCapacities[name] || bounds.maxCapacity || (isHazard ? 4 : 10);
           const isOverCapacity = zoneWorkerCount > maxCapacity;

           return (
             <div 
               key={name}
               onClick={(e) => {
                 if (isDrawingGeofence) return;
                 e.stopPropagation();
                 onSelectEntity?.({ 
                   type: 'infrastructure', 
                   data: { 
                     id: `zone-${name.replace(/\s+/g, '-').toLowerCase()}`, 
                     name: `Geofence Zone: ${name}`, 
                     type: 'UHF RFID Reader',
                     location: name,
                     status: (isOverCapacity || isHazard) ? 'Warning' : 'Online', 
                     occupancy: `${zoneWorkerCount} / ${maxCapacity}`,
                     x: bounds.x,
                     y: bounds.y
                   } 
                 });
               }}
               className={`absolute border-2 transition-all duration-300 group/zone cursor-pointer ${
                 isOverCapacity ? 'bg-rose-600/15 border-rose-600 ring-4 ring-rose-500/30 animate-pulse' :
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
                <div className={`absolute top-0 left-0 right-0 flex items-center justify-between px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                  isOverCapacity ? 'bg-rose-600 text-white animate-bounce' :
                  isHazard ? 'bg-rose-600 text-white' : 
                  isWarning ? 'bg-amber-600 text-white' : 
                  isMusterPoint && isEvacMode ? 'bg-emerald-600 text-white' :
                  'bg-sky-700 text-white'
                }`}>
                  <span className="truncate max-w-[120px]">{name}</span>
                  <span className={`px-1 rounded font-mono text-[9px] ${
                    isOverCapacity ? 'bg-black text-amber-300 font-extrabold' : 'bg-black/30 text-white'
                  }`}>
                    {zoneWorkerCount}/{maxCapacity} {isOverCapacity ? '⚠️ OVER' : ''}
                  </span>
                </div>
             </div>
           );
        })}

        {/* Interactive Geofence Polygon Drawing Overlay */}
        {isDrawingGeofence && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-50">
            {drawingPoints.map((pt, idx) => (
              <g key={idx}>
                <circle cx={`${pt.x}%`} cy={`${pt.y}%`} r="6" fill="#0284c7" stroke="#ffffff" strokeWidth="2" className="animate-pulse" />
                <text x={`${pt.x}%`} y={`${pt.y - 2}%`} textAnchor="middle" fill="#0284c7" fontSize="10" fontWeight="bold">P{idx + 1}</text>
              </g>
            ))}
            {drawingPoints.length > 1 && (
              <polyline
                points={drawingPoints.map(p => `${p.x}%,${p.y}%`).join(' ')}
                fill="rgba(2, 132, 199, 0.2)"
                stroke="#0284c7"
                strokeWidth="3"
                strokeDasharray="6,4"
              />
            )}
          </svg>
        )}

        {/* RFID Readers & Gates */}
        {(visibleLayers?.readers ?? true) && (
          <>
            {(mode === 'coverage' || mode === 'hardware' || mode === 'standard') && readers.map(r => (
              <div 
                key={r.id} 
                className="absolute flex flex-col items-center gap-1 z-30 cursor-pointer group" 
                style={{ left: `${r.x}%`, top: `${r.y}%`, transform: 'translate(-50%, -50%)', transition: 'left 0.9s cubic-bezier(0.25, 1, 0.5, 1), top 0.9s cubic-bezier(0.25, 1, 0.5, 1)' }}
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
                style={{ left: `${g.x}%`, top: `${g.y}%`, transform: 'translate(-50%, -50%)', transition: 'left 0.9s cubic-bezier(0.25, 1, 0.5, 1), top 0.9s cubic-bezier(0.25, 1, 0.5, 1)' }}
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
                style={{ left: `${a.x}%`, top: `${a.y}%`, transform: 'translate(-50%, -50%)', transition: 'left 0.9s cubic-bezier(0.25, 1, 0.5, 1), top 0.9s cubic-bezier(0.25, 1, 0.5, 1)' }}
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
                style={{ left: `${m.x}%`, top: `${m.y}%`, transform: 'translate(-50%, -50%)', transition: 'left 0.9s cubic-bezier(0.25, 1, 0.5, 1), top 0.9s cubic-bezier(0.25, 1, 0.5, 1)' }}
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

        {/* Motion Trails for Workers */}
        {(visibleLayers?.workers ?? true) && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-30">
            {people.map(p => {
              if (!p.trail || p.trail.length < 2) return null;
              const pointsStr = p.trail.map(pt => `${pt.x}%,${pt.y}%`).join(' ');
              const isAlert = p.ppeStatus === 'NON_COMPLIANT';
              return (
                <polyline
                  key={`trail-${p.id}`}
                  points={pointsStr}
                  fill="none"
                  stroke={isAlert ? '#f43f5e' : '#38bdf8'}
                  strokeWidth="2.5"
                  strokeOpacity="0.6"
                  strokeDasharray="4,3"
                  strokeLinecap="round"
                  style={{ transition: 'all 0.9s ease-out' }}
                />
              );
            })}
          </svg>
        )}

        {/* Vehicles */}
        {(visibleLayers?.vehicles ?? true) && vehicles.map(v => (
          <div 
            key={v.id} 
            className="absolute flex flex-col items-center gap-1 z-30 cursor-pointer group" 
            style={{ left: `${v.x}%`, top: `${v.y}%`, transform: 'translate(-50%, -50%)', transition: 'left 0.9s cubic-bezier(0.25, 1, 0.5, 1), top 0.9s cubic-bezier(0.25, 1, 0.5, 1)' }}
            onClick={(e) => {
              e.stopPropagation();
              onSelectEntity?.({
                type: 'vehicle',
                data: {
                  id: v.id,
                  name: v.name,
                  type: (v.type as any) || 'Hydraulic Excavator',
                  operator: 'Site Certified Operator',
                  location: 'Excavation Sector',
                  speed: v.speed || 12,
                  heading: v.heading || 180,
                  status: 'Active',
                  fuel: v.fuel || 85,
                  x: v.x,
                  y: v.y
                }
              });
            }}
          >
            <div className="relative flex items-center justify-center">
              <div 
                className="bg-amber-600 p-2 rounded-full shadow-lg border-2 border-white ring-2 ring-amber-500/30 hover:scale-125 transition-transform"
                style={{ transform: v.heading ? `rotate(${v.heading}deg)` : undefined }}
              >
                <Truck className="w-4 h-4 text-white" />
              </div>
            </div>
            {zoom > 0.9 && (
              <div className="flex flex-col items-center">
                <span className="text-[9px] font-black bg-slate-900/90 text-white backdrop-blur-sm border border-amber-500/40 px-1.5 py-0.5 rounded shadow-sm">
                  {v.name}
                </span>
                <span className="text-[8px] font-mono font-bold bg-amber-500 text-slate-950 px-1 rounded mt-0.5">
                  {v.speed ? `${v.speed} km/h` : 'ACTIVE'}
                </span>
              </div>
            )}
          </div>
        ))}

        {/* Hardware (Sensors, Cameras) */}
        {(mode === 'standard' || mode === 'hardware') && (
          <>
            {(visibleLayers?.cameras ?? true) && cameras.map(c => (
              <div 
                key={c.id} 
                className="absolute z-20 cursor-pointer hover:scale-125 transition-transform" 
                style={{ left: `${c.x}%`, top: `${c.y}%`, transform: 'translate(-50%, -50%)', transition: 'left 0.9s cubic-bezier(0.25, 1, 0.5, 1), top 0.9s cubic-bezier(0.25, 1, 0.5, 1)' }}
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
                className="absolute z-20 cursor-pointer hover:scale-125 transition-transform flex flex-col items-center gap-0.5" 
                style={{ left: `${s.x}%`, top: `${s.y}%`, transform: 'translate(-50%, -50%)', transition: 'left 0.9s cubic-bezier(0.25, 1, 0.5, 1), top 0.9s cubic-bezier(0.25, 1, 0.5, 1)' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectEntity?.({
                    type: 'sensor',
                    data: {
                      id: s.id,
                      name: s.name,
                      zone: 'Deep Basement Pit',
                      temperature: s.temperature || 24.2,
                      gasLevel: s.gasLevel || 0.02,
                      dustPM25: s.dustPM25 || 14.5,
                      noiseDb: s.noiseDb || 68,
                      humidity: s.humidity || 58,
                      status: 'Normal',
                      x: s.x,
                      y: s.y
                    }
                  });
                }}
              >
                <div className="bg-rose-600 p-1 rounded-full text-white shadow-md border border-white">
                  <Thermometer className="w-3.5 h-3.5 animate-pulse" />
                </div>
                {zoom > 1.0 && (
                  <span className="text-[8px] font-mono font-bold bg-slate-900 text-rose-300 px-1 py-0.5 rounded border border-rose-500/30 whitespace-nowrap">
                    {s.temperature ? `${s.temperature}°C` : '24.2°C'} | {s.noiseDb ? `${s.noiseDb}dB` : '68dB'}
                  </span>
                )}
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
              const speedMps = person.speed ?? (person.presenceState === 'MOVING' ? 1.4 : 0.0);
              const isWorkerDimmed = activeLegendFilter && (
                activeLegendFilter === 'ppe_alert' ? person.ppeStatus !== 'NON_COMPLIANT' : activeLegendFilter !== 'workers'
              );
              
              return (
                <motion.div
                  key={person.id}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ 
                    opacity: isWorkerDimmed ? 0.2 : 1, 
                    scale: isHighlighted ? 1.25 : 1
                  }}
                  exit={{ opacity: 0, scale: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className={`absolute z-40 cursor-pointer transition-opacity duration-300 ${isHighlighted ? 'z-50' : ''} ${isWorkerDimmed ? 'pointer-events-none' : ''}`}
                  style={{ 
                    left: `${person.x}%`, 
                    top: `${person.y}%`, 
                    transform: 'translate(-50%, -50%)',
                    transition: 'left 0.9s cubic-bezier(0.25, 1, 0.5, 1), top 0.9s cubic-bezier(0.25, 1, 0.5, 1)'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectEntity?.({ type: 'person', data: person });
                  }}
                >
                  <div className="relative group flex flex-col items-center">
                    {/* Pulse Effect */}
                    {isAlert && (
                      <span className="absolute -inset-1 rounded-full bg-rose-500 opacity-60 animate-ping" />
                    )}
                    {isHighlighted && (
                      <span className="absolute -inset-2 rounded-full border-2 border-[#007BC4] opacity-60 animate-ping" />
                    )}

                    {/* Marker Pin & Heading Indicator */}
                    <div className="relative flex items-center justify-center">
                      <div className={`w-8 h-8 rounded-full shadow-xl flex items-center justify-center border-2 transition-transform hover:scale-125 ${
                        isAlert ? 'bg-rose-600 border-white ring-2 ring-rose-400' : 
                        isMuster ? 'bg-emerald-600 border-white ring-2 ring-emerald-400 shadow-emerald-200' :
                        isHighlighted ? 'bg-[#007BC4] border-white ring-2 ring-sky-300' : 
                        'bg-white border-[#007BC4]'
                      }`}>
                        <User className={`w-4 h-4 ${isAlert || isHighlighted || isMuster ? 'text-white' : 'text-[#007BC4]'}`} />
                      </div>

                      {/* Heading directional pointer */}
                      {person.heading !== undefined && speedMps > 0.1 && (
                        <div 
                          className="absolute w-3 h-3 text-sky-400 -top-1" 
                          style={{ transform: `rotate(${person.heading}deg) translateY(-8px)` }}
                        >
                          <Navigation className="w-3 h-3 fill-sky-400" />
                        </div>
                      )}
                    </div>

                    {/* Speed Badge & Worker Label */}
                    {zoom > 0.95 && (
                      <div className="mt-1 flex flex-col items-center gap-0.5">
                        <span className={`text-[8px] font-mono font-black px-1.5 py-0.2 rounded shadow-md border ${
                          speedMps > 0 
                            ? 'bg-sky-950 text-sky-300 border-sky-500/40' 
                            : 'bg-slate-900 text-slate-400 border-slate-700'
                        }`}>
                          {speedMps > 0 ? `⚡ ${speedMps} m/s` : 'IDLE'}
                        </span>
                        <span className="text-[9px] font-extrabold bg-white/95 text-slate-900 backdrop-blur-sm border border-slate-300 px-1.5 py-0.5 rounded shadow-sm whitespace-nowrap">
                          {person.name}
                        </span>
                      </div>
                    )}

                    {/* Detailed Tooltip on Hover */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none z-50 border border-slate-700">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-sky-400 font-mono tracking-tight font-black">{person.id}</span>
                        {person.hardhatTagId && <span className="text-amber-400 font-mono text-[9px]">[{person.hardhatTagId}]</span>}
                        {isAlert && <span className="text-rose-400 font-extrabold">⚠️ PPE ALERT</span>}
                      </div>
                      <div className="text-xs font-black">{person.name}</div>
                      <div className="text-slate-300 text-[9px] flex items-center gap-2">
                        <span>{person.role}</span>
                        <span className="text-emerald-400">Zone: {person.currentZone}</span>
                      </div>
                      <div className="text-sky-300 font-mono text-[9px] mt-0.5">
                        Speed: {speedMps} m/s | RSSI: {person.rssi ?? -55} dBm | Batt: {person.battery ?? 95}%
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>





      {/* Floating Drawing Control Bar */}
      {isDrawingGeofence && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 text-white backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-2xl border border-sky-500/50 flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs font-black text-sky-400">
            <PenTool className="w-4 h-4 text-sky-400 animate-spin" />
            <span>GEOFENCE DRAWING MODE ({drawingPoints.length} Points)</span>
          </div>
          <div className="text-[11px] text-slate-300 hidden sm:inline">Click blueprint to place boundary vertices</div>
          <button
            onClick={() => setDrawingPoints([])}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[10px] font-bold transition"
          >
            Clear
          </button>
          <button
            onClick={handleOpenGeofenceModal}
            disabled={drawingPoints.length < 3}
            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition ${
              drawingPoints.length >= 3 
                ? 'bg-sky-600 hover:bg-sky-500 text-white shadow-md' 
                : 'bg-slate-800 text-slate-500 cursor-not-allowed'
            }`}
          >
            Save Geofence ({drawingPoints.length >= 3 ? 'Ready' : 'Need 3+ pts'})
          </button>
          <button
            onClick={() => {
              setDrawingPoints([]);
              onCancelDrawing?.();
            }}
            className="p-1 hover:bg-slate-800 rounded-md text-slate-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Modal for saving custom drawn geofence */}
      {isGeofenceModalOpen && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-sky-700 font-black text-sm">
                <PenTool className="w-5 h-5" />
                <span>Define Geofence Zone</span>
              </div>
              <button onClick={() => setIsGeofenceModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs font-semibold text-slate-700">
              <div>
                <label className="block mb-1 font-bold text-slate-900">Zone Name</label>
                <input
                  type="text"
                  value={newZoneName}
                  onChange={e => setNewZoneName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 font-bold"
                  placeholder="e.g. Roof Deck Sector C"
                />
              </div>

              <div>
                <label className="block mb-1 font-bold text-slate-900">Hazard Category</label>
                <select
                  value={newZoneHazard}
                  onChange={e => setNewZoneHazard(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 font-bold"
                >
                  <option value="critical">Critical High Hazard (Red)</option>
                  <option value="warning">Warning Hazard Zone (Amber)</option>
                  <option value="standard">Standard Monitored Zone (Blue)</option>
                </select>
              </div>

              <div>
                <label className="block mb-1 font-bold text-slate-900">Max Worker Safety Capacity Limit</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={newZoneCapacity}
                  onChange={e => setNewZoneCapacity(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-sky-500 font-mono font-bold"
                />
                <span className="text-[10px] text-slate-400">Triggers automated alert when worker count exceeds threshold</span>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => setIsGeofenceModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveGeofence}
                className="flex-1 py-2.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg transition"
              >
                Save Zone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map Navigation & Status Indicator */}
      <div className="absolute bottom-6 right-6 z-50 flex flex-col items-end gap-2 pointer-events-auto">
         <div className={`backdrop-blur-md text-white px-3 py-2 rounded-xl border shadow-xl flex items-center gap-2.5 transition-colors duration-500 ${
           mode === 'evacuation' ? 'bg-rose-600/90 border-rose-500' : 'bg-slate-900/90 border-slate-700'
         }`}>
            <Navigation className={`w-3.5 h-3.5 ${mode === 'evacuation' ? 'text-white' : 'text-sky-400'}`} />
            <span className="text-[9px] font-black uppercase tracking-widest leading-none">
              {mode === 'evacuation' ? 'EMERGENCY ACTIVE' : 'RTLS ENGINE ACTIVE'}
            </span>
         </div>
      </div>
    </div>
  );
}

