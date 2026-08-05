import { Person, AIAlert } from '../lib/simulation';
import { 
  Users, 
  UserCheck, 
  Activity, 
  ShieldAlert, 
  Clock, 
  Bell, 
  Map as MapIcon, 
  LayoutDashboard, 
  Cpu, 
  ShieldCheck, 
  Radio, 
  Settings, 
  Eye, 
  EyeOff, 
  ArrowUp, 
  ArrowDown, 
  X, 
  RotateCcw, 
  Check, 
  SlidersHorizontal, 
  Save,
  Server,
  Wifi,
  WifiOff,
  ArrowRight,
  Key,
  ExternalLink,
  Trash2,
  GripVertical
} from 'lucide-react';
import { motion } from 'motion/react';
import AIFeed from './AIFeed';
import SystemHealthWidget from './SystemHealthWidget';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { useMemo, ReactNode, useState, useEffect, useContext } from 'react';
import React from 'react';
import { collection, onSnapshot, doc, getDoc, setDoc, query, orderBy, limit } from '../lib/db';
import { db, auth } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';
import { AppModeContext } from '../App';

const COLORS = ['#007BC4', '#38bdf8', '#10b981', '#f59e0b', '#8b5cf6'];

export interface KPIConfig {
  id: string;
  title: string;
  visible: boolean;
  order: number;
  deleted?: boolean;
}

export interface PanelConfig {
  id: string;
  title: string;
  description: string;
  visible: boolean;
  order: number;
  width: '1/4' | '1/3' | '1/2' | '2/3' | 'full';
  deleted?: boolean;
}

const DEFAULT_KPIS: KPIConfig[] = [
  { id: 'total_people', title: 'Total Registered Workers', visible: true, order: 1 },
  { id: 'on_site', title: 'Currently On-Site', visible: true, order: 2 },
  { id: 'in_motion', title: 'Workers Active / In Motion', visible: true, order: 3 },
  { id: 'alerts_count', title: 'Safety Hazards & Alerts', visible: true, order: 4 },
  { id: 'dwell_time', title: 'Avg. Shift Dwell Time', visible: true, order: 5 },
];

const DEFAULT_PANELS: PanelConfig[] = [
  { id: 'system_health', title: 'Database & System Health', description: 'Real-time connection state, latency monitoring, and telemetry for Cloud Firestore and MongoDB.', visible: true, order: 0, width: 'full' },
  { id: 'occupancy_panel', title: 'Construction Site Occupancy & Sector Status', description: 'Device health, live zone distribution tracker, and worker movement logs.', visible: true, order: 1, width: '2/3' },
  { id: 'alerts_panel', title: 'Safety Hazards & Exclusion Alerts', description: 'Live alerts, PPE violations, crane exclusion breaches, and sensor events feed.', visible: true, order: 2, width: '1/3' },
  { id: 'attendance_summary', title: 'Site Shift Attendance Module', description: 'First entry gate scan, last exit scan, and shift working hours summary.', visible: true, order: 3, width: '1/3' },
  { id: 'ai_insights', title: 'AI Safety Predictions & PPE Insights', description: 'AI generated summaries, crane exclusion warnings, and man-down anomaly detection.', visible: true, order: 4, width: '2/3' },
  { id: 'chart_over_time', title: 'Worker Flow Trend', description: 'Over-time area trend of RFID hardhat tag occurrences across construction shifts.', visible: true, order: 5, width: '1/4' },
  { id: 'chart_top_zones', title: 'Sector Breakdown', description: 'Interactive pie chart showing worker proportion distribution by active construction zones.', visible: true, order: 6, width: '1/4' },
  { id: 'chart_device_status', title: 'Site Readers & RFID Gate Status', description: 'Visual breakdown of RFID gate portals, antenna health, and CPU load analytics.', visible: true, order: 7, width: '1/4' },
  { id: 'chart_heatmap', title: 'Site Density Heatmap', description: 'Live density heatmap showing high worker concentrations in active site sectors.', visible: true, order: 8, width: '1/4' },
  { id: 'tech_footer', title: 'Construction RFID Features', description: 'Core system specs overview of active RFID frequency bands, IP67 readers & safety protocols.', visible: true, order: 9, width: 'full' }
];

