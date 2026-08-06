import React, { useState, useEffect, useMemo } from 'react';
import { 
  EnterpriseIncident, IncidentCategory, IncidentWorkflowStatus, 
  WitnessStatement, IncidentAttachment, IncidentTimelineEvent 
} from '../types';
import { 
  ShieldAlert, AlertTriangle, CheckCircle2, Clock, Paperclip, ChevronRight, 
  FileText, Plus, Download, Printer, Search, Filter, Flame, Stethoscope, 
  Shield, Zap, Wrench, Droplet, UserCheck, AlertOctagon, Activity, Sparkles, 
  ArrowRight, CheckSquare, MessageSquare, UserPlus, FileCheck, Layers, X, 
  Send, ShieldCheck, Eye, EyeOff, Building2, MapPin, HardHat, FileSpreadsheet, RefreshCw
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { collection, onSnapshot, doc, setDoc, updateDoc, getDocs } from '../lib/db';
import { db } from '../lib/firebase';
import { exportToCSV, generatePDFReport } from '../lib/exportUtils';

const INCIDENT_CATEGORIES: { name: IncidentCategory; icon: React.ElementType; color: string; bg: string }[] = [
  { name: 'Near Miss', icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/40' },
  { name: 'Injury', icon: Stethoscope, color: 'text-rose-600', bg: 'bg-rose-50 dark:bg-rose-950/40' },
  { name: 'Equipment Damage', icon: Wrench, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-950/40' },
  { name: 'Fire', icon: Flame, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/40' },
  { name: 'Medical', icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/40' },
  { name: 'Security', icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-950/40' },
  { name: 'Chemical', icon: Droplet, color: 'text-violet-600', bg: 'bg-violet-50 dark:bg-violet-950/40' },
  { name: 'Electrical', icon: Zap, color: 'text-yellow-600', bg: 'bg-yellow-50 dark:bg-yellow-950/40' },
  { name: 'Environmental', icon: AlertOctagon, color: 'text-teal-600', bg: 'bg-teal-50 dark:bg-teal-950/40' }
];

const WORKFLOW_STAGES: IncidentWorkflowStatus[] = [
  'Open', 'Assigned', 'Investigation', 'Root Cause', 'Corrective Action', 'Approval', 'Closed'
];

const INITIAL_MOCK_INCIDENTS: EnterpriseIncident[] = [
  {
    id: 'INC-2026-101',
    title: 'Near-Miss Heavy Crane Load Swing Exceedance',
    category: 'Near Miss',
    severity: 'High',
    workflowStatus: 'Investigation',
    locationZone: 'Heavy Crane & Exclusion Area',
    reportedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    reportedBy: 'Carlos Mendez (Rigging Supervisor)',
    assignedOfficer: 'Marcus Vance',
    assignedRole: 'EHS Lead Officer',
    description: 'During 12-ton steel truss lift on Crane TC-01, wind shear caused load to swing into secondary scaffold zone. No injuries, scaffold mesh grazed.',
    equipmentInvolved: 'Tower Crane TC-01 & 12T Steel Truss',
    aiAnalysis: {
      severityScore: 78,
      aiSummary: 'High-risk near-miss incident triggered by localized wind shear coupled with unannounced tag line operator repositioning.',
      probableRootCause: 'Tag-line riggers failed to maintain dual 45-degree guide control during wind gust transition above 35 km/h.',
      contributingFactors: [
        'Anemometer wind alarm acknowledged but lift was not immediately aborted.',
        'Secondary rigger stood in blind spot of crane operator camera CAM-TC01-BOOM.'
      ],
      capaRecommendations: [
        'Mandate dual-tagline control for loads exceeding 8 tons in windy conditions.',
        'Install direct automated wind speed cutoff circuit on Crane TC-01 hoist controls.'
      ],
      regulatoryImpact: 'OSHA 1926.1412 / ISO 45001 High Potential (HIPO) Event - Mandatory internal safety audit required.'
    },
    witnessStatements: [
      {
        id: 'ws-1',
        witnessName: 'Carlos Mendez',
        witnessRole: 'Rigger Lead',
        company: 'Apex Rigging Co.',
        interviewedBy: 'Marcus Vance',
        timestamp: '10:15 AM',
        statement: 'A sudden wind gust caught the truss right as we cleared the 3rd scaffold tier. I signaled to hold, but momentum pulled the tagline.'
      }
    ],
    attachments: [
      {
        id: 'att-1',
        fileName: 'cctv_crane_swing_frame.jpg',
        fileType: 'CCTV Clip',
        fileUrl: '/cctv_frame_crane.jpg',
        fileSize: '2.4 MB',
        uploadedBy: 'AI Vision System',
        uploadedAt: '10:02 AM'
      },
      {
        id: 'att-2',
        fileName: 'telematics_tc01_wind_log.csv',
        fileType: 'Telemetry Log',
        fileUrl: '/telematics_wind.csv',
        fileSize: '410 KB',
        uploadedBy: 'TC-01 Telematics',
        uploadedAt: '10:05 AM'
      }
    ],
    timeline: [
      { id: 't1', timestamp: '10:00 AM', title: 'Incident Occurred', description: 'Truss swing grazed scaffold tier 3.', actor: 'Site Sensors', statusChange: 'Open' },
      { id: 't2', timestamp: '10:08 AM', title: 'Assigned to EHS Lead', description: 'Assigned to Marcus Vance for site investigation.', actor: 'EHS System', statusChange: 'Assigned' },
      { id: 't3', timestamp: '10:15 AM', title: 'Investigation Started', description: 'CCTV footage reviewed & witness statement recorded.', actor: 'Marcus Vance', statusChange: 'Investigation' }
    ],
    correctiveActions: [
      { id: 'ca-1', actionItem: 'Inspect scaffold tier 3 structural integrity for minor scrapes', assignedTo: 'Civil Engineering Lead', dueDate: '2026-08-07', isCompleted: true },
      { id: 'ca-2', actionItem: 'Conduct mandatory crane rigging safety toolbox talk', assignedTo: 'Marcus Vance', dueDate: '2026-08-08', isCompleted: false }
    ]
  },
  {
    id: 'INC-2026-102',
    title: 'Tunnel Shaft Chemical Hydraulic Hose Burst',
    category: 'Chemical',
    severity: 'Critical',
    workflowStatus: 'Root Cause',
    locationZone: 'Confined Shaft & Tunneling',
    reportedAt: new Date(Date.now() - 120 * 60 * 1000).toISOString(),
    reportedBy: 'Frank Reynolds (Equipment Lead)',
    assignedOfficer: 'Elena Rostova',
    assignedRole: 'Environmental EHS Inspector',
    description: 'Hydraulic high-pressure hose on Excavator EX-04 ruptured in Shaft L2, spilling 45 liters of bio-degradable hydraulic fluid.',
    equipmentInvolved: 'Excavator EX-04 (CAT 336)',
    hazardClass: 'Class 9 Environmental Hazard',
    aiAnalysis: {
      severityScore: 88,
      aiSummary: 'Critical hydraulic line burst resulting in fluid spill inside confined shaft enclave.',
      probableRootCause: 'Abrasion wear on hydraulic outer sleeve against boom pivot casting due to missing rubber guard bushing.',
      contributingFactors: [
        'Preventive maintenance inspection missed missing guard bushing during 250-hour check.',
        'High ambient thermal stress inside Shaft L2 accelerated rubber hose degradation.'
      ],
      capaRecommendations: [
        'Deploy chemical spill absorbents and sump pump containment.',
        'Replace all excavator boom hydraulic hoses with dual-braided steel sleeves.'
      ],
      regulatoryImpact: 'EPA Spill Reporting Protocol - Bio-degradable oil contained, local spill kit deployed.'
    },
    witnessStatements: [
      {
        id: 'ws-2',
        witnessName: 'Frank Reynolds',
        witnessRole: 'Heavy Equipment Operator',
        company: 'Titan Machinery',
        interviewedBy: 'Elena Rostova',
        timestamp: '08:45 AM',
        statement: 'I heard a sharp pop on the boom hydraulic circuit and immediately saw hydraulic mist spraying out. Aborted engine in 4 seconds.'
      }
    ],
    attachments: [
      {
        id: 'att-3',
        fileName: 'spill_containment_photo.jpg',
        fileType: 'Photo',
        fileUrl: '/spill_photo.jpg',
        fileSize: '3.1 MB',
        uploadedBy: 'Elena Rostova',
        uploadedAt: '09:00 AM'
      }
    ],
    timeline: [
      { id: 't1', timestamp: '08:40 AM', title: 'Hose Rupture', description: 'Excavator EX-04 hose burst in Shaft L2.', actor: 'Frank Reynolds', statusChange: 'Open' },
      { id: 't2', timestamp: '08:50 AM', title: 'Spill Kit Deployed', description: 'Absorbent pads and booms deployed.', actor: 'EHS Crew', statusChange: 'Investigation' },
      { id: 't3', timestamp: '09:20 AM', title: 'Root Cause Review', description: 'Hose failure analyzed by mechanical team.', actor: 'Elena Rostova', statusChange: 'Root Cause' }
    ],
    rootCauseDetails: {
      causeType: 'Mechanical Fatigue & Omitted Guard Bushing',
      description: 'Absence of protective sleeve led to friction rubbing against excavator frame.',
      verifiedBy: 'Frank Reynolds (Equipment Lead)'
    },
    correctiveActions: [
      { id: 'ca-3', actionItem: 'Clean fluid spill and dispose of absorbent materials per EHS guidelines', assignedTo: 'Hazmat Crew', dueDate: '2026-08-06', isCompleted: true },
      { id: 'ca-4', actionItem: 'Inspect all excavators for missing hydraulic guard bushings', assignedTo: 'Titan Mechanics', dueDate: '2026-08-07', isCompleted: false }
    ]
  },
  {
    id: 'INC-2026-103',
    title: 'Scaffold Tower Handrail Laceration Injury',
    category: 'Injury',
    severity: 'Medium',
    workflowStatus: 'Corrective Action',
    locationZone: 'Structure & Scaffolding (L1-L4)',
    reportedAt: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
    reportedBy: 'Sarah Lin (First Responder)',
    assignedOfficer: 'Sarah Lin',
    assignedRole: 'Site First Aid Officer',
    description: 'Worker sustained minor hand laceration from sharp burr on galvanized scaffold tube while ascending Level 2 ladder bay.',
    injuredPersonnelCount: 1,
    aiAnalysis: {
      severityScore: 45,
      aiSummary: 'First aid recordable incident involving hand laceration. Level 1 PPE gloves prevented deep tissue injury.',
      probableRootCause: 'Raw burr left on newly cut scaffold tubing during Level 2 expansion.',
      contributingFactors: [
        'Scaffold installation team omitted edge de-burring step before handrail clamping.'
      ],
      capaRecommendations: [
        'Require mandatory de-burring quality sign-off before scaffolding release.',
        'Upgrade glove specification to Level 4 cut-resistance for scaffold erectors.'
      ],
      regulatoryImpact: 'OSHA First Aid Recordable - No lost time, worker returned to light duty.'
    },
    witnessStatements: [
      {
        id: 'ws-3',
        witnessName: 'David Chen',
        witnessRole: 'Scaffolder',
        company: 'BuildCorp Partner',
        interviewedBy: 'Sarah Lin',
        timestamp: '07:15 AM',
        statement: 'I grabbed the handrail while climbing up and felt a sharp metallic burr cut through my glove seam.'
      }
    ],
    attachments: [
      {
        id: 'att-4',
        fileName: 'medical_triage_form.pdf',
        fileType: 'Medical Report',
        fileUrl: '/medical_report.pdf',
        fileSize: '1.2 MB',
        uploadedBy: 'Sarah Lin',
        uploadedAt: '07:30 AM'
      }
    ],
    timeline: [
      { id: 't1', timestamp: '07:00 AM', title: 'Injury Reported', description: 'Hand laceration treated at Gatehouse First Aid station.', actor: 'Sarah Lin', statusChange: 'Open' },
      { id: 't2', timestamp: '07:30 AM', title: 'Medical Triage Completed', description: 'Wound cleaned and bandaged. Triage report logged.', actor: 'Sarah Lin', statusChange: 'Investigation' },
      { id: 't3', timestamp: '08:15 AM', title: 'Corrective Actions Initiated', description: 'Scaffold handrails inspected for metallic burrs.', actor: 'BuildCorp Safety', statusChange: 'Corrective Action' }
    ],
    correctiveActions: [
      { id: 'ca-5', actionItem: 'Sand and file down all burrs on Scaffold Tier 2 handrails', assignedTo: 'Scaffold Maintenance', dueDate: '2026-08-06', isCompleted: true },
      { id: 'ca-6', actionItem: 'Issue Level 4 cut-resistant gloves to all scaffolding crews', assignedTo: 'PPE Procurement', dueDate: '2026-08-07', isCompleted: true }
    ]
  },
  {
    id: 'INC-2026-104',
    title: 'Site Perimeter Gate 3 Lock Tampering',
    category: 'Security',
    severity: 'High',
    workflowStatus: 'Approval',
    locationZone: 'Main Gate 1',
    reportedAt: new Date(Date.now() - 360 * 60 * 1000).toISOString(),
    reportedBy: 'Gate 3 Patrol Guard',
    assignedOfficer: 'Marcus Vance',
    assignedRole: 'Security Director',
    description: 'Padlock on secondary perimeter fence Gate 3 cut during overnight hours. No material missing, CCTV captured 1 suspect fleeing.',
    aiAnalysis: {
      severityScore: 72,
      aiSummary: 'Security perimeter breach via mechanical cut on gate chain lock.',
      probableRootCause: 'Lack of thermal CCTV coverage along East perimeter fence boundary.',
      contributingFactors: [
        'Perimeter lighting fixture L-12 was powered off due to faulty breaker.'
      ],
      capaRecommendations: [
        'Install smart electronic solenoid lock with turnstile telemetry on Gate 3.',
        'Reposition thermal camera CAM-EAST-02 to cover blind fence angle.'
      ],
      regulatoryImpact: 'Site Physical Security Compliance Protocol Level 2.'
    },
    witnessStatements: [],
    attachments: [
      {
        id: 'att-5',
        fileName: 'gate3_cut_lock.jpg',
        fileType: 'Photo',
        fileUrl: '/cut_lock.jpg',
        fileSize: '1.8 MB',
        uploadedBy: 'Patrol Guard',
        uploadedAt: '05:30 AM'
      }
    ],
    timeline: [
      { id: 't1', timestamp: '05:15 AM', title: 'Breach Discovered', description: 'Cut lock noticed during morning patrol.', actor: 'Patrol Guard', statusChange: 'Open' },
      { id: 't2', timestamp: '06:00 AM', title: 'Investigation Completed', description: 'CCTV footage archived & police report filed.', actor: 'Marcus Vance', statusChange: 'Investigation' },
      { id: 't3', timestamp: '09:00 AM', title: 'Submitted for EHS Approval', description: 'CAPA plan submitted for executive sign-off.', actor: 'Marcus Vance', statusChange: 'Approval' }
    ],
    correctiveActions: [
      { id: 'ca-7', actionItem: 'Replace Gate 3 cut padlock with high-security smart lock', assignedTo: 'Security Maintenance', dueDate: '2026-08-06', isCompleted: true }
    ],
    approvalSignOff: {
      approvedBy: 'David Miller (Site Operations VP)',
      approvedAt: new Date().toISOString(),
      comments: 'Security CAPA plan approved. Proceed with thermal camera upgrade.'
    }
  },
  {
    id: 'INC-2026-105',
    title: 'Temporary Power DB-02 Electrical Short Arc',
    category: 'Electrical',
    severity: 'Closed' as any,
    workflowStatus: 'Closed',
    locationZone: 'Electrical Substation',
    reportedAt: new Date(Date.now() - 500 * 60 * 1000).toISOString(),
    reportedBy: 'VoltCraft Utilities Tech',
    assignedOfficer: 'Frank Reynolds',
    assignedRole: 'Electrical Safety Lead',
    description: 'Electrical arc flash occurred inside distribution board DB-02 due to moisture penetration during heavy rainfall.',
    equipmentInvolved: 'Distribution Board DB-02',
    aiAnalysis: {
      severityScore: 60,
      aiSummary: 'Electrical short circuit caused by rainwater ingress into weather-rated DB box.',
      probableRootCause: 'Damaged rubber door gasket seal on NEMA 4X distribution enclosure.',
      contributingFactors: ['Heavy rainstorm coupled with worn enclosure seal.'],
      capaRecommendations: ['Replace DB-02 door seal and install weather canopy overhead.'],
      regulatoryImpact: 'NFPA 70E Electrical Safety in the Workplace Compliance.'
    },
    witnessStatements: [],
    attachments: [],
    timeline: [
      { id: 't1', timestamp: '03:00 AM', title: 'Arc Flash Alarm', description: 'Main breaker tripped automatically.', actor: 'Telemetry System', statusChange: 'Open' },
      { id: 't2', timestamp: '05:00 AM', title: 'Repairs Completed', description: 'Breaker replaced and IP67 canopy installed.', actor: 'Frank Reynolds', statusChange: 'Closed' }
    ],
    correctiveActions: [
      { id: 'ca-8', actionItem: 'Replace NEMA enclosure seal and test insulation resistance', assignedTo: 'VoltCraft Electric', dueDate: '2026-08-05', isCompleted: true }
    ]
  }
];

export default function IncidentsTab() {
  const [incidents, setIncidents] = useState<EnterpriseIncident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<EnterpriseIncident | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<IncidentCategory | 'All'>('All');
  const [selectedStatus, setSelectedStatus] = useState<IncidentWorkflowStatus | 'All'>('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals & Active Sub-Tabs
  const [isNewIncidentOpen, setIsNewIncidentOpen] = useState(false);
  const [isAddWitnessOpen, setIsAddWitnessOpen] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<'ai_analysis' | 'workflow' | 'witnesses' | 'attachments' | 'timeline' | 'capa'>('ai_analysis');

  // Notification Toast
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // New Incident Form State
  const [newForm, setNewForm] = useState<{
    title: string;
    category: IncidentCategory;
    severity: 'Critical' | 'High' | 'Medium' | 'Low';
    locationZone: string;
    reportedBy: string;
    assignedOfficer: string;
    description: string;
    equipmentInvolved: string;
  }>({
    title: '',
    category: 'Near Miss',
    severity: 'High',
    locationZone: 'Main Gate 1',
    reportedBy: 'Field Safety Officer',
    assignedOfficer: 'Marcus Vance (EHS Director)',
    description: '',
    equipmentInvolved: ''
  });

  // New Witness Statement State
  const [newWitness, setNewWitness] = useState({
    witnessName: '',
    witnessRole: '',
    company: 'BuildCorp Partner',
    interviewedBy: 'Marcus Vance',
    statement: ''
  });

  // Sync with Firestore & Seed Initial Data
  useEffect(() => {
    const seedAndSubscribe = async () => {
      try {
        const snap = await getDocs(collection(db, 'incidents_enterprise'));
        if (snap.empty) {
          for (const inc of INITIAL_MOCK_INCIDENTS) {
            await setDoc(doc(db, 'incidents_enterprise', inc.id), {
              ...inc,
              reportedAt: typeof inc.reportedAt === 'string' ? inc.reportedAt : inc.reportedAt.toISOString()
            });
          }
        }
      } catch (err) {
        console.error('Error seeding initial incidents:', err);
      }
    };

    seedAndSubscribe();

    const unsub = onSnapshot(collection(db, 'incidents_enterprise'), (snapshot) => {
      const data = snapshot.docs.map(docSnap => {
        const d = docSnap.data();
        return {
          ...d,
          id: docSnap.id
        } as EnterpriseIncident;
      });

      setIncidents(data);
      if (data.length > 0 && !selectedIncident) {
        setSelectedIncident(data[0]);
      }
    });

    return () => unsub();
  }, []);

  // Filtered Incident Roster
  const filteredIncidents = useMemo(() => {
    return incidents.filter(inc => {
      const matchesCategory = selectedCategory === 'All' || inc.category === selectedCategory;
      const matchesStatus = selectedStatus === 'All' || inc.workflowStatus === selectedStatus;
      
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = !searchTerm ||
        inc.id.toLowerCase().includes(searchLower) ||
        inc.title.toLowerCase().includes(searchLower) ||
        inc.locationZone.toLowerCase().includes(searchLower) ||
        inc.assignedOfficer.toLowerCase().includes(searchLower) ||
        inc.description.toLowerCase().includes(searchLower);

      return matchesCategory && matchesStatus && matchesSearch;
    });
  }, [incidents, selectedCategory, selectedStatus, searchTerm]);

  // KPI Metrics
  const metrics = useMemo(() => {
    const total = incidents.length;
    const openCount = incidents.filter(i => i.workflowStatus === 'Open' || i.workflowStatus === 'Assigned' || i.workflowStatus === 'Investigation').length;
    const highRisk = incidents.filter(i => (i.severity === 'Critical' || i.severity === 'High') && i.workflowStatus !== 'Closed').length;
    const capaPending = incidents.reduce((acc, curr) => acc + (curr.correctiveActions?.filter(c => !c.isCompleted).length || 0), 0);
    const closedCount = incidents.filter(i => i.workflowStatus === 'Closed').length;

    return { total, openCount, highRisk, capaPending, closedCount };
  }, [incidents]);

  // Handle Create New Incident
  const handleCreateIncidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.title || !newForm.description) return;

    const incId = `INC-2026-${Math.floor(Math.random() * 899) + 100}`;
    const nowStr = new Date().toISOString();

    const newRecord: EnterpriseIncident = {
      id: incId,
      title: newForm.title,
      category: newForm.category,
      severity: newForm.severity,
      workflowStatus: 'Open',
      locationZone: newForm.locationZone,
      reportedAt: nowStr,
      reportedBy: newForm.reportedBy,
      assignedOfficer: newForm.assignedOfficer,
      assignedRole: 'Field EHS Specialist',
      description: newForm.description,
      equipmentInvolved: newForm.equipmentInvolved || undefined,
      aiAnalysis: {
        severityScore: newForm.severity === 'Critical' ? 92 : newForm.severity === 'High' ? 75 : 45,
        aiSummary: `Initial incident analysis logged for ${newForm.category} at ${newForm.locationZone}.`,
        probableRootCause: `Pending formal site investigation by ${newForm.assignedOfficer}.`,
        contributingFactors: [
          'Environmental or operational hazard reported in field.',
          'Initial notification captured via Enterprise Incident Center.'
        ],
        capaRecommendations: [
          'Secure immediate hazard perimeter at location zone.',
          'Assign field investigator to conduct witness interviews.',
          'Log formal root cause analysis within 24 hours.'
        ],
        regulatoryImpact: 'Internal EHS Incident Protocol Level 1 - Notification Dispatched.'
      },
      witnessStatements: [],
      attachments: [],
      timeline: [
        { id: `t_${Date.now()}`, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), title: 'Incident Created', description: newForm.description, actor: newForm.reportedBy, statusChange: 'Open' }
      ],
      correctiveActions: [
        { id: `ca_${Date.now()}`, actionItem: 'Perform preliminary safety perimeter isolation', assignedTo: newForm.assignedOfficer, dueDate: '2026-08-07', isCompleted: false }
      ]
    };

    try {
      await setDoc(doc(db, 'incidents_enterprise', incId), newRecord);
      setSelectedIncident(newRecord);
      setIsNewIncidentOpen(false);
      setNotification({ type: 'success', text: `Enterprise Incident ${incId} logged & dispatched to ${newForm.assignedOfficer}` });
      setNewForm({
        title: '',
        category: 'Near Miss',
        severity: 'High',
        locationZone: 'Main Gate 1',
        reportedBy: 'Field Safety Officer',
        assignedOfficer: 'Marcus Vance (EHS Director)',
        description: '',
        equipmentInvolved: ''
      });
    } catch (err) {
      console.error('Error creating incident:', err);
    }
  };

  // Transition Workflow Stage
  const handleAdvanceWorkflow = async (nextStatus: IncidentWorkflowStatus) => {
    if (!selectedIncident) return;

    const nowTimeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updatedTimeline: IncidentTimelineEvent[] = [
      ...(selectedIncident.timeline || []),
      {
        id: `t_${Date.now()}`,
        timestamp: nowTimeStr,
        title: `Advanced to ${nextStatus}`,
        description: `Workflow stage updated from ${selectedIncident.workflowStatus} to ${nextStatus}.`,
        actor: 'EHS Control Lead',
        statusChange: nextStatus
      }
    ];

    try {
      await updateDoc(doc(db, 'incidents_enterprise', selectedIncident.id), {
        workflowStatus: nextStatus,
        timeline: updatedTimeline
      });

      setSelectedIncident({
        ...selectedIncident,
        workflowStatus: nextStatus,
        timeline: updatedTimeline
      });

      setNotification({ type: 'success', text: `Incident ${selectedIncident.id} advanced to workflow stage: ${nextStatus}` });
    } catch (err) {
      console.error('Error advancing workflow stage:', err);
    }
  };

  // Add Witness Statement
  const handleAddWitnessSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedIncident || !newWitness.witnessName || !newWitness.statement) return;

    const newStmt: WitnessStatement = {
      id: `ws_${Date.now()}`,
      witnessName: newWitness.witnessName,
      witnessRole: newWitness.witnessRole || 'Site Worker',
      company: newWitness.company,
      interviewedBy: newWitness.interviewedBy,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      statement: newWitness.statement
    };

    const updatedStatements = [...(selectedIncident.witnessStatements || []), newStmt];

    try {
      await updateDoc(doc(db, 'incidents_enterprise', selectedIncident.id), {
        witnessStatements: updatedStatements
      });

      setSelectedIncident({
        ...selectedIncident,
        witnessStatements: updatedStatements
      });

      setIsAddWitnessOpen(false);
      setNewWitness({ witnessName: '', witnessRole: '', company: 'BuildCorp Partner', interviewedBy: 'Marcus Vance', statement: '' });
      setNotification({ type: 'success', text: 'Witness statement attached to incident file.' });
    } catch (err) {
      console.error('Error adding witness statement:', err);
    }
  };

  // Toggle CAPA Action Completion
  const handleToggleCapa = async (actionId: string) => {
    if (!selectedIncident || !selectedIncident.correctiveActions) return;

    const updatedCapas = selectedIncident.correctiveActions.map(ca => 
      ca.id === actionId ? { ...ca, isCompleted: !ca.isCompleted } : ca
    );

    try {
      await updateDoc(doc(db, 'incidents_enterprise', selectedIncident.id), {
        correctiveActions: updatedCapas
      });

      setSelectedIncident({
        ...selectedIncident,
        correctiveActions: updatedCapas
      });
      setNotification({ type: 'info', text: 'CAPA action item status updated.' });
    } catch (err) {
      console.error('Error toggling CAPA item:', err);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const data = incidents.map(i => ({
      IncidentID: i.id,
      Title: i.title,
      Category: i.category,
      Severity: i.severity,
      WorkflowStatus: i.workflowStatus,
      Location: i.locationZone,
      ReportedBy: i.reportedBy,
      AssignedOfficer: i.assignedOfficer,
      SeverityScore: i.aiAnalysis?.severityScore || 50,
      CapasPending: i.correctiveActions?.filter(c => !c.isCompleted).length || 0
    }));

    exportToCSV('Enterprise_Incidents_Log', data, [
      { key: 'IncidentID', label: 'INCIDENT ID' },
      { key: 'Title', label: 'TITLE' },
      { key: 'Category', label: 'CATEGORY' },
      { key: 'Severity', label: 'SEVERITY' },
      { key: 'WorkflowStatus', label: 'WORKFLOW STAGE' },
      { key: 'Location', label: 'ZONE LOCATION' },
      { key: 'ReportedBy', label: 'REPORTED BY' },
      { key: 'AssignedOfficer', label: 'ASSIGNED OFFICER' },
      { key: 'SeverityScore', label: 'AI THREAT SCORE' },
      { key: 'CapasPending', label: 'PENDING CAPAS' }
    ]);
  };

  // Export PDF
  const handleExportPDF = () => {
    const rows = incidents.map(i => ({
      id: i.id,
      cat: i.category,
      title: i.title,
      sev: i.severity,
      status: i.workflowStatus,
      zone: i.locationZone,
      officer: i.assignedOfficer
    }));

    generatePDFReport(
      'Aperture Enterprise Incident & CAPA Audit Report',
      'Official EHS Command Center Investigation Record',
      [
        { key: 'id', label: 'Incident ID' },
        { key: 'cat', label: 'Category' },
        { key: 'title', label: 'Incident Description' },
        { key: 'sev', label: 'Severity' },
        { key: 'status', label: 'Workflow Stage' },
        { key: 'zone', label: 'Zone' },
        { key: 'officer', label: 'Assigned Lead' }
      ],
      rows,
      [
        { label: 'Total Incidents Logged', value: metrics.total },
        { label: 'Active Open / Investigation', value: metrics.openCount },
        { label: 'High/Critical Severity Hazards', value: metrics.highRisk },
        { label: 'Pending CAPA Items', value: metrics.capaPending },
        { label: 'Closed / Signed Off', value: metrics.closedCount }
      ]
    );
  };

  return (
    <div className="w-full flex flex-col p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldAlert className="w-7 h-7 text-[#007BC4]" />
              Enterprise Incident Center
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#007BC4]/10 text-[#007BC4] border border-[#007BC4]/20">
              EHS Command Live
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-xs md:text-sm mt-0.5">
            Near misses, injuries, equipment damage, fires, medical events, security breaches, witnesses, & AI RCA
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsNewIncidentOpen(true)}
            className="px-4 py-2 bg-[#007BC4] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2"
          >
            <Plus size={15} /> Log New Incident
          </button>

          <button
            onClick={handleExportCSV}
            className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 transition"
            title="Export CSV Log"
          >
            <FileSpreadsheet size={15} />
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
      {notification && (
        <div className="p-3.5 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-blue-700 rounded-xl text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[#007BC4]" />
            {notification.text}
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* KPI Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Incidents</span>
          <span className="text-2xl font-black text-slate-900 dark:text-white">{metrics.total}</span>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Active Open / Investigating</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-2xl font-black text-amber-600">{metrics.openCount}</span>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">High / Critical Hazards</span>
          <span className="text-2xl font-black text-rose-600">{metrics.highRisk}</span>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pending CAPA Actions</span>
          <span className="text-2xl font-black text-indigo-600">{metrics.capaPending}</span>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Closed & Signed Off</span>
          <span className="text-2xl font-black text-emerald-600">{metrics.closedCount}</span>
        </div>
      </div>

      {/* Category Selection Tabs Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setSelectedCategory('All')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
            selectedCategory === 'All'
              ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
          }`}
        >
          All Categories ({incidents.length})
        </button>

        {INCIDENT_CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const count = incidents.filter(i => i.category === cat.name).length;

          return (
            <button
              key={cat.name}
              onClick={() => setSelectedCategory(cat.name)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap border ${
                selectedCategory === cat.name
                  ? `${cat.bg} ${cat.color} ring-2 ring-offset-1 ring-current shadow-sm`
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
              }`}
            >
              <Icon size={14} className={cat.color} />
              {cat.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Workflow Stage Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-3.5" />
          <input
            type="text"
            placeholder="Search incident ID, title, zone, officer..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#007BC4]"
          />
        </div>

        {/* Workflow Stage Pills */}
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => setSelectedStatus('All')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold ${selectedStatus === 'All' ? 'bg-[#007BC4] text-white' : 'text-slate-500 hover:bg-slate-100'}`}
          >
            All Stages
          </button>
          {WORKFLOW_STAGES.map(st => (
            <button
              key={st}
              onClick={() => setSelectedStatus(st)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap ${
                selectedStatus === st ? 'bg-[#007BC4] text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Interface: List Left + Detail Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[550px]">
        
        {/* Incident List Column (4 cols) */}
        <div className="lg:col-span-4 space-y-3 overflow-y-auto max-h-[700px] pr-1">
          {filteredIncidents.map(inc => {
            const isSelected = selectedIncident?.id === inc.id;
            const catObj = INCIDENT_CATEGORIES.find(c => c.name === inc.category) || INCIDENT_CATEGORIES[0];
            const Icon = catObj.icon;

            return (
              <div
                key={inc.id}
                onClick={() => setSelectedIncident(inc)}
                className={`p-4 rounded-2xl border transition cursor-pointer shadow-sm relative ${
                  isSelected
                    ? 'bg-[#007BC4]/5 border-[#007BC4] ring-2 ring-[#007BC4]/20'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-mono text-xs font-black text-[#007BC4] bg-blue-50 dark:bg-blue-950 px-2 py-0.5 rounded border border-blue-200">
                    {inc.id}
                  </span>

                  <Badge variant="outline" className={
                    inc.workflowStatus === 'Open' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                    inc.workflowStatus === 'Investigation' ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' :
                    inc.workflowStatus === 'Root Cause' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                    inc.workflowStatus === 'Closed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-700'
                  }>
                    {inc.workflowStatus}
                  </Badge>
                </div>

                <h3 className="font-bold text-slate-900 dark:text-white text-sm line-clamp-1 mb-1">
                  {inc.title}
                </h3>

                <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
                  <span className={`flex items-center gap-1 font-bold ${catObj.color}`}>
                    <Icon size={12} /> {inc.category}
                  </span>
                  •
                  <span>{inc.locationZone}</span>
                </div>

                <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-100 dark:border-slate-700/60">
                  <span className="text-slate-500 font-medium">
                    Officer: <strong className="text-slate-800 dark:text-slate-200">{inc.assignedOfficer.split(' ')[0]}</strong>
                  </span>

                  {inc.severity === 'Critical' && <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-black text-[9px] uppercase">Critical</span>}
                  {inc.severity === 'High' && <span className="px-2 py-0.5 rounded bg-rose-500 text-white font-black text-[9px] uppercase">High</span>}
                  {inc.severity === 'Medium' && <span className="px-2 py-0.5 rounded bg-amber-500 text-white font-black text-[9px] uppercase">Medium</span>}
                  {inc.severity === 'Low' && <span className="px-2 py-0.5 rounded bg-slate-400 text-white font-black text-[9px] uppercase">Low</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Incident Detailed Workspace (8 cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm flex flex-col overflow-hidden">
          {selectedIncident ? (
            <div className="flex flex-col h-full">
              
              {/* Detail Header */}
              <div className="p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 space-y-3">
                <div className="flex flex-wrap justify-between items-start gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs font-black text-[#007BC4]">{selectedIncident.id}</span>
                      <Badge className="bg-[#007BC4]">{selectedIncident.category}</Badge>
                      <Badge variant="outline" className="border-rose-200 text-rose-700 bg-rose-50 font-bold">
                        Severity: {selectedIncident.severity}
                      </Badge>
                    </div>

                    <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-snug">
                      {selectedIncident.title}
                    </h2>
                  </div>

                  {/* Workflow Advancement Action Buttons */}
                  <div className="flex items-center gap-2">
                    {selectedIncident.workflowStatus === 'Open' && (
                      <button
                        onClick={() => handleAdvanceWorkflow('Assigned')}
                        className="px-3 py-1.5 bg-[#007BC4] text-white text-xs font-bold rounded-xl shadow-sm hover:bg-blue-700 transition flex items-center gap-1.5"
                      >
                        Assign Officer <ArrowRight size={13} />
                      </button>
                    )}

                    {selectedIncident.workflowStatus === 'Assigned' && (
                      <button
                        onClick={() => handleAdvanceWorkflow('Investigation')}
                        className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-amber-700 transition flex items-center gap-1.5"
                      >
                        Start Investigation <ArrowRight size={13} />
                      </button>
                    )}

                    {selectedIncident.workflowStatus === 'Investigation' && (
                      <button
                        onClick={() => handleAdvanceWorkflow('Root Cause')}
                        className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-indigo-700 transition flex items-center gap-1.5"
                      >
                        Proceed to Root Cause <ArrowRight size={13} />
                      </button>
                    )}

                    {selectedIncident.workflowStatus === 'Root Cause' && (
                      <button
                        onClick={() => handleAdvanceWorkflow('Corrective Action')}
                        className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-blue-700 transition flex items-center gap-1.5"
                      >
                        Submit CAPA Plan <ArrowRight size={13} />
                      </button>
                    )}

                    {selectedIncident.workflowStatus === 'Corrective Action' && (
                      <button
                        onClick={() => handleAdvanceWorkflow('Approval')}
                        className="px-3 py-1.5 bg-violet-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-violet-700 transition flex items-center gap-1.5"
                      >
                        Request Executive Sign-Off <ArrowRight size={13} />
                      </button>
                    )}

                    {selectedIncident.workflowStatus === 'Approval' && (
                      <button
                        onClick={() => handleAdvanceWorkflow('Closed')}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-xl shadow-sm hover:bg-emerald-700 transition flex items-center gap-1.5"
                      >
                        Final Approval & Close <CheckCircle2 size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300">
                  {selectedIncident.description}
                </p>

                {/* Sub-Tabs Navigation inside Workspace */}
                <div className="flex items-center gap-1 pt-2 border-t border-slate-200 dark:border-slate-700 overflow-x-auto">
                  {[
                    { id: 'ai_analysis', label: 'AI Incident RCA', icon: Sparkles },
                    { id: 'workflow', label: 'Workflow & Stepper', icon: Layers },
                    { id: 'capa', label: 'Corrective Actions (CAPA)', icon: CheckSquare },
                    { id: 'witnesses', label: `Witnesses (${selectedIncident.witnessStatements?.length || 0})`, icon: MessageSquare },
                    { id: 'attachments', label: `Attachments (${selectedIncident.attachments?.length || 0})`, icon: Paperclip },
                    { id: 'timeline', label: 'Timeline & History', icon: Clock }
                  ].map(tab => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveDetailTab(tab.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap ${
                          activeDetailTab === tab.id
                            ? 'bg-[#007BC4] text-white shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        <Icon size={13} />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Detail Content Workspace Area */}
              <div className="p-5 flex-1 overflow-y-auto space-y-5">
                
                {/* 1. AI INCIDENT ANALYSIS TAB */}
                {activeDetailTab === 'ai_analysis' && (
                  <div className="space-y-4 text-xs">
                    <div className="p-4 bg-blue-50/70 dark:bg-slate-900 border border-blue-200 dark:border-slate-700 rounded-2xl space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-blue-900 dark:text-blue-200 text-sm flex items-center gap-2">
                          <Sparkles size={16} className="text-[#007BC4]" />
                          Automated Root Cause Analysis (AI RCA)
                        </h4>
                        <span className="px-2.5 py-0.5 rounded-full font-black text-xs bg-[#007BC4] text-white">
                          Threat Score: {selectedIncident.aiAnalysis?.severityScore || 70}/100
                        </span>
                      </div>

                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">
                        {selectedIncident.aiAnalysis?.aiSummary}
                      </p>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                          <span className="font-bold text-slate-500 text-[10px] uppercase">Probable Root Cause</span>
                          <p className="font-bold text-slate-900 dark:text-white">{selectedIncident.aiAnalysis?.probableRootCause}</p>
                        </div>

                        <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1">
                          <span className="font-bold text-slate-500 text-[10px] uppercase">OSHA / ISO 45001 Regulatory Impact</span>
                          <p className="font-bold text-slate-900 dark:text-white">{selectedIncident.aiAnalysis?.regulatoryImpact}</p>
                        </div>
                      </div>

                      <div className="space-y-1 pt-1">
                        <span className="font-bold text-slate-500 text-[10px] uppercase block">Contributing Factors</span>
                        <ul className="list-disc list-inside space-y-1 text-slate-700 dark:text-slate-300 font-medium">
                          {selectedIncident.aiAnalysis?.contributingFactors.map((cf, idx) => (
                            <li key={idx}>{cf}</li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-1 pt-1">
                        <span className="font-bold text-slate-500 text-[10px] uppercase block">AI CAPA Recommendations</span>
                        <div className="space-y-1.5">
                          {selectedIncident.aiAnalysis?.capaRecommendations.map((rec, idx) => (
                            <div key={idx} className="p-2 bg-emerald-50 dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 rounded-lg font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
                              {rec}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. WORKFLOW STEPPER TAB */}
                {activeDetailTab === 'workflow' && (
                  <div className="space-y-6">
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">Seven-Stage EHS Incident Investigation Pipeline</h4>
                    
                    {/* Stepper Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
                      {WORKFLOW_STAGES.map((st, idx) => {
                        const currentStageIdx = WORKFLOW_STAGES.indexOf(selectedIncident.workflowStatus);
                        const isDone = idx < currentStageIdx;
                        const isCurrent = idx === currentStageIdx;

                        return (
                          <div
                            key={st}
                            className={`p-3 rounded-xl border flex flex-col justify-between h-24 text-xs transition ${
                              isCurrent ? 'bg-[#007BC4] text-white border-[#007BC4] font-bold shadow-md' :
                              isDone ? 'bg-emerald-50 border-emerald-200 text-emerald-800 font-bold' :
                              'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400'
                            }`}
                          >
                            <span className="text-[10px] uppercase font-black opacity-75">Stage 0{idx + 1}</span>
                            <span className="font-bold">{st}</span>
                            <div className="flex items-center gap-1 text-[10px]">
                              {isDone && <CheckCircle2 size={12} className="text-emerald-600" />}
                              {isCurrent && <Clock size={12} className="text-white animate-spin" />}
                              <span>{isDone ? 'Completed' : isCurrent ? 'Active Stage' : 'Pending'}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* 3. CAPA ACTION ITEMS TAB */}
                {activeDetailTab === 'capa' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                        <CheckSquare size={16} className="text-[#007BC4]" />
                        Corrective & Preventive Action (CAPA) Log
                      </h4>
                    </div>

                    <div className="space-y-2 text-xs">
                      {selectedIncident.correctiveActions?.map(ca => (
                        <div key={ca.id} className="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <input
                              type="checkbox"
                              checked={ca.isCompleted}
                              onChange={() => handleToggleCapa(ca.id)}
                              className="w-4 h-4 rounded text-[#007BC4] focus:ring-[#007BC4] cursor-pointer"
                            />
                            <div>
                              <p className={`font-bold ${ca.isCompleted ? 'line-through text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                                {ca.actionItem}
                              </p>
                              <div className="text-[11px] text-slate-500 font-medium mt-0.5">
                                Assigned: <strong>{ca.assignedTo}</strong> • Due Date: {ca.dueDate}
                              </div>
                            </div>
                          </div>

                          <Badge variant="outline" className={ca.isCompleted ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>
                            {ca.isCompleted ? 'Completed' : 'Pending'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. WITNESS STATEMENTS TAB */}
                {activeDetailTab === 'witnesses' && (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                        <MessageSquare size={16} className="text-[#007BC4]" />
                        Recorded Witness & Personnel Statements
                      </h4>
                      <button
                        onClick={() => setIsAddWitnessOpen(true)}
                        className="px-3 py-1.5 bg-[#007BC4] text-white text-xs font-bold rounded-xl shadow-sm hover:bg-blue-700 transition flex items-center gap-1.5"
                      >
                        <UserPlus size={14} /> Record Witness Statement
                      </button>
                    </div>

                    <div className="space-y-3 text-xs">
                      {selectedIncident.witnessStatements && selectedIncident.witnessStatements.length > 0 ? (
                        selectedIncident.witnessStatements.map(ws => (
                          <div key={ws.id} className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2">
                            <div className="flex justify-between items-center font-bold text-slate-900 dark:text-white">
                              <span className="flex items-center gap-2">
                                <HardHat size={14} className="text-[#007BC4]" />
                                {ws.witnessName} ({ws.witnessRole})
                              </span>
                              <span className="text-slate-400 font-mono text-[10px]">{ws.timestamp} • Interviewed by {ws.interviewedBy}</span>
                            </div>
                            <p className="text-slate-700 dark:text-slate-300 italic bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                              "{ws.statement}"
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                          No witness statements logged for this incident yet.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 5. ATTACHMENTS & EVIDENCE TAB */}
                {activeDetailTab === 'attachments' && (
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                      <Paperclip size={16} className="text-[#007BC4]" />
                      Evidence & Digital Attachments
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      {selectedIncident.attachments?.map(att => (
                        <div key={att.id} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-[#007BC4]/10 text-[#007BC4] rounded-lg font-bold text-xs">
                              {att.fileType === 'CCTV Clip' ? 'CCTV' : att.fileType === 'Photo' ? 'IMG' : 'DOC'}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">{att.fileName}</p>
                              <span className="text-[10px] text-slate-400">{att.fileSize} • Uploaded by {att.uploadedBy}</span>
                            </div>
                          </div>
                          <button className="px-2.5 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-bold hover:bg-slate-100 transition">
                            View
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. TIMELINE & HISTORY TAB */}
                {activeDetailTab === 'timeline' && (
                  <div className="space-y-4">
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                      <Clock size={16} className="text-[#007BC4]" />
                      Chronological Timeline History
                    </h4>

                    <div className="space-y-3 relative before:absolute before:left-3.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-700 pl-8">
                      {selectedIncident.timeline?.map((evt, idx) => (
                        <div key={evt.id || idx} className="relative space-y-0.5">
                          <div className="absolute -left-[27px] top-0.5 w-4 h-4 rounded-full bg-[#007BC4] text-white flex items-center justify-center text-[8px] font-black">
                            ✓
                          </div>
                          <div className="flex justify-between items-center text-xs font-bold text-slate-900 dark:text-white">
                            <span>{evt.title}</span>
                            <span className="text-slate-400 font-mono text-[10px]">{evt.timestamp}</span>
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300">{evt.description}</p>
                          <span className="text-[10px] text-slate-400 font-semibold">Actor: {evt.actor}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
              <ShieldAlert className="w-12 h-12 mb-3 text-slate-300" />
              <p className="font-bold text-sm">Select an incident from the left roster to view workspace details.</p>
            </div>
          )}
        </div>
      </div>

      {/* NEW INCIDENT MODAL */}
      {isNewIncidentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl w-full max-w-lg p-6 relative">
            <button onClick={() => setIsNewIncidentOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <Plus size={18} className="text-[#007BC4]" /> Log Enterprise Incident
            </h3>

            <form onSubmit={handleCreateIncidentSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Incident Category</label>
                <select
                  value={newForm.category}
                  onChange={e => setNewForm({ ...newForm, category: e.target.value as IncidentCategory })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                >
                  {INCIDENT_CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Incident Title / Summary</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Scaffolding Plank Shift near Gate 2"
                  value={newForm.title}
                  onChange={e => setNewForm({ ...newForm, title: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Severity Rating</label>
                  <select
                    value={newForm.severity}
                    onChange={e => setNewForm({ ...newForm, severity: e.target.value as any })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                  >
                    <option value="Critical">Critical Severity</option>
                    <option value="High">High Severity</option>
                    <option value="Medium">Medium Severity</option>
                    <option value="Low">Low Severity</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Location Zone</label>
                  <input
                    type="text"
                    value={newForm.locationZone}
                    onChange={e => setNewForm({ ...newForm, locationZone: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Detailed Description</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Describe the initial findings, personnel involved, and immediate safety measures taken..."
                  value={newForm.description}
                  onChange={e => setNewForm({ ...newForm, description: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewIncidentOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#007BC4] text-white rounded-xl font-bold shadow-md hover:bg-blue-700 transition"
                >
                  Dispatch Incident File
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD WITNESS STATEMENT MODAL */}
      {isAddWitnessOpen && selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl w-full max-w-md p-6 relative">
            <button onClick={() => setIsAddWitnessOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <MessageSquare size={18} className="text-[#007BC4]" /> Record Witness Statement
            </h3>

            <form onSubmit={handleAddWitnessSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Witness Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. David Chen"
                  value={newWitness.witnessName}
                  onChange={e => setNewWitness({ ...newWitness, witnessName: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Witness Role</label>
                  <input
                    type="text"
                    placeholder="e.g. Scaffolding Lead"
                    value={newWitness.witnessRole}
                    onChange={e => setNewWitness({ ...newWitness, witnessRole: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Contractor / Trade</label>
                  <input
                    type="text"
                    value={newWitness.company}
                    onChange={e => setNewWitness({ ...newWitness, company: e.target.value })}
                    className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Interviewed By</label>
                <input
                  type="text"
                  value={newWitness.interviewedBy}
                  onChange={e => setNewWitness({ ...newWitness, interviewedBy: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Witness Statement Text</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Verbatim quote or transcript of what the witness observed..."
                  value={newWitness.statement}
                  onChange={e => setNewWitness({ ...newWitness, statement: e.target.value })}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-medium"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddWitnessOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#007BC4] text-white rounded-xl font-bold"
                >
                  Save Witness Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
