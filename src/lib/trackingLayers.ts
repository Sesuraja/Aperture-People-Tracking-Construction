export interface AssetItem {
  id: string;
  name: string;
  category: 'Power Tool' | 'Heavy Equipment' | 'Storage Container' | 'Material Pallet' | 'Generator' | 'Compressor' | 'Survey Equipment';
  location: string;
  assignedWorker: string;
  status: 'Operating' | 'Standby' | 'Maintenance' | 'Offline';
  utilization: number; // percentage
  lastMovement: string;
  battery: number;
  speed?: number;
  heading?: number;
  rssi?: number;
  x: number;
  y: number;
}

export interface VehicleItem {
  id: string;
  name: string;
  type: 'Tower Crane' | 'Hydraulic Excavator' | 'Heavy Forklift' | 'Concrete Mixer Truck' | 'Articulated Dump Truck' | 'Mobile Elevating Platform';
  operator: string;
  location: string;
  speed: number; // km/h
  direction?: number; // degrees 0-360
  heading?: number;
  rssi?: number;
  status: 'Active' | 'Idling' | 'Maintenance' | 'Parked';
  fuel: number;
  x: number;
  y: number;
}

export interface InfrastructureItem {
  id: string;
  name: string;
  type: 'UHF RFID Reader' | 'BLE Gateway' | 'UWB Anchor' | 'Wi-Fi Access Point' | 'IoT Edge Gateway';
  location: string;
  ipAddress?: string;
  macAddress?: string;
  status: 'Online' | 'Offline' | 'Warning' | 'Maintenance Required';
  signalRssi?: number; // -30 to -90 dBm
  battery?: number | null;
  occupancy?: string;
  x: number;
  y: number;
}

export interface CCTVCameraItem {
  id: string;
  name: string;
  zone: string;
  status: 'Online' | 'Offline' | 'Warning';
  aiStatus: 'Active' | 'Calibrating' | 'Triggered';
  aiFeatures: string[];
  recentEvent: string;
  streamResolution: string;
  x: number;
  y: number;
  angle: number;
}

export interface EnvironmentalSensorItem {
  id: string;
  name: string;
  zone: string;
  temperature: number; // °C
  gasLevel: number; // ppm CO/H2S
  dustPM25: number; // µg/m³
  noiseDb: number; // dB
  humidity: number; // %
  status: 'Normal' | 'Warning' | 'Critical';
  x: number;
  y: number;
}

export interface SafetyAlertItem {
  id: string;
  title: string;
  type: 'Geofence Violation' | 'Restricted Area' | 'Worker Down' | 'Lone Worker' | 'SOS Emergency' | 'Fall Detection' | 'High Temperature' | 'Gas Leak Proximity' | 'Crane Collision' | 'Vehicle-Pedestrian Proximity' | 'PPE Non-Compliance';
  severity: 'CRITICAL' | 'HIGH' | 'WARNING';
  location: string;
  subject: string;
  timestamp: string;
  acknowledged: boolean;
}

export const INITIAL_ASSETS: AssetItem[] = [
  {
    id: 'AST-8801',
    name: 'DeWalt Core Drilling Rig (UHF Tagged)',
    category: 'Power Tool',
    location: 'Structure & Scaffolding (L1-L4)',
    assignedWorker: 'Alice Smith (Electrician)',
    status: 'Operating',
    utilization: 84,
    lastMovement: '2 mins ago',
    battery: 92,
    x: 52,
    y: 28
  },
  {
    id: 'AST-8802',
    name: 'Atlas Copco Diesel Air Compressor 375 CFM',
    category: 'Compressor',
    location: 'Excavation & Foundation Pit',
    assignedWorker: 'David Kim (Heavy Ops)',
    status: 'Operating',
    utilization: 95,
    lastMovement: '12 mins ago',
    battery: 88,
    x: 22,
    y: 28
  },
  {
    id: 'AST-8803',
    name: 'Honda 10kW Portable Site Generator',
    category: 'Generator',
    location: 'Material Laydown & Loading',
    assignedWorker: 'Carlos Rodriguez (Logistics)',
    status: 'Standby',
    utilization: 45,
    lastMovement: '35 mins ago',
    battery: 65,
    x: 52,
    y: 58
  },
  {
    id: 'AST-8804',
    name: 'Leica TS16 Robotic Total Station Survey Tool',
    category: 'Survey Equipment',
    location: 'Heavy Crane & Exclusion Area',
    assignedWorker: 'Elena Rostova (Surveyor)',
    status: 'Operating',
    utilization: 91,
    lastMovement: 'Just now',
    battery: 98,
    x: 88,
    y: 32
  },
  {
    id: 'AST-8805',
    name: 'Structural Steel I-Beam Pallet Bundle #44',
    category: 'Material Pallet',
    location: 'Material Laydown & Loading',
    assignedWorker: 'Unassigned (Logistics Yard)',
    status: 'Standby',
    utilization: 10,
    lastMovement: '1 hour ago',
    battery: 100,
    x: 58,
    y: 62
  },
  {
    id: 'AST-8806',
    name: 'Mobile Hydraulic Rebar Bender / Shear Station',
    category: 'Heavy Equipment',
    location: 'Confined Shaft & Tunneling',
    assignedWorker: 'Marcus Vance (Ironworker)',
    status: 'Maintenance',
    utilization: 0,
    lastMovement: '3 hours ago',
    battery: 40,
    x: 75,
    y: 85
  }
];

