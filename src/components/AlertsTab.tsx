import React, { useState, useEffect, useMemo } from 'react';
import { AIAlert, AlertCategory, AlertPriority, AlertStatus, AlertComment } from '../types';
import { 
  BellRing, AlertTriangle, ShieldAlert, Zap, Radio, HardHat, UserX, 
  Wrench, CloudLightning, Cpu, Search, Filter, CheckCircle2, Clock, 
  ArrowUpRight, UserCheck, MessageSquare, FileText, ChevronRight, X, 
  Plus, Download, Printer, RefreshCw, Send, ShieldCheck, Eye, Shield, 
  MapPin, Camera, Activity, AlertCircle, Info, Sparkles, Flame, Siren, 
  CornerDownRight, Check, CheckSquare
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { collection, onSnapshot, doc, setDoc, updateDoc, getDocs } from '../lib/db';
import { db } from '../lib/firebase';
import { exportToCSV, generatePDFReport } from '../lib/exportUtils';

const CATEGORY_CONFIG: Record<AlertCategory, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  Emergency: { icon: Siren, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/40', border: 'border-rose-200 dark:border-rose-800' },
  Safety: { icon: ShieldAlert, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800' },
  Security: { icon: Shield, color: 'text-rose-700', bg: 'bg-rose-100/60 dark:bg-rose-900/40', border: 'border-rose-300 dark:border-rose-800' },
  Equipment: { icon: Zap, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/40', border: 'border-blue-200 dark:border-blue-800' },
  Reader: { icon: Radio, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/40', border: 'border-indigo-200 dark:border-indigo-800' },
  Worker: { icon: HardHat, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800' },
  Visitor: { icon: UserX, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/40', border: 'border-violet-200 dark:border-violet-800' },
  Maintenance: { icon: Wrench, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-200 dark:border-orange-800' },
  Weather: { icon: CloudLightning, color: 'text-cyan-600', bg: 'bg-cyan-50 dark:bg-cyan-950/40', border: 'border-cyan-200 dark:border-cyan-800' },
  System: { icon: Cpu, color: 'text-slate-700 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-800', border: 'border-slate-300 dark:border-slate-700' }
};

const CATEGORIES_LIST: AlertCategory[] = [
  'Emergency', 'Safety', 'Security', 'Equipment', 
  'Reader', 'Worker', 'Visitor', 'Maintenance', 
  'Weather', 'System'
];

const INITIAL_ENTERPRISE_ALERTS: AIAlert[] = [
  {
    id: 'ALT-1001',
    type: 'security',
    category: 'Emergency',
    priority: 'Critical',
    status: 'In Progress',
    title: 'Confined Tunnel Gas Sensor High CO Hazard',
    message: 'Gas Monitor SENS-09 detected 48ppm Carbon Monoxide spike in Shaft L3 Shaft Tunnel.',
    timestamp: new Date(Date.now() - 12 * 60 * 1000),
    assignedTo: 'Marcus Vance',
    assignedRole: 'EHS Lead Officer',
    assignedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    aiSummary: {
      rootCause: 'Poor forced-air ventilation duct alignment coupled with heavy diesel generator exhaust backflow into Tunnel Shaft L3.',
      threatScore: 94,
      recommendedActions: [
        'Halt all tunneling personnel immediately via audio siren.',
        'Activate auxiliary blast exhaust ventilation unit V-02.',
        'Dispatch emergency responder unit with self-contained breathing apparatus (SCBA).'
      ]
    },
    evidence: {
      locationZone: 'Confined Shaft & Tunneling',
      rfidReaderId: 'RD-SHAFT-L3-GATE',
      cctvCameraId: 'CAM-SHAFT-03',
      cctvSnapshotUrl: 'cctv_frame_tunnel_co.jpg',
      rssiDbm: -68,
      telemetryLog: '[SENS-09] CO: 48.2 ppm | O2: 19.4% | Temp: 31.2°C | Alarm: AUDIBLE_HIGH_STEL'
    },
    comments: [
      { id: 'c1', author: 'Marcus Vance', role: 'EHS Lead', timestamp: '10:35 AM', text: 'Tunnel L3 evacuated. SCBA team dispatched to inspect ventilation duct V-02.' },
      { id: 'c2', author: 'Elena Rostova', role: 'Safety Inspector', timestamp: '10:38 AM', text: 'Confirmed 4 workers cleared turnstile gate RD-SHAFT-L3.' }
    ],
    timeline: [
      { time: '10:33 AM', title: 'Threshold Exceeded', description: 'Sensor SENS-09 registered 48.2ppm CO.', actor: 'Automated IoT Sensor SENS-09', type: 'trigger' },
      { time: '10:34 AM', title: 'AI Emergency Alert Raised', description: 'System triggered critical sirens & dispatched push notification.', actor: 'Antigravity AI Engine', type: 'system' },
      { time: '10:35 AM', title: 'Officer Assigned', description: 'Marcus Vance acknowledged and took ownership of incident.', actor: 'Marcus Vance', type: 'assignment' }
    ],
    escalation: {
      level: 'Tier 2 (EHS Director)',
      slaMinutes: 15,
      elapsedMinutes: 12,
      autoEscalateTarget: 'Site Operations VP (David Miller)',
      isEscalated: false
    },
    history: [
      { timestamp: '10:33 AM', action: 'Alert Created', user: 'System AI' },
      { timestamp: '10:35 AM', action: 'Assigned to Marcus Vance', user: 'Marcus Vance' }
    ]
  },
  {
    id: 'ALT-1002',
    type: 'security',
    category: 'Safety',
    priority: 'High',
    status: 'In Progress',
    title: 'High-Elevation Scaffold Zone Non-Compliant PPE',
    message: 'CCTV Camera CAM-L2-SCAFFOLD detected 2 workers on Level 3 scaffolding without secondary safety harness attached.',
    timestamp: new Date(Date.now() - 28 * 60 * 1000),
    assignedTo: 'Elena Rostova',
    assignedRole: 'Field Safety Officer',
    assignedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    aiSummary: {
      rootCause: 'Subcontractor crew (Apex Scaffold) bypassing secondary lanyard tie-off while adjusting guardrails.',
      threatScore: 82,
      recommendedActions: [
        'Issue immediate verbal halt order over Site PA channel 2.',
        'Dispatch field safety supervisor to perform safety stand-down.',
        'Log safety penalty infraction against Apex Scaffold Solutions.'
      ]
    },
    evidence: {
      locationZone: 'Structure & Scaffolding (L1-L4)',
      cctvCameraId: 'CAM-L2-SCAFFOLD',
      rfidTagId: 'HH-7721',
      telemetryLog: '[AI-VISION] Bounding Box Confidence: 96.4% | Fall Hazard: Unanchored Harness'
    },
    comments: [
      { id: 'c1', author: 'Elena Rostova', role: 'Field Safety Officer', timestamp: '10:20 AM', text: 'Contacted Apex Scaffold foreman. Workers instructed to clip lanyards immediately.' }
    ],
    timeline: [
      { time: '10:17 AM', title: 'Computer Vision Alert', description: 'Camera CAM-L2 flagged unattached harness.', actor: 'CCTV AI Vision Model', type: 'trigger' },
      { time: '10:20 AM', title: 'Officer Dispatched', description: 'Elena Rostova assigned and issued verbal warning.', actor: 'Elena Rostova', type: 'assignment' }
    ],
    escalation: {
      level: 'Tier 1 (Gatehouse)',
      slaMinutes: 30,
      elapsedMinutes: 28,
      autoEscalateTarget: 'Marcus Vance (EHS Lead)',
      isEscalated: false
    },
    history: [
      { timestamp: '10:17 AM', action: 'Alert Created', user: 'AI Vision Engine' },
      { timestamp: '10:20 AM', action: 'Assigned to Elena Rostova', user: 'Elena Rostova' }
    ]
  },
  {
    id: 'ALT-1003',
    type: 'security',
    category: 'Security',
    priority: 'Critical',
    status: 'Escalated',
    title: 'Blacklisted Individual Gate Entry Attempt',
    message: 'Visitor pre-registration attempt by Victor Vance (Rogue Contracting) blocked by Security Blacklist database match.',
    timestamp: new Date(Date.now() - 45 * 60 * 1000),
    assignedTo: 'Gate 1 Security Lead',
    assignedRole: 'Physical Security Supervisor',
    assignedAt: new Date(Date.now() - 42 * 60 * 1000).toISOString(),
    aiSummary: {
      rootCause: 'Person flagged on active EHS Blacklist directory (banned for previous crane exclusion area trespass) attempted unauthorized entry.',
      threatScore: 89,
      recommendedActions: [
        'Refuse gate pass issuance at Turnstile Gate 1.',
        'Escort individual off site premises.',
        'Notify Site Security Director.'
      ]
    },
    evidence: {
      locationZone: 'Gate 1 Gatehouse',
      rfidReaderId: 'RD-GATE-01-TURNSTILE',
      cctvCameraId: 'CAM-GATE-1A',
      telemetryLog: '[BLACKLIST_CHECK] Match score: 100% | Name: Victor Vance | Flag: CRITICAL_BAN'
    },
    comments: [
      { id: 'c1', author: 'Gate Security', role: 'Security Guard', timestamp: '10:05 AM', text: 'Individual turned away at Gate 1 gatehouse. No badge issued.' }
    ],
    timeline: [
      { time: '10:00 AM', title: 'Entry Request', description: 'Visitor pre-registration submitted at Gate 1.', actor: 'Gate Kiosk', type: 'trigger' },
      { time: '10:01 AM', title: 'Blacklist Intercept', description: 'Database flagged active restriction order.', actor: 'Security Engine', type: 'system' },
      { time: '10:05 AM', title: 'Escalated to Director', description: 'Alert escalated due to high threat policy rule.', actor: 'System Auto-Escalate', type: 'escalation' }
    ],
    escalation: {
      level: 'Tier 2 (EHS Director)',
      slaMinutes: 15,
      elapsedMinutes: 45,
      autoEscalateTarget: 'VP Operations',
      isEscalated: true
    },
    history: [
      { timestamp: '10:00 AM', action: 'Alert Triggered', user: 'Gatehouse System' },
      { timestamp: '10:05 AM', action: 'Escalated to Tier 2', user: 'Escalation Policy Engine' }
    ]
  },
  {
    id: 'ALT-1004',
    type: 'warning',
    category: 'Equipment',
    priority: 'Medium',
    status: 'In Progress',
    title: 'Main Tower Crane TC-01 Hydraulic Pressure Drop',
    message: 'Telematics sensor on Tower Crane TC-01 logged hydraulic fluid pressure drop below 180 bar operating threshold.',
    timestamp: new Date(Date.now() - 60 * 60 * 1000),
    assignedTo: 'Frank Reynolds',
    assignedRole: 'Heavy Machinery Lead Tech',
    assignedAt: new Date(Date.now() - 55 * 60 * 1000).toISOString(),
    aiSummary: {
      rootCause: 'Possible hydraulic hose seal degradation on boom hoist cylinder 2.',
      threatScore: 68,
      recommendedActions: [
        'Halt heavy load lifts exceeding 5 metric tons on Crane TC-01.',
        'Dispatch hydraulic technician to inspect fluid reservoir and hose fittings.'
      ]
    },
    evidence: {
      locationZone: 'Heavy Crane & Exclusion Area',
      rfidReaderId: 'RD-CRANE-TC01',
      telemetryLog: '[CRANE-TELEMATICS] Pressure: 174 Bar (Norm: 210 Bar) | Temp: 68°C | Hours: 4,120'
    },
    comments: [
      { id: 'c1', author: 'Frank Reynolds', role: 'Machinery Tech', timestamp: '09:55 AM', text: 'Inspecting hydraulic seals. Replacement hose prepped in laydown yard.' }
    ],
    timeline: [
      { time: '09:45 AM', title: 'Telematics Warning', description: 'Pressure dropped below 180 bar.', actor: 'TC-01 Telematics Unit', type: 'trigger' },
      { time: '09:50 AM', title: 'Assigned to Tech', description: 'Frank Reynolds dispatched.', actor: 'Dispatch System', type: 'assignment' }
    ],
    escalation: {
      level: 'Tier 1 (Gatehouse)',
      slaMinutes: 60,
      elapsedMinutes: 60,
      autoEscalateTarget: 'Equipment Manager',
      isEscalated: false
    },
    history: [
      { timestamp: '09:45 AM', action: 'Created', user: 'Equipment Monitor' }
    ]
  },
  {
    id: 'ALT-1005',
    type: 'warning',
    category: 'Reader',
    priority: 'Medium',
    status: 'In Progress',
    title: 'RFID Gateway RD-GATE-04 Intermittent Offline',
    message: 'Reader RD-GATE-04 missed 3 consecutive heartbeat ping intervals. RSSI signal dropped to -92dBm.',
    timestamp: new Date(Date.now() - 90 * 60 * 1000),
    assignedTo: 'Network Systems Admin',
    assignedRole: 'IoT Infrastructure Tech',
    assignedAt: new Date(Date.now() - 85 * 60 * 1000).toISOString(),
    aiSummary: {
      rootCause: 'PoE power supply voltage ripple or loose Ethernet RJ45 termination at Gate 4 enclosure.',
      threatScore: 55,
      recommendedActions: [
        'Reboot gateway RD-GATE-04 remotely via SNMP controller.',
        'Check physical PoE cable connection if reboot fails.'
      ]
    },
    evidence: {
      locationZone: 'Main Gate 1',
      rfidReaderId: 'RD-GATE-04',
      rssiDbm: -92,
      telemetryLog: '[PING_LOST] Heartbeat Timeout (30s) | IP: 192.168.10.104 | MAC: 00:1B:44:11:3A:90'
    },
    comments: [
      { id: 'c1', author: 'IT Helpdesk', role: 'IoT Tech', timestamp: '09:25 AM', text: 'Remote SNMP reset initiated. Ping restored temporarily.' }
    ],
    timeline: [
      { time: '09:15 AM', title: 'Ping Failure', description: 'Lost 3 consecutive heartbeats.', actor: 'GAO RFID Health Service', type: 'trigger' }
    ],
    escalation: {
      level: 'Tier 1 (Gatehouse)',
      slaMinutes: 120,
      elapsedMinutes: 90,
      autoEscalateTarget: 'IT Infrastructure Director',
      isEscalated: false
    },
    history: [
      { timestamp: '09:15 AM', action: 'Created', user: 'IoT Service' }
    ]
  },
  {
    id: 'ALT-1006',
    type: 'warning',
    category: 'Worker',
    priority: 'High',
    status: 'Resolved',
    title: 'Worker Lone-Worker Motion Inactivity Alert',
    message: 'Hardhat Tag HH-4011 (Carlos Mendez) detected 15 minutes continuous zero-motion in Confined Shaft Tunnel L2.',
    timestamp: new Date(Date.now() - 120 * 60 * 1000),
    assignedTo: 'Marcus Vance',
    assignedRole: 'EHS Lead',
    assignedAt: new Date(Date.now() - 118 * 60 * 1000).toISOString(),
    aiSummary: {
      rootCause: 'Worker placed hardhat on workbench during scheduled lunch break inside tunnel break room.',
      threatScore: 78,
      recommendedActions: [
        'Verify worker safety via two-way radio.',
        'Confirm location via turnstile tag ping.'
      ]
    },
    evidence: {
      locationZone: 'Confined Shaft & Tunneling',
      rfidTagId: 'HH-4011',
      telemetryLog: '[ACCELEROMETER] Static 0.0g for 900 seconds | Battery: 88%'
    },
    comments: [
      { id: 'c1', author: 'Marcus Vance', role: 'EHS Lead', timestamp: '08:50 AM', text: 'Contacted Carlos Mendez over radio. Confirmed worker safe in tunnel break area.' }
    ],
    timeline: [
      { time: '08:45 AM', title: 'Inactivity Triggered', description: 'Tag HH-4011 motionless for 15 mins.', actor: 'Smart Hardhat Sensor', type: 'trigger' },
      { time: '08:52 AM', title: 'Issue Resolved', description: 'Worker safety verified. Alert cleared.', actor: 'Marcus Vance', type: 'resolution' }
    ],
    escalation: {
      level: 'Tier 1 (Gatehouse)',
      slaMinutes: 15,
      elapsedMinutes: 7,
      autoEscalateTarget: 'EHS Director',
      isEscalated: false
    },
    resolution: {
      resolvedBy: 'Marcus Vance (EHS Director)',
      resolvedAt: new Date(Date.now() - 110 * 60 * 1000).toISOString(),
      rootCause: 'False Alarm - Hardhat removed during scheduled lunch break in tunnel rest enclave.',
      correctiveAction: 'Instructed worker to maintain hardhat attachment or log break status on mobile app.',
      verificationOfficer: 'Marcus Vance'
    },
    history: [
      { timestamp: '08:45 AM', action: 'Created', user: 'Hardhat Telematics' },
      { timestamp: '08:52 AM', action: 'Resolved', user: 'Marcus Vance' }
    ]
  },
  {
    id: 'ALT-1007',
    type: 'warning',
    category: 'Visitor',
    priority: 'Medium',
    status: 'In Progress',
    title: 'Visitor Overstayed Authorized Site Time Limit',
    message: 'Visitor Frank Reynolds (Titan Heavy Machinery) exceeded 4-hour authorized visit duration by 70 minutes.',
    timestamp: new Date(Date.now() - 150 * 60 * 1000),
    assignedTo: 'Gatehouse Reception Officer',
    assignedRole: 'Visitor Access Controller',
    assignedAt: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
    aiSummary: {
      rootCause: 'Overstayed due to extended hydraulic troubleshooting on Crane TC-01 with site mechanics.',
      threatScore: 62,
      recommendedActions: [
        'Contact host officer (Jake Miller) to request pass extension.',
        'Update visitor stay duration in Visitor Management Portal.'
      ]
    },
    evidence: {
      locationZone: 'Heavy Crane & Exclusion Area',
      rfidTagId: 'HH-9921 (Visitor Pass)',
      telemetryLog: '[VISITOR_PASS] Issued: 06:15 AM | Expired: 10:15 AM | Current Location: Crane Yard'
    },
    comments: [
      { id: 'c1', author: 'Gatehouse', role: 'Security Officer', timestamp: '08:20 AM', text: 'Host Jake Miller confirmed extension approved for crane repairs.' }
    ],
    timeline: [
      { time: '10:15 AM', title: 'Pass Expiration', description: '4-hour duration elapsed without checkout.', actor: 'Visitor Engine', type: 'trigger' }
    ],
    escalation: {
      level: 'Tier 1 (Gatehouse)',
      slaMinutes: 60,
      elapsedMinutes: 70,
      autoEscalateTarget: 'Security Lead',
      isEscalated: false
    },
    history: [
      { timestamp: '10:15 AM', action: 'Overstay Flagged', user: 'Visitor System' }
    ]
  },
  {
    id: 'ALT-1008',
    type: 'info',
    category: 'Maintenance',
    priority: 'Low',
    status: 'New',
    title: 'Site Diesel Generator GEN-02 Scheduled Filter Service Due',
    message: 'Generator GEN-02 reached 500 operating hours threshold. Preventive oil & air filter maintenance required.',
    timestamp: new Date(Date.now() - 200 * 60 * 1000),
    assignedTo: 'Maintenance Dispatch',
    assignedRole: 'Facilities Engineer',
    aiSummary: {
      rootCause: 'Routine preventive maintenance schedule milestone reached.',
      threatScore: 30,
      recommendedActions: [
        'Schedule filter replacement during non-peak hours (18:00 - 20:00).',
        'Issue work order to Mechanical Maintenance Unit.'
      ]
    },
    evidence: {
      locationZone: 'Laydown Yard & Material Staging',
      telemetryLog: '[GEN-02] Hours: 500.4 hrs | Fuel: 72% | Temp: 74°C'
    },
    comments: [],
    timeline: [
      { time: '07:25 AM', title: 'Hours Threshold Reached', description: 'GEN-02 crossed 500 operating hours.', actor: 'Generator Telematics', type: 'trigger' }
    ],
    escalation: {
      level: 'Tier 1 (Gatehouse)',
      slaMinutes: 480,
      elapsedMinutes: 200,
      autoEscalateTarget: 'Maintenance Manager',
      isEscalated: false
    },
    history: [
      { timestamp: '07:25 AM', action: 'Created', user: 'System Telematics' }
    ]
  },
  {
    id: 'ALT-1009',
    type: 'warning',
    category: 'Weather',
    priority: 'High',
    status: 'In Progress',
    title: 'High Wind Gust Alert > 48 km/h - Tower Crane Halt Advised',
    message: 'Anemometer SENS-WIND-01 registered sustained wind gusts of 52 km/h at 45m elevation on Tower Crane TC-01.',
    timestamp: new Date(Date.now() - 35 * 60 * 1000),
    assignedTo: 'Site EHS Weather Desk',
    assignedRole: 'EHS Safety Controller',
    assignedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    aiSummary: {
      rootCause: 'Approaching coastal cold front bringing sudden high-elevation wind shears across the bay area.',
      threatScore: 88,
      recommendedActions: [
        'Enforce mandatory crane boom weather-vane parking state immediately.',
        'Clear heavy lifting zone underneath Crane TC-01 and TC-02.'
      ]
    },
    evidence: {
      locationZone: 'Heavy Crane & Exclusion Area',
      telemetryLog: '[WIND-SENS-01] Sustained: 42 km/h | Gust: 52.4 km/h | Elev: 45m | Threshold: 48 km/h'
    },
    comments: [
      { id: 'c1', author: 'EHS Desk', role: 'Weather Lead', timestamp: '10:18 AM', text: 'Tower cranes TC-01 and TC-02 placed in weather-vane free-spin mode. Lifting suspended.' }
    ],
    timeline: [
      { time: '10:10 AM', title: 'Wind Gust Exceedance', description: 'Anemometer logged 52.4 km/h gust.', actor: 'Weather Station SENS-WIND-01', type: 'trigger' }
    ],
    escalation: {
      level: 'Tier 2 (EHS Director)',
      slaMinutes: 20,
      elapsedMinutes: 35,
      autoEscalateTarget: 'Site Director',
      isEscalated: false
    },
    history: [
      { timestamp: '10:10 AM', action: 'Created', user: 'Anemometer System' }
    ]
  },
  {
    id: 'ALT-1010',
    type: 'info',
    category: 'System',
    priority: 'Low',
    status: 'Resolved',
    title: 'Edge AI Video Server Sync Latency Normalised',
    message: 'Edge Server EDGE-CAM-01 video buffer synchronization recovered. Buffer delay returned to < 120ms.',
    timestamp: new Date(Date.now() - 300 * 60 * 1000),
    assignedTo: 'IT Network Ops',
    assignedRole: 'System Administrator',
    aiSummary: {
      rootCause: 'Temporary network congestion during scheduled 05:00 AM cloud database backup sync.',
      threatScore: 25,
      recommendedActions: [
        'Adjust backup batch window to 02:00 AM off-peak hours.'
      ]
    },
    evidence: {
      locationZone: 'Site Office & Welcome Center',
      telemetryLog: '[EDGE-CAM-01] Buffer Delay: 112ms (Peak was 1,840ms) | Status: OPTIMAL'
    },
    comments: [],
    timeline: [
      { time: '05:45 AM', title: 'Buffer Normalized', description: 'Latency dropped back to 112ms.', actor: 'Health Monitor', type: 'system' }
    ],
    escalation: {
      level: 'Tier 1 (Gatehouse)',
      slaMinutes: 300,
      elapsedMinutes: 300,
      autoEscalateTarget: 'IT Director',
      isEscalated: false
    },
    resolution: {
      resolvedBy: 'Auto-Recovery Service',
      resolvedAt: new Date(Date.now() - 290 * 60 * 1000).toISOString(),
      rootCause: 'Temporary bandwidth constriction during database backup.',
      correctiveAction: 'Rescheduled automated backups to 02:00 AM.',
      verificationOfficer: 'IT System Admin'
    },
    history: [
      { timestamp: '05:45 AM', action: 'Resolved automatically', user: 'System Health' }
    ]
  }
];

export default function AlertsTab({ alerts }: { alerts: AIAlert[] }) {
  const [selectedCategory, setSelectedCategory] = useState<AlertCategory | 'All'>('All');
  const [selectedPriority, setSelectedPriority] = useState<AlertPriority | 'All'>('All');
  const [selectedStatus, setSelectedStatus] = useState<AlertStatus | 'All'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [alertList, setAlertList] = useState<AIAlert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<AIAlert | null>(null);
  
  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'ai_summary' | 'evidence' | 'timeline' | 'resolution' | 'comments'>('ai_summary');
  
  // New Alert Form State
  const [newAlert, setNewAlert] = useState<{
    category: AlertCategory;
    priority: AlertPriority;
    title: string;
    message: string;
    assignedTo: string;
    locationZone: string;
    cctvCameraId: string;
    rfidReaderId: string;
  }>({
    category: 'Safety',
    priority: 'High',
    title: '',
    message: '',
    assignedTo: 'Marcus Vance (EHS Director)',
    locationZone: 'Main Gate 1',
    cctvCameraId: 'CAM-GATE-1A',
    rfidReaderId: 'RD-GATE-01-TURNSTILE'
  });

  // New Comment Input
  const [newCommentText, setNewCommentText] = useState('');

  // Resolution Form
  const [resolutionData, setResolutionData] = useState({
    rootCause: '',
    correctiveAction: '',
    verificationOfficer: 'Marcus Vance (EHS Lead)'
  });

  // Notification Toast
  const [notificationMsg, setNotificationMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Firestore Sync & Initial Seed
  useEffect(() => {
    const seedAndSubscribe = async () => {
      try {
        const snap = await getDocs(collection(db, 'alerts_enterprise'));
        if (snap.empty) {
          for (const item of INITIAL_ENTERPRISE_ALERTS) {
            await setDoc(doc(db, 'alerts_enterprise', item.id || `ALT-${Math.floor(Math.random() * 9000) + 1000}`), {
              ...item,
              timestamp: item.timestamp.toISOString()
            });
          }
        }
      } catch (err) {
        console.error('Error seeding enterprise alerts:', err);
      }
    };

    seedAndSubscribe();

    const unsub = onSnapshot(collection(db, 'alerts_enterprise'), (snapshot) => {
      const data = snapshot.docs.map(docSnap => {
        const d = docSnap.data();
        return {
          ...d,
          id: docSnap.id,
          timestamp: typeof d.timestamp === 'string' ? new Date(d.timestamp) : (d.timestamp?.toDate ? d.timestamp.toDate() : new Date())
        } as AIAlert;
      });

      // Combine with props alerts if any unique ones
      setAlertList(data.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
    });

    return () => unsub();
  }, []);

  // Filtered Alert Roster
  const filteredAlerts = useMemo(() => {
    return alertList.filter(a => {
      const matchesCategory = selectedCategory === 'All' || a.category === selectedCategory;
      const matchesPriority = selectedPriority === 'All' || a.priority === selectedPriority;
      const matchesStatus = selectedStatus === 'All' || a.status === selectedStatus;
      
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        (a.id && a.id.toLowerCase().includes(searchLower)) ||
        (a.title && a.title.toLowerCase().includes(searchLower)) ||
        a.message.toLowerCase().includes(searchLower) ||
        (a.assignedTo && a.assignedTo.toLowerCase().includes(searchLower)) ||
        (a.evidence?.locationZone && a.evidence.locationZone.toLowerCase().includes(searchLower));

      return matchesCategory && matchesPriority && matchesStatus && matchesSearch;
    });
  }, [alertList, selectedCategory, selectedPriority, selectedStatus, searchTerm]);

  // Key KPI Metrics
  const metrics = useMemo(() => {
    const total = alertList.length;
    const critical = alertList.filter(a => a.priority === 'Critical' && a.status !== 'Resolved').length;
    const inProgress = alertList.filter(a => a.status === 'In Progress').length;
    const escalated = alertList.filter(a => a.status === 'Escalated' || a.escalation?.isEscalated).length;
    const resolved = alertList.filter(a => a.status === 'Resolved' || a.resolved).length;
    const emergencyCount = alertList.filter(a => a.category === 'Emergency' && a.status !== 'Resolved').length;

    return { total, critical, inProgress, escalated, resolved, emergencyCount };
  }, [alertList]);

  // Handle Create New Alert
  const handleCreateAlertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlert.title || !newAlert.message) return;

    const alertId = `ALT-${Math.floor(Math.random() * 8999) + 1000}`;
    const now = new Date();

    const createdRecord: AIAlert = {
      id: alertId,
      type: newAlert.priority === 'Critical' || newAlert.priority === 'High' ? 'security' : 'warning',
      category: newAlert.category,
      priority: newAlert.priority,
      status: 'New',
      title: newAlert.title,
      message: newAlert.message,
      timestamp: now,
      assignedTo: newAlert.assignedTo,
      assignedRole: 'Field Officer',
      assignedAt: now.toISOString(),
      aiSummary: {
        rootCause: `Manual incident logged under ${newAlert.category} protocol at ${newAlert.locationZone}.`,
        threatScore: newAlert.priority === 'Critical' ? 95 : newAlert.priority === 'High' ? 80 : 50,
        recommendedActions: [
          'Dispatch assigned field responder immediately.',
          'Verify CCTV camera telemetry feed.',
          'Log containment measures in comments thread.'
        ]
      },
      evidence: {
        locationZone: newAlert.locationZone,
        cctvCameraId: newAlert.cctvCameraId,
        rfidReaderId: newAlert.rfidReaderId,
        telemetryLog: `[MANUAL_TRIGGER] Alert ID: ${alertId} | Priority: ${newAlert.priority} | Zone: ${newAlert.locationZone}`
      },
      comments: [
        { id: `c_${Date.now()}`, author: 'Current User', role: 'EHS Controller', timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), text: `Alert manually initiated: ${newAlert.title}` }
      ],
      timeline: [
        { time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), title: 'Alert Created', description: newAlert.message, actor: 'User Input', type: 'trigger' }
      ],
      escalation: {
        level: 'Tier 1 (Gatehouse)',
        slaMinutes: newAlert.priority === 'Critical' ? 15 : 60,
        elapsedMinutes: 0,
        autoEscalateTarget: 'EHS Director (Marcus Vance)',
        isEscalated: false
      },
      history: [
        { timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), action: 'Created Alert', user: 'User' }
      ]
    };

    try {
      await setDoc(doc(db, 'alerts_enterprise', alertId), {
        ...createdRecord,
        timestamp: now.toISOString()
      });
      setNotificationMsg({ type: 'success', text: `Enterprise Alert ${alertId} generated & dispatched!` });
      setIsCreateModalOpen(false);
      setNewAlert({
        category: 'Safety',
        priority: 'High',
        title: '',
        message: '',
        assignedTo: 'Marcus Vance (EHS Director)',
        locationZone: 'Main Gate 1',
        cctvCameraId: 'CAM-GATE-1A',
        rfidReaderId: 'RD-GATE-01-TURNSTILE'
      });
    } catch (err) {
      console.error('Error creating alert:', err);
    }
  };

  // Add Comment to Alert
  const handleAddComment = async () => {
    if (!selectedAlert || !newCommentText.trim()) return;

    const newComment: AlertComment = {
      id: `comment_${Date.now()}`,
      author: 'EHS Control Officer',
      role: 'Site Safety Team',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: newCommentText.trim()
    };

    const updatedComments = [...(selectedAlert.comments || []), newComment];
    const updatedHistory = [...(selectedAlert.history || []), {
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: 'Added Comment',
      user: 'EHS Officer'
    }];

    try {
      await updateDoc(doc(db, 'alerts_enterprise', selectedAlert.id!), {
        comments: updatedComments,
        history: updatedHistory
      });

      setSelectedAlert({
        ...selectedAlert,
        comments: updatedComments,
        history: updatedHistory
      });
      setNewCommentText('');
      setNotificationMsg({ type: 'success', text: 'Comment added to activity thread.' });
    } catch (err) {
      console.error('Error adding comment:', err);
    }
  };

  // Escalate Alert
  const handleEscalateAlert = async (alert: AIAlert) => {
    const updatedEscalation = {
      level: 'Tier 2 (EHS Director)' as const,
      slaMinutes: 15,
      elapsedMinutes: alert.escalation?.elapsedMinutes || 10,
      autoEscalateTarget: 'VP Site Operations',
      isEscalated: true
    };

    const updatedHistory = [...(alert.history || []), {
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: 'Manually Escalated to Tier 2 (EHS Director)',
      user: 'EHS Controller'
    }];

    try {
      await updateDoc(doc(db, 'alerts_enterprise', alert.id!), {
        status: 'Escalated',
        escalation: updatedEscalation,
        history: updatedHistory
      });

      if (selectedAlert && selectedAlert.id === alert.id) {
        setSelectedAlert({
          ...selectedAlert,
          status: 'Escalated',
          escalation: updatedEscalation,
          history: updatedHistory
        });
      }
      setNotificationMsg({ type: 'error', text: `Alert ${alert.id} ESCALATED to Tier 2 Executive Protocol!` });
    } catch (err) {
      console.error('Error escalating alert:', err);
    }
  };

  // Resolve Alert Submit
  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlert) return;

    const resInfo = {
      resolvedBy: resolutionData.verificationOfficer,
      resolvedAt: new Date().toISOString(),
      rootCause: resolutionData.rootCause || 'Root cause analyzed & risk contained.',
      correctiveAction: resolutionData.correctiveAction || 'Field inspection completed & safety sign-off verified.',
      verificationOfficer: resolutionData.verificationOfficer
    };

    const updatedHistory = [...(selectedAlert.history || []), {
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      action: `Resolved by ${resolutionData.verificationOfficer}`,
      user: resolutionData.verificationOfficer
    }];

    try {
      await updateDoc(doc(db, 'alerts_enterprise', selectedAlert.id!), {
        status: 'Resolved',
        resolved: true,
        resolution: resInfo,
        history: updatedHistory
      });

      setSelectedAlert({
        ...selectedAlert,
        status: 'Resolved',
        resolved: true,
        resolution: resInfo,
        history: updatedHistory
      });

      setIsResolveModalOpen(false);
      setNotificationMsg({ type: 'success', text: `Alert ${selectedAlert.id} marked RESOLVED with EHS sign-off!` });
      setResolutionData({
        rootCause: '',
        correctiveAction: '',
        verificationOfficer: 'Marcus Vance (EHS Lead)'
      });
    } catch (err) {
      console.error('Error resolving alert:', err);
    }
  };

  // Export CSV & PDF
  const handleExportCSV = () => {
    const columns = [
      { key: 'id', label: 'ALERT ID' },
      { key: 'category', label: 'CATEGORY' },
      { key: 'priority', label: 'PRIORITY' },
      { key: 'title', label: 'TITLE' },
      { key: 'status', label: 'STATUS' },
      { key: 'assignedTo', label: 'ASSIGNED OFFICER' },
      { key: 'locationZone', label: 'ZONE LOCATION' }
    ];

    const data = alertList.map(a => ({
      id: a.id,
      category: a.category || 'General',
      priority: a.priority || 'Medium',
      title: a.title || a.message,
      status: a.status || 'New',
      assignedTo: a.assignedTo || 'Unassigned',
      locationZone: a.evidence?.locationZone || 'Site Area'
    }));

    exportToCSV('Enterprise_Alert_Center_Log', data, columns);
  };

  const handleExportPDF = () => {
    const columns = [
      { key: 'id', label: 'Alert ID' },
      { key: 'category', label: 'Category' },
      { key: 'priority', label: 'Priority' },
      { key: 'title', label: 'Alert Summary' },
      { key: 'status', label: 'Status' },
      { key: 'assignedTo', label: 'Assigned Officer' }
    ];

    const rows = alertList.map(a => ({
      id: a.id,
      category: a.category || 'Safety',
      priority: a.priority || 'High',
      title: a.title || a.message,
      status: a.status || 'Active',
      assignedTo: a.assignedTo || 'EHS Team'
    }));

    const metricsData = [
      { label: 'Total Incidents Logged', value: metrics.total },
      { label: 'Active Critical Hazards', value: metrics.critical },
      { label: 'In-Progress Containments', value: metrics.inProgress },
      { label: 'Escalated Alerts', value: metrics.escalated },
      { label: 'Resolved Incidents', value: metrics.resolved }
    ];

    generatePDFReport(
      'Aperture Enterprise Alert & Safety Incident Audit',
      'Official EHS Command Center Log & Response Summary',
      columns,
      rows,
      metricsData
    );
  };

  return (
    <div className="w-full flex flex-col p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Top Header & Quick Trigger Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Siren className="w-7 h-7 text-rose-600 animate-pulse" />
              Enterprise Alert Center
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500/10 text-rose-600 border border-rose-500/20">
              Active Monitoring Live
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-xs md:text-sm mt-0.5">
            Emergency alarms, safety hazards, equipment telematics, reader failures & AI threat escalation
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2"
          >
            <Plus size={15} /> Trigger Test Incident
          </button>

          <button
            onClick={handleExportCSV}
            className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 transition"
            title="Export CSV Log"
          >
            <Download size={15} />
          </button>

          <button
            onClick={handleExportPDF}
            className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 transition"
            title="Export Official PDF Report"
          >
            <Printer size={15} />
          </button>
        </div>
      </div>

      {/* Notification Toast */}
      {notificationMsg && (
        <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center justify-between shadow-sm animate-in fade-in border ${
          notificationMsg.type === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200' :
          notificationMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
          'bg-blue-50 text-blue-800 border-blue-200'
        }`}>
          <div className="flex items-center gap-2">
            {notificationMsg.type === 'error' ? <ShieldAlert size={16} className="text-rose-600" /> : <CheckCircle2 size={16} className="text-emerald-600" />}
            {notificationMsg.text}
          </div>
          <button onClick={() => setNotificationMsg(null)} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* KPI Cards Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Incidents</span>
          <span className="text-2xl font-black text-slate-900 dark:text-white">{metrics.total}</span>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Emergency & Critical</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-2xl font-black text-rose-600">{metrics.critical + metrics.emergencyCount}</span>
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">In Progress</span>
          <span className="text-2xl font-black text-amber-600">{metrics.inProgress}</span>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Escalated (Tier 2/3)</span>
          <span className="text-2xl font-black text-indigo-600">{metrics.escalated}</span>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Resolved & Cleared</span>
          <span className="text-2xl font-black text-emerald-600">{metrics.resolved}</span>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg SLA Response</span>
          <span className="text-2xl font-black text-slate-800 dark:text-slate-200">8.4m</span>
        </div>
      </div>

      {/* Category Pills Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedCategory('All')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            selectedCategory === 'All'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          All Categories ({alertList.length})
        </button>

        {CATEGORIES_LIST.map(cat => {
          const cfg = CATEGORY_CONFIG[cat];
          const Icon = cfg.icon;
          const count = alertList.filter(a => a.category === cat).length;

          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap border ${
                selectedCategory === cat
                  ? `${cfg.bg} ${cfg.color} ${cfg.border} ring-2 ring-offset-1 ring-current shadow-sm`
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              <Icon size={14} className={cfg.color} />
              {cat} ({count})
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-3.5" />
          <input
            type="text"
            placeholder="Search incident ID, title, zone, officer..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-rose-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <select
            value={selectedPriority}
            onChange={e => setSelectedPriority(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 px-3 py-1.5 outline-none"
          >
            <option value="All">All Priorities</option>
            <option value="Critical">Critical Priority</option>
            <option value="High">High Priority</option>
            <option value="Medium">Medium Priority</option>
            <option value="Low">Low Priority</option>
          </select>

          <select
            value={selectedStatus}
            onChange={e => setSelectedStatus(e.target.value as any)}
            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 px-3 py-1.5 outline-none"
          >
            <option value="All">All Statuses</option>
            <option value="New">New</option>
            <option value="In Progress">In Progress</option>
            <option value="Escalated">Escalated</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>
      </div>

      {/* Incident List Cards */}
      <div className="space-y-3">
        {filteredAlerts.map(alert => {
          const cat = alert.category || 'Safety';
          const cfg = CATEGORY_CONFIG[cat];
          const Icon = cfg.icon;

          return (
            <div
              key={alert.id}
              className={`p-4 md:p-5 rounded-2xl border transition shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                alert.priority === 'Critical' ? 'bg-rose-50/60 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900' :
                alert.priority === 'High' ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900' :
                'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
              }`}
            >
              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                <div className={`p-3 rounded-2xl shrink-0 ${cfg.bg} ${cfg.border} border shadow-inner`}>
                  <Icon size={22} className={cfg.color} />
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-black text-rose-600 bg-rose-50 dark:bg-rose-900/50 px-2 py-0.5 rounded-md border border-rose-200">
                      {alert.id}
                    </span>

                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                      {cat}
                    </span>

                    {alert.priority === 'Critical' && (
                      <Badge variant="outline" className="bg-rose-600 text-white font-black text-[10px] uppercase border-0 animate-pulse">
                        Critical Priority
                      </Badge>
                    )}
                    {alert.priority === 'High' && (
                      <Badge variant="outline" className="bg-amber-500 text-white font-black text-[10px] uppercase border-0">
                        High Priority
                      </Badge>
                    )}
                    {alert.priority === 'Medium' && (
                      <Badge variant="outline" className="bg-blue-500 text-white font-black text-[10px] uppercase border-0">
                        Medium
                      </Badge>
                    )}
                    {alert.priority === 'Low' && (
                      <Badge variant="outline" className="bg-slate-400 text-white font-black text-[10px] uppercase border-0">
                        Low
                      </Badge>
                    )}

                    <span className="text-xs text-slate-400 font-mono">
                      {alert.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <h3 className="font-bold text-slate-900 dark:text-white text-base leading-snug">
                    {alert.title || alert.message}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-300 font-medium line-clamp-2">
                    {alert.message}
                  </p>

                  <div className="flex items-center gap-4 text-xs font-semibold text-slate-500 pt-1 flex-wrap">
                    <span className="flex items-center gap-1">
                      <MapPin size={12} className="text-[#007BC4]" />
                      {alert.evidence?.locationZone || 'Site Main Area'}
                    </span>

                    <span className="flex items-center gap-1">
                      <UserCheck size={12} className="text-emerald-600" />
                      Assigned: <strong className="text-slate-700 dark:text-slate-200">{alert.assignedTo || 'Unassigned'}</strong>
                    </span>

                    {alert.comments && alert.comments.length > 0 && (
                      <span className="flex items-center gap-1 text-slate-600">
                        <MessageSquare size={12} />
                        {alert.comments.length} Comments
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status & Actions */}
              <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                {alert.status === 'Resolved' || alert.resolved ? (
                  <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                    <CheckCircle2 size={15} /> Resolved
                  </span>
                ) : alert.status === 'Escalated' ? (
                  <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1.5 animate-pulse">
                    <ShieldAlert size={15} /> Escalated (Tier 2)
                  </span>
                ) : (
                  <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1.5">
                    <Clock size={15} /> In Progress
                  </span>
                )}

                {alert.status !== 'Resolved' && !alert.resolved && (
                  <button
                    onClick={() => handleEscalateAlert(alert)}
                    className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-xl text-xs font-bold transition flex items-center gap-1"
                    title="Escalate Alert to Executive Tier 2"
                  >
                    <ArrowUpRight size={14} /> Escalate
                  </button>
                )}

                <button
                  onClick={() => {
                    setSelectedAlert(alert);
                    setActiveDetailTab('ai_summary');
                  }}
                  className="px-3.5 py-1.5 bg-[#007BC4] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center gap-1.5"
                >
                  <Eye size={14} /> Details & AI Summary
                </button>
              </div>
            </div>
          );
        })}

        {filteredAlerts.length === 0 && (
          <div className="py-16 text-center text-slate-500 font-medium bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700">
            <CheckCircle2 size={36} className="mx-auto text-emerald-500 mb-2" />
            No active alerts matching search criteria.
          </div>
        )}
      </div>

      {/* SELECTED ALERT DETAIL DRAWER / MODAL */}
      {selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden relative">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-start justify-between bg-slate-50 dark:bg-slate-900">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black text-rose-600 bg-rose-100 dark:bg-rose-900 px-2 py-0.5 rounded">
                    {selectedAlert.id}
                  </span>
                  <Badge variant="outline" className="bg-rose-600 text-white text-[10px] uppercase font-bold">
                    {selectedAlert.priority || 'High'} Priority
                  </Badge>
                  <span className="text-xs text-slate-500 font-mono">
                    {selectedAlert.timestamp.toLocaleString()}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                  {selectedAlert.title || selectedAlert.message}
                </h3>
              </div>

              <button
                onClick={() => setSelectedAlert(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Sub-Nav Tabs inside Detail Modal */}
            <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-700 px-5 pt-3 bg-white dark:bg-slate-800 overflow-x-auto">
              {[
                { id: 'ai_summary', label: 'AI Diagnosis & Action', icon: Sparkles },
                { id: 'evidence', label: 'CCTV & Telemetry Evidence', icon: Camera },
                { id: 'timeline', label: 'Timeline & Escalation', icon: Clock },
                { id: 'resolution', label: 'Resolution & Audit', icon: ShieldCheck },
                { id: 'comments', label: `Comments (${selectedAlert.comments?.length || 0})`, icon: MessageSquare }
              ].map(t => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveDetailTab(t.id as any)}
                    className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition flex items-center gap-1.5 whitespace-nowrap ${
                      activeDetailTab === t.id
                        ? 'border-[#007BC4] text-[#007BC4]'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Icon size={14} />
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Body Content */}
            <div className="p-6 overflow-y-auto space-y-4 flex-1">
              
              {/* TAB 1: AI SUMMARY */}
              {activeDetailTab === 'ai_summary' && (
                <div className="space-y-4">
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-900 border border-blue-200 dark:border-blue-800 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-900 dark:text-blue-200 text-xs flex items-center gap-1.5">
                        <Sparkles size={16} className="text-[#007BC4]" />
                        Antigravity AI Cause & Threat Engine
                      </span>
                      <span className="px-2.5 py-0.5 bg-blue-600 text-white text-[10px] font-black rounded-full">
                        Threat Score: {selectedAlert.aiSummary?.threatScore || 85}/100
                      </span>
                    </div>

                    <div className="text-xs text-slate-800 dark:text-slate-200 font-medium">
                      <strong>AI Root Cause Diagnosis:</strong> {selectedAlert.aiSummary?.rootCause || 'Root cause under automatic AI evaluation.'}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">
                      Recommended Immediate Containment Protocol
                    </h4>
                    <div className="space-y-2">
                      {(selectedAlert.aiSummary?.recommendedActions || [
                        'Dispatch nearest field responder unit.',
                        'Review CCTV frame telemetry log.',
                        'Notify EHS Director if unresolved in 15 minutes.'
                      ]).map((act, i) => (
                        <div key={i} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-start gap-2">
                          <span className="w-5 h-5 bg-[#007BC4] text-white rounded-full flex items-center justify-center shrink-0 text-[10px] font-black">{i + 1}</span>
                          {act}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: EVIDENCE */}
              {activeDetailTab === 'evidence' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-slate-900 rounded-2xl p-4 text-white space-y-2 relative overflow-hidden">
                      <div className="flex justify-between items-center text-xs font-mono text-slate-400">
                        <span className="flex items-center gap-1">
                          <Camera size={14} className="text-rose-500" />
                          {selectedAlert.evidence?.cctvCameraId || 'CAM-GATE-1A'}
                        </span>
                        <span className="text-rose-400 font-bold animate-pulse">● CCTV LIVE FRAME</span>
                      </div>
                      <div className="h-32 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-center text-slate-500 text-xs font-mono">
                        [ CCTV Frame Preview Stream Encrypted ]
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                      <h4 className="font-bold text-slate-900 dark:text-white">RFID & Sensor Telemetry Log</h4>
                      <div className="space-y-1 font-mono text-slate-700 dark:text-slate-300">
                        <div><strong>Location Zone:</strong> {selectedAlert.evidence?.locationZone || 'Gatehouse'}</div>
                        <div><strong>RFID Reader ID:</strong> {selectedAlert.evidence?.rfidReaderId || 'RD-GATE-01'}</div>
                        <div><strong>Hardhat Tag:</strong> {selectedAlert.evidence?.rfidTagId || 'HH-7721'}</div>
                        <div><strong>Signal RSSI:</strong> {selectedAlert.evidence?.rssiDbm || -65} dBm</div>
                      </div>
                      <div className="p-2 bg-slate-200 dark:bg-slate-800 rounded-lg text-[10px] font-mono break-all text-slate-800 dark:text-slate-200">
                        {selectedAlert.evidence?.telemetryLog || '[LOG] No raw telemetry log payload attached.'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: TIMELINE & ESCALATION */}
              {activeDetailTab === 'timeline' && (
                <div className="space-y-4">
                  <div className="p-4 bg-amber-50 dark:bg-slate-900 border border-amber-200 dark:border-amber-800/50 rounded-2xl space-y-2 text-xs">
                    <div className="flex justify-between font-bold text-amber-900 dark:text-amber-200">
                      <span>Escalation Matrix Level: {selectedAlert.escalation?.level || 'Tier 1'}</span>
                      <span>SLA: {selectedAlert.escalation?.elapsedMinutes || 10} / {selectedAlert.escalation?.slaMinutes || 15} mins</span>
                    </div>
                    <div className="w-full bg-amber-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div className="bg-rose-600 h-full rounded-full" style={{ width: `${Math.min(100, ((selectedAlert.escalation?.elapsedMinutes || 10) / (selectedAlert.escalation?.slaMinutes || 15)) * 100)}%` }} />
                    </div>
                    <div className="text-slate-500">Auto-Escalation Target: {selectedAlert.escalation?.autoEscalateTarget || 'EHS Director'}</div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase tracking-wider">Chronological Event Timeline</h4>
                    <div className="space-y-3 border-l-2 border-slate-200 dark:border-slate-700 ml-2 pl-4">
                      {(selectedAlert.timeline || [
                        { time: '10:00 AM', title: 'Alert Triggered', description: 'System recorded anomaly event.', actor: 'Automated System', type: 'trigger' }
                      ]).map((item, idx) => (
                        <div key={idx} className="relative text-xs space-y-0.5">
                          <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#007BC4]" />
                          <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span>{item.title}</span>
                            <span className="text-[10px] text-slate-400 font-mono">({item.time})</span>
                          </div>
                          <div className="text-slate-600 dark:text-slate-300">{item.description}</div>
                          <div className="text-[10px] text-slate-400">Actor: {item.actor}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: RESOLUTION */}
              {activeDetailTab === 'resolution' && (
                <div className="space-y-4">
                  {selectedAlert.status === 'Resolved' || selectedAlert.resolved ? (
                    <div className="p-4 bg-emerald-50 dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-2 text-xs">
                      <div className="font-bold text-emerald-900 dark:text-emerald-200 text-sm flex items-center gap-2">
                        <CheckCircle2 size={18} className="text-emerald-600" />
                        Incident Resolved & Verified
                      </div>
                      <div><strong>Resolved By:</strong> {selectedAlert.resolution?.resolvedBy || 'Marcus Vance'}</div>
                      <div><strong>Root Cause:</strong> {selectedAlert.resolution?.rootCause}</div>
                      <div><strong>Corrective Action:</strong> {selectedAlert.resolution?.correctiveAction}</div>
                      <div className="text-[10px] text-slate-400 font-mono">Resolved At: {selectedAlert.resolution?.resolvedAt}</div>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase">EHS Incident Sign-Off & Resolution</h4>
                      <p className="text-xs text-slate-500">Provide root cause analysis and corrective action taken before marking resolved.</p>
                      <button
                        onClick={() => setIsResolveModalOpen(true)}
                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 size={16} /> Mark Incident Resolved & Sign Off
                      </button>
                    </div>
                  )}

                  {/* Audit History */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 dark:text-white text-xs uppercase">Audit Log History</h4>
                    <div className="space-y-1.5 text-xs">
                      {(selectedAlert.history || []).map((h, i) => (
                        <div key={i} className="p-2 bg-slate-50 dark:bg-slate-900 rounded-lg flex justify-between font-mono text-[11px]">
                          <span>{h.action} (by {h.user})</span>
                          <span className="text-slate-400">{h.timestamp}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: COMMENTS */}
              {activeDetailTab === 'comments' && (
                <div className="space-y-4">
                  <div className="space-y-3">
                    {(selectedAlert.comments || []).map(c => (
                      <div key={c.id} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-1 text-xs">
                        <div className="flex justify-between font-bold text-slate-900 dark:text-white">
                          <span>{c.author} ({c.role})</span>
                          <span className="text-[10px] text-slate-400 font-mono">{c.timestamp}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 font-medium">{c.text}</p>
                      </div>
                    ))}

                    {(!selectedAlert.comments || selectedAlert.comments.length === 0) && (
                      <div className="py-8 text-center text-slate-400 text-xs">No comments posted yet.</div>
                    )}
                  </div>

                  {/* Add Comment Input */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                    <input
                      type="text"
                      placeholder="Post official safety update comment..."
                      value={newCommentText}
                      onChange={e => setNewCommentText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                      className="flex-1 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#007BC4]"
                    />
                    <button
                      onClick={handleAddComment}
                      className="px-4 py-2 bg-[#007BC4] hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
                    >
                      <Send size={14} /> Send
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer Actions */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
              <button
                onClick={() => handleEscalateAlert(selectedAlert)}
                disabled={selectedAlert.status === 'Resolved'}
                className="px-3.5 py-2 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-xl text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <ArrowUpRight size={15} /> Escalate Alert
              </button>

              <button
                onClick={() => setSelectedAlert(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CREATE ALERT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <form onSubmit={handleCreateAlertSubmit} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-3xl w-full max-w-lg p-6 relative space-y-4">
            <button type="button" onClick={() => setIsCreateModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Plus size={18} className="text-rose-600" />
              Trigger Custom Enterprise Incident Alert
            </h3>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Category</label>
                  <select
                    value={newAlert.category}
                    onChange={e => setNewAlert({ ...newAlert, category: e.target.value as any })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                  >
                    {CATEGORIES_LIST.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Priority</label>
                  <select
                    value={newAlert.priority}
                    onChange={e => setNewAlert({ ...newAlert, priority: e.target.value as any })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                  >
                    <option value="Critical">Critical Priority</option>
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Incident Headline Title</label>
                <input
                  type="text"
                  value={newAlert.title}
                  onChange={e => setNewAlert({ ...newAlert, title: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  placeholder="e.g. Scaffolding Structure Anchor Failure Risk"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Detailed Incident Description</label>
                <textarea
                  value={newAlert.message}
                  onChange={e => setNewAlert({ ...newAlert, message: e.target.value })}
                  rows={3}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  placeholder="Describe telemetry anomaly, visual CCTV detection, or site hazard..."
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Location Zone</label>
                  <input
                    type="text"
                    value={newAlert.locationZone}
                    onChange={e => setNewAlert({ ...newAlert, locationZone: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Assign Officer</label>
                  <input
                    type="text"
                    value={newAlert.assignedTo}
                    onChange={e => setNewAlert({ ...newAlert, assignedTo: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 text-white rounded-xl font-bold shadow-md hover:bg-rose-700 transition"
                >
                  Post Incident Alert
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* RESOLUTION MODAL */}
      {isResolveModalOpen && selectedAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <form onSubmit={handleResolveSubmit} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-3xl w-full max-w-md p-6 relative space-y-4">
            <button type="button" onClick={() => setIsResolveModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600" />
              Sign Off & Resolve Incident {selectedAlert.id}
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Confirmed Root Cause Analysis</label>
                <textarea
                  value={resolutionData.rootCause}
                  onChange={e => setResolutionData({ ...resolutionData, rootCause: e.target.value })}
                  rows={2}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  placeholder="Detail the technical or operational root cause..."
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Corrective Actions Executed</label>
                <textarea
                  value={resolutionData.correctiveAction}
                  onChange={e => setResolutionData({ ...resolutionData, correctiveAction: e.target.value })}
                  rows={2}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  placeholder="Detail containment, equipment repair, or safety clearance..."
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Signing EHS Officer</label>
                <input
                  type="text"
                  value={resolutionData.verificationOfficer}
                  onChange={e => setResolutionData({ ...resolutionData, verificationOfficer: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                  required
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsResolveModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold shadow-md hover:bg-emerald-700 transition"
                >
                  Confirm Sign-Off & Clear Alert
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
