import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Radio, Wifi, WifiOff, AlertCircle, RefreshCw, MoreVertical, Plus, X, Save, 
  MapPin, Cpu, Video, Eye, CloudSun, Satellite, Sliders, Download, CheckCircle2, 
  Zap, Thermometer, Activity, Layers, ShieldCheck, AlertTriangle, Gauge, Terminal, 
  Settings2, Maximize2, ScanEye, Radar, CircleDot, HardDrive, Play, ArrowUpRight, 
  Clock, Shield, Sparkles, Filter, Check, RotateCcw
} from 'lucide-react';
import { collection, onSnapshot, doc, setDoc } from '../lib/db';
import { db } from '../lib/firebase';
import { useNavigate } from 'react-router-dom';

export interface DeviceItem {
  id: string;
  name: string;
  category: 'rfid' | 'ble' | 'gps' | 'iot' | 'cctv' | 'ai_camera' | 'weather';
  type: string;
  location: string;
  zoneId: string;
  status: 'online' | 'warning' | 'critical' | 'offline';
  ip: string;
  mac: string;
  firmware: string;
  latestFirmware: string;
  signalRssi: number; // e.g. -58 dBm
  coverageRadiusMeters: number;
  temperatureC: number;
  cpuUsagePct: number;
  memoryUsagePct: number;
  pingMs: number;
  uptime: string;
  lastPing: string;
  calibrationStatus: 'Calibrated' | 'Needs Calibration' | 'Calibrating';
  otaStatus: 'Up to Date' | 'Update Available' | 'Updating';
}