export const INITIAL_VEHICLES: VehicleItem[] = [
  {
    id: 'VEH-CRANE-01',
    name: 'Liebherr 280 EC-H 12 Litronic Tower Crane',
    type: 'Tower Crane',
    operator: 'Gavin Vance (Certified Crane Op)',
    location: 'Heavy Crane & Exclusion Area',
    speed: 1.5,
    direction: 142,
    status: 'Active',
    fuel: 88,
    x: 83,
    y: 18
  },
  {
    id: 'VEH-EXCAV-03',
    name: 'CAT 336 Heavy Tracked Hydraulic Excavator',
    type: 'Hydraulic Excavator',
    operator: 'Hank Miller (Subcontractor Op)',
    location: 'Excavation & Foundation Pit',
    speed: 4.2,
    direction: 210,
    status: 'Active',
    fuel: 72,
    x: 15,
    y: 20
  },
  {
    id: 'VEH-FORK-09',
    name: 'JCB 514-56 Rough Terrain Telehandler Forklift',
    type: 'Heavy Forklift',
    operator: 'Leo Garcia (Yard Lead)',
    location: 'Material Laydown & Loading',
    speed: 8.5,
    direction: 85,
    status: 'Active',
    fuel: 60,
    x: 42,
    y: 58
  },
  {
    id: 'VEH-MIXER-02',
    name: 'Volvo FMX 10m³ Ready-Mix Concrete Truck',
    type: 'Concrete Mixer Truck',
    operator: 'Aisha Patel (Delivery Driver)',
    location: 'Gate 1 / Main Access Gate',
    speed: 12.0,
    direction: 350,
    status: 'Idling',
    fuel: 90,
    x: 12,
    y: 85
  },
  {
    id: 'VEH-MEWP-05',
    name: 'JLG 1350SJP Telescopic Boom Lift (MEWP 135ft)',
    type: 'Mobile Elevating Platform',
    operator: 'Samira Chen (Facade Installer)',
    location: 'Structure & Scaffolding (L1-L4)',
    speed: 0.0,
    direction: 0,
    status: 'Active',
    fuel: 82,
    x: 42,
    y: 15
  }
];

export const INITIAL_INFRASTRUCTURE: InfrastructureItem[] = [
  {
    id: 'INF-UHF-101',
    name: 'Gate 1 Heavy Vehicle & Personnel RFID Portal',
    type: 'UHF RFID Reader',
    location: 'Gate 1 / Main Access Gate',
    ipAddress: '192.168.1.101',
    macAddress: '00:1B:44:11:01:A0',
    status: 'Online',
    signalRssi: -58,
    battery: null,
    x: 17,
    y: 73
  },
  {
    id: 'INF-BLE-202',
    name: 'Scaffold Tower L1-L4 BLE Mesh Gateway',
    type: 'BLE Gateway',
    location: 'Structure & Scaffolding (L1-L4)',
    ipAddress: '192.168.1.103',
    macAddress: '00:1B:44:11:02:B1',
    status: 'Online',
    signalRssi: -62,
    battery: 94,
    x: 50,
    y: 45
  },
  {
    id: 'INF-UWB-301',
    name: 'Heavy Crane Exclusion Radius UWB Anchor #1',
    type: 'UWB Anchor',
    location: 'Heavy Crane & Exclusion Area',
    ipAddress: '192.168.1.104',
    macAddress: '00:1B:44:11:03:C2',
    status: 'Online',
    signalRssi: -45,
    battery: null,
    x: 68,
    y: 24
  },
  {
    id: 'INF-WIFI-401',
    name: 'Subsurface Confined Shaft Wi-Fi 6 Mesh Bridge',
    type: 'Wi-Fi Access Point',
    location: 'Confined Shaft & Tunneling',
    ipAddress: '192.168.1.105',
    macAddress: '00:1B:44:11:04:D3',
    status: 'Warning',
    signalRssi: -78,
    battery: 62,
    x: 35,
    y: 85
  },
  {
    id: 'INF-EDGE-501',
    name: 'Site Office Core IoT Edge Controller',
    type: 'IoT Edge Gateway',
    location: 'Site Office & Welfare Container',
    ipAddress: '192.168.1.100',
    macAddress: '00:1B:44:11:00:E4',
    status: 'Online',
    signalRssi: -38,
    battery: null,
    x: 17,
    y: 48
  }
];