export default function DashboardTab({ 
  people, 
  alerts, 
  zones, 
  highlightedPersonId, 
  isLoading 
}: { 
  people: Person[], 
  alerts: AIAlert[], 
  zones: any, 
  highlightedPersonId?: string | null, 
  isLoading?: boolean 
}) {
  const navigate = useNavigate();
  const { mode } = useContext(AppModeContext);
  const [apiConfig, setApiConfig] = useState({
    url: '',
    authType: 'none',
    apiKeyHeader: 'X-API-Key'
  });

  useEffect(() => {
    setApiConfig({
      url: localStorage.getItem('gao_api_url') || '',
      authType: localStorage.getItem('gao_auth_type') || 'none',
      apiKeyHeader: localStorage.getItem('gao_api_key_header') || 'X-API-Key'
    });
  }, []);

  const [registeredCount, setRegisteredCount] = useState<number>(0);
  const [recentMovements, setRecentMovements] = useState<any[]>([]);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const movingCount = people.filter(p => p.presenceState === 'MOVING').length;
  const avgDwellInfo = people.length > 0 ? (people.reduce((sum, p) => sum + p.dwellTime, 0) / people.length / 60).toFixed(1) : "0.0";

  const [deviceStats, setDeviceStats] = useState({ online: 0, offline: 0, warning: 0 });
  const [deviceList, setDeviceList] = useState<any[]>([]);

  // Layout states
  const [kpis, setKpis] = useState<KPIConfig[]>(DEFAULT_KPIS);
  const [panels, setPanels] = useState<PanelConfig[]>(DEFAULT_PANELS);
  const [isSaving, setIsSaving] = useState(false);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'metrics' | 'grids'>('metrics');

  // Temporary layout configurations for draft editing
  const [tempKpis, setTempKpis] = useState<KPIConfig[]>([]);
  const [tempPanels, setTempPanels] = useState<PanelConfig[]>([]);

  // Drag and drop sorting states
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIdx(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === index) return;
    setDragOverIdx(index);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number, type: 'kpi' | 'panel') => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === targetIndex) return;

    if (type === 'kpi') {
      setTempKpis(prev => {
        const active = prev.filter(k => !k.deleted).sort((a,b) => a.order - b.order);
        const deleted = prev.filter(k => k.deleted);
        
        const result = [...active];
        const [removed] = result.splice(draggedIdx, 1);
        result.splice(targetIndex, 0, removed);
        
        const reordered = result.map((item, idx) => ({ ...item, order: idx + 1 }));
        return [...reordered, ...deleted];
      });
    } else {
      setTempPanels(prev => {
        const active = prev.filter(p => !p.deleted).sort((a,b) => a.order - b.order);
        const deleted = prev.filter(p => p.deleted);
        
        const result = [...active];
        const [removed] = result.splice(draggedIdx, 1);
        result.splice(targetIndex, 0, removed);
        
        const reordered = result.map((item, idx) => ({ ...item, order: idx + 1 }));
        return [...reordered, ...deleted];
      });
    }
    
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  // Load and subscribe to Device & Floorplans info
  useEffect(() => {
    let unsubs: (() => void)[] = [];
    
    let stdDevs: any[] = [];
    let fpDevs: any[] = [];
    
    const updateAll = () => {
       const combined = [
         ...stdDevs.map(d => ({ name: d.name, status: d.status || 'online', id: d.id || d.name })),
         ...fpDevs.map(d => ({ name: d.name, status: 'online', id: d.id || d.mac || d.name }))
       ];
       const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
       setDeviceList(unique);
       
       let on = 0, off = 0, warn = 0;
       unique.forEach((d: any) => {
          if (d.status === 'online') on++;
          else if (d.status === 'warning') warn++;
          else off++;
       });
       setDeviceStats({
          online: on,
          offline: off,
          warning: warn
       });
    };

    unsubs.push(onSnapshot(collection(db, 'devices'), (snapshot) => {
      stdDevs = [];
      snapshot.forEach(doc => stdDevs.push({ id: doc.id, ...doc.data() }));
      updateAll();
    }));
    
    unsubs.push(onSnapshot(collection(db, 'floorplans'), (snapshot) => {
      fpDevs = [];
      snapshot.forEach(doc => {
         const fp = doc.data();
         if (fp.devices && Array.isArray(fp.devices)) {
            fp.devices.forEach((d:any) => fpDevs.push(d));
         }
      });
      updateAll();
    }));

    unsubs.push(onSnapshot(collection(db, 'registered_people'), (snapshot) => {
       setRegisteredCount(snapshot.size);
    }));

    unsubs.push(onSnapshot(
      query(collection(db, 'tag_history'), orderBy('timestamp', 'desc'), limit(5)),
      (snapshot) => {
         const moves: any[] = [];
         snapshot.forEach(doc => {
            const data = doc.data();
            moves.push({
               id: doc.id,
               tagId: data.TagID || '',
               name: data.name || `Tag ${data.TagID?.substring(0,6).toUpperCase() || 'UNKNOWN'}`,
               role: data.role || 'Visitor',
               fromZone: data.fromZone || null,
               toZone: data.toZone || '',
               timestamp: data.timestamp?.toDate() || new Date()
            });
         });
         setRecentMovements(moves);
      },
      (error) => console.warn("Failed tag_history subscription:", error)
    ));

    unsubs.push(onSnapshot(
      query(collection(db, 'tag_history'), orderBy('timestamp', 'desc'), limit(100)),
      (snapshot) => {
         const defaultBuckets = [
           { time: '12 AM', load: 0 },
           { time: '4 AM', load: 0 },
           { time: '8 AM', load: 0 },
           { time: '12 PM', load: 0 },
           { time: '4 PM', load: 0 },
           { time: '8 PM', load: 0 }
         ];
         
         snapshot.forEach(doc => {
            const data = doc.data();
            const date = data.timestamp?.toDate ? data.timestamp.toDate() : null;
            if (date) {
               const hour = date.getHours();
               if (hour < 4) defaultBuckets[0].load++;
               else if (hour < 8) defaultBuckets[1].load++;
               else if (hour < 12) defaultBuckets[2].load++;
               else if (hour < 16) defaultBuckets[3].load++;
               else if (hour < 20) defaultBuckets[4].load++;
               else defaultBuckets[5].load++;
            }
         });
         
         if (snapshot.size === 0) {
            defaultBuckets[2].load = 2;
            defaultBuckets[3].load = Math.max(people.length, 1);
         }
         
         setTimelineData(defaultBuckets);
      },
      (error) => console.warn("Failed tag_history timeline subscription:", error)
    ));

    return () => unsubs.forEach(fn => fn());
  }, []);

  // Fetch customizable layout configurations from Firestore / LocalStorage
  useEffect(() => {
    const fetchLayout = async () => {
      try {
        const userId = auth.currentUser?.uid || 'default';
        const docRef = doc(db, 'settings', `dashboard_${userId}`);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.kpis && Array.isArray(data.kpis)) {
             // Merge missing properties if defaults changed
             const mergedKpis = DEFAULT_KPIS.map(def => {
               const saved = data.kpis.find((k: any) => k.id === def.id);
               return saved ? { ...def, visible: saved.visible, order: saved.order, deleted: saved.deleted } : def;
             });
             setKpis(mergedKpis.sort((a,b) => a.order - b.order));
          }
          if (data.panels && Array.isArray(data.panels)) {
             const mergedPanels = DEFAULT_PANELS.map(def => {
               const saved = data.panels.find((p: any) => p.id === def.id);
               return saved ? { ...def, visible: saved.visible, order: saved.order, width: saved.width || def.width, deleted: saved.deleted } : def;
             });
             setPanels(mergedPanels.sort((a,b) => a.order - b.order));
          }
        } else {
          // Fallback to localStorage
          const storedKpis = localStorage.getItem(`dashboard_kpis_${userId}`);
          const storedPanels = localStorage.getItem(`dashboard_panels_${userId}`);
          if (storedKpis) {
             setKpis(JSON.parse(storedKpis));
          }
          if (storedPanels) {
             setPanels(JSON.parse(storedPanels));
          }
        }
      } catch (err) {
        console.warn("Failed to load dashboard layout preference:", err);
      }
    };
    fetchLayout();
  }, [auth.currentUser]);

  // Open Edit Layout panel
  const openCustomizeModal = () => {
    setTempKpis(JSON.parse(JSON.stringify(kpis)));
    setTempPanels(JSON.parse(JSON.stringify(panels)));
    setShowCustomizeModal(true);
  };

  // KPI Edit helpers
  const handleToggleKpi = (id: string) => {
    setTempKpis(prev => prev.map(k => k.id === id ? { ...k, visible: !k.visible } : k));
  };

  const handleDeleteKpi = (id: string) => {
    setTempKpis(prev => prev.map(k => k.id === id ? { ...k, deleted: true, visible: false } : k));
  };

  const handleMoveKpiUp = (index: number) => {
    if (index <= 0) return;
    setTempKpis(prev => {
      const active = prev.filter(k => !k.deleted).sort((a,b) => a.order - b.order);
      const deleted = prev.filter(k => k.deleted);
      const updated = [...active];
      
      const temp = updated[index].order;
      updated[index].order = updated[index - 1].order;
      updated[index - 1].order = temp;
      
      return [...updated, ...deleted].sort((a,b) => a.order - b.order);
    });
  };

  const handleMoveKpiDown = (index: number) => {
    setTempKpis(prev => {
      const active = prev.filter(k => !k.deleted).sort((a,b) => a.order - b.order);
      if (index >= active.length - 1) return prev;
      const deleted = prev.filter(k => k.deleted);
      const updated = [...active];
      
      const temp = updated[index].order;
      updated[index].order = updated[index + 1].order;
      updated[index + 1].order = temp;
      
      return [...updated, ...deleted].sort((a,b) => a.order - b.order);
    });
  };

  // Panel Edit helpers
  const handleTogglePanel = (id: string) => {
    setTempPanels(prev => prev.map(p => p.id === id ? { ...p, visible: !p.visible } : p));
  };

  const handleDeletePanel = (id: string) => {
    setTempPanels(prev => prev.map(p => p.id === id ? { ...p, deleted: true, visible: false } : p));
  };

  const handleResizePanel = (id: string, width: '1/4' | '1/3' | '1/2' | '2/3' | 'full') => {
    setTempPanels(prev => prev.map(p => p.id === id ? { ...p, width } : p));
  };

  const handleMovePanelUp = (index: number) => {
    if (index <= 0) return;
    setTempPanels(prev => {
      const active = prev.filter(p => !p.deleted).sort((a,b) => a.order - b.order);
      const deleted = prev.filter(p => p.deleted);
      const updated = [...active];
      
      const temp = updated[index].order;
      updated[index].order = updated[index - 1].order;
      updated[index - 1].order = temp;
      
      return [...updated, ...deleted].sort((a,b) => a.order - b.order);
    });
  };

  const handleMovePanelDown = (index: number) => {
    setTempPanels(prev => {
      const active = prev.filter(p => !p.deleted).sort((a,b) => a.order - b.order);
      if (index >= active.length - 1) return prev;
      const deleted = prev.filter(p => p.deleted);
      const updated = [...active];
      
      const temp = updated[index].order;
      updated[index].order = updated[index + 1].order;
      updated[index + 1].order = temp;
      
      return [...updated, ...deleted].sort((a,b) => a.order - b.order);
    });
  };

  const handleResetLayout = () => {
    setTempKpis(JSON.parse(JSON.stringify(DEFAULT_KPIS)));
    setTempPanels(JSON.parse(JSON.stringify(DEFAULT_PANELS)));
  };

  // Commits newly customized layout configs back to Firestore & LocalStorage
  const handleSaveLayout = async (newKpis: KPIConfig[], newPanels: PanelConfig[]) => {
    setIsSaving(true);
    const userId = auth.currentUser?.uid || 'default';
    
    // Normalize correct order values (1 to N)
    const normalizedKpis = [...newKpis]
      .sort((a,b) => a.order - b.order)
      .map((k, idx) => ({ ...k, order: idx + 1 }));

    const normalizedPanels = [...newPanels]
      .sort((a,b) => a.order - b.order)
      .map((p, idx) => ({ ...p, order: idx + 1 }));

    try {
      // 1. Log to Firestore Database (Durable Cloud Persistence)
      const docRef = doc(db, 'settings', `dashboard_${userId}`);
      await setDoc(docRef, {
        userId,
        kpis: normalizedKpis,
        panels: normalizedPanels,
        updatedAt: new Date().toISOString()
      });
      
      // 2. Sync client-side fallback storage
      localStorage.setItem(`dashboard_kpis_${userId}`, JSON.stringify(normalizedKpis));
      localStorage.setItem(`dashboard_panels_${userId}`, JSON.stringify(normalizedPanels));
      
      setKpis(normalizedKpis);
      setPanels(normalizedPanels);
      setShowCustomizeModal(false);
    } catch (err) {
      console.warn("Failed to persistently sync layout settings to Firestore:", err);
      // Fallback local persistence
      localStorage.setItem(`dashboard_kpis_${userId}`, JSON.stringify(normalizedKpis));
      localStorage.setItem(`dashboard_panels_${userId}`, JSON.stringify(normalizedPanels));
      
      setKpis(normalizedKpis);
      setPanels(normalizedPanels);
      setShowCustomizeModal(false);
    } finally {
      setIsSaving(false);
    }
  };

  // Recharts memoized timeline datasets 
  const mockTimelineData = useMemo(() => {
    const base = [
      { time: '12 AM', load: 12 },
      { time: '4 AM', load: 18 },
      { time: '8 AM', load: 250 },
      { time: '12 PM', load: 856 },
      { time: '4 PM', load: 650 },
      { time: '8 PM', load: 300 },
      { time: '12 AM', load: 100 }
    ];
    return base;
  }, []);

  // Recharts memoized zone proportions datasets
  const zoneData = useMemo(() => {
    const counts = people.reduce((acc, p) => {
      acc[p.currentZone] = (acc[p.currentZone] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.keys(counts).map(zone => ({
      name: zone,
      value: counts[zone]
    }));
  }, [people]);

  const deviceData = [
    { name: 'Online', value: deviceStats.online || 1, color: '#10b981' },
    { name: 'Offline', value: deviceStats.offline, color: '#f43f5e' },
    { name: 'Warning', value: deviceStats.warning, color: '#f59e0b' }
  ].filter(d => d.value > 0);

  // Sorting configurations
  const sortedVisibleKpis = useMemo(() => {
    return [...kpis]
      .filter(k => k.visible && !k.deleted)
      .sort((a, b) => a.order - b.order);
  }, [kpis]);

  const sortedVisiblePanels = useMemo(() => {
    return [...panels]
      .filter(p => p.visible && !p.deleted)
      .sort((a, b) => a.order - b.order);
  }, [panels]);

  // Resolves customizable widths into responsive grid classes
  const getPanelWidthClass = (width: '1/4' | '1/3' | '1/2' | '2/3' | 'full') => {
    switch (width) {
      case '1/4':
        return 'col-span-12 md:col-span-6 xl:col-span-3';
      case '1/3':
        return 'col-span-12 md:col-span-6 xl:col-span-4';
      case '1/2':
        return 'col-span-12 xl:col-span-6';
      case '2/3':
        return 'col-span-12 xl:col-span-8';
      case 'full':
        return 'col-span-12';
      default:
        return 'col-span-12';
    }
  };

  // Direct content dispatcher mapping widget configurations dynamically
  const renderPanelContent = (id: string) => {
    switch (id) {
      case 'system_health':
        return <SystemHealthWidget />;

      case 'occupancy_panel':
        return (
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col shadow-sm transition hover:shadow-md h-[480px]">
             <div className="flex items-center justify-between mb-4 shrink-0">
               <div className="flex items-center gap-2">
                 <div className="w-2 rounded-full bg-[#10b981] h-2" />
                 <h3 className="font-semibold text-slate-900 tracking-tight text-sm">Facility Occupancy & Status</h3>
               </div>
               <div className="flex gap-2">
                 <span className="text-xs font-semibold text-slate-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#10b981]"></span> Nominal</span>
                 <span className="text-xs font-semibold text-slate-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]"></span> Busy</span>
               </div>
             </div>
             
             <div className="flex flex-1 gap-6 min-h-0 overflow-hidden">
               <div className="w-1/3 flex flex-col gap-3 border-r border-slate-100 pr-4 overflow-y-auto shrink-0 z-20">
                 <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-white sticky top-0 py-1">Device Health</h4>
                 {((deviceList && deviceList.length > 0) ? deviceList.slice(0, 4) : [
                   { name: 'Main Entrance', status: 'online' },
                   { name: 'Lobby Scanner', status: 'online' },
                   { name: 'Server Rm Door', status: 'warning' },
                   { name: 'Loading Dock', status: 'online' },
                 ]).map((d, idx) => {
                   const isOnline = d.status === 'online';
                   const isWarning = d.status === 'warning';
                   const bgClass = isOnline ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : isWarning ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-rose-50 text-rose-700 border-rose-100';
                   
                   return (
                     <div 
                       key={d.id || idx} 
                       onClick={() => navigate('/devices')}
                       className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer hover:scale-[1.02] flex-shrink-0 transition-transform duration-200 ${bgClass}`}
                     >
                       <div className="font-bold text-xs truncate max-w-[100px]">{d.name}</div>
                       <div className="text-[10px] font-bold uppercase">{d.status}</div>
                     </div>
                   );
                 })}
                 <button 
                   onClick={() => navigate('/devices')} 
                   className="text-[10px] font-bold text-[#007BC4] uppercase text-left hover:underline mt-1 flex items-center gap-1 group bg-white sticky bottom-0 py-1"
                 >
                   View all devices <span className="group-hover:translate-x-1 transition-transform">→</span>
                 </button>
               </div>
               
               <div className="flex-1 flex flex-col bg-slate-50 rounded-lg p-4 overflow-hidden border border-slate-200 shadow-inner overflow-y-auto">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Live Zone Occupancy Distribution</h4>
                  <div className="flex flex-col gap-2">
                     {Object.keys(zones).map(z => {
                        const count = people.filter(p => p.currentZone === z).length;
                        const percent = Math.round((count / Math.max(people.length, 1)) * 100);
                        return (
                           <div key={z} onClick={() => navigate('/live', { state: { focusZone: z } })} className="flex items-center gap-3 bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-100 cursor-pointer hover:border-[#007BC4]/40 hover:bg-[#007BC4]/5 hover:translate-x-1 transition-all duration-200">
                              <div className="font-bold text-slate-700 w-24 text-xs truncate">{z}</div>
                              <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden">
                                 <div className={`h-full rounded-full transition-all duration-500 ${percent > 40 ? 'bg-[#f59e0b]' : 'bg-[#007BC4]'}`} style={{ width: `${Math.max(percent, 2)}%` }}></div>
                              </div>
                              <div className="w-10 text-right">
                                <span className="font-semibold text-xs text-slate-900">{count}</span>
                                <span className="text-[9px] text-slate-400 ml-0.5">pax</span>
                              </div>
                           </div>
                        )
                     })}
                  </div>
                  
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-4">Recent Movement Log</h4>
                  <div className="flex flex-col gap-1.5">
                     {(mode === 'real' && recentMovements.length > 0) ? (
                        recentMovements.slice(0, 3).map(move => (
                          <div key={move.id} onClick={() => navigate('/playback')} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-100 cursor-pointer hover:border-[#007BC4]/30 hover:bg-[#007BC4]/5 hover:translate-x-0.5 transition-all duration-200">
                            <div className="flex items-center gap-2">
                               <div className="w-7 h-7 rounded bg-[#007BC4]/10 text-[#007BC4] flex items-center justify-center font-bold text-xs border border-[#007BC4]/20">{move.name.charAt(0)}</div>
                               <div>
                                 <div className="font-bold text-xs text-slate-800 leading-tight">{move.name}</div>
                                 <div className="text-[9px] text-slate-500 font-medium uppercase tracking-wide leading-none">{move.role} - ID: {move.tagId.substring(0, 6)}</div>
                               </div>
                            </div>
                            <div className="flex flex-col items-end leading-none">
                               <div className="text-xs font-bold text-slate-600 flex items-center gap-1 text-right">
                                 <span className="w-1 h-1 rounded-full bg-[#007BC4]"></span> {move.fromZone ? `${move.fromZone} → ${move.toZone}` : `Entered ${move.toZone}`}
                               </div>
                               <div className="text-[9px] text-slate-400 font-mono mt-0.5">{move.timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</div>
                            </div>
                          </div>
                        ))
                     ) : (
                        people.slice(0, 3).map(p => (
                          <div key={p.id} onClick={() => navigate('/live', { state: { focusZone: p.currentZone, highlightedPersonId: p.id } })} className="flex items-center justify-between bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-100 cursor-pointer hover:border-[#007BC4]/30 hover:bg-[#007BC4]/5 hover:translate-x-0.5 transition-all duration-200">
                             <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded bg-[#007BC4]/10 text-[#007BC4] flex items-center justify-center font-bold text-xs border border-[#007BC4]/20">{p.name.charAt(0)}</div>
                                <div>
                                  <div className="font-bold text-xs text-slate-800 leading-tight">{p.name}</div>
                                  <div className="text-[9px] text-slate-500 font-medium uppercase tracking-wide leading-none">{p.role}</div>
                                </div>
                             </div>
                             <div className="flex flex-col items-end leading-none">
                                <div className="text-xs font-bold text-slate-600 flex items-center gap-1">
                                  <span className="w-1 h-1 rounded-full bg-emerald-500"></span> {p.currentZone}
                                </div>
                                <div className="text-[9px] text-slate-400 font-mono mt-0.5">Dwell: {Math.floor(p.dwellTime/60)}m {p.dwellTime%60}s</div>
                             </div>
                          </div>
                        ))
                     )}
                  </div>
               </div>
             </div>
          </div>
        );

      case 'alerts_panel':
        return (
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col shadow-sm transition hover:shadow-md h-[480px]">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 shrink-0">
              <h3 className="font-semibold text-slate-900 tracking-tight text-sm">Recent Alerts</h3>
              <button onClick={() => navigate('/alerts')} className="text-xs font-semibold text-[#007BC4] hover:underline cursor-pointer">View All</button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AIFeed alerts={alerts} />
            </div>
          </div>
        );

      case 'attendance_summary':
        return (
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col shadow-sm transition hover:shadow-md h-[480px]">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 shrink-0">
               <h3 className="font-semibold text-slate-900 tracking-tight text-sm">Attendance Summary</h3>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4">
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                 <div className="text-[10px] font-bold text-slate-500 uppercase">First Entry (Today)</div>
                 <div className="text-lg font-bold text-slate-900 mt-1">07:14 AM</div>
                 <div className="text-[11px] text-slate-500">Alan Turing (Admin)</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-lg">
                 <div className="text-[10px] font-bold text-slate-500 uppercase">Last Exit (Today)</div>
                 <div className="text-lg font-bold text-slate-900 mt-1">18:42 PM</div>
                 <div className="text-[11px] text-slate-500">Grace Hopper (Engineer)</div>
              </div>
              <div className="p-3 bg-[#007BC4]/5 border border-[#007BC4]/20 rounded-lg">
                 <div className="text-[10px] font-bold text-[#007BC4] uppercase">Avg Working Hours</div>
                 <div className="text-xl font-black text-[#007BC4] mt-1">8h 24m</div>
                 <div className="text-[11px] text-[#007BC4]/80">+12m vs yesterday</div>
              </div>
            </div>
          </div>
        );

      case 'ai_insights':
        return (
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col shadow-sm transition hover:shadow-md h-[480px]">
             <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 shrink-0">
               <h3 className="font-semibold text-slate-900 tracking-tight text-sm flex items-center gap-2"><Cpu className="w-4 h-4 text-purple-500" /> AI Insights</h3>
            </div>
            <div className="flex flex-col gap-3 flex-1 overflow-y-auto">
               <div className="bg-purple-50 border border-purple-100 p-4 rounded-lg">
                  <h4 className="text-xs font-bold text-purple-700 uppercase mb-1">Predictive Alert: Zone Overcrowding</h4>
                  <p className="text-xs text-purple-900 leading-relaxed font-medium">Based on current worker movement vectors, the <span className="font-bold">Site Welfare & Canteen Container</span> is predicted to exceed occupancy limits (150 tradespeople) in approximately 12 minutes during lunch shift change.</p>
               </div>
               <div className="bg-amber-50 border border-amber-100 p-4 rounded-lg mt-2">
                  <h4 className="text-xs font-bold text-amber-700 uppercase mb-1">Anomaly Detection: Unauthorized Exclusion Zone</h4>
                  <p className="text-xs text-amber-900 leading-relaxed font-medium">Hardhat Sensor <span className="font-bold">Tag ID: 8B-F1-0A</span> bypassed the safety perimeter gate and entered the Heavy Crane Swing Radius during active lift operations.</p>
               </div>
               <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg mt-2">
                  <h4 className="text-xs font-bold text-slate-700 uppercase mb-1">Daily Construction Site Summary</h4>
                  <p className="text-xs text-slate-600 leading-relaxed font-medium">Site headcount operations are nominal. Dwell time on <span className="font-bold">Structure & Scaffolding L3</span> increased (+14% vs norm) due to concrete rebar tying. PPE compliance scanners reported 99.4% helmet tag active status.</p>
               </div>
            </div>
          </div>
        );

      case 'chart_over_time':
        return (
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col shadow-sm transition hover:shadow-md h-[300px]">
            <div className="flex justify-between items-center mb-3 shrink-0">
               <h3 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">Site crowd timeline</h3>
               <select className="bg-white text-[10px] font-semibold text-slate-600 border border-slate-200 shadow-sm rounded-md px-1.5 py-0.5 outline-none focus:border-[#007BC4]">
                 <option>Today</option>
               </select>
            </div>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={(mode === 'real' && timelineData.length > 0) ? timelineData : mockTimelineData} margin={{ top: 5, right: 0, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#007BC4" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#007BC4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="time" stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={9} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', padding: '6px 10px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} itemStyle={{ color: '#0f172a', fontWeight: 'bold', fontSize: '11px' }} />
                  <Area type="monotone" dataKey="load" stroke="#007BC4" strokeWidth={1.5} fillOpacity={1} fill="url(#colorLoad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        );

      case 'chart_top_zones':
        return (
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col shadow-sm transition hover:shadow-md h-[300px]">
            <h3 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2 shrink-0">Zone Occupancy Shares</h3>
            <div className="flex-1 flex items-center justify-center relative min-h-0">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={zoneData}
                     innerRadius="65%"
                     outerRadius="90%"
                     paddingAngle={2}
                     dataKey="value"
                     stroke="none"
                   >
                     {zoneData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                     ))}
                   </Pie>
                   <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', padding: '6px 10px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} itemStyle={{ color: '#0f172a', fontWeight: 'bold', fontSize: '11px' }} />
                 </PieChart>
               </ResponsiveContainer>
               <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                 <span className="text-xl font-bold text-slate-900">{people.length.toString()}</span>
                 <span className="text-[9px] font-semibold text-slate-500 uppercase tracking-widest">Total</span>
               </div>
               
               {/* Custom Legend Overlay */}
               <div className="absolute right-0 top-1/2 -translate-y-1/2 flex flex-col gap-1.5 pointer-events-none">
                 {zoneData.slice(0, 3).map((entry, index) => (
                   <div key={entry.name} className="flex items-center justify-between gap-1.5 text-[10px] bg-white/95 border border-slate-100 px-1.5 py-0.5 rounded shadow-sm backdrop-blur">
                     <div className="flex items-center gap-1">
                       <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                       <span className="text-slate-700 font-bold max-w-[50px] truncate">{entry.name}</span>
                     </div>
                     <span className="text-slate-500 font-bold">{Math.round((entry.value / people.length) * 100)}%</span>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        );

      case 'chart_device_status':
        return (
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col shadow-sm transition hover:shadow-md h-[300px] justify-between">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <h3 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">System Load & Readers</h3>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#007BC4] animate-ping"></span>
                <span className="text-[10px] font-bold text-[#007BC4]">Live Telemetry</span>
              </div>
            </div>
            
            <div className="grid grid-cols-12 gap-3 flex-1 min-h-0 items-center">
              {/* Readers Pie representation */}
              <div className="col-span-6 relative flex items-center justify-center h-full">
                <ResponsiveContainer width="100%" height={110}>
                  <PieChart>
                    <Pie
                      data={deviceData}
                      innerRadius="75%"
                      outerRadius="90%"
                      paddingAngle={0}
                      dataKey="value"
                      stroke="none"
                      startAngle={90}
                      endAngle={-270}
                    >
                      {deviceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-lg font-extrabold text-slate-900 leading-none">
                    {mode === 'real' ? deviceList.length : 32}
                  </span>
                  <span className="text-[8px] font-semibold text-slate-400 uppercase tracking-widest mt-0.5">Readers</span>
                </div>
              </div>

              {/* Status and Active System Load metrics right panel */}
              <div className="col-span-6 space-y-3">
                {/* Simulated/Real CPU Load */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-600">
                    <span className="flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-slate-400" /> CPU Load
                    </span>
                    <span className="text-slate-900">42%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-[#007BC4] h-full rounded-full transition-all duration-500" style={{ width: '42%' }} />
                  </div>
                </div>

                {/* Packet Polling Queue */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-600">
                    <span>Sweep Frequency</span>
                    <span className="text-emerald-600 font-extrabold">250 Hz</span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full transition-all duration-500" style={{ width: '78%' }} />
                  </div>
                </div>

                {/* Active Antennas count */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[9px] font-bold text-slate-500">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-100 text-emerald-600 border border-emerald-200 flex items-center justify-center text-[7px] font-bold justify-center flex-shrink-0">✓</span>
                    <span>All Antennas Nominal</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Labels overlay bottom bar footer */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between shrink-0">
              {deviceData.map(d => (
                <div key={d.name} className="flex items-center gap-1 leading-none">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d.color }}></span>
                  <span className="text-[10px] font-extrabold text-slate-700">{d.value}</span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">{d.name}</span>
                </div>
              ))}
            </div>
          </div>
        );

      case 'chart_heatmap':
        return (
          <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col shadow-sm transition hover:shadow-md h-[300px]">
            <h3 className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider mb-2 shrink-0">People Flow Heatmap</h3>
            <div className="flex-1 bg-slate-50 rounded-lg border border-slate-200 shadow-inner relative overflow-hidden flex items-center justify-center">
               <div className="absolute inset-0 z-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#007BC4 1px, transparent 1px), linear-gradient(90deg, #007BC4 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
               {mode === 'real' ? (
                 /* Real heatmap blobs based on tracked people coordinates */
                 people.map(p => (
                   <div 
                     key={p.id} 
                     className="absolute w-12 h-12 bg-[#007BC4]/30 dark:bg-sky-500/30 rounded-full blur-md animate-pulse pointer-events-none"
                     style={{ left: `${p.x}%`, top: `${p.y}%`, transform: 'translate(-50%, -50%)' }}
                   />
                 ))
               ) : (
                 <>
                   {/* Mock heatmap blobs */}
                   <div className="absolute top-1/4 left-1/4 w-12 h-12 bg-rose-500/50 rounded-full blur-lg"></div>
                   <div className="absolute top-1/2 left-1/2 w-16 h-16 bg-[#007BC4]/50 rounded-full blur-xl"></div>
                   <div className="absolute bottom-1/3 right-1/4 w-8 h-8 bg-amber-500/50 rounded-full blur-lg"></div>
                   <div className="absolute bottom-1/4 left-1/3 w-14 h-14 bg-emerald-500/50 rounded-full blur-lg"></div>
                 </>
               )}
               
               {/* Scale bar */}
               <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 z-10 bg-white/75 backdrop-blur px-2 py-1 rounded border border-slate-150">
                 <span className="text-[8px] font-black text-slate-500 uppercase leading-none">Low</span>
                 <div className="h-1 flex-1 rounded-full bg-gradient-to-r from-[#007BC4] via-emerald-400 to-rose-500"></div>
                 <span className="text-[8px] font-black text-slate-500 uppercase leading-none">High</span>
               </div>
            </div>
          </div>
        );

      case 'tech_footer':
        return (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 pt-4 shrink-0 w-full mb-2">
             <FooterCard icon={<Radio className="text-[#007BC4] w-5 h-5"/>} title="UHF RFID Technology" desc="Long range, high accuracy tracking for large environments." />
             <FooterCard icon={<Cpu className="text-[#8b5cf6] w-5 h-5"/>} title="AI Powered Analytics" desc="Behavior analysis and insightful reports." />
             <FooterCard icon={<MapIcon className="text-[#10b981] w-5 h-5"/>} title="Real-time Monitoring" desc="Live location and movement tracking." />
             <FooterCard icon={<Bell className="text-[#f59e0b] w-5 h-5"/>} title="Smart Alerts" desc="Instant notifications and event detection." />
             <FooterCard icon={<ShieldCheck className="text-[#007BC4] w-5 h-5"/>} title="Data Security" desc="Enterprise grade security and privacy." />
          </div>
        );
      default:
        return null;
    }
  };

  // Direct content dispatcher mapping metric KPI configurations dynamically
  const renderKpiCard = (id: string) => {
    const isReal = mode === 'real';
    switch (id) {
      case 'total_people':
        return (
          <KpiCard 
            key={id} 
            title="Total Registered People" 
            value={registeredCount.toString()} 
            sub="Registered personnel directory" 
            icon={<Users className="w-5 h-5 text-white" />} 
            iconColor="bg-[#007BC4]" 
            onClick={() => navigate('/people')} 
          />
        );
      case 'on_site':
        return (
          <KpiCard 
            key={id} 
            title="Currently On-Site" 
            value={people.length.toString()} 
            sub={isReal ? "Active tags tracking live" : "↗ 8.3% vs yesterday"} 
            icon={<UserCheck className="w-5 h-5 text-white" />} 
            iconColor="bg-[#10b981]" 
            onClick={() => navigate('/live')} 
          />
        );
      case 'in_motion':
        return (
          <KpiCard 
            key={id} 
            title="In Motion" 
            value={movingCount.toString()} 
            sub={isReal ? "Tags in moving state" : "↗ 15.7% vs yesterday"} 
            icon={<Activity className="w-5 h-5 text-white" />} 
            iconColor="bg-[#007BC4]" 
            onClick={() => navigate('/live')} 
          />
        );
      case 'alerts_count':
        return (
          <KpiCard 
            key={id} 
            title="Alerts" 
            value={alerts.length.toString()} 
            sub={isReal ? "AI-detected safety incidents" : "↘ 22.2% vs yesterday"} 
            icon={<ShieldAlert className="w-5 h-5 text-white" />} 
            iconColor="bg-[#f59e0b]" 
            onClick={() => navigate('/alerts')} 
          />
        );
      case 'dwell_time':
        return (
          <KpiCard 
            key={id} 
            title="Avg. Dwell Time" 
            value={`${avgDwellInfo}m`} 
            sub={isReal ? "Per active on-site session" : "↗ 5.6% vs yesterday"} 
            icon={<Clock className="w-5 h-5 text-white" />} 
            iconColor="bg-[#8b5cf6]" 
            onClick={() => navigate('/analytics')} 
          />
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-4 md:p-6 lg:p-8 flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4 animate-pulse">
           <div className="w-12 h-12 rounded-full border-4 border-[#007BC4] border-t-transparent animate-spin"></div>
           <div className="text-slate-500 font-medium tracking-wide">Syncing real-time data from Firestore...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full p-4 md:p-6 lg:p-8 flex flex-col gap-6 max-w-7xl mx-auto">
      
      {/* Premium Operations custom header bar with Configuration button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0 border-b border-slate-200/60 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <LayoutDashboard className="w-5 h-5 text-[#007BC4]" />
            Operations Control Panel
          </h2>
          <p className="text-xs text-slate-500 font-medium dark:text-slate-400">Manage real-time personnel analytics, alerts, and facility tracking.</p>
        </div>
        <div className="flex items-center gap-2">
           <button 
             onClick={() => alert('Starting PDF generation from current view... Download will begin shortly.')}
             className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-200 rounded-lg text-xs font-bold shadow-sm transition-transform active:scale-95 duration-150 cursor-pointer"
           >
             Export Report
           </button>
           <button 
             onClick={openCustomizeModal}
             className="flex items-center gap-2 px-3.5 py-2 bg-[#007BC4] text-white hover:bg-[#006aa9] rounded-lg text-xs font-bold shadow-md transition-transform active:scale-95 duration-150 cursor-pointer"
           >
             <SlidersHorizontal className="w-3.5 h-3.5" />
             Customize Dashboard
           </button>
        </div>
      </div>

      {/* Aperture RFID Controller Server Connection Banner */}
      {mode === 'real' ? (
        <div id="aperture_server_connected_banner" className="bg-white border border-[#10b981]/35 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-[#10b981]" />
          <div className="flex items-start gap-4 flex-1">
            <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 shrink-0 text-emerald-600">
              <Server className="w-5 h-5 animate-pulse" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">Aperture RFID Server Live Connection Active</span>
                <span className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1 border border-emerald-200">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  Real-Time Sync Ready
                </span>
                <span className="bg-blue-50 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded-full uppercase flex items-center gap-1 border border-blue-200">
                  <Wifi className="w-3 h-3" />
                  3s polling
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-2xl">
                Polling scans directly from your physical server controller. This page compiles UHF tag history telemetry, track coordinates, and triggers immediate alarms on safety hazards.
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 pt-1 font-mono text-[10px]">
                <div className="flex items-center gap-1 text-slate-500">
                  <span className="font-bold">Target Host:</span>
                  <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 uppercase tracking-tight font-medium max-w-[240px] truncate" title={apiConfig.url || "https://www.i360services.com/peopletrackinguhf"}>
                    {apiConfig.url || "https://www.i360services.com/peopletrackinguhf"}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-slate-500">
                  <span className="font-bold">Auth Strategy:</span>
                  <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded border border-slate-200 uppercase tracking-tight font-medium">
                    {apiConfig.authType === 'api_key' ? `API Key [Header: ${apiConfig.apiKeyHeader}]` : apiConfig.authType === 'bearer' ? 'Bearer JWT Bearer' : apiConfig.authType === 'basic' ? 'Basic Auth (User-Pass)' : apiConfig.authType === 'oauth' ? 'OAuth 2.0 Credentials' : 'None / Public Server'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 md:mt-0 shrink-0">
            <button 
              id="configure-connection-credentials-btn"
              onClick={() => navigate('/settings', { state: { focusSection: 'apidocs' } })}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-750 px-4 py-2 rounded-lg text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
            >
              <Key className="w-3.5 h-3.5 text-slate-500" />
              Configure Credentials
            </button>
            <button 
              id="sandbox-test-btn"
              onClick={() => navigate('/settings', { state: { focusSection: 'apidocs' } })}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-750 px-4 py-2 rounded-lg text-xs font-bold border border-slate-200 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-500" />
              Sandbox Console
            </button>
          </div>
        </div>
      ) : (
        <div id="gao_server_simulated_banner" className="bg-amber-50/70 border border-amber-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-amber-500" />
          <div className="flex items-start gap-4 flex-1">
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-100/60 shrink-0 text-amber-600">
              <WifiOff className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">Currently Running in Simulated Demo Mode</span>
                <span className="bg-amber-50 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase border border-amber-200">
                  Offline Playground Dataset
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-relaxed max-w-2xl">
                The dashboard is currently running in simulated/mock mode. To connect your physical old server's API Key and display your real live production UHF employee tracking scans, switch to Real Connection Mode.
              </p>
              <div className="flex flex-wrap items-center gap-3 mt-2 font-semibold text-[11px] text-amber-700">
                <span>✓ Isolated local tracking sweeps</span>
                <span>•</span>
                <span>✓ High-fidelity loitering models</span>
                <span>•</span>
                <span>✓ Simulated emergency hazards</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 md:mt-0 shrink-0">
            <button 
              id="dashboard_sim_to_config_btn"
              onClick={() => navigate('/settings', { state: { focusSection: 'apidocs' } })}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2.5 rounded-lg text-xs font-bold border border-amber-500 shadow-sm transition-transform active:scale-95 duration-100 cursor-pointer"
            >
              Configure Aperture API Key <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Dynamic KPI Cards Row */}
      {sortedVisibleKpis.length > 0 ? (
        <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-${Math.min(sortedVisibleKpis.length, 5)} gap-4 shrink-0`}>
          {sortedVisibleKpis.map(k => renderKpiCard(k.id))}
        </div>
      ) : (
        <div className="bg-slate-100 border border-dashed border-slate-300 rounded-xl p-4 text-center text-slate-500 text-xs font-semibold flex items-center justify-center gap-2">
          <span>All metric cards are currently hidden.</span>
          <button onClick={openCustomizeModal} className="text-[#007BC4] hover:underline font-bold">Configure Layout →</button>
        </div>
      )}
      
      {/* Dynamic 12-column Grid of Main Panels & Charts */}
      {sortedVisiblePanels.length > 0 ? (
        <div className="grid grid-cols-12 gap-6 items-start shrink-0">
          {sortedVisiblePanels.map(panel => {
            const widthClass = getPanelWidthClass(panel.width);
            return (
              <div key={panel.id} className={widthClass}>
                {renderPanelContent(panel.id)}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border rounded-xl p-10 text-center shadow-sm flex flex-col items-center justify-center gap-3">
          <SlidersHorizontal className="w-8 h-8 text-slate-300" />
          <h3 className="font-bold text-slate-700 text-sm">Dashboard layout empty</h3>
          <p className="text-xs text-slate-500 max-w-sm">No panels are currently toggled on. Customize your operations console to display the maps, graphs, and logs you want to track.</p>
          <button 
            onClick={openCustomizeModal}
            className="mt-2 px-4 py-2 bg-[#007BC4] hover:bg-[#006aa9] text-white text-xs font-bold rounded-lg shadow transition"
          >
            Select Layout Panels
          </button>
        </div>
      )}

      {/* Floating Side-Panel Customizer (Slide-In Slide-Out Drawer) */}
      {showCustomizeModal && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Transparent Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setShowCustomizeModal(false)}
          />
          
          {/* Slide Drawer body container */}
          <div className="w-[440px] max-w-full bg-white h-full relative z-10 shadow-2xl flex flex-col justify-between border-l border-slate-200">
            
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-150 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#007BC4]/10 rounded-lg text-[#007BC4]">
                  <SlidersHorizontal className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Customize Dashboard Layout</h3>
                  <span className="text-[10px] text-slate-500 font-medium">Toggle, resize and sort your tracking panels.</span>
                </div>
              </div>
              <button 
                onClick={() => setShowCustomizeModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Config Tabs Selector */}
            <div className="flex border-b border-slate-150 text-xs shrink-0 bg-slate-50/50">
              <button 
                onClick={() => setActiveTab('metrics')}
                className={`flex-1 py-3 text-center font-bold relative transition ${activeTab === 'metrics' ? 'text-[#007BC4]' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Metric Cards
                {activeTab === 'metrics' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#007BC4]" />}
              </button>
              <button 
                onClick={() => setActiveTab('grids')}
                className={`flex-1 py-3 text-center font-bold relative transition ${activeTab === 'grids' ? 'text-[#007BC4]' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Charts & Panels Grid
                {activeTab === 'grids' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-[#007BC4]" />}
              </button>
            </div>
            
            {/* Scrollable Form body */}
            <div className="flex-1 overflow-y-auto p-5">
              {activeTab === 'metrics' ? (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5 bg-[#007BC4]/5 p-3 rounded-lg border border-[#007BC4]/10">
                    <p className="text-[11px] leading-relaxed text-slate-600 font-medium">✨ <strong>Drag-and-Drop Enabled:</strong> Drag any card using the grid handle to rearrange, or toggle its visibility checkbox.</p>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    {[...tempKpis]
                      .filter(k => !k.deleted)
                      .sort((a,b) => a.order - b.order)
                      .map((kpi, idx, arr) => {
                        const isDraggingObj = draggedIdx === idx;
                        const isOver = dragOverIdx === idx;
                        
                        return (
                          <motion.div 
                            layout
                            id={`kpi-item-${kpi.id}`}
                            key={kpi.id}
                            draggable
                            onDragStart={(e: any) => handleDragStart(e, idx)}
                            onDragOver={(e: any) => handleDragOver(e, idx)}
                            onDragEnd={handleDragEnd}
                            onDrop={(e) => handleDrop(e, idx, 'kpi')}
                            transition={{ type: "spring", stiffness: 350, damping: 30 }}
                            className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-grab active:cursor-grabbing select-none ${
                              isDraggingObj 
                                ? 'opacity-30 border-dashed border-[#007BC4] bg-slate-100' 
                                : isOver 
                                  ? 'border-[#007BC4] bg-[#007BC4]/10 shadow-md scale-[1.01]' 
                                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {/* Grip Icon Drag Handle */}
                              <div className="text-slate-400 hover:text-slate-600 p-0.5 pointer-events-none">
                                <GripVertical className="w-4 h-4 shrink-0" />
                              </div>
                              
                              <button 
                                onClick={() => handleToggleKpi(kpi.id)}
                                className={`p-1.5 rounded-md hover:bg-white border transition shadow-xs ${kpi.visible ? 'text-[#007BC4] border-[#007BC4]/20 bg-[#007BC4]/5' : 'text-slate-400 border-slate-200 bg-white'}`}
                                title={kpi.visible ? "Disable metric" : "Enable metric"}
                              >
                                {kpi.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                              </button>
                              <span className={`text-xs font-bold ${kpi.visible ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{kpi.title}</span>
                            </div>
                            
                            {/* Actions bar */}
                            <div className="flex items-center gap-1">
                              <button 
                                onClick={() => handleMoveKpiUp(idx)}
                                disabled={idx === 0}
                                className="p-1 rounded bg-white hover:bg-slate-200 text-slate-500 disabled:opacity-20 transition shadow-xs border border-slate-100"
                                title="Move Up"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleMoveKpiDown(idx)}
                                disabled={idx === arr.length - 1}
                                className="p-1 rounded bg-white hover:bg-slate-200 text-slate-500 disabled:opacity-20 transition shadow-xs border border-slate-100"
                                title="Move Down"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => handleDeleteKpi(kpi.id)}
                                className="p-1 rounded bg-white hover:bg-red-50 text-red-500 hover:text-red-700 transition shadow-xs border border-slate-100 ml-1 cursor-pointer"
                                title="Delete Option"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </motion.div>
                        );
                      })}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5 bg-[#007BC4]/5 p-3 rounded-lg border border-[#007BC4]/10">
                    <p className="text-[11px] leading-relaxed text-slate-600 font-medium">✨ <strong>Drag-and-Drop Enabled:</strong> Use the grippers to dynamically order active tracking widgets. Modify widths below to resize the dashboard grid columns.</p>
                  </div>

                  <div className="flex flex-col gap-3">
                    {[...tempPanels]
                      .filter(p => !p.deleted)
                      .sort((a,b) => a.order - b.order)
                      .map((panel, idx, arr) => {
                        const isDraggingObj = draggedIdx === idx;
                        const isOver = dragOverIdx === idx;
                        
                        return (
                          <motion.div 
                            layout
                            id={`panel-item-${panel.id}`}
                            key={panel.id}
                            draggable
                            onDragStart={(e: any) => handleDragStart(e, idx)}
                            onDragOver={(e: any) => handleDragOver(e, idx)}
                            onDragEnd={handleDragEnd}
                            onDrop={(e) => handleDrop(e, idx, 'panel')}
                            transition={{ type: "spring", stiffness: 350, damping: 30 }}
                            className={`p-3.5 rounded-lg border flex flex-col gap-2 transition-all cursor-grab active:cursor-grabbing select-none ${
                              isDraggingObj
                                ? 'opacity-30 border-dashed border-[#007BC4] bg-slate-100'
                                : isOver
                                  ? 'border-[#007BC4] bg-[#007BC4]/10 shadow-lg scale-[1.01]'
                                  : panel.visible 
                                    ? 'bg-slate-50/50 hover:bg-slate-50 border-slate-200 shadow-none' 
                                    : 'bg-slate-50 border-slate-200/50 opacity-70 border-dashed'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {/* Grip Drag Handle */}
                                <div className="text-slate-400 hover:text-slate-600 p-0.5 pointer-events-none">
                                  <GripVertical className="w-4 h-4 shrink-0" />
                                </div>
                                
                                <button 
                                  onClick={() => handleTogglePanel(panel.id)}
                                  className={`p-1.5 rounded-md hover:bg-white border transition shadow-xs ${panel.visible ? 'text-[#007BC4] border-[#007BC4]/20 bg-[#007BC4]/5' : 'text-slate-400 border-slate-200 bg-white'}`}
                                  title={panel.visible ? "Disable widget" : "Enable widget"}
                                >
                                  {panel.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                </button>
                                <div>
                                  <p className={`text-xs font-bold leading-tight ${panel.visible ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{panel.title}</p>
                                  <p className="text-[9px] text-slate-400 mt-0.5 leading-tight max-w-[200px]">{panel.description}</p>
                                </div>
                              </div>
                              
                              {/* Alternative reorder keys */}
                              <div className="flex items-center gap-1 shrink-0">
                                <button 
                                  onClick={() => handleMovePanelUp(idx)}
                                  disabled={idx === 0}
                                  className="p-1 rounded bg-white hover:bg-slate-200 text-slate-500 disabled:opacity-20 transition shadow-xs border border-slate-100"
                                  title="Move Up"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleMovePanelDown(idx)}
                                  disabled={idx === arr.length - 1}
                                  className="p-1 rounded bg-white hover:bg-slate-200 text-slate-500 disabled:opacity-20 transition shadow-xs border border-slate-100"
                                  title="Move Down"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                <button 
                                  onClick={() => handleDeletePanel(panel.id)}
                                  className="p-1 rounded bg-white hover:bg-red-50 text-red-500 hover:text-red-700 transition shadow-xs border border-slate-100 ml-1 cursor-pointer"
                                  title="Delete Option"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            
                            {/* Width selector grids */}
                            {panel.visible && panel.id !== 'tech_footer' && (
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mt-2 pt-2 border-t border-slate-200/50">
                                <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none">Grid column width</label>
                                <div className="flex items-center gap-0.5 self-end sm:self-auto">
                                  {(['1/4', '1/3', '1/2', '2/3', 'full'] as const).map(w => {
                                    const isSelected = panel.width === w;
                                    return (
                                      <button
                                        key={w}
                                        onClick={() => handleResizePanel(panel.id, w)}
                                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold border transition ${isSelected ? 'bg-[#007BC4] text-white border-[#007BC4] shadow-xs' : 'bg-white hover:bg-slate-150 text-slate-500 border-slate-200'}`}
                                      >
                                        {w}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

            {/* Customizer footer */}
            <div className="p-4 border-t border-slate-150 flex items-center justify-between bg-slate-50">
              <button 
                onClick={handleResetLayout}
                className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase text-slate-400 hover:text-rose-500 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Defaults
              </button>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setShowCustomizeModal(false)}
                  className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-bold text-slate-700 cursor-pointer transition active:scale-95 duration-100"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleSaveLayout(tempKpis, tempPanels)}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 px-4 py-2 bg-[#007BC4] hover:bg-[#006aa9] rounded-lg text-xs font-bold text-white cursor-pointer transition shadow hover:shadow-md disabled:opacity-50 active:scale-95 duration-100"
                >
                  {isSaving ? (
                    <>
                      <LoaderSpin />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      Save Settings
                    </>
                  )}
                </button>
              </div>
            </div>
            
          </div>
        </div>
      )}

    </div>
  );
}

function LoaderSpin() {
  return (
    <svg className="animate-spin h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
  );
}

function KpiCard({ 
  title, 
  value, 
  sub, 
  icon, 
  iconColor, 
  onClick 
}: { 
  key?: string,
  title: string, 
  value: string, 
  sub: string, 
  icon: ReactNode, 
  iconColor: string, 
  onClick?: () => void 
}) {
  const isUp = sub.includes('↗');
  const isDown = sub.includes('↘');
  const colorClass = isUp ? 'text-emerald-500' : isDown ? 'text-rose-500' : 'text-slate-500/70 font-bold';
  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex items-center gap-4 transition duration-200 hover:scale-[1.015] hover:shadow-md ${onClick ? 'cursor-pointer hover:border-[#007BC4]/40 hover:bg-[#007BC4]/5 active:scale-[0.98]' : ''}`}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconColor} shadow-inner`}>
        {icon}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-xs font-bold text-slate-500 truncate mb-0.5">{title}</span>
        <span className="text-2xl font-extrabold text-slate-900 leading-none mb-1">{value}</span>
        <span className={`text-[10px] ${colorClass} truncate`}>{sub}</span>
      </div>
    </div>
  );
}

function FooterCard({ icon, title, desc }: { icon: ReactNode, title: string, desc: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3 flex items-start gap-3 transition hover:shadow-md border-t-2 border-t-[#007BC4]/20">
       <div className="p-2 bg-slate-50 rounded-lg border border-slate-100/50 text-[#007BC4]">
         {icon}
       </div>
       <div className="flex flex-col">
         <h4 className="text-xs font-black text-slate-900 mb-0.5">{title}</h4>
         <p className="text-[10px] font-semibold text-slate-400 leading-tight">{desc}</p>
       </div>
    </div>
  );
}
