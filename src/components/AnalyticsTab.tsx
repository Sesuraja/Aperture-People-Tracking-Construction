import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, 
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, RadarChart, PolarGrid, 
  PolarAngleAxis, PolarRadiusAxis, Radar, Legend, ComposedChart 
} from 'recharts';
import { Person } from '../lib/simulation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart3, TrendingUp, Users, HardHat, ShieldCheck, AlertTriangle, 
  Radio, Building2, Clock, Sparkles, Download, FileSpreadsheet, FileText, 
  Calendar, Filter, Layers, Zap, Activity, Cpu, CheckCircle2, XCircle, 
  Compass, Printer, Gauge, Truck, Flame, ShieldAlert, BrainCircuit, Send,
  RefreshCw, Check, AlertCircle, ArrowUpRight, ArrowDownRight, Layers2
} from 'lucide-react';
import { exportToCSV, generatePDFReport } from '../lib/exportUtils';

const PALETTE = ['#007BC4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4'];

export interface AnalyticsProps {
  people: Person[];
  isLoading?: boolean;
}

export default function AnalyticsTab({ people, isLoading }: AnalyticsProps) {
  // Navigation / Module Selection
  const [activeModule, setActiveModule] = useState<
    | 'overview' 
    | 'executive' 
    | 'operations' 
    | 'attendance' 
    | 'productivity' 
    | 'movement' 
    | 'equipment' 
    | 'readers' 
    | 'occupancy' 
    | 'incidents' 
    | 'ppe' 
    | 'safety' 
    | 'forecasting' 
    | 'scheduled' 
    | 'custom' 
    | 'ai_insights'
  >('overview');

  // Global Date Filter State
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'q3_2026'>('7d');
  const [selectedSite, setSelectedSite] = useState<string>('all');

  // Custom Report Generator State
  const [customMetrics, setCustomMetrics] = useState<string[]>(['occupancy', 'attendance', 'safety']);
  const [reportFormat, setReportFormat] = useState<'csv' | 'pdf'>('csv');
  const [reportGenerated, setReportGenerated] = useState(false);

  // AI Prompt Assistant State
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Scheduled Reports Toggle Mock State
  const [scheduledReportsList, setScheduledReportsList] = useState([
    { id: 'rep-1', name: 'Daily EHS & Safety Compliance Summary', format: 'PDF', frequency: 'Daily at 06:00 AM', recipients: 'ehs-team@buildcorp.com', status: 'Active', lastRun: 'Today, 06:00 AM' },
    { id: 'rep-[#2]', name: 'Weekly Executive Operations & Headcount Digest', format: 'PDF + CSV', frequency: 'Mondays at 08:00 AM', recipients: 'execs@buildcorp.com', status: 'Active', lastRun: 'Aug 04, 2026' },
    { id: 'rep-3', name: 'Subcontractor Attendance & Overtime Ledger', format: 'CSV', frequency: 'Weekly on Friday 05:00 PM', recipients: 'payroll@buildcorp.com', status: 'Active', lastRun: 'Aug 01, 2026' },
    { id: 'rep-4', name: 'Equipment Heavy Machinery Runtime & Maintenance Log', format: 'PDF', frequency: 'Monthly 1st Day', recipients: 'fleet@buildcorp.com', status: 'Active', lastRun: 'Aug 01, 2026' }
  ]);

  // --- MOCK ANALYTICS DATASETS ---

  // 1. Executive Dashboard KPIs & Site Scores
  const executiveKPIs = useMemo(() => {
    const totalWorkers = people.length || 48;
    return {
      safetyScore: 98.4,
      productivityIndex: 92.1,
      costSavings: '$142,500',
      activeSites: 4,
      totalHeadcount: totalWorkers,
      shiftCompliance: 96.8,
      trirScore: 0.12, // Total Recordable Incident Rate
      dartScore: 0.04
    };
  }, [people]);

  // 2. Attendance & Shift Trends (24 Hours)
  const attendanceTrendData = [
    { time: '06:00', onTime: 12, late: 1, absent: 0, overtime: 0 },
    { time: '07:00', onTime: 38, late: 3, absent: 1, overtime: 0 },
    { time: '08:00', onTime: 45, late: 5, absent: 2, overtime: 1 },
    { time: '09:00', onTime: 48, late: 6, absent: 2, overtime: 2 },
    { time: '12:00', onTime: 46, late: 6, absent: 2, overtime: 4 },
    { time: '15:00', onTime: 44, late: 6, absent: 2, overtime: 8 },
    { time: '18:00', onTime: 22, late: 2, absent: 2, overtime: 12 },
    { time: '21:00', onTime: 8, late: 0, absent: 0, overtime: 6 }
  ];

  // 3. Worker Movement & Flow Throughput
  const movementFlowData = [
    { zone: 'Main Entrance Turnstile', hourlyFlow: 140, avgDwellMin: 2, congestionRisk: 'Low' },
    { zone: 'Tower Alpha Shaft Level 2', hourlyFlow: 88, avgDwellMin: 185, congestionRisk: 'Medium' },
    { zone: 'Excavation Sector B', hourlyFlow: 62, avgDwellMin: 210, congestionRisk: 'Low' },
    { zone: 'Laydown Yard & Material Depot', hourlyFlow: 110, avgDwellMin: 45, congestionRisk: 'Low' },
    { zone: 'Sub-Basement B1 Trench', hourlyFlow: 34, avgDwellMin: 140, congestionRisk: 'High' },
    { zone: 'Site Welfare & Command Hub', hourlyFlow: 95, avgDwellMin: 30, congestionRisk: 'Low' }
  ];

  // 4. Productivity - Active Time vs Dwell Time
  const productivityData = [
    { role: 'Rigging Crew', toolTimePct: 82, transitPct: 11, idlePct: 7 },
    { role: 'Steel Erectors', toolTimePct: 79, transitPct: 14, idlePct: 7 },
    { role: 'Electricians', toolTimePct: 86, transitPct: 9, idlePct: 5 },
    { role: 'Concrete Finishers', toolTimePct: 88, transitPct: 8, idlePct: 4 },
    { role: 'Safety Inspectors', toolTimePct: 91, transitPct: 7, idlePct: 2 },
    { role: 'General Laborers', toolTimePct: 72, transitPct: 18, idlePct: 10 }
  ];

  // 5. Equipment Utilization (Heavy Machinery)
  const equipmentData = [
    { name: 'Tower Crane TC-01', type: 'Crane', activeHours: 7.2, idleHours: 0.8, loadFactorPct: 84, fuelLiters: 180, maintDueDays: 14, status: 'Optimal' },
    { name: 'CAT 336 Heavy Excavator', type: 'Excavator', activeHours: 6.5, idleHours: 1.5, loadFactorPct: 78, fuelLiters: 240, maintDueDays: 3, status: 'Service Soon' },
    { name: 'Mobile Crane MC-02', type: 'Crane', activeHours: 4.8, idleHours: 3.2, loadFactorPct: 62, fuelLiters: 130, maintDueDays: 22, status: 'Optimal' },
    { name: 'Site Concrete Pumping Rig', type: 'Pump', activeHours: 5.5, idleHours: 2.5, loadFactorPct: 90, fuelLiters: 195, maintDueDays: 8, status: 'Optimal' }
  ];

  // 6. Reader Health & BLE / RFID Gateway Network
  const readerHealthData = [
    { id: 'RDR-01', name: 'Main Gate Turnstile RFID Portal', type: 'Fixed UHF RFID', status: 'Online', rssi: -42, battery: 100, packetsPerSec: 142, uptimePct: 99.98 },
    { id: 'GW-02', name: 'Tower Alpha Scaffold BLE Gateway', type: 'BLE 5.3 AoA', status: 'Online', rssi: -55, battery: 94, packetsPerSec: 88, uptimePct: 99.91 },
    { id: 'GPS-01', name: 'RTK GPS Base Station Alpha', type: 'GPS Differential', status: 'Online', rssi: -38, battery: 100, packetsPerSec: 200, uptimePct: 100.0 },
    { id: 'GW-03', name: 'Sub-Basement B1 Trench Gateway', type: 'BLE Mesh Portal', status: 'Warning', rssi: -78, battery: 32, packetsPerSec: 41, uptimePct: 98.40 }
  ];

  // 7. Zone Occupancy & Capacity Risk
  const zoneOccupancyData = [
    { zone: 'Level 2 Structural Frame', current: 18, capacity: 25, loadPct: 72, risk: 'Normal' },
    { zone: 'Level 3 Crane Swing Deck', current: 8, capacity: 10, loadPct: 80, risk: 'Moderate' },
    { zone: 'Sub-Basement B1 Trench', current: 14, capacity: 15, loadPct: 93, risk: 'High' },
    { zone: 'Ground Turnstile Laydown', current: 22, capacity: 60, loadPct: 36, risk: 'Normal' },
    { zone: 'Site Welfare Command Center', current: 10, capacity: 30, loadPct: 33, risk: 'Normal' }
  ];

  // 8. Incident Trends & Near Misses (Last 6 Months)
  const incidentTrendData = [
    { month: 'Mar 2026', nearMiss: 4, zoneBreach: 2, ppeViolation: 8, slipFall: 1 },
    { month: 'Apr 2026', nearMiss: 3, zoneBreach: 1, ppeViolation: 6, slipFall: 0 },
    { month: 'May 2026', nearMiss: 2, zoneBreach: 3, ppeViolation: 4, slipFall: 1 },
    { month: 'Jun 2026', nearMiss: 1, zoneBreach: 0, ppeViolation: 3, slipFall: 0 },
    { month: 'Jul 2026', nearMiss: 2, zoneBreach: 1, ppeViolation: 2, slipFall: 0 },
    { month: 'Aug 2026', nearMiss: 0, zoneBreach: 0, ppeViolation: 1, slipFall: 0 }
  ];

  // 9. PPE Compliance Radar Analytics
  const ppeComplianceData = [
    { subject: 'Safety Helmet', score: 99.2, target: 100 },
    { subject: 'High-Vis Vest', score: 98.5, target: 100 },
    { subject: 'Steel-Toe Boots', score: 99.8, target: 100 },
    { subject: 'Safety Glasses', score: 94.2, target: 95 },
    { subject: 'Fall Protection Harness', score: 97.6, target: 100 },
    { subject: 'Dust / Gas Mask', score: 92.0, target: 90 }
  ];

  // 10. Predictive Forecasting (Next 7 Days Workforce & Equipment Load)
  const forecastData = [
    { day: 'Mon Aug 10', predictedWorkers: 54, optimalEquipment: 4, riskFactor: 'Low' },
    { day: 'Tue Aug 11', predictedWorkers: 62, optimalEquipment: 5, riskFactor: 'Medium (Concrete Pour)' },
    { day: 'Wed Aug 12', predictedWorkers: 68, optimalEquipment: 5, riskFactor: 'High (Crane Lift Phase)' },
    { day: 'Thu Aug 13', predictedWorkers: 60, optimalEquipment: 4, riskFactor: 'Medium' },
    { day: 'Fri Aug 14', predictedWorkers: 52, optimalEquipment: 3, riskFactor: 'Low' },
    { day: 'Sat Aug 15', predictedWorkers: 28, optimalEquipment: 2, riskFactor: 'Low (Weekend Shift)' }
  ];

  // --- ACTIONS & HANDLERS ---

  const handleExportFullBI = () => {
    const rows = people.map(p => ({
      ID: p.id,
      Name: p.name,
      Role: p.role,
      Zone: p.currentZone,
      DwellSeconds: p.dwellTime,
      LastSeen: p.lastSeen.toISOString(),
      State: p.presenceState
    }));

    exportToCSV('Enterprise_BI_Analytics_Master_Dump', rows, [
      { key: 'ID', label: 'WORKER ID' },
      { key: 'Name', label: 'FULL NAME' },
      { key: 'Role', label: 'ROLE / TRADE' },
      { key: 'Zone', label: 'CURRENT ZONE' },
      { key: 'DwellSeconds', label: 'DWELL TIME (SEC)' },
      { key: 'State', label: 'PRESENCE STATE' },
      { key: 'LastSeen', label: 'LAST SEEN TIMESTAMP' }
    ]);
  };

  const handleGeneratePDFReport = () => {
    const rows = people.map(p => ({
      ID: p.id,
      Name: p.name,
      Role: p.role,
      Zone: p.currentZone,
      Status: p.presenceState
    }));

    generatePDFReport(
      'Enterprise BI Executive Site Analytics Report',
      'Comprehensive Workforce, Equipment, PPE, and Safety Intelligence Audit',
      [
        { key: 'ID', label: 'ID' },
        { key: 'Name', label: 'Personnel Name' },
        { key: 'Role', label: 'Role' },
        { key: 'Zone', label: 'Active Zone' },
        { key: 'Status', label: 'State' }
      ],
      rows,
      [
        { label: 'Overall Safety Score', value: '98.4%' },
        { label: 'Tool-Time Productivity', value: '82.5%' },
        { label: 'Active Reader Uptime', value: '99.9%' },
        { label: 'TRIR Incident Rate', value: '0.12' }
      ]
    );
  };

  const handleRunAiAnalysis = () => {
    setIsAiLoading(true);
    setAiResponse(null);

    setTimeout(() => {
      setIsAiLoading(false);
      setAiResponse(
        `🤖 Gemini Enterprise BI Synthesis:
1. Attendance & Productivity: Morning shift entry peak occurred at 08:12 AM with 96.8% on-time arrival. Rigging & Electrical trades demonstrated 84%+ tool-time productivity with minimal congestion at the main shaft.
2. Safety & PPE Compliance: Zero lost-time incidents recorded in the last 180 days. Safety helmet compliance stands at 99.2%. Sub-Basement B1 Trench reached 93% zone capacity at 11:30 AM — auto-alert issued to clear staging areas.
3. Equipment & Infrastructure: Tower Crane TC-01 operated at 84% load factor with 7.2 active runtime hours. Reader GW-03 in Sub-Basement B1 is exhibiting battery degradation (32%) and should be swapped during scheduled night maintenance.
4. Recommendation: Maintain current shift stagger to prevent turnstile bottlenecks and schedule preventative battery replacement for gateway GW-03.`
      );
    }, 1200);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col w-full h-full p-8 items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <div className="w-12 h-12 rounded-full border-4 border-[#007BC4] border-t-transparent animate-spin" />
          <div className="text-slate-500 font-medium text-sm">Compiling Enterprise BI Telemetry & Analytics...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full p-4 md:p-6 space-y-6 max-w-7xl mx-auto overflow-y-auto">
      
      {/* 1. ENTERPRISE BI HEADER & GLOBAL CONTROLS */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-7 h-7 text-[#007BC4]" />
              Enterprise BI & Intelligence Suite
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-50 text-[#007BC4] border border-blue-200 dark:bg-blue-950/60 dark:text-blue-300">
              Live BI Engine
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-xs md:text-sm mt-0.5">
            Executive, operations, attendance, productivity, equipment, reader health, PPE & safety forecasting
          </p>
        </div>

        {/* Global BI Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Global Date Filter */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm text-xs font-bold">
            <Calendar size={14} className="text-[#007BC4] ml-2" />
            {(['today', '7d', '30d', 'q3_2026'] as const).map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-2.5 py-1 rounded-lg uppercase transition ${
                  dateRange === range ? 'bg-[#007BC4] text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {range === 'today' ? 'Today' : range === '7d' ? '7 Days' : range === '30d' ? '30 Days' : 'Q3 2026'}
              </button>
            ))}
          </div>

          <button
            onClick={handleExportFullBI}
            className="px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold shadow-sm hover:bg-slate-50 transition flex items-center gap-1.5"
          >
            <FileSpreadsheet size={14} className="text-[#007BC4]" /> Export CSV
          </button>

          <button
            onClick={handleGeneratePDFReport}
            className="px-3.5 py-2 bg-[#007BC4] text-white rounded-xl text-xs font-bold shadow-sm hover:bg-blue-700 transition flex items-center gap-1.5"
          >
            <Printer size={14} /> Printable PDF Report
          </button>
        </div>
      </div>

      {/* 2. MODULE NAVIGATION STRIP (16 ENTERPRISE BI DIMENSIONS) */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-2 shadow-sm overflow-x-auto">
        <div className="flex items-center gap-1.5 min-w-max">
          {[
            { id: 'overview', label: 'Master Overview', icon: Layers2 },
            { id: 'executive', label: 'Executive Dashboard', icon: Building2 },
            { id: 'operations', label: 'Operations Dashboard', icon: Zap },
            { id: 'attendance', label: 'Attendance Analytics', icon: Clock },
            { id: 'productivity', label: 'Productivity & Tool-Time', icon: TrendingUp },
            { id: 'movement', label: 'Worker Movement', icon: Activity },
            { id: 'equipment', label: 'Equipment Utilization', icon: Truck },
            { id: 'readers', label: 'Reader Health Network', icon: Radio },
            { id: 'occupancy', label: 'Zone Occupancy', icon: Users },
            { id: 'incidents', label: 'Incident Trends', icon: ShieldAlert },
            { id: 'ppe', label: 'PPE Analytics', icon: HardHat },
            { id: 'safety', label: 'Safety & OSHA', icon: ShieldCheck },
            { id: 'forecasting', label: 'Predictive Forecasting', icon: Compass },
            { id: 'scheduled', label: 'Scheduled Reports', icon: Calendar },
            { id: 'custom', label: 'Custom Report Builder', icon: Filter },
            { id: 'ai_insights', label: 'AI Insights (Gemini)', icon: BrainCircuit }
          ].map(mod => {
            const Icon = mod.icon;
            const active = activeModule === mod.id;
            return (
              <button
                key={mod.id}
                onClick={() => setActiveModule(mod.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 select-none ${
                  active 
                    ? 'bg-[#007BC4] text-white shadow-sm' 
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Icon size={14} />
                {mod.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. DYNAMIC MODULE CONTENTS */}

      {/* --- MODULE A: MASTER OVERVIEW & EXECUTIVE KPIs --- */}
      {(activeModule === 'overview' || activeModule === 'executive') && (
        <div className="space-y-6">
          {/* Executive Top Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Safety Compliance Score</span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{executiveKPIs.safetyScore}%</div>
                  <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5 mt-0.5">
                    <ArrowUpRight size={12} /> +1.2% vs last month
                  </span>
                </div>
                <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 rounded-2xl text-emerald-600">
                  <ShieldCheck size={24} />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Productivity Index</span>
                  <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5">{executiveKPIs.productivityIndex}%</div>
                  <span className="text-[10px] font-semibold text-blue-600 flex items-center gap-0.5 mt-0.5">
                    <ArrowUpRight size={12} /> +3.4% tool-time efficiency
                  </span>
                </div>
                <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 rounded-2xl text-[#007BC4]">
                  <TrendingUp size={24} />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Estimated Cost Savings</span>
                  <div className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">{executiveKPIs.costSavings}</div>
                  <span className="text-[10px] font-semibold text-slate-500 mt-0.5">Automated idle reduction</span>
                </div>
                <div className="p-2.5 bg-purple-50 dark:bg-purple-950/50 rounded-2xl text-purple-600">
                  <Zap size={24} />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">OSHA TRIR Rate</span>
                  <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{executiveKPIs.trirScore}</div>
                  <span className="text-[10px] font-semibold text-emerald-600 mt-0.5">Industry Avg: 2.40</span>
                </div>
                <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 rounded-2xl text-amber-600">
                  <Gauge size={24} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Combined Productivity & Attendance Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-8 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">Daily On-Site Headcount & Shift Attendance</CardTitle>
                  <p className="text-xs text-slate-500">On-time arrivals, late arrivals, and overtime worker counts</p>
                </div>
                <Badge variant="outline" className="text-[10px] text-blue-600">Live RFID Feeds</Badge>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={attendanceTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Bar dataKey="onTime" name="On-Time Workers" fill="#007BC4" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="late" name="Late Arrivals" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="overtime" name="Overtime Crew" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="lg:col-span-4 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">PPE Safety Radar Compliance</CardTitle>
                <p className="text-xs text-slate-500">Real-time computer vision & EHS inspection rates</p>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={ppeComplianceData}>
                    <PolarGrid stroke="#e2e8f0" />
                    <PolarAngleAxis dataKey="subject" stroke="#64748b" fontSize={10} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} fontSize={9} />
                    <Radar name="Actual Score %" dataKey="score" stroke="#007BC4" fill="#007BC4" fillOpacity={0.5} />
                    <Radar name="Safety Target %" dataKey="target" stroke="#10B981" fill="#10B981" fillOpacity={0.1} />
                    <Tooltip />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* --- MODULE B: OPERATIONS & PRODUCTIVITY --- */}
      {(activeModule === 'operations' || activeModule === 'productivity') && (
        <div className="space-y-6 animate-in fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Tool Time Efficiency by Trade */}
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>Trade Productivity Breakdown (% Tool-Time)</span>
                  <Badge variant="outline" className="text-[#007BC4]">Target: &gt;75%</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={productivityData} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} stroke="#64748b" fontSize={11} />
                    <YAxis dataKey="role" type="category" stroke="#64748b" fontSize={11} width={110} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Bar dataKey="toolTimePct" name="Active Tool Time %" stackId="a" fill="#10B981" />
                    <Bar dataKey="transitPct" name="Transit / Walking %" stackId="a" fill="#007BC4" />
                    <Bar dataKey="idlePct" name="Idle / Waiting %" stackId="a" fill="#F59E0B" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Zone Throughput & Congestion */}
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">
                  Zone Hourly Throughput & Dwell Risk
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-100 dark:border-slate-700">
                      <th className="p-3">Zone Location</th>
                      <th className="p-3 text-right">Hourly Flow</th>
                      <th className="p-3 text-right">Avg Dwell</th>
                      <th className="p-3 text-center">Congestion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                    {movementFlowData.map(row => (
                      <tr key={row.zone} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{row.zone}</td>
                        <td className="p-3 text-right font-mono font-bold text-[#007BC4]">{row.hourlyFlow} p/hr</td>
                        <td className="p-3 text-right font-mono">{row.avgDwellMin} min</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            row.congestionRisk === 'High' 
                              ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300' 
                              : row.congestionRisk === 'Medium'
                              ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
                              : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                          }`}>
                            {row.congestionRisk}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

          </div>
        </div>
      )}

      {/* --- MODULE C: EQUIPMENT & READER HEALTH --- */}
      {(activeModule === 'equipment' || activeModule === 'readers' || activeModule === 'movement') && (
        <div className="space-y-6 animate-in fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Equipment Heavy Machinery Matrix */}
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Truck size={16} className="text-[#007BC4]" /> Heavy Machinery Utilization & Maintenance
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-100 dark:border-slate-700">
                      <th className="p-3">Equipment</th>
                      <th className="p-3 text-right">Runtime</th>
                      <th className="p-3 text-right">Load %</th>
                      <th className="p-3 text-center">Maint. Due</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                    {equipmentData.map(eq => (
                      <tr key={eq.name} className="hover:bg-slate-50/50">
                        <td className="p-3">
                          <strong className="text-slate-800 dark:text-slate-200 block">{eq.name}</strong>
                          <span className="text-[10px] text-slate-400 font-mono">{eq.type}</span>
                        </td>
                        <td className="p-3 text-right font-mono font-bold">{eq.activeHours} hrs</td>
                        <td className="p-3 text-right font-mono font-bold text-[#007BC4]">{eq.loadFactorPct}%</td>
                        <td className="p-3 text-center font-mono">{eq.maintDueDays} days</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            eq.status === 'Service Soon' 
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' 
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}>
                            {eq.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Reader Network Health */}
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Radio size={16} className="text-emerald-500" /> RFID & BLE Hardware Health Network
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-100 dark:border-slate-700">
                      <th className="p-3">Gateway ID</th>
                      <th className="p-3">Hardware Type</th>
                      <th className="p-3 text-right">RSSI</th>
                      <th className="p-3 text-right">Packets/s</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                    {readerHealthData.map(rdr => (
                      <tr key={rdr.id} className="hover:bg-slate-50/50">
                        <td className="p-3">
                          <strong className="text-slate-800 dark:text-slate-200 block">{rdr.name}</strong>
                          <span className="text-[10px] text-slate-400 font-mono">{rdr.id}</span>
                        </td>
                        <td className="p-3 text-slate-500">{rdr.type}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300">{rdr.rssi} dBm</td>
                        <td className="p-3 text-right font-mono font-bold text-[#007BC4]">{rdr.packetsPerSec}</td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            rdr.status === 'Online' 
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}>
                            {rdr.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

          </div>
        </div>
      )}

      {/* --- MODULE D: SAFETY, PPE & INCIDENT TRENDS --- */}
      {(activeModule === 'incidents' || activeModule === 'ppe' || activeModule === 'safety' || activeModule === 'occupancy') && (
        <div className="space-y-6 animate-in fade-in">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Incident Trends Chart */}
            <Card className="lg:col-span-8 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center justify-between">
                  <span>6-Month Safety Incident & Near-Miss Reduction Trend</span>
                  <Badge variant="outline" className="text-emerald-600">-75% Incident Reduction</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={incidentTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="month" stroke="#64748b" fontSize={11} />
                    <YAxis stroke="#64748b" fontSize={11} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                    <Area type="monotone" dataKey="ppeViolation" name="PPE Violations" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.2} />
                    <Area type="monotone" dataKey="nearMiss" name="Near Misses" stroke="#007BC4" fill="#007BC4" fillOpacity={0.2} />
                    <Area type="monotone" dataKey="zoneBreach" name="Zone Breaches" stroke="#EF4444" fill="#EF4444" fillOpacity={0.2} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Zone Capacity Matrix */}
            <Card className="lg:col-span-4 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">Zone Capacity & Over-Crowding</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {zoneOccupancyData.map(z => (
                  <div key={z.zone} className="space-y-1">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-slate-800 dark:text-slate-200">{z.zone}</span>
                      <span className="font-mono text-slate-500">{z.current} / {z.capacity} ({z.loadPct}%)</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full ${
                          z.loadPct > 90 ? 'bg-rose-500' : z.loadPct > 75 ? 'bg-amber-500' : 'bg-[#007BC4]'
                        }`}
                        style={{ width: `${z.loadPct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

          </div>
        </div>
      )}

      {/* --- MODULE E: PREDICTIVE FORECASTING --- */}
      {activeModule === 'forecasting' && (
        <div className="space-y-6 animate-in fade-in">
          <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Compass size={16} className="text-[#007BC4]" /> 7-Day Predictive Staffing & Risk Forecast Model
              </CardTitle>
            </CardHeader>
            <CardContent className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={forecastData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="day" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                  <Bar dataKey="predictedWorkers" name="Predicted Workforce Headcount" fill="#007BC4" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="optimalEquipment" name="Required Machinery Units" stroke="#10B981" strokeWidth={3} />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* --- MODULE F: SCHEDULED REPORTS & CUSTOM REPORT BUILDER --- */}
      {(activeModule === 'scheduled' || activeModule === 'custom') && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Scheduled Reports List */}
          {activeModule === 'scheduled' && (
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Calendar size={16} className="text-[#007BC4]" /> Scheduled Automated Enterprise Reports
                  </CardTitle>
                  <p className="text-xs text-slate-500">Automated daily, weekly and monthly PDF/CSV distribution</p>
                </div>
                <button 
                  onClick={handleGeneratePDFReport}
                  className="px-3 py-1.5 bg-[#007BC4] text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition"
                >
                  Run Report Now
                </button>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900/50 text-slate-400 font-bold uppercase text-[10px] border-b border-slate-100 dark:border-slate-700">
                      <th className="p-3">Report Name</th>
                      <th className="p-3">Format</th>
                      <th className="p-3">Frequency</th>
                      <th className="p-3">Recipients</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-right">Last Execution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 font-medium">
                    {scheduledReportsList.map(rep => (
                      <tr key={rep.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-bold text-slate-800 dark:text-slate-200">{rep.name}</td>
                        <td className="p-3 font-mono font-bold text-[#007BC4]">{rep.format}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{rep.frequency}</td>
                        <td className="p-3 text-slate-500 font-mono text-[11px]">{rep.recipients}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px]">
                            {rep.status}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-slate-500">{rep.lastRun}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Interactive Custom Report Builder */}
          {activeModule === 'custom' && (
            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Filter size={16} className="text-[#007BC4]" /> Interactive Custom Report Builder
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-200 block mb-2">Select Metrics & Columns to Include:</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: 'occupancy', label: 'Zone Occupancy' },
                      { id: 'attendance', label: 'Shift Attendance' },
                      { id: 'safety', label: 'Safety & PPE Compliance' },
                      { id: 'equipment', label: 'Equipment Hours' },
                      { id: 'readers', label: 'Reader Signal RSSI' },
                      { id: 'incidents', label: 'Near-Miss Violations' }
                    ].map(item => (
                      <label key={item.id} className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg flex items-center gap-2 cursor-pointer font-bold">
                        <input
                          type="checkbox"
                          checked={customMetrics.includes(item.id)}
                          onChange={e => {
                            if (e.target.checked) setCustomMetrics([...customMetrics, item.id]);
                            else setCustomMetrics(customMetrics.filter(m => m !== item.id));
                          }}
                          className="rounded accent-[#007BC4]"
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-4 pt-2">
                  <div>
                    <label className="font-bold text-slate-700 dark:text-slate-200 block mb-1">Export Format:</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setReportFormat('csv')}
                        className={`px-3 py-1.5 rounded-lg font-bold border ${reportFormat === 'csv' ? 'bg-[#007BC4] text-white border-[#007BC4]' : 'bg-slate-100 text-slate-700'}`}
                      >
                        CSV Spreadsheet
                      </button>
                      <button
                        onClick={() => setReportFormat('pdf')}
                        className={`px-3 py-1.5 rounded-lg font-bold border ${reportFormat === 'pdf' ? 'bg-[#007BC4] text-white border-[#007BC4]' : 'bg-slate-100 text-slate-700'}`}
                      >
                        Printable PDF Report
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (reportFormat === 'csv') handleExportFullBI();
                      else handleGeneratePDFReport();
                      setReportGenerated(true);
                    }}
                    className="mt-5 px-5 py-2 bg-[#007BC4] text-white rounded-xl font-bold shadow-md hover:bg-blue-700 transition flex items-center gap-2"
                  >
                    <Download size={14} /> Generate & Download Custom Report
                  </button>
                </div>

                {reportGenerated && (
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 rounded-xl text-emerald-800 dark:text-emerald-200 font-bold flex items-center gap-2">
                    <CheckCircle2 size={16} /> Custom report generated and downloaded successfully.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        </div>
      )}

      {/* --- MODULE G: AI INSIGHTS (GEMINI INTEGRATION) --- */}
      {activeModule === 'ai_insights' && (
        <div className="space-y-6 animate-in fade-in">
          <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <BrainCircuit size={18} className="text-[#007BC4]" /> Gemini Enterprise AI Site Telemetry Assistant
              </CardTitle>
              <p className="text-xs text-slate-500">Ask natural language questions or request automated anomaly detection</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Highlight workforce bottlenecks in Tower Alpha or forecast safety risks..."
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium outline-none focus:ring-2 focus:ring-[#007BC4]"
                />
                <button
                  onClick={handleRunAiAnalysis}
                  disabled={isAiLoading}
                  className="px-4 py-2 bg-[#007BC4] text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isAiLoading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Synthesize AI Insights
                </button>
              </div>

              {aiResponse && (
                <div className="p-4 bg-slate-900 text-slate-100 rounded-2xl text-xs font-mono whitespace-pre-wrap leading-relaxed border border-slate-800 shadow-inner">
                  {aiResponse}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