export const INITIAL_CCTVS: CCTVCameraItem[] = [
  {
    id: 'CAM-AI-01',
    name: 'Gate 1 License Plate & Hardhat AI Camera',
    zone: 'Gate 1 / Main Access Gate',
    status: 'Online',
    aiStatus: 'Active',
    aiFeatures: ['PPE Detection', 'License Plate Recognition', 'Tailgating Alert'],
    recentEvent: 'PPE Complaint Entrance: 100% hardhats verified',
    streamResolution: '4K Ultra HD (30 fps)',
    x: 5,
    y: 75,
    angle: 45
  },
  {
    id: 'CAM-AI-02',
    name: 'Excavation Pit Edge & Fall Risk Cam',
    zone: 'Excavation & Foundation Pit',
    status: 'Online',
    aiStatus: 'Active',
    aiFeatures: ['Perimeter Intrusion', 'PPE Safety Vest', 'Soil Movement Alert'],
    recentEvent: 'Excavator clearance distance verified 3.5m',
    streamResolution: '1080p HDR (60 fps)',
    x: 5,
    y: 8,
    angle: 120
  },
  {
    id: 'CAM-AI-03',
    name: 'Tower Crane Jib & Swing Area AI Cam',
    zone: 'Heavy Crane & Exclusion Area',
    status: 'Online',
    aiStatus: 'Triggered',
    aiFeatures: ['Exclusion Zone Intrusion', 'Crane Collision Risk', 'Overhead Load Warning'],
    recentEvent: 'WARNING: Subcontractor worker inside active radius',
    streamResolution: '4K Ultra HD (60 fps)',
    x: 95,
    y: 8,
    angle: 220
  },
  {
    id: 'CAM-AI-04',
    name: 'Tunnel Shaft Entrance Safety Monitor',
    zone: 'Confined Shaft & Tunneling',
    status: 'Warning',
    aiStatus: 'Calibrating',
    aiFeatures: ['Gas Mask / Respirator Tag', 'Alone Worker Dwell', 'Muster Headcount'],
    recentEvent: 'Calibrating low-light thermal channel',
    streamResolution: '1080p Thermal + Visible',
    x: 40,
    y: 76,
    angle: 90
  }
];

export const INITIAL_ENV_SENSORS: EnvironmentalSensorItem[] = [
  {
    id: 'ENV-101',
    name: 'Confined Shaft Hazardous Gas & Air Quality Sensor',
    zone: 'Confined Shaft & Tunneling',
    temperature: 28.4,
    gasLevel: 12.5, // ppm CO
    dustPM25: 42,
    noiseDb: 88,
    humidity: 78,
    status: 'Warning',
    x: 55,
    y: 85
  },
  {
    id: 'ENV-102',
    name: 'Excavation Pit Dust & Noise Weather Monitor',
    zone: 'Excavation & Foundation Pit',
    temperature: 31.2,
    gasLevel: 2.1,
    dustPM25: 85, // High dust
    noiseDb: 94, // High noise
    humidity: 45,
    status: 'Normal',
    x: 25,
    y: 35
  },
  {
    id: 'ENV-103',
    name: 'Structural Scaffolding High-Wind & Heat Stress Station',
    zone: 'Structure & Scaffolding (L1-L4)',
    temperature: 34.8, // Heat warning
    gasLevel: 0.5,
    dustPM25: 22,
    noiseDb: 72,
    humidity: 38,
    status: 'Warning',
    x: 58,
    y: 10
  },
  {
    id: 'ENV-104',
    name: 'Site Office Ambient Environment & Air Quality',
    zone: 'Site Office & Welfare Container',
    temperature: 22.0,
    gasLevel: 0.0,
    dustPM25: 12,
    noiseDb: 54,
    humidity: 50,
    status: 'Normal',
    x: 5,
    y: 52
  }
];

export const INITIAL_SAFETY_ALERTS: SafetyAlertItem[] = [
  {
    id: 'ALT-9001',
    title: 'Crane Exclusion Zone Intrusion',
    type: 'Crane Collision',
    severity: 'CRITICAL',
    location: 'Heavy Crane & Exclusion Area',
    subject: 'Bob Johnson (Subcontractor Worker)',
    timestamp: '2 mins ago',
    acknowledged: false
  },
  {
    id: 'ALT-9002',
    title: 'High Noise Exposure Threshold (94 dB)',
    type: 'High Temperature',
    severity: 'WARNING',
    location: 'Excavation & Foundation Pit',
    subject: 'Excavation Crew (4 Workers)',
    timestamp: '8 mins ago',
    acknowledged: true
  },
  {
    id: 'ALT-9003',
    title: 'Stationary Dwell Warning (> 30 mins)',
    type: 'Lone Worker',
    severity: 'WARNING',
    location: 'Confined Shaft & Tunneling',
    subject: 'Alice Smith (Electrician)',
    timestamp: '14 mins ago',
    acknowledged: false
  },
  {
    id: 'ALT-9004',
    title: 'Missing Hardhat RFID Tag Signal',
    type: 'PPE Non-Compliance',
    severity: 'HIGH',
    location: 'Structure & Scaffolding (L1-L4)',
    subject: 'Visitor Tag #402',
    timestamp: '22 mins ago',
    acknowledged: true
  }
];