const DEFAULT_DEVICES: DeviceItem[] = [
  {
    id: 'RDR-FX9600-01',
    name: 'Main Gate RFID Turnstile Portal',
    category: 'rfid',
    type: 'UHF RFID Fixed Reader',
    location: 'Main Site Entrance (Zone A)',
    zoneId: 'zone-a',
    status: 'online',
    ip: '192.168.10.42',
    mac: '00:1A:2B:3C:4D:01',
    firmware: 'v3.8.2',
    latestFirmware: 'v3.8.2',
    signalRssi: -48,
    coverageRadiusMeters: 18,
    temperatureC: 38.4,
    cpuUsagePct: 24,
    memoryUsagePct: 41,
    pingMs: 12,
    uptime: '14d 6h',
    lastPing: '2s ago',
    calibrationStatus: 'Calibrated',
    otaStatus: 'Up to Date'
  },
  {
    id: 'GW-BLE53-02',
    name: 'Tower Alpha Scaffold BLE Gateway',
    category: 'ble',
    type: 'BLE 5.3 Angle-of-Arrival (AoA) Gateway',
    location: 'Tower Alpha Shaft (Zone B)',
    zoneId: 'zone-b',
    status: 'online',
    ip: '192.168.10.88',
    mac: '00:1A:2B:3C:4D:02',
    firmware: 'v2.1.0',
    latestFirmware: 'v2.2.1',
    signalRssi: -56,
    coverageRadiusMeters: 35,
    temperatureC: 41.2,
    cpuUsagePct: 35,
    memoryUsagePct: 52,
    pingMs: 18,
    uptime: '8d 12h',
    lastPing: '1s ago',
    calibrationStatus: 'Calibrated',
    otaStatus: 'Update Available'
  },
  {
    id: 'GPS-RTK-01',
    name: 'Differential RTK GPS Base Station',
    category: 'gps',
    type: 'GPS/GNSS High-Precision Base Station',
    location: 'Site Roof Mast Alpha',
    zoneId: 'zone-a',
    status: 'online',
    ip: '192.168.10.15',
    mac: '00:1A:2B:3C:4D:03',
    firmware: 'v5.0.4',
    latestFirmware: 'v5.0.4',
    signalRssi: -38,
    coverageRadiusMeters: 500,
    temperatureC: 35.1,
    cpuUsagePct: 15,
    memoryUsagePct: 28,
    pingMs: 8,
    uptime: '30d 2h',
    lastPing: 'Just now',
    calibrationStatus: 'Calibrated',
    otaStatus: 'Up to Date'
  },
  {
    id: 'IOT-GAS-03',
    name: 'Sub-Basement Gas & Dust Sensor Node',
    category: 'iot',
    type: 'Multi-Gas (CO2/H2S/Dust) LoRaWAN Sensor',
    location: 'Sub-Basement B1 Trench (Zone C)',
    zoneId: 'zone-c',
    status: 'warning',
    ip: '192.168.10.112',
    mac: '00:1A:2B:3C:4D:04',
    firmware: 'v1.4.1',
    latestFirmware: 'v1.5.0',
    signalRssi: -82,
    coverageRadiusMeters: 25,
    temperatureC: 48.9,
    cpuUsagePct: 62,
    memoryUsagePct: 78,
    pingMs: 145,
    uptime: '3d 18h',
    lastPing: '12s ago',
    calibrationStatus: 'Needs Calibration',
    otaStatus: 'Update Available'
  },
  {
    id: 'CAM-CCTV-04',
    name: 'Crane Laydown 4K PTZ Camera',
    category: 'cctv',
    type: '4K Heavy Industrial PTZ Camera',
    location: 'Laydown Yard & Material Depot',
    zoneId: 'zone-[#d]',
    status: 'online',
    ip: '192.168.20.50',
    mac: '00:1A:2B:3C:4D:05',
    firmware: 'v4.1.2',
    latestFirmware: 'v4.1.2',
    signalRssi: -50,
    coverageRadiusMeters: 80,
    temperatureC: 42.0,
    cpuUsagePct: 48,
    memoryUsagePct: 64,
    pingMs: 15,
    uptime: '12d 4h',
    lastPing: '3s ago',
    calibrationStatus: 'Calibrated',
    otaStatus: 'Up to Date'
  },
  {
    id: 'CAM-AI-01',
    name: 'PPE & Restricted Zone AI Camera',
    category: 'ai_camera',
    type: 'Edge AI Vision Processing Camera',
    location: 'Excavation Sector B (Zone E)',
    zoneId: 'zone-e',
    status: 'online',
    ip: '192.168.20.66',
    mac: '00:1A:2B:3C:4D:06',
    firmware: 'v2.8.0',
    latestFirmware: 'v2.8.0',
    signalRssi: -54,
    coverageRadiusMeters: 45,
    temperatureC: 44.5,
    cpuUsagePct: 81,
    memoryUsagePct: 88,
    pingMs: 22,
    uptime: '5d 9h',
    lastPing: 'Just now',
    calibrationStatus: 'Calibrated',
    otaStatus: 'Up to Date'
  },
  {
    id: 'WX-STATION-01',
    name: 'Crane Wind & Weather Station WXT530',
    category: 'weather',
    type: 'Ultrasonic Anemometer & Rain Station',
    location: 'Tower Crane TC-01 Top Mast',
    zoneId: 'zone-crane',
    status: 'online',
    ip: '192.168.10.201',
    mac: '00:1A:2B:3C:4D:07',
    firmware: 'v1.2.9',
    latestFirmware: 'v1.2.9',
    signalRssi: -42,
    coverageRadiusMeters: 150,
    temperatureC: 32.8,
    cpuUsagePct: 18,
    memoryUsagePct: 30,
    pingMs: 10,
    uptime: '45d 1h',
    lastPing: '1s ago',
    calibrationStatus: 'Calibrated',
    otaStatus: 'Up to Date'
  },
  {
    id: 'GW-BLE53-03',
    name: 'Sub-Basement Trench Gateway B2',
    category: 'ble',
    type: 'BLE Mesh Repeater Gateway',
    location: 'Sub-Basement B2 Deep Pit',
    zoneId: 'zone-pit',
    status: 'critical',
    ip: '192.168.10.119',
    mac: '00:1A:2B:3C:4D:08',
    firmware: 'v1.9.4',
    latestFirmware: 'v2.2.1',
    signalRssi: -94,
    coverageRadiusMeters: 12,
    temperatureC: 56.2,
    cpuUsagePct: 92,
    memoryUsagePct: 95,
    pingMs: 420,
    uptime: '0d 2h',
    lastPing: '45s ago',
    calibrationStatus: 'Needs Calibration',
    otaStatus: 'Update Available'
  }
];

