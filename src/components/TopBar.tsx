import { Download, Sun, Moon, Calendar, Bell } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useContext } from 'react';
import { AppModeContext } from '../App';
import ExportReportModal from './ExportReportModal';

export default function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  const [isExportOpen, setIsExportOpen] = useState(false);
  const { mode } = useContext(AppModeContext);
  
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  // Determine current active view category for compliance export
  let defaultCategory = 'attendance';
  if (location.pathname.includes('people')) defaultCategory = 'people';
  else if (location.pathname.includes('incidents')) defaultCategory = 'incidents';
  else if (location.pathname.includes('visitors')) defaultCategory = 'visitors';
  else if (location.pathname.includes('devices')) defaultCategory = 'devices';
  else if (location.pathname.includes('tags')) defaultCategory = 'tags';

  const savedUrl = localStorage.getItem('gao_api_url') || '';
  let displayHost = 'Standard Gateway';
  if (savedUrl) {
    try {
      const urlObj = new URL(savedUrl);
      displayHost = urlObj.hostname;
    } catch {
      displayHost = savedUrl.replace(/^https?:\/\//i, '').split('/')[0];
    }
  }

  return (
    <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-6 justify-between shrink-0 shadow-sm z-10 w-full relative transition-colors">
      <ExportReportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        defaultCategory={defaultCategory}
      />
      <div className="flex items-center gap-4">
        <div className="p-2 bg-[#007BC4]/10 rounded border border-[#007BC4]/20 hidden md:block">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#007BC4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/><path d="m14 12 4-4-4-4"/><path d="m10 12-4 4 4 4"/></svg>
        </div>
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Construction Worker Tracking</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 tracking-wide mt-0.5 font-medium">UHF RFID & AI Safety Tracking System</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Export Data Button */}
        <button
          onClick={() => setIsExportOpen(true)}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-[#007BC4] hover:from-blue-700 hover:to-[#006aa9] text-white text-xs font-bold transition shadow-md hover:shadow-lg cursor-pointer"
          title="Download current view data as CSV or PDF report for EHS & site compliance"
        >
          <Download className="w-4 h-4 text-white" />
          <span>Export Data</span>
          <div className="flex items-center gap-0.5 text-[9px] bg-white/20 px-1.5 py-0.5 rounded font-mono font-bold">
            CSV / PDF
          </div>
        </button>

        {/* Dynamic Interactive API Connection Pill */}
        {mode === 'real' ? (
          <button 
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold shadow-sm hover:bg-emerald-100/75 transition cursor-pointer"
            title="Click to view full API credentials and execute dev queries"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">RFID Gate Live:</span>
            <span className="font-mono text-[10px] bg-white dark:bg-slate-800 px-1 py-0.5 rounded border border-emerald-100 text-slate-600 dark:text-slate-300">
              {displayHost || 'localport'}
            </span>
          </button>
        ) : (
          <button 
            onClick={() => navigate('/settings')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-[#007BC4] text-xs font-bold shadow-sm hover:bg-blue-100/75 transition cursor-pointer"
            title="Running in Demo Sandbox Mode. Click to connect to real Aperture hardware"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span className="font-semibold">Demo Sandbox Mode</span>
            <span className="text-[9px] bg-white dark:bg-slate-800 text-slate-500 px-1.5 rounded border border-blue-100">Simulate Actions</span>
          </button>
        )}
        
        {/* Date Picker Mock */}
        <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 shadow-sm text-xs hover:bg-slate-50 dark:hover:bg-slate-700 transition hover:text-[#007BC4] dark:hover:text-[#007BC4]">
           <Calendar className="w-3.5 h-3.5 text-slate-400" />
           <span className="font-medium">{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
        </button>

        {/* Action Icons */}
        <div className="flex items-center gap-1.5 ml-1">
           <button 
             onClick={() => navigate('/alerts')}
             className="relative w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-[#007BC4] transition"
           >
             <Bell className="w-4 h-4" />
             <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 border-2 border-white dark:border-slate-900 rounded-full"></span>
           </button>
           <button 
             onClick={() => setIsDark(!isDark)}
             className="w-9 h-9 rounded-lg flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-[#007BC4] transition hidden md:flex"
           >
             {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
           </button>
        </div>
      </div>
    </header>
  );
}
