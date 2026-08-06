import React, { useState, useMemo } from 'react';
import { Person } from '../lib/simulation';
import { 
  Clock, CheckCircle2, UserX, AlertTriangle, Download, Search, Briefcase, 
  Calendar as CalendarIcon, MapPin, Radio, FileSpreadsheet, UserCheck, 
  ShieldCheck, ArrowUpRight, BarChart2, Plus, X, Sun, Moon, 
  CalendarDays, Layers, Zap, DollarSign, Filter, RefreshCw, Printer, FileText
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { exportToCSV, generatePDFReport } from '../lib/exportUtils';

export interface AttendanceRecord {
  id: string;
  name: string;
  role: string;
  company: string;
  department: string;
  siteZone: string;
  shift: 'Day Shift (07:00-15:30)' | 'Night Shift (19:00-03:30)' | 'Swing OT (15:00-23:30)';
  firstIn: string;
  lastOut: string;
  breakDurationMins: number;
  totalHoursStr: string;
  totalMins: number;
  overtimeHours: number;
  isLate: boolean;
  isOvertime: boolean;
  rfidTagId: string;
  geoStatus: 'IN_GEO_FENCE' | 'OUT_OF_BOUNDS' | 'BEACON_VERIFIED';
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'ON_LEAVE' | 'OVERTIME';
  hourlyRate: number;
  leaveReason?: string;
  punchType: 'RFID_AUTO' | 'MANUAL_OVERRIDE' | 'GEO_MOBILE_PUNCH';
}

const SHIFT_OPTIONS = [
  'Day Shift (07:00-15:30)',
  'Night Shift (19:00-03:30)',
  'Swing OT (15:00-23:30)'
];

const MOCK_LEAVE_RECORDS = [
  { id: 'LV-101', name: 'David Chen', department: 'Scaffolding & Civil', type: 'Medical Leave', startDate: '2026-08-06', endDate: '2026-08-08', status: 'APPROVED', approvedBy: 'Marcus Vance' },
  { id: 'LV-102', name: 'Sarah Lin', department: 'Geotechnical EHS', type: 'Annual Leave', startDate: '2026-08-10', endDate: '2026-08-15', status: 'PENDING', approvedBy: 'Site HR' },
  { id: 'LV-103', name: 'Frank Reynolds', department: 'Heavy Equipment', type: 'Safety Training', startDate: '2026-08-06', endDate: '2026-08-06', status: 'APPROVED', approvedBy: 'Elena Rostova' }
];

const MOCK_HOLIDAYS = [
  { date: '2026-09-07', name: 'Labor Day (Site Off-Day)', type: 'National Holiday' },
  { date: '2026-10-12', name: 'EHS Safety Inspection Day', type: 'Mandatory Site Stand-Down' },
  { date: '2026-11-26', name: 'Thanksgiving Holiday', type: 'National Holiday' }
];

export default function AttendanceTab({ people }: { people: Person[] }) {
  const [activeSubTab, setActiveSubTab] = useState<'roster' | 'calendar' | 'shifts' | 'heatmap' | 'departments' | 'payroll'>('roster');
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('All');
  const [shiftFilter, setShiftFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  // Manual Attendance Modal
  const [isManualPunchOpen, setIsManualPunchOpen] = useState(false);
  const [selectedPersonForPunch, setSelectedPersonForPunch] = useState<Person | null>(null);
  const [manualPunchType, setManualPunchType] = useState<'IN' | 'OUT'>('IN');
  const [manualReason, setManualReason] = useState('Turnstile Badge Sensor Glitch');

  // Notification Toast
  const [notification, setNotification] = useState<string | null>(null);

  // Generate enriched attendance data
  const attendanceData = useMemo<AttendanceRecord[]>(() => {
    return people.map((p, idx) => {
      const firstInH = 7 + (idx % 3);
      const firstInM = (idx * 13) % 60;
      const lastOutH = 16 + (idx % 4);
      const lastOutM = (idx * 17) % 60;

      const isLate = firstInH >= 8 && firstInM > 15;
      const isOvertime = lastOutH >= 18;

      const totalMins = ((lastOutH * 60) + lastOutM) - ((firstInH * 60) + firstInM);
      const breakMins = 45 + (idx % 2 === 0 ? 15 : 0);
      const netWorkMins = Math.max(0, totalMins - breakMins);
      const hoursNum = Math.floor(netWorkMins / 60);
      const minsNum = netWorkMins % 60;

      const otHours = isOvertime ? Math.round(((lastOutH - 17) + (lastOutM / 60)) * 10) / 10 : 0;

      const departments = ['Civil Engineering', 'Electrical & Utilities', 'Safety & EHS', 'Heavy Equipment Ops', 'Structure & Scaffolding'];
      const dept = departments[idx % departments.length];

      const shiftChoice: 'Day Shift (07:00-15:30)' | 'Night Shift (19:00-03:30)' | 'Swing OT (15:00-23:30)' = 
        idx % 4 === 0 ? 'Night Shift (19:00-03:30)' : idx % 5 === 0 ? 'Swing OT (15:00-23:30)' : 'Day Shift (07:00-15:30)';

      const geoStatus: 'IN_GEO_FENCE' | 'OUT_OF_BOUNDS' | 'BEACON_VERIFIED' = 
        idx % 7 === 0 ? 'OUT_OF_BOUNDS' : idx % 3 === 0 ? 'BEACON_VERIFIED' : 'IN_GEO_FENCE';

      const punchType: 'RFID_AUTO' | 'MANUAL_OVERRIDE' | 'GEO_MOBILE_PUNCH' = 
        idx % 6 === 0 ? 'MANUAL_OVERRIDE' : idx % 4 === 0 ? 'GEO_MOBILE_PUNCH' : 'RFID_AUTO';

      let statusVal: 'PRESENT' | 'LATE' | 'ABSENT' | 'ON_LEAVE' | 'OVERTIME' = 'PRESENT';
      if (idx % 9 === 0) statusVal = 'ABSENT';
      else if (idx % 11 === 0) statusVal = 'ON_LEAVE';
      else if (isOvertime) statusVal = 'OVERTIME';
      else if (isLate) statusVal = 'LATE';

      return {
        id: p.id,
        name: p.name,
        role: p.role,
        company: p.tradeCompany || 'BuildCorp Partner',
        department: dept,
        siteZone: p.currentZone || 'Main Gate 1',
        shift: shiftChoice,
        firstIn: `${firstInH.toString().padStart(2, '0')}:${firstInM.toString().padStart(2, '0')}`,
        lastOut: `${lastOutH.toString().padStart(2, '0')}:${lastOutM.toString().padStart(2, '0')}`,
        breakDurationMins: breakMins,
        totalHoursStr: `${hoursNum}h ${minsNum}m`,
        totalMins: netWorkMins,
        overtimeHours: otHours,
        isLate,
        isOvertime,
        rfidTagId: p.hardhatTagId || `HH-${p.id.substring(0, 4).toUpperCase()}`,
        geoStatus,
        status: statusVal,
        hourlyRate: 38 + (idx % 5) * 6,
        punchType
      };
    });
  }, [people]);

  // Filtered Roster
  const filteredRoster = useMemo(() => {
    return attendanceData.filter(a => {
      const matchesSearch = a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.rfidTagId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.company.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDept = departmentFilter === 'All' || a.department === departmentFilter;
      const matchesShift = shiftFilter === 'All' || a.shift === shiftFilter;
      const matchesStatus = statusFilter === 'All' || a.status === statusFilter;

      return matchesSearch && matchesDept && matchesShift && matchesStatus;
    });
  }, [attendanceData, searchTerm, departmentFilter, shiftFilter, statusFilter]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = attendanceData.length;
    const present = attendanceData.filter(a => a.status === 'PRESENT' || a.status === 'OVERTIME' || a.status === 'LATE').length;
    const late = attendanceData.filter(a => a.isLate).length;
    const overtime = attendanceData.filter(a => a.isOvertime).length;
    const totalOtHours = attendanceData.reduce((acc, curr) => acc + curr.overtimeHours, 0);
    const punctualityRate = total > 0 ? Math.round(((present - late) / total) * 100) : 100;
    const geoCompliant = attendanceData.filter(a => a.geoStatus !== 'OUT_OF_BOUNDS').length;
    const geoRate = total > 0 ? Math.round((geoCompliant / total) * 100) : 100;

    return { total, present, late, overtime, totalOtHours: Math.round(totalOtHours * 10) / 10, punctualityRate, geoRate };
  }, [attendanceData]);

  // Handle RFID Tap Simulation
  const handleSimulateRfidTap = (personName: string, tagId: string) => {
    setNotification(`⚡ RFID Sensor Gate 1 Triggered! Hardhat Tag ${tagId} (${personName}) clocked in successfully.`);
    setTimeout(() => setNotification(null), 4000);
  };

  // Handle Manual Attendance Submit
  const handleSaveManualPunch = () => {
    if (!selectedPersonForPunch) return;
    setNotification(`✅ Manual Override Punch (${manualPunchType}) logged for ${selectedPersonForPunch.name}. Reason: ${manualReason}.`);
    setIsManualPunchOpen(false);
    setSelectedPersonForPunch(null);
    setTimeout(() => setNotification(null), 4000);
  };

  // Export Payroll CSV
  const handleExportPayrollCSV = () => {
    const data = attendanceData.map(a => {
      const baseHours = Math.round((a.totalMins / 60) * 10) / 10;
      const grossPay = Math.round((baseHours * a.hourlyRate) + (a.overtimeHours * a.hourlyRate * 1.5));
      return {
        WorkerID: a.rfidTagId,
        Name: a.name,
        Department: a.department,
        Contractor: a.company,
        Shift: a.shift,
        FirstIn: `${a.firstIn} AM`,
        LastOut: `${a.lastOut} PM`,
        BreakMins: `${a.breakDurationMins}m`,
        BaseHours: baseHours,
        OvertimeHours: a.overtimeHours,
        HourlyRate: `$${a.hourlyRate}/hr`,
        EstGrossPay: `$${grossPay}`
      };
    });

    exportToCSV('Enterprise_Payroll_Timesheet_Report', data, [
      { key: 'WorkerID', label: 'RFID TAG' },
      { key: 'Name', label: 'NAME' },
      { key: 'Department', label: 'DEPARTMENT' },
      { key: 'Contractor', label: 'CONTRACTOR' },
      { key: 'Shift', label: 'SHIFT SCHEDULE' },
      { key: 'FirstIn', label: 'FIRST IN' },
      { key: 'LastOut', label: 'LAST OUT' },
      { key: 'BreakMins', label: 'BREAK' },
      { key: 'BaseHours', label: 'WORK HOURS' },
      { key: 'OvertimeHours', label: 'OT HOURS' },
      { key: 'HourlyRate', label: 'RATE' },
      { key: 'EstGrossPay', label: 'EST. GROSS PAY' }
    ]);
  };

  // Export PDF Attendance Report
  const handleExportPDF = () => {
    const rows = attendanceData.map(a => ({
      tag: a.rfidTagId,
      name: a.name,
      dept: a.department,
      shift: a.shift.split(' ')[0],
      inOut: `${a.firstIn} - ${a.lastOut}`,
      hours: a.totalHoursStr,
      ot: `${a.overtimeHours}h`,
      status: a.status
    }));

    generatePDFReport(
      'Aperture Enterprise Attendance & Shift Audit Report',
      'Official Turnstile Scan & Timesheet Summary',
      [
        { key: 'tag', label: 'Tag ID' },
        { key: 'name', label: 'Worker Name' },
        { key: 'dept', label: 'Department' },
        { key: 'shift', label: 'Shift' },
        { key: 'inOut', label: 'First In / Last Out' },
        { key: 'hours', label: 'Hours Worked' },
        { key: 'ot', label: 'Overtime' },
        { key: 'status', label: 'Status' }
      ],
      rows,
      [
        { label: 'Total Personnel Present', value: metrics.present },
        { label: 'Punctuality Compliance', value: `${metrics.punctualityRate}%` },
        { label: 'Total Overtime Hours', value: `${metrics.totalOtHours} hrs` },
        { label: 'Geo-Fence Compliance', value: `${metrics.geoRate}%` }
      ]
    );
  };

  return (
    <div className="w-full flex flex-col p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-7 h-7 text-[#007BC4]" />
              Enterprise Attendance Management
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-[#007BC4]/10 text-[#007BC4] border border-[#007BC4]/20">
              RFID Turnstile Live
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-xs md:text-sm mt-0.5">
            RFID turnstile taps, geo-fence mobile punches, shift rosters, overtime & automated payroll export
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => {
              if (people.length > 0) {
                setSelectedPersonForPunch(people[0]);
                setIsManualPunchOpen(true);
              }
            }}
            className="px-3.5 py-2 bg-[#007BC4] hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2"
          >
            <Plus size={15} /> Manual Attendance Override
          </button>

          <button
            onClick={handleExportPayrollCSV}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2"
          >
            <FileSpreadsheet size={15} /> Payroll Timesheet CSV
          </button>

          <button
            onClick={handleExportPDF}
            className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 transition"
            title="Export PDF Report"
          >
            <Printer size={15} />
          </button>
        </div>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div className="p-3.5 bg-blue-50 dark:bg-slate-800 border border-blue-200 dark:border-blue-700 rounded-xl text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <Zap size={15} className="text-[#007BC4]" />
            {notification}
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            <X size={15} />
          </button>
        </div>
      )}

      {/* KPI Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Present Today</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-2xl font-black text-emerald-600">{metrics.present}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Late Arrivals</span>
          <span className="text-2xl font-black text-amber-600">{metrics.late}</span>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Overtime Active</span>
          <span className="text-2xl font-black text-[#007BC4]">{metrics.overtime}</span>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total OT Hours</span>
          <span className="text-2xl font-black text-indigo-600">{metrics.totalOtHours}h</span>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Punctuality Rate</span>
          <span className="text-2xl font-black text-slate-900 dark:text-white">{metrics.punctualityRate}%</span>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-3.5 shadow-sm">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Geo Compliance</span>
          <span className="text-2xl font-black text-emerald-600">{metrics.geoRate}%</span>
        </div>
      </div>

      {/* Sub Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2 gap-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {[
            { id: 'roster', label: 'Attendance Roster', icon: UserCheck },
            { id: 'calendar', label: 'Calendar & Leave Log', icon: CalendarDays },
            { id: 'shifts', label: 'Shift Roster & Overtime', icon: Clock },
            { id: 'heatmap', label: 'Attendance Density Heatmap', icon: BarChart2 },
            { id: 'departments', label: 'Department & Contractor Breakdown', icon: Layers },
            { id: 'payroll', label: 'Payroll & Timesheets', icon: DollarSign }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap ${
                  activeSubTab === tab.id
                    ? 'bg-[#007BC4] text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Filters for Roster */}
        {activeSubTab === 'roster' && (
          <div className="flex items-center gap-2 w-full lg:w-auto mt-2 lg:mt-0 flex-wrap">
            <div className="relative flex-1 sm:w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 size-3.5" />
              <input 
                type="text" 
                placeholder="Search worker or tag..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#007BC4]"
              />
            </div>

            <select
              value={departmentFilter}
              onChange={e => setDepartmentFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 px-2.5 py-1.5 outline-none"
            >
              <option value="All">All Departments</option>
              <option value="Civil Engineering">Civil Engineering</option>
              <option value="Electrical & Utilities">Electrical & Utilities</option>
              <option value="Safety & EHS">Safety & EHS</option>
              <option value="Heavy Equipment Ops">Heavy Equipment Ops</option>
              <option value="Structure & Scaffolding">Structure & Scaffolding</option>
            </select>

            <select
              value={shiftFilter}
              onChange={e => setShiftFilter(e.target.value)}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 px-2.5 py-1.5 outline-none"
            >
              <option value="All">All Shifts</option>
              {SHIFT_OPTIONS.map(s => <option key={s} value={s}>{s.split(' ')[0]}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* 1. ATTENDANCE ROSTER TAB */}
      {activeSubTab === 'roster' && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
              <TableRow>
                <TableHead className="font-bold">Personnel & RFID Tag</TableHead>
                <TableHead className="font-bold">Department / Contractor</TableHead>
                <TableHead className="font-bold">Shift Schedule</TableHead>
                <TableHead className="font-bold">First In / Last Out</TableHead>
                <TableHead className="font-bold">Net Work Hours</TableHead>
                <TableHead className="font-bold">Geo-Fence Status</TableHead>
                <TableHead className="font-bold text-center">Status</TableHead>
                <TableHead className="font-bold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRoster.map(item => (
                <TableRow key={item.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/80 dark:hover:bg-slate-800/60 transition">
                  <TableCell>
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      {item.name}
                    </div>
                    <div className="text-[11px] font-mono text-[#007BC4] font-bold">{item.rfidTagId} • <span className="text-slate-400 font-sans">{item.role}</span></div>
                  </TableCell>

                  <TableCell className="text-xs">
                    <div className="font-semibold text-slate-800 dark:text-slate-200">{item.department}</div>
                    <div className="text-[10px] text-slate-500">{item.company}</div>
                  </TableCell>

                  <TableCell className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <div className="flex items-center gap-1">
                      {item.shift.includes('Night') ? <Moon size={12} className="text-indigo-500" /> : <Sun size={12} className="text-amber-500" />}
                      {item.shift.split(' ')[0]}
                    </div>
                  </TableCell>

                  <TableCell className="text-xs font-mono text-slate-700 dark:text-slate-300">
                    <div>In: <strong>{item.firstIn} AM</strong></div>
                    <div>Out: <strong>{item.lastOut} PM</strong></div>
                  </TableCell>

                  <TableCell className="text-xs">
                    <div className="font-bold text-slate-900 dark:text-white">{item.totalHoursStr}</div>
                    <div className="text-[10px] text-slate-400">Break: {item.breakDurationMins}m</div>
                  </TableCell>

                  <TableCell>
                    {item.geoStatus === 'IN_GEO_FENCE' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 w-fit">
                        <MapPin size={10} /> In Site Geo-Fence
                      </span>
                    ) : item.geoStatus === 'BEACON_VERIFIED' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1 w-fit">
                        <Radio size={10} /> Bluetooth Beacon
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 w-fit">
                        <AlertTriangle size={10} /> Out of Bounds
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="text-center">
                    {item.status === 'PRESENT' && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Present</Badge>}
                    {item.status === 'OVERTIME' && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Overtime (+{item.overtimeHours}h)</Badge>}
                    {item.status === 'LATE' && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Late Entry</Badge>}
                    {item.status === 'ABSENT' && <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">Absent</Badge>}
                    {item.status === 'ON_LEAVE' && <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">On Leave</Badge>}
                  </TableCell>

                  <TableCell className="text-right">
                    <button
                      onClick={() => handleSimulateRfidTap(item.name, item.rfidTagId)}
                      className="px-2.5 py-1 bg-slate-100 dark:bg-slate-700 hover:bg-[#007BC4] hover:text-white text-slate-800 dark:text-slate-200 text-xs font-bold rounded-lg transition"
                      title="Simulate Hardhat RFID Turnstile Tap"
                    >
                      ⚡ Tap RFID
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* 2. CALENDAR & LEAVE LOG TAB */}
      {activeSubTab === 'calendar' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <CalendarIcon size={18} className="text-[#007BC4]" />
                August 2026 Site Attendance Calendar Grid
              </h3>
              <div className="text-xs font-bold text-slate-500">22 Work Days Scheduled</div>
            </div>

            {/* Calendar Matrix */}
            <div className="grid grid-cols-7 gap-2 text-center text-xs">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="font-black text-slate-400 uppercase py-1">{day}</div>
              ))}
              {Array.from({ length: 31 }).map((_, i) => {
                const dayNum = i + 1;
                const isToday = dayNum === 6;
                const presentCount = 38 + (i % 7);
                const lateCount = i % 4;

                return (
                  <div 
                    key={dayNum} 
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between h-20 transition ${
                      isToday ? 'border-[#007BC4] bg-[#007BC4]/5 font-bold' : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900'
                    }`}
                  >
                    <span className={`text-xs ${isToday ? 'text-[#007BC4] font-black' : 'text-slate-700 dark:text-slate-300'}`}>{dayNum}</span>
                    <div className="space-y-0.5">
                      <div className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 py-0.2 rounded w-fit">{presentCount} Present</div>
                      {lateCount > 0 && <div className="text-[9px] font-bold text-amber-600">{lateCount} Late</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leave & Site Holiday Sidebar */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm space-y-3">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <UserX size={16} className="text-indigo-600" />
                Active & Pending Leave Requests
              </h4>
              <div className="space-y-2.5">
                {MOCK_LEAVE_RECORDS.map(l => (
                  <div key={l.id} className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1 text-xs">
                    <div className="flex justify-between font-bold text-slate-900 dark:text-white">
                      <span>{l.name}</span>
                      <Badge variant="outline" className={l.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}>
                        {l.status}
                      </Badge>
                    </div>
                    <div className="text-slate-500 text-[11px]">{l.department} • {l.type}</div>
                    <div className="text-slate-400 font-mono text-[10px]">{l.startDate} to {l.endDate}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm space-y-3">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <CalendarDays size={16} className="text-[#007BC4]" />
                Upcoming Site Holidays & Stand-Downs
              </h4>
              <div className="space-y-2">
                {MOCK_HOLIDAYS.map(h => (
                  <div key={h.date} className="p-2.5 bg-blue-50/50 dark:bg-slate-900 border border-blue-100 dark:border-slate-700 rounded-xl text-xs space-y-0.5">
                    <div className="font-bold text-blue-900 dark:text-blue-200">{h.name}</div>
                    <div className="text-slate-500 text-[10px] font-mono">{h.date} • {h.type}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. SHIFT ROSTER & OVERTIME */}
      {activeSubTab === 'shifts' && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm p-5 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Clock size={18} className="text-[#007BC4]" />
                Shift Allocation & Overtime Authorization Matrix
              </h3>
              <p className="text-xs text-slate-500 font-medium">Configure day, night, and swing overtime shifts for trade contractors.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-amber-50/60 dark:bg-slate-900 border border-amber-200 dark:border-amber-800/50 rounded-2xl space-y-2">
              <div className="flex justify-between items-center font-bold text-amber-900 dark:text-amber-200">
                <span className="flex items-center gap-1.5"><Sun size={16} /> Day Shift (07:00 - 15:30)</span>
                <span className="px-2 py-0.5 bg-amber-200 text-amber-900 rounded-full text-xs font-black">28 Workers</span>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-300">Standard civil engineering, structural scaffolding, and concrete pouring operations.</p>
            </div>

            <div className="p-4 bg-indigo-50/60 dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/50 rounded-2xl space-y-2">
              <div className="flex justify-between items-center font-bold text-indigo-900 dark:text-indigo-200">
                <span className="flex items-center gap-1.5"><Moon size={16} /> Night Shift (19:00 - 03:30)</span>
                <span className="px-2 py-0.5 bg-indigo-200 text-indigo-900 rounded-full text-xs font-black">8 Workers</span>
              </div>
              <p className="text-xs text-indigo-800 dark:text-indigo-300">Tunnel shaft excavation, heavy crane rigging, and high-voltage cable splicing.</p>
            </div>

            <div className="p-4 bg-blue-50/60 dark:bg-slate-900 border border-blue-200 dark:border-blue-800/50 rounded-2xl space-y-2">
              <div className="flex justify-between items-center font-bold text-blue-900 dark:text-blue-200">
                <span className="flex items-center gap-1.5"><Zap size={16} /> Swing Overtime (1.5x Rate)</span>
                <span className="px-2 py-0.5 bg-blue-200 text-blue-900 rounded-full text-xs font-black">{metrics.overtime} Active</span>
              </div>
              <p className="text-xs text-blue-800 dark:text-blue-300">Pre-approved overtime hours for milestone completion. Requires EHS supervisor authorization.</p>
            </div>
          </div>
        </div>
      )}

      {/* 4. ATTENDANCE HEATMAP */}
      {activeSubTab === 'heatmap' && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm p-5 space-y-4">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
              <BarChart2 size={18} className="text-[#007BC4]" />
              Hourly Gatehouse Attendance Density Heatmap
            </h3>
            <p className="text-xs text-slate-500 font-medium">Monitors turnstile traffic peaks between 06:00 AM and 08:00 PM.</p>
          </div>

          {/* Heatmap Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[650px] space-y-2 text-xs">
              <div className="grid grid-cols-13 gap-1 font-bold text-slate-400 text-center">
                <span>Day</span>
                {['06:00', '07:00', '08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map(h => (
                  <span key={h}>{h}</span>
                ))}
              </div>

              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((day, dIdx) => (
                <div key={day} className="grid grid-cols-13 gap-1 items-center">
                  <span className="font-bold text-slate-700 dark:text-slate-300">{day}</span>
                  {Array.from({ length: 12 }).map((_, hIdx) => {
                    const intensity = (dIdx + hIdx * 3) % 5;
                    const bgClass = 
                      intensity === 4 ? 'bg-[#007BC4] text-white font-bold' :
                      intensity === 3 ? 'bg-blue-400 text-white' :
                      intensity === 2 ? 'bg-blue-200 text-slate-800' :
                      intensity === 1 ? 'bg-blue-50 text-slate-700' : 'bg-slate-100 text-slate-400';

                    return (
                      <div key={hIdx} className={`p-2 rounded-lg text-center ${bgClass}`} title={`Hour ${hIdx + 6}:00`}>
                        {12 + (intensity * 6)}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 5. DEPARTMENT & CONTRACTOR BREAKDOWN */}
      {activeSubTab === 'departments' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Department Attendance Distribution</h3>
            <div className="space-y-3 text-xs">
              {[
                { name: 'Civil Engineering', count: 14, pct: 35, color: 'bg-[#007BC4]' },
                { name: 'Electrical & Utilities', count: 8, pct: 20, color: 'bg-emerald-500' },
                { name: 'Structure & Scaffolding', count: 10, pct: 25, color: 'bg-amber-500' },
                { name: 'Safety & EHS', count: 5, pct: 12, color: 'bg-indigo-500' },
                { name: 'Heavy Equipment Ops', count: 3, pct: 8, color: 'bg-rose-500' }
              ].map(d => (
                <div key={d.name} className="space-y-1">
                  <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                    <span>{d.name}</span>
                    <span>{d.count} Workers ({d.pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                    <div className={`${d.color} h-full rounded-full`} style={{ width: `${d.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm space-y-3">
            <h3 className="font-bold text-slate-900 dark:text-white text-base">Trade Subcontractor Roster</h3>
            <div className="space-y-3 text-xs">
              {[
                { name: 'BuildCorp General Contractor', count: 18, pct: 45, color: 'bg-[#007BC4]' },
                { name: 'Apex Structural Solutions', count: 10, pct: 25, color: 'bg-emerald-500' },
                { name: 'VoltCraft Electrical', count: 7, pct: 18, color: 'bg-indigo-500' },
                { name: 'Titan Heavy Machinery', count: 5, pct: 12, color: 'bg-rose-500' }
              ].map(c => (
                <div key={c.name} className="space-y-1">
                  <div className="flex justify-between font-bold text-slate-800 dark:text-slate-200">
                    <span>{c.name}</span>
                    <span>{c.count} On-Site ({c.pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                    <div className={`${c.color} h-full rounded-full`} style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 6. PAYROLL & TIMESHEETS */}
      {activeSubTab === 'payroll' && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm p-5 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <DollarSign size={18} className="text-emerald-600" />
                Automated Payroll & Hours Calculator
              </h3>
              <p className="text-xs text-slate-500 font-medium">Calculates base wages, overtime multipliers (1.5x), and break deductions.</p>
            </div>
            <button
              onClick={handleExportPayrollCSV}
              className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-emerald-700 transition flex items-center gap-2"
            >
              <FileSpreadsheet size={15} /> Export Payroll CSV
            </button>
          </div>

          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900">
              <TableRow>
                <TableHead className="font-bold">Worker Name</TableHead>
                <TableHead className="font-bold">Contractor</TableHead>
                <TableHead className="font-bold">Base Hours</TableHead>
                <TableHead className="font-bold">OT Hours (1.5x)</TableHead>
                <TableHead className="font-bold">Hourly Rate</TableHead>
                <TableHead className="font-bold text-right">Est. Gross Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendanceData.map(a => {
                const baseHours = Math.round((a.totalMins / 60) * 10) / 10;
                const grossPay = Math.round((baseHours * a.hourlyRate) + (a.overtimeHours * a.hourlyRate * 1.5));

                return (
                  <TableRow key={a.id}>
                    <TableCell className="font-bold text-xs text-slate-900 dark:text-white">{a.name}</TableCell>
                    <TableCell className="text-xs text-slate-600 dark:text-slate-400">{a.company}</TableCell>
                    <TableCell className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">{baseHours} hrs</TableCell>
                    <TableCell className="text-xs font-mono font-bold text-[#007BC4]">{a.overtimeHours} hrs</TableCell>
                    <TableCell className="text-xs font-mono text-slate-600 dark:text-slate-400">${a.hourlyRate}/hr</TableCell>
                    <TableCell className="text-xs font-mono font-black text-emerald-600 text-right">${grossPay}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Manual Attendance Punch Modal */}
      {isManualPunchOpen && selectedPersonForPunch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl w-full max-w-md p-6 relative">
            <button onClick={() => setIsManualPunchOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-3">Manual Attendance Punch Override</h3>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Select Personnel</label>
                <select
                  value={selectedPersonForPunch.id}
                  onChange={e => {
                    const found = people.find(p => p.id === e.target.value);
                    if (found) setSelectedPersonForPunch(found);
                  }}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl font-bold"
                >
                  {people.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.hardhatTagId || p.id})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Punch Direction</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setManualPunchType('IN')}
                    className={`flex-1 py-2 rounded-xl font-bold text-xs border ${manualPunchType === 'IN' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700'}`}
                  >
                    CLOCK IN
                  </button>
                  <button
                    type="button"
                    onClick={() => setManualPunchType('OUT')}
                    className={`flex-1 py-2 rounded-xl font-bold text-xs border ${manualPunchType === 'OUT' ? 'bg-rose-600 text-white border-rose-600' : 'bg-slate-50 text-slate-700'}`}
                  >
                    CLOCK OUT
                  </button>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-600 dark:text-slate-300 block mb-1">Reason for Override</label>
                <input
                  type="text"
                  value={manualReason}
                  onChange={e => setManualReason(e.target.value)}
                  className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
                  placeholder="e.g. Turnstile Sensor Replacement"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualPunchOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveManualPunch}
                  className="px-4 py-2 bg-[#007BC4] text-white rounded-xl font-bold"
                >
                  Submit Manual Punch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
