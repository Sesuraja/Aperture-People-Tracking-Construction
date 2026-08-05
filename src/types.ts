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
  lastSeen: Date;
  trail: {x: number, y: number}[];
  activityInsights?: { activity: string; confidence: number };
  projectId?: string;
}

export interface Asset { 
  id: string; 
  name: string; 
  type: string; 
  x: number; 
  y: number; 
  status?: string; 
  battery?: number;
  projectId?: string;
}

export interface Vehicle { 
  id: string; 
  name: string; 
  type: string; 
  x: number; 
  y: number; 
  status?: string; 
  speed?: number;
  projectId?: string;
}

export interface CameraDevice { 
  id: string; 
  name: string; 
  x: number; 
  y: number; 
  status?: 'online' | 'offline'; 
  projectId?: string;
}

export interface EnvSensor { 
  id: string; 
  name: string; 
  x: number; 
  y: number; 
  status?: 'online' | 'offline'; 
  projectId?: string;
}

export interface AIAlert {
  id?: string;
  type: 'security' | 'warning' | 'info';
  message: string;
  timestamp: Date;
  resolved?: boolean;
}