export default function DevicesTab() {
  const navigate = useNavigate();

  // State
  const [devices, setDevices] = useState<DeviceItem[]>(DEFAULT_DEVICES);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'inventory' | 'heatmap' | 'deadzones' | 'ota'>('inventory');

  // Modals & Action States
  const [selectedDevice, setSelectedDevice] = useState<DeviceItem | null>(null);
  const [actionModalType, setActionModalType] = useState<'restart' | 'calibrate' | 'ota' | 'diagnostics' | 'add' | null>(null);
  
  // Interactive Action Progress
  const [actionProgress, setActionProgress] = useState<number>(0);
  const [actionLog, setActionLog] = useState<string[]>([]);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // New Device Form State
  const [newDevId, setNewDevId] = useState('');
  const [newDevName, setNewDevName] = useState('');
  const [newDevCategory, setNewDevCategory] = useState<DeviceItem['category']>('rfid');
  const [newDevType, setNewDevType] = useState('UHF RFID Reader');
  const [newDevLocation, setNewDevLocation] = useState('Entrance Zone A');
  const [newDevIp, setNewDevIp] = useState('192.168.10.150');

  // Load from Firebase or combine
  useEffect(() => {
    const unsubDevices = onSnapshot(collection(db, 'devices'), (snapshot) => {
      if (!snapshot.empty) {
        const firestoreDevices: DeviceItem[] = [];
        snapshot.forEach(d => {
          const data = d.data();
          firestoreDevices.push({
            id: d.id,
            name: data.name || 'Unnamed Device',
            category: data.category || 'rfid',
            type: data.type || 'Reader Gateway',
            location: data.location || 'Site Location',
            zoneId: data.zoneId || 'zone-a',
            status: data.status || 'online',
            ip: data.ip || '192.168.10.100',
            mac: data.mac || '00:1A:2B:3C:4D:FE',
            firmware: data.firmware || 'v2.0.0',
            latestFirmware: data.latestFirmware || 'v2.0.0',
            signalRssi: data.signalRssi || -60,
            coverageRadiusMeters: data.coverageRadiusMeters || 20,
            temperatureC: data.temperatureC || 36,
            cpuUsagePct: data.cpuUsagePct || 20,
            memoryUsagePct: data.memoryUsagePct || 40,
            pingMs: data.pingMs || 10,
            uptime: data.uptime || '1d 0h',
            lastPing: 'Just now',
            calibrationStatus: data.calibrationStatus || 'Calibrated',
            otaStatus: data.otaStatus || 'Up to Date'
          });
        });
        
        // Merge with defaults
        const map = new Map<string, DeviceItem>();
        DEFAULT_DEVICES.forEach(dev => map.set(dev.id, dev));
        firestoreDevices.forEach(dev => map.set(dev.id, dev));
        setDevices(Array.from(map.values()));
      }
    });

    return () => unsubDevices();
  }, []);

  // Filtered Devices
  const filteredDevices = useMemo(() => {
    return devices.filter(dev => {
      const matchesCategory = selectedCategory === 'all' || dev.category === selectedCategory;
      const matchesStatus = selectedStatus === 'all' || dev.status === selectedStatus;
      const matchesSearch = 
        dev.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dev.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dev.ip.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dev.mac.toLowerCase().includes(searchTerm.toLowerCase()) ||
        dev.location.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesStatus && matchesSearch;
    });
  }, [devices, selectedCategory, selectedStatus, searchTerm]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = devices.length;
    const online = devices.filter(d => d.status === 'online').length;
    const warning = devices.filter(d => d.status === 'warning').length;
    const critical = devices.filter(d => d.status === 'critical').length;
    const offline = devices.filter(d => d.status === 'offline').length;
    const otaPending = devices.filter(d => d.otaStatus === 'Update Available').length;
    const needsCalib = devices.filter(d => d.calibrationStatus === 'Needs Calibration').length;
    
    return { total, online, warning, critical, offline, otaPending, needsCalib };
  }, [devices]);

  // Handlers for Device Actions
  const handleTriggerRestart = (device: DeviceItem) => {
    setSelectedDevice(device);
    setActionModalType('restart');
    setActionProgress(0);
    setActionLog(['Initializing remote soft reboot command...', 'Connecting via SSH / Telnet Gateway...', 'Sending SIGTERM to gateway daemon process...']);
  };

  const handleExecuteRestart = () => {
    setIsProcessingAction(true);
    setActionProgress(20);
    setTimeout(() => {
      setActionProgress(60);
      setActionLog(prev => [...prev, 'System rebooting...', 'Flushing IP socket buffers...', 'Verifying interface link state...']);
      setTimeout(() => {
        setActionProgress(100);
        setActionLog(prev => [...prev, 'Device re-connected successfully!', 'Status: ONLINE | Heartbeat 2ms']);
        setIsProcessingAction(false);
        setDevices(prev => prev.map(d => d.id === selectedDevice?.id ? { ...d, status: 'online', pingMs: 12, uptime: '0d 0h' } : d));
      }, 1000);
    }, 1000);
  };

  const handleTriggerCalibration = (device: DeviceItem) => {
    setSelectedDevice(device);
    setActionModalType('calibrate');
    setActionProgress(0);
    setActionLog(['Starting Antenna Signal & Frequency Sweep...', 'Sampling baseline noise floor RSSI...']);
  };

  const handleExecuteCalibration = () => {
    setIsProcessingAction(true);
    setActionProgress(25);
    setTimeout(() => {
      setActionProgress(70);
      setActionLog(prev => [...prev, 'Phase offset tuned to 0.04 rad.', 'Gain calibrated at +24 dBm.', 'Cross-talk interference eliminated.']);
      setTimeout(() => {
        setActionProgress(100);
        setActionLog(prev => [...prev, 'Calibration Completed Successfully!', 'Precision rating: 99.8%']);
        setIsProcessingAction(false);
        setDevices(prev => prev.map(d => d.id === selectedDevice?.id ? { ...d, calibrationStatus: 'Calibrated', signalRssi: -45 } : d));
      }, 1000);
    }, 1000);
  };

  const handleTriggerOTA = (device: DeviceItem) => {
    setSelectedDevice(device);
    setActionModalType('ota');
    setActionProgress(0);
    setActionLog([`Fetching firmware binary package ${device.latestFirmware}...`, 'Verifying MD5 checksum SHA-256...']);
  };

  const handleExecuteOTA = () => {
    setIsProcessingAction(true);
    setActionProgress(30);
    setTimeout(() => {
      setActionProgress(75);
      setActionLog(prev => [...prev, 'Flashing firmware image to ROM partition B...', 'Swapping bootloader register...', 'Performing self-diagnostic boot check...']);
      setTimeout(() => {
        setActionProgress(100);
        setActionLog(prev => [...prev, 'OTA Firmware Update Applied!', `Running build: ${selectedDevice?.latestFirmware}`]);
        setIsProcessingAction(false);
        setDevices(prev => prev.map(d => d.id === selectedDevice?.id ? { ...d, firmware: d.latestFirmware, otaStatus: 'Up to Date' } : d));
      }, 1200);
    }, 1000);
  };

  const handleAddDevice = async () => {
    if (!newDevName || !newDevId) return;
    const newObj: DeviceItem = {
      id: newDevId,
      name: newDevName,
      category: newDevCategory,
      type: newDevType,
      location: newDevLocation,
      zoneId: 'zone-new',
      status: 'online',
      ip: newDevIp,
      mac: '00:1A:2B:88:99:AA',
      firmware: 'v3.0.0',
      latestFirmware: 'v3.0.0',
      signalRssi: -42,
      coverageRadiusMeters: 30,
      temperatureC: 36.0,
      cpuUsagePct: 15,
      memoryUsagePct: 30,
      pingMs: 10,
      uptime: '0d 1h',
      lastPing: 'Just now',
      calibrationStatus: 'Calibrated',
      otaStatus: 'Up to Date'
    };

    try {
      await setDoc(doc(db, 'devices', newDevId), newObj as any);
      setDevices(prev => [newObj, ...prev]);
      setActionModalType(null);
      setNewDevId('');
      setNewDevName('');
    } catch (e) {
      console.error(e);
      setDevices(prev => [newObj, ...prev]);
      setActionModalType(null);
    }
  };

  const getCategoryBadge = (cat: DeviceItem['category']) => {
    switch (cat) {
      case 'rfid':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#007BC4] border border-blue-200"><Radio size={12} /> RFID Reader</span>;
      case 'ble':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200"><Wifi size={12} /> BLE Gateway</span>;
      case 'gps':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200"><Satellite size={12} /> GPS Base</span>;
      case 'iot':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"><Cpu size={12} /> IoT Sensor</span>;
      case 'cctv':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300"><Video size={12} /> CCTV Cam</span>;
      case 'ai_camera':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200"><Eye size={12} /> AI Vision</span>;
      case 'weather':
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-50 text-cyan-700 border border-cyan-200"><CloudSun size={12} /> Weather Station</span>;
    }
  };

  const getStatusBadge = (status: DeviceItem['status']) => {
    switch (status) {
      case 'online':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> ONLINE
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> WARNING
          </span>
        );
      case 'critical':
      case 'offline':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> {status.toUpperCase()}
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col w-full h-full p-4 md:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      
      {/* 1. PAGE HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Cpu className="w-7 h-7 text-[#007BC4]" />
              Enterprise Hardware & Device Management
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-50 text-[#007BC4] border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300">
              Live Sensor Fabric
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-xs md:text-sm mt-0.5">
            Real-time telemetry, firmware, health diagnostics, coverage heatmaps & dead zone detection for construction hardware
          </p>
        </div>

        {/* Global Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActionModalType('add')}
            className="px-3.5 py-2 bg-[#007BC4] text-white rounded-xl text-xs font-bold shadow-sm hover:bg-blue-700 transition flex items-center gap-1.5"
          >
            <Plus size={16} /> Register New Device
          </button>
        </div>
      </div>

      {/* 2. TOP METRICS SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Total Hardware</div>
          <div className="text-2xl font-black text-slate-900 dark:text-white mt-1">{metrics.total}</div>
          <div className="text-[10px] font-semibold text-slate-500 mt-0.5">Active Monitored</div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Healthy / Online</div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{metrics.online}</div>
          <div className="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5 mt-0.5">
            <CheckCircle2 size={10} /> 100% Signal Link
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Signal Warning</div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">{metrics.warning}</div>
          <div className="text-[10px] font-semibold text-amber-600 mt-0.5">Weak RSSI (-80dB+)</div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Critical / Offline</div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{metrics.critical + metrics.offline}</div>
          <div className="text-[10px] font-semibold text-rose-600 mt-0.5">Needs Attention</div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Pending OTA</div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-1">{metrics.otaPending}</div>
          <div className="text-[10px] font-semibold text-purple-600 mt-0.5">Firmware Available</div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 shadow-sm">
          <div className="text-[10px] font-bold text-slate-400 uppercase">Needs Calibration</div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{metrics.needsCalib}</div>
          <div className="text-[10px] font-semibold text-blue-600 mt-0.5">Antenna Offset</div>
        </div>
      </div>

      {/* 3. MAIN TAB NAVIGATION STRIP */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-2 shadow-sm">
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'inventory', label: 'Device Inventory & Health', icon: HardwareIcon },
            { id: 'heatmap', label: 'Signal Coverage Heatmap', icon: Radar },
            { id: 'deadzones', label: 'Dead Zone Analyzer', icon: ScanEye },
            { id: 'ota', label: 'Mass OTA Firmware Hub', icon: Zap }
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
                  active 
                    ? 'bg-[#007BC4] text-white shadow-sm' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Filter Bar inside inventory */}
        {activeTab === 'inventory' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
              <input
                type="text"
                placeholder="Search IP, MAC, Name, Zone..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#007BC4]"
              />
            </div>
          </div>
        )}
      </div>

      {/* 4. TAB CONTENT AREAS */}

      {/* --- TAB A: DEVICE INVENTORY & HEALTH MATRIX --- */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          
          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-xs font-bold text-slate-400 mr-2 flex items-center gap-1">
              <Filter size={12} /> Category:
            </span>
            {[
              { id: 'all', label: 'All Hardware' },
              { id: 'rfid', label: 'RFID Readers' },
              { id: 'ble', label: 'BLE Gateways' },
              { id: 'gps', label: 'GPS Base' },
              { id: 'iot', label: 'IoT Sensors' },
              { id: 'cctv', label: 'CCTV' },
              { id: 'ai_camera', label: 'AI Cameras' },
              { id: 'weather', label: 'Weather' }
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  selectedCategory === cat.id 
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm' 
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Device Table */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-slate-200 dark:border-slate-700 text-slate-500 font-bold uppercase text-[10px]">
                    <th className="p-3.5">Device Identifier & Type</th>
                    <th className="p-3.5">Category</th>
                    <th className="p-3.5">Status & Health</th>
                    <th className="p-3.5">IP / MAC Address</th>
                    <th className="p-3.5">Firmware</th>
                    <th className="p-3.5">Signal (RSSI)</th>
                    <th className="p-3.5">Coverage</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                  {filteredDevices.map(device => (
                    <tr key={device.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-700/40 transition">
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                            {device.category === 'rfid' && <Radio size={16} className="text-[#007BC4]" />}
                            {device.category === 'ble' && <Wifi size={16} className="text-indigo-600" />}
                            {device.category === 'gps' && <Satellite size={16} className="text-purple-600" />}
                            {device.category === 'iot' && <Cpu size={16} className="text-emerald-600" />}
                            {device.category === 'cctv' && <Video size={16} className="text-slate-600" />}
                            {device.category === 'ai_camera' && <Eye size={16} className="text-amber-600" />}
                            {device.category === 'weather' && <CloudSun size={16} className="text-cyan-600" />}
                          </div>
                          <div>
                            <strong className="text-slate-900 dark:text-white font-bold block">{device.name}</strong>
                            <div className="text-[10px] text-slate-400 font-mono">{device.id} • {device.type}</div>
                            <button
                              onClick={() => navigate('/live', { state: { focusZone: device.location } })}
                              className="text-[10px] text-[#007BC4] hover:underline flex items-center gap-0.5 mt-0.5 font-bold"
                            >
                              <MapPin size={10} /> {device.location}
                            </button>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5">
                        {getCategoryBadge(device.category)}
                      </td>

                      <td className="p-3.5">
                        <div className="space-y-1">
                          {getStatusBadge(device.status)}
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                            <span className={device.temperatureC > 45 ? 'text-rose-600 font-bold' : ''}>
                              Temp: {device.temperatureC}°C
                            </span>
                            <span>CPU: {device.cpuUsagePct}%</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 font-mono text-[11px]">
                        <div className="text-slate-800 dark:text-slate-200 font-bold">{device.ip}</div>
                        <div className="text-[10px] text-slate-400">{device.mac}</div>
                      </td>

                      <td className="p-3.5">
                        <div className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
                          {device.firmware}
                        </div>
                        {device.otaStatus === 'Update Available' ? (
                          <button
                            onClick={() => handleTriggerOTA(device)}
                            className="text-[10px] font-bold text-purple-600 hover:underline flex items-center gap-0.5"
                          >
                            <Zap size={10} /> OTA {device.latestFirmware}
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-600 font-medium">Up to Date</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <div className="space-y-1">
                          <div className="flex items-center justify-between font-mono text-[11px]">
                            <span className={`font-bold ${device.signalRssi > -65 ? 'text-emerald-600' : device.signalRssi > -85 ? 'text-amber-600' : 'text-rose-600'}`}>
                              {device.signalRssi} dBm
                            </span>
                            <span className="text-[10px] text-slate-400">{device.pingMs}ms</span>
                          </div>
                          <div className="w-20 bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                device.signalRssi > -65 ? 'bg-emerald-500' : device.signalRssi > -85 ? 'bg-amber-500' : 'bg-rose-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(10, (100 + device.signalRssi) * 2))}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 font-mono text-[11px]">
                        <span className="font-bold text-slate-700 dark:text-slate-300">
                          {device.coverageRadiusMeters}m
                        </span>
                        <span className="text-[10px] text-slate-400 block">Radius</span>
                      </td>

                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Restart Action */}
                          <button
                            onClick={() => handleTriggerRestart(device)}
                            className="p-1.5 text-slate-500 hover:text-[#007BC4] hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                            title="Restart Device"
                          >
                            <RotateCcw size={14} />
                          </button>

                          {/* Calibration Action */}
                          <button
                            onClick={() => handleTriggerCalibration(device)}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                            title="Run Calibration"
                          >
                            <Sliders size={14} />
                          </button>

                          {/* OTA Action */}
                          <button
                            onClick={() => handleTriggerOTA(device)}
                            className="p-1.5 text-slate-500 hover:text-purple-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                            title="OTA Firmware"
                          >
                            <Zap size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB B: SIGNAL COVERAGE HEATMAP --- */}
      {activeTab === 'heatmap' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Radar className="w-5 h-5 text-[#007BC4]" /> Interactive Site Hardware Signal & Coverage Radius
                </h3>
                <p className="text-xs text-slate-500">Visual spatial overlay of RFID, BLE, GPS and Vision sensor radii across job site zones</p>
              </div>

              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-emerald-600">
                  <span className="w-3 h-3 rounded-full bg-emerald-500/40 border border-emerald-500" /> Strong (&gt; -65 dBm)
                </span>
                <span className="flex items-center gap-1.5 text-amber-600">
                  <span className="w-3 h-3 rounded-full bg-amber-500/40 border border-amber-500" /> Moderate (-65 to -85 dBm)
                </span>
                <span className="flex items-center gap-1.5 text-rose-600">
                  <span className="w-3 h-3 rounded-full bg-rose-500/40 border border-rose-500" /> Weak / Fringe (&lt; -85 dBm)
                </span>
              </div>
            </div>

            {/* Spatial Grid Canvas Representation */}
            <div className="relative w-full h-[420px] bg-slate-900 rounded-xl overflow-hidden border border-slate-700 p-4 flex flex-col justify-between select-none">
              
              {/* Background Grid Lines */}
              <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-40" />

              {/* Floor Plan Zone Labels */}
              <div className="relative z-10 grid grid-cols-3 gap-4 h-full pointer-events-none">
                <div className="border border-slate-700/60 rounded-xl p-3 bg-slate-800/30">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Zone A: Main Entrance Turnstile</span>
                </div>
                <div className="border border-slate-700/60 rounded-xl p-3 bg-slate-800/30">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Zone B: Tower Alpha Shaft</span>
                </div>
                <div className="border border-slate-700/60 rounded-xl p-3 bg-slate-800/30">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Zone C: Sub-Basement B1 Trench</span>
                </div>
              </div>

              {/* Dynamic Coverage Bubble Pins */}
              <div className="absolute inset-0 p-8 flex items-center justify-around flex-wrap gap-12 z-20 pointer-events-auto">
                {devices.map((dev, idx) => {
                  const isWeak = dev.signalRssi < -80;
                  return (
                    <div key={dev.id} className="relative group cursor-pointer">
                      
                      {/* Pulse Coverage Radius */}
                      <div 
                        className={`absolute -inset-8 rounded-full animate-ping opacity-25 ${
                          isWeak ? 'bg-rose-500' : 'bg-[#007BC4]'
                        }`} 
                      />
                      <div 
                        className={`absolute -inset-10 rounded-full border-2 ${
                          isWeak ? 'border-rose-500/50 bg-rose-500/10' : 'border-emerald-500/50 bg-emerald-500/10'
                        }`} 
                      />

                      {/* Device Center Node */}
                      <div className="relative p-3 rounded-full bg-slate-900 border-2 border-white shadow-xl text-white flex items-center justify-center">
                        <Radio size={18} className={isWeak ? 'text-rose-400 animate-pulse' : 'text-emerald-400'} />
                      </div>

                      {/* Tooltip Hover Box */}
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block w-48 bg-slate-900 border border-slate-700 p-2.5 rounded-xl text-[11px] shadow-2xl z-30">
                        <strong className="text-white block truncate">{dev.name}</strong>
                        <div className="text-slate-400 font-mono text-[10px]">{dev.ip} • Radius: {dev.coverageRadiusMeters}m</div>
                        <div className="flex justify-between items-center mt-1 pt-1 border-t border-slate-800">
                          <span className="text-slate-300">RSSI:</span>
                          <span className={`font-bold font-mono ${isWeak ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {dev.signalRssi} dBm
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend Footer */}
              <div className="relative z-10 flex justify-between items-center bg-slate-900/80 backdrop-blur p-2.5 rounded-xl border border-slate-800 text-xs text-slate-300">
                <span>Active Antenna Fabric: <strong className="text-emerald-400">8 Devices Broadcasting</strong></span>
                <span>Signal Overlap Density: <strong className="text-[#007BC4]">94.2% Site Coverage</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB C: DEAD ZONE ANALYZER --- */}
      {activeTab === 'deadzones' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            <div className="lg:col-span-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ScanEye className="w-5 h-5 text-rose-500" /> Site Unmonitored Dead Zone Detection Radar
                  </h3>
                  <p className="text-xs text-slate-500">Automated spatial analysis identifying unmonitored blindspots & signal gaps</p>
                </div>

                <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
                  2 Dead Zones Identified
                </span>
              </div>

              {/* List of Detected Deadzones */}
              <div className="space-y-3">
                <div className="p-4 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <strong className="text-rose-900 dark:text-rose-300 text-sm font-bold flex items-center gap-2">
                      <AlertTriangle size={16} className="text-rose-600" /> Sector B2 Deep Shaft (Sub-Basement B2)
                    </strong>
                    <span className="text-xs font-mono font-bold text-rose-700">Area: ~34 m² Blindspot</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    High concrete density attenuates gateway GW-BLE53-03 signal. Workers entering B2 pit lose active beacon tracking for over 12 minutes.
                  </p>
                  <div className="pt-2 border-t border-rose-200/60 dark:border-rose-900/40 flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                    <span>💡 Recommended Remedy: Install 1x BLE Mesh Repeater Gateway at Scaffold Joint #14</span>
                    <button 
                      onClick={() => setActionModalType('add')}
                      className="px-3 py-1 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition"
                    >
                      Provision Gateway
                    </button>
                  </div>
                </div>

                <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <strong className="text-amber-900 dark:text-amber-300 text-sm font-bold flex items-center gap-2">
                      <AlertCircle size={16} className="text-amber-600" /> Northwest Laydown Yard Crane Blindspot
                    </strong>
                    <span className="text-xs font-mono font-bold text-amber-700">Area: ~18 m² Fringe</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    Steel beam storage piles create multipath interference for RFID Reader RDR-FX9600-01.
                  </p>
                  <div className="pt-2 border-t border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                    <span>💡 Recommended Remedy: Recalibrate antenna gain +3dB or re-orient patch antenna</span>
                    <button 
                      onClick={() => handleTriggerCalibration(devices[0])}
                      className="px-3 py-1 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition"
                    >
                      Auto-Calibrate Gain
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Coverage Optimization Summary Panel */}
            <div className="lg:col-span-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Coverage Optimization Score</h4>
              <div className="text-center p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-4xl font-black text-[#007BC4]">94.2%</div>
                <div className="text-xs text-slate-500 mt-1 font-bold">Site Spatial Visibility Index</div>
              </div>

              <div className="space-y-2 text-xs font-medium">
                <div className="flex justify-between p-2 rounded bg-slate-50 dark:bg-slate-900">
                  <span>Monitored Jobsite Area:</span>
                  <strong className="font-mono">14,200 m²</strong>
                </div>
                <div className="flex justify-between p-2 rounded bg-slate-50 dark:bg-slate-900">
                  <span>Unmonitored Gaps:</span>
                  <strong className="font-mono text-rose-600">52 m² (0.36%)</strong>
                </div>
                <div className="flex justify-between p-2 rounded bg-slate-50 dark:bg-slate-900">
                  <span>Hardware Density:</span>
                  <strong className="font-mono">1 dev per 1,775 m²</strong>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* --- TAB D: MASS OTA FIRMWARE HUB --- */}
      {activeTab === 'ota' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-purple-600" /> Over-The-Air (OTA) Firmware Management Hub
                </h3>
                <p className="text-xs text-slate-500">Deploy encrypted binary updates across all site RFID, BLE and IoT hardware</p>
              </div>

              <button
                onClick={() => handleTriggerOTA(devices[1])}
                className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition flex items-center gap-1.5"
              >
                <Zap size={14} /> Deploy All Pending Updates
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Current Fleet Firmware</span>
                <div className="text-xl font-bold font-mono text-slate-800 dark:text-slate-200">v3.8.2 / v2.1.0</div>
                <div className="text-xs text-emerald-600 font-semibold">6 of 8 devices up-to-date</div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Available OTA Releases</span>
                <div className="text-xl font-bold font-mono text-purple-600">v2.2.1 Stable</div>
                <div className="text-xs text-slate-500">Fixes BLE AoA packet latency & battery sleep</div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Security Checksum</span>
                <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300 truncate">SHA256: e3b0c44298fc1c149afbf4c8996fb924</div>
                <div className="text-xs text-emerald-600 font-bold flex items-center gap-1">
                  <ShieldCheck size={12} /> Digitally Signed by GAO Security
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- ACTION MODALS (RESTART, CALIBRATE, OTA, ADD) --- */}
      {actionModalType && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                {actionModalType === 'restart' && <RotateCcw className="text-[#007BC4]" />}
                {actionModalType === 'calibrate' && <Sliders className="text-indigo-600" />}
                {actionModalType === 'ota' && <Zap className="text-purple-600" />}
                {actionModalType === 'add' && <Plus className="text-emerald-600" />}
                {actionModalType === 'restart' && 'Remote Soft Reboot Device'}
                {actionModalType === 'calibrate' && 'Run Antenna & RSSI Calibration'}
                {actionModalType === 'ota' && 'Deploy Over-the-Air Firmware Update'}
                {actionModalType === 'add' && 'Register New Hardware Device'}
              </h3>
              <button onClick={() => setActionModalType(null)} className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X size={18} />
              </button>
            </div>

            {/* Modal Content - Execution or Add Form */}
            {actionModalType !== 'add' && selectedDevice && (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-xl font-mono">
                  <div className="font-bold text-slate-900 dark:text-white">{selectedDevice.name}</div>
                  <div className="text-slate-500 text-[11px]">{selectedDevice.id} • IP: {selectedDevice.ip}</div>
                </div>

                {/* Terminal Exec Output */}
                <div className="bg-slate-950 text-emerald-400 p-3 rounded-xl font-mono text-[11px] space-y-1 h-36 overflow-y-auto border border-slate-800">
                  {actionLog.map((log, i) => (
                    <div key={i} className="flex items-start gap-1">
                      <span className="text-slate-600">&gt;</span>
                      <span>{log}</span>
                    </div>
                  ))}
                </div>

                {/* Progress Bar */}
                {actionProgress > 0 && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-bold">
                      <span>Execution Progress</span>
                      <span>{actionProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div className="h-full bg-[#007BC4] transition-all duration-300" style={{ width: `${actionProgress}%` }} />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setActionModalType(null)} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl">
                    Close
                  </button>
                  {actionProgress === 0 && (
                    <button
                      onClick={() => {
                        if (actionModalType === 'restart') handleExecuteRestart();
                        if (actionModalType === 'calibrate') handleExecuteCalibration();
                        if (actionModalType === 'ota') handleExecuteOTA();
                      }}
                      className="px-4 py-2 bg-[#007BC4] text-white font-bold rounded-xl shadow hover:bg-blue-700 transition"
                    >
                      Start Operation
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Registration Form */}
            {actionModalType === 'add' && (
              <div className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Device ID / MAC</label>
                  <input
                    type="text"
                    placeholder="e.g. GW-BLE53-09"
                    value={newDevId}
                    onChange={e => setNewDevId(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Hardware Display Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Scaffold Level 4 RFID Gate"
                    value={newDevName}
                    onChange={e => setNewDevName(e.target.value)}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Category</label>
                    <select
                      value={newDevCategory}
                      onChange={e => setNewDevCategory(e.target.value as any)}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                    >
                      <option value="rfid">UHF RFID Reader</option>
                      <option value="ble">BLE AoA Gateway</option>
                      <option value="gps">GPS Base Station</option>
                      <option value="iot">IoT Environmental Sensor</option>
                      <option value="cctv">CCTV Camera</option>
                      <option value="ai_camera">AI Vision Camera</option>
                      <option value="weather">Weather Station</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Static IP Address</label>
                    <input
                      type="text"
                      value={newDevIp}
                      onChange={e => setNewDevIp(e.target.value)}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setActionModalType(null)} className="px-4 py-2 bg-slate-100 text-slate-700 font-bold rounded-xl">
                    Cancel
                  </button>
                  <button
                    onClick={handleAddDevice}
                    className="px-4 py-2 bg-[#007BC4] text-white font-bold rounded-xl shadow hover:bg-blue-700 transition"
                  >
                    Save & Provision Device
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}

// Helper Icon Component
function HardwareIcon(props: { size?: number }) {
  return <Cpu size={props.size || 16} />;
}
