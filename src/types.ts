export type PresenceState = 'MOVING' | 'IDLE' | 'EXITED';

export interface Person {
  id: string;
  name: string;
  role: string;
  tradeCompany?: string;
  ppeStatus?: 'COMPLIANT' | 'NON_COMPLIANT' | 'WARNING';
  certifications?: string[];
  hardhatTagId?: string;
  permitToWork?: string | null;
  currentZone: string;
  presenceState: PresenceState;
  dwellTime: number; 
  x: number; 
  y: number;
  speed?: number; // m/s
  heading?: number; // degrees
  rssi?: number; // dBm
  battery?: number; // %
  lastReader?: string;
  lastSeen: Date;
  trail: {x: number, y: number}[];
  activityInsights?: { activity: string; confidence: number };
  projectId?: string;
  targetX?: number;
  targetY?: number;
  idleRemaining?: number;
}

export interface Asset { 
  id: string; 
  name: string; 
  type: string; 
  x: number; 
  y: number; 
  status?: string; 
  battery?: number;
  speed?: number;
  heading?: number;
  rssi?: number;
  lastReader?: string;
  projectId?: string;
}

export interface Vehicle { 
  id: string; 
  name: string; 
  type: string; 
  x: number; 
  y: number; 
  status?: string; 
  speed?: number; // km/h or m/s
  heading?: number;
  rssi?: number;
  fuel?: number;
  operator?: string;
  projectId?: string;
  trail?: {x: number, y: number}[];
  targetX?: number;
  targetY?: number;
  idleRemaining?: number;
}

export interface CameraDevice { 
  id: string; 
  name: string; 
  x: number; 
  y: number; 
  status?: 'online' | 'offline'; 
  projectId?: string;
  resolution?: string;
  angle?: number;
}

export interface EnvSensor { 
  id: string; 
  name: string; 
  x: number; 
  y: number; 
  status?: 'online' | 'offline'; 
  temperature?: number;
  humidity?: number;
  gasLevel?: number;
  dustPM25?: number;
  noiseDb?: number;
  battery?: number;
  projectId?: string;
}

export interface AIAlert {
  id?: string;
  type: 'security' | 'warning' | 'info';
  message: string;
  timestamp: Date;
  resolved?: boolean;
}
