/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useSimulation } from './lib/simulation';
import { Activity, Bell, Map, Map as MapIcon, Users, BarChart3, Settings, ShieldAlert, Cpu, LayoutDashboard, Radio, PlayCircle, Search, LogOut, Lock, Clock, Building2, ClipboardCheck, History, MessageSquare, Terminal, Wrench, Sparkles, Box, ShieldCheck } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import AttendanceTab from './components/AttendanceTab';
import VisitorsTab from './components/VisitorsTab';
import AuditTab from './components/AuditTab';
import IncidentsTab from './components/IncidentsTab';
import AIInsightsTab from './components/AIInsightsTab';
import MaintenanceTab from './components/MaintenanceTab';
import TopBar from './components/TopBar';
import PeopleTab from './components/PeopleTab';
import AlertsTab from './components/AlertsTab';
import AnalyticsTab from './components/AnalyticsTab';
import DashboardTab from './components/DashboardTab';
import LiveTrackingTab from './components/LiveTrackingTab';
import PlaybackTab from './components/PlaybackTab';
import DevicesTab from './components/DevicesTab';
import SettingsTab from './components/SettingsTab';
import CustomMapPage from './components/CustomMapPage';
import ProfileModal from './components/ProfileModal';
import Login from './components/Login';
import { startGaoSync, stopGaoSync } from './lib/gaoSyncService';
import { auth, db, signOut, onAuthStateChanged } from './lib/firebase';
import { doc, getDoc, setDoc } from './lib/db';

import LocationsTab from './components/LocationsTab';

export type AppMode = 'real' | 'demo' | null;

export const AppModeContext = React.createContext<{ mode: AppMode }>({ mode: null });

const ProtectedRoute = ({ 
  element, 
  userRole, 
  userUid,
  permissionKey, 
  permissions, 
  userPagePermissions,
  featureName 
}: { 
  element: React.ReactNode; 
  userRole: string; 
  userUid?: string;
  permissionKey: string; 
  permissions: any; 
  userPagePermissions?: any;
  featureName: string; 
}) => {
  let isAllowed = true;
  if (userUid && userPagePermissions && userPagePermissions[userUid] && userPagePermissions[userUid][permissionKey] !== undefined) {
    isAllowed = Boolean(userPagePermissions[userUid][permissionKey]);
  } else if (permissions && permissions[userRole] && permissions[userRole][permissionKey] !== undefined) {
    isAllowed = Boolean(permissions[userRole][permissionKey]);
  } else if (userRole === 'admin') {
    isAllowed = true;
  } else {
    isAllowed = permissions[userRole]?.[permissionKey] ?? true;
  }

  if (!isAllowed) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center h-full select-none animate-in fade-in zoom-in-95 duration-300">
        <div className="p-4 bg-rose-50 rounded-full border border-rose-100 mb-4 max-w-sm flex items-center justify-center shadow-sm">
           <Lock className="w-10 h-10 text-rose-500" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Page Access Restricted</h3>
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
           Your user profile or role tier (<strong>{userRole}</strong>) is restricted from accessing {featureName}.
         </p>
         <p className="text-xs text-slate-400 mt-4 font-mono">
            Ask your administrator to toggle page access permissions for your account or role in Settings.
         </p>
      </div>
    );
  }
  return <>{element}</>;
};

export default function App() {
  const [mode, setMode] = useState<AppMode>(() => (localStorage.getItem('gao_app_mode') as AppMode) || 'demo');

  const changeMode = (newMode: AppMode) => {
    setMode(newMode);
    if (newMode) {
      localStorage.setItem('gao_app_mode', newMode);
    } else {
      localStorage.removeItem('gao_app_mode');
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        if (!localStorage.getItem('gao_app_mode')) {
          changeMode('real');
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetch('/api/mongodb/status')
      .then(async res => {
        if (!res.ok) return null;
        const text = await res.text();
        try { return JSON.parse(text); } catch { return null; }
      })
      .then(data => {
        if (data && data.connected) {
          const currentUri = localStorage.getItem('gao_mongodb_uri');
          if (!currentUri) {
            localStorage.setItem('gao_mongodb_uri', 'mongodb+srv://sigmundtd_db_user:Jesuraja123%40@cluster0.lxd6qba.mongodb.net/gao_rfid?retryWrites=true&w=majority');
          }
        }
      })
      .catch(err => console.warn('Syncing MongoDB state error:', err));
  }, []);

  useEffect(() => {
    if (mode === 'real') {
      startGaoSync();
    } else {
      stopGaoSync();
    }
  }, [mode]);

  return (
    <ErrorBoundary>
      <AppModeContext.Provider value={{ mode }}>
        {!mode ? (
          <Login onLoginSuccess={changeMode} />
        ) : (
          <BrowserRouter>
            <AppContent onLogout={() => {
                if (mode === 'real') {
                    signOut(auth).catch(console.error);
                }
                changeMode(null);
            }} />
          </BrowserRouter>
        )}
      </AppModeContext.Provider>
    </ErrorBoundary>
  );
}

function AppContent({ onLogout }: { onLogout: () => void }) {
  const { mode } = React.useContext(AppModeContext);
  const [activeProject, setActiveProject] = useState(() => {
    return localStorage.getItem('gao_active_project') || 'metro-tower';
  });

  const handleActiveProjectChange = (projectId: string) => {
    setActiveProject(projectId);
    localStorage.setItem('gao_active_project', projectId);
  };

  const { people, assets, vehicles, alerts, ZONES, isLoading } = useSimulation(mode, activeProject);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedPersonId, setHighlightedPersonId] = useState<string | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  
  // Custom Claims Role-based visibility and access controls
  const [userRole, setUserRole] = useState<string>('operator');
  const [permissions, setPermissions] = useState<any>({});
  const [userPagePermissions, setUserPagePermissions] = useState<any>({});

  const loadClaimsAndPermissions = async () => {
    if (mode === 'demo') {
      setUserRole('admin');
      setPermissions({
        admin: {
          dashboard: true, live: true, customMap: true, playback: true, people: true, visitors: true,
          attendance: true, alerts: true, incidents: true, analytics: true,
          aiInsights: true, devices: true, maintenance: true, audit: true, settings: true
        },
        manager: {
          dashboard: true, live: true, customMap: true, playback: true, people: true, visitors: true,
          attendance: true, alerts: true, incidents: true, analytics: true,
          aiInsights: true, devices: true, maintenance: true, audit: true, settings: false
        },
        operator: {
          dashboard: true, live: true, customMap: true, playback: true, people: true, visitors: true,
          attendance: true, alerts: true, incidents: true, analytics: false,
          aiInsights: false, devices: false, maintenance: true, audit: false, settings: false
        },
        security: {
          dashboard: true, live: true, customMap: true, playback: true, people: true, visitors: true,
          attendance: false, alerts: true, incidents: true, analytics: false,
          aiInsights: false, devices: false, maintenance: false, audit: false, settings: false
        },
        auditor: {
          dashboard: true, live: false, customMap: false, playback: true, people: true, visitors: true,
          attendance: true, alerts: true, incidents: true, analytics: true,
          aiInsights: true, devices: false, maintenance: false, audit: true, settings: false
        },
        contractor: {
          dashboard: false, live: true, customMap: false, playback: false, people: true, visitors: false,
          attendance: true, alerts: true, incidents: false, analytics: false,
          aiInsights: false, devices: false, maintenance: false, audit: false, settings: false
        },
        visitor_manager: {
          dashboard: false, live: false, customMap: false, playback: false, people: false, visitors: true,
          attendance: true, alerts: true, incidents: false, analytics: false,
          aiInsights: false, devices: false, maintenance: false, audit: false, settings: false
        },
        viewer: {
          dashboard: true, live: true, customMap: true, playback: false, people: false, visitors: false,
          attendance: false, alerts: true, incidents: false, analytics: false,
          aiInsights: false, devices: false, maintenance: false, audit: false, settings: false
        }
      });
      return;
    }

    let resolvedRole = 'operator';

    // 1. Try to get role from firebase db document fallback
    try {
      if (auth.currentUser) {
        const docRef = doc(db, 'settings', `user_role_${auth.currentUser.uid}`);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const r = docSnap.data().role;
          if (r) resolvedRole = r;
        }
      }
    } catch (dbErr) {
      console.error('Failed to fetch user role from db settings direct:', dbErr);
    }

    // 2. Try auth custom claims
    try {
      const idTokenResult = await auth.currentUser?.getIdTokenResult(true);
      const claimRole = idTokenResult?.claims?.role as string;
      if (claimRole) {
        resolvedRole = claimRole;
      }
    } catch (err) {
      console.error('Failed to resolve current live claims in App:', err);
    }

    // 3. Email-based local fallback for prompt onboarding / admin bypass
    if (auth.currentUser?.email?.toLowerCase() === 'sigmund.t.d@gaostaff.com') {
      resolvedRole = 'admin';
    }

    setUserRole(resolvedRole);

    // 4. Load role permissions matrix
    try {
      const rolePermDoc = await getDoc(doc(db, 'settings', 'role_permissions'));
      if (rolePermDoc.exists()) {
        setPermissions(rolePermDoc.data());
      } else {
        const res = await fetch('/api/admin/permissions');
        if (res.ok) {
          const data = await res.json();
          setPermissions(data.rolePermissions ? data.rolePermissions : data);
        }
      }
    } catch (err) {
      console.error('Failed to load active permissions matrices:', err);
    }

    // 5. Load user-specific page overrides
    try {
      if (auth.currentUser) {
        const userPermDoc = await getDoc(doc(db, 'settings', `user_permissions_${auth.currentUser.uid}`));
        if (userPermDoc.exists()) {
          setUserPagePermissions((prev: any) => ({
            ...prev,
            [auth.currentUser!.uid]: userPermDoc.data()
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load user page permissions:', err);
    }
  };

  useEffect(() => {
    // Synchronize authentication state and auto-register live users
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      if (user) {
        // Direct write to settings database fallback (bypasses potential API issues)
        try {
          const docRef = doc(db, 'settings', `user_role_${user.uid}`);
          const docSnap = await getDoc(docRef);
          
          let role = 'operator';
          if (user.email?.toLowerCase() === 'sigmund.t.d@gaostaff.com') {
            role = 'admin';
          } else if (docSnap.exists()) {
            role = docSnap.data().role || 'operator';
          }

          await setDoc(docRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName || user.email?.split('@')[0] || 'User',
            role,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (clientDbErr) {
          console.error('Failed to auto-register current user in client-side Firestore:', clientDbErr);
        }

        // Backend register API execution
        try {
          await fetch('/api/admin/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName || user.email?.split('@')[0] || 'User'
            })
          });
        } catch (err) {
          console.error('Failed to auto-register current user in backend:', err);
        }
      }
      loadClaimsAndPermissions();
    });

    // Listen to real-time events triggered from claims administrator console
    window.addEventListener('gao-refresh-claims', loadClaimsAndPermissions);
    
    return () => {
      unsubscribeAuth();
      window.removeEventListener('gao-refresh-claims', loadClaimsAndPermissions);
    };
  }, []);

  const isPageAllowed = (key: string) => {
    const uid = auth.currentUser?.uid;
    if (uid && userPagePermissions?.[uid] && userPagePermissions[uid][key] !== undefined) {
      return Boolean(userPagePermissions[uid][key]);
    }
    if (permissions && permissions[userRole] && permissions[userRole][key] !== undefined) {
      return Boolean(permissions[userRole][key]);
    }
    if (userRole === 'admin') return true;
    return true;
  };

  const navigate = useNavigate();

  const filteredPeople = searchQuery 
    ? people.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.id.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden font-sans transition-colors">
      {/* Sidebar */}
      <aside className="w-56 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col py-6 shrink-0 z-10 transition-all duration-300 shadow-sm">
        {/* LOGO */}
        <div className="px-6 mb-8 flex flex-col">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-[#007BC4] leading-none">Aperture</h1>
          </div>
          <span className="text-[10px] tracking-widest text-slate-500 dark:text-slate-400 font-semibold mt-1">People Tracking</span>
          <span className="text-[10px] tracking-widest text-slate-500 dark:text-slate-400 font-semibold mt-1">In Construction</span>
        </div>

        {/* Global Search */}
        <div className="px-4 mb-4">
           <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search workers & trades..." 
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 rounded-lg pl-9 pr-3 py-2 outline-none focus:border-[#007BC4] dark:focus:border-[#007BC4] focus:ring-1 focus:ring-[#007BC4] transition"
                value={searchQuery}
                onChange={e => {
                   setSearchQuery(e.target.value);
                   if (!e.target.value) setHighlightedPersonId(null);
                }}
              />
           </div>
           {searchQuery && (
             <div className="relative z-50">
               <div className="absolute top-1 left-0 w-full flex flex-col gap-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-lg p-1">
                 {filteredPeople.map(p => (
                    <button 
                      key={p.id}
                      onClick={() => {
                          setHighlightedPersonId(p.id);
                          navigate('/');
                          setSearchQuery('');
                      }}
                      className={`text-left text-xs p-2 rounded flex justify-between items-center ${highlightedPersonId === p.id ? 'bg-[#007BC4] text-white' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-[#007BC4] dark:hover:text-[#007BC4]'}`}
                    >
                      <span className="truncate mr-2 font-medium">{p.name}</span>
                      <span className="opacity-60 text-[9px] uppercase tracking-wider">{p.currentZone}</span>
                    </button>
                 ))}
                 {filteredPeople.length === 0 && (
                    <div className="text-xs text-slate-500 dark:text-slate-400 p-2 text-center">No results found.</div>
                 )}
               </div>
             </div>
           )}
        </div>

        <nav className="flex flex-col gap-1 px-3 flex-1 overflow-y-auto min-h-0">
          {isPageAllowed('dashboard') && <NavItem to="/dashboard" icon={<LayoutDashboard size={20}/>} label="Dashboard" />}
          {isPageAllowed('live') && <NavItem to="/live" icon={<Map size={20}/>} label="Live Tracking" />}
          {isPageAllowed('customMap') && <NavItem to="/custom-map" icon={<MapIcon size={20}/>} label="Custom Map & Assets" />}
          {isPageAllowed('playback') && <NavItem to="/playback" icon={<PlayCircle size={20}/>} label="Playback History" />}
          {isPageAllowed('people') && <NavItem to="/people" icon={<Users size={20}/>} label="Personnel" />}
          {isPageAllowed('visitors') && <NavItem to="/visitors" icon={<ClipboardCheck size={20}/>} label="Visitors" />}
          {isPageAllowed('attendance') && <NavItem to="/attendance" icon={<Clock size={20}/>} label="Attendance" />}
          {isPageAllowed('alerts') && <NavItem to="/alerts" icon={<Bell size={20}/>} label="Alerts" hasNotification={alerts.some(a => a.type === 'security')} />}
          {isPageAllowed('incidents') && <NavItem to="/incidents" icon={<ShieldAlert size={20}/>} label="Incidents" />}
          {isPageAllowed('analytics') && <NavItem to="/analytics" icon={<BarChart3 size={20}/>} label="Analytics" />}
          {isPageAllowed('aiInsights') && <NavItem to="/ai-insights" icon={<Sparkles size={20}/>} label="AI Insights" />}
          {isPageAllowed('devices') && <NavItem to="/devices" icon={<Radio size={20}/>} label="Devices" />}
          {isPageAllowed('maintenance') && <NavItem to="/maintenance" icon={<Wrench size={20}/>} label="Maintenance" />}
          {isPageAllowed('audit') && <NavItem to="/audit" icon={<History size={20}/>} label="Audit & Compliance" />}
          {isPageAllowed('settings') && <NavItem to="/settings" icon={<Settings size={20}/>} label="Settings" />}
        </nav>
        
        {/* User Profile */}
        <div className="mt-auto px-4 pt-4 shrink-0 flex items-center justify-between gap-2">
           <div 
             onClick={() => setIsProfileModalOpen(true)}
             className="bg-slate-50 dark:bg-slate-800 p-3 flex-1 rounded-xl flex items-center justify-between cursor-pointer border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition shadow-sm"
           >
             <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-full bg-[#007BC4] flex items-center justify-center text-xs font-bold text-white shrink-0 uppercase">
                {auth.currentUser?.email ? auth.currentUser.email.charAt(0) : 'AD'}
               </div>
               <div className="flex flex-col min-w-0 pr-2">
                 <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                  {auth.currentUser?.email ? auth.currentUser.email.split('@')[0] : 'Admin User'}
                 </span>
                 <span className="text-[10px] text-[#007BC4] font-bold uppercase tracking-wider">{userRole} Status</span>
               </div>
             </div>
           </div>
           
           <button 
             onClick={onLogout}
             className="p-3 text-slate-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 rounded-xl border border-transparent hover:border-red-100 dark:hover:border-red-500/20 transition shadow-sm bg-slate-50 dark:bg-slate-800 shrink-0" 
             title="Logout"
           >
              <LogOut size={16} />
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900 transition-colors">
        <TopBar />
        
        <div className="flex-1 overflow-y-auto relative min-h-0 w-full flex flex-col">
          <div className="min-h-full flex flex-col w-full flex-1">
            <Routes>
              <Route path="/" element={
                 <ProtectedRoute 
                   element={<DashboardTab people={people} alerts={alerts} zones={ZONES} highlightedPersonId={highlightedPersonId}  />}
                   userRole={userRole}
                   userUid={auth.currentUser?.uid}
                   permissionKey="dashboard"
                   permissions={permissions}
                   userPagePermissions={userPagePermissions}
                   featureName="Dashboard Telemetry"
                 />
              } />
              <Route path="/dashboard" element={
                 <ProtectedRoute 
                   element={<DashboardTab people={people} alerts={alerts} zones={ZONES} highlightedPersonId={highlightedPersonId}  />}
                   userRole={userRole}
                   userUid={auth.currentUser?.uid}
                   permissionKey="dashboard"
                   permissions={permissions}
                   userPagePermissions={userPagePermissions}
                   featureName="Dashboard Telemetry"
                 />
              } />
              <Route path="/live" element={
                 <ProtectedRoute 
                   element={<LiveTrackingTab people={people} assets={assets} vehicles={vehicles} zones={ZONES} highlightedPersonId={highlightedPersonId}  activeProject={activeProject} setActiveProject={handleActiveProjectChange} />}
                   userRole={userRole}
                   userUid={auth.currentUser?.uid}
                   permissionKey="live"
                   permissions={permissions}
                   userPagePermissions={userPagePermissions}
                   featureName="Live Tracking Feed"
                 />
              } />
              <Route path="/custom-map" element={
                 <ProtectedRoute 
                   element={<CustomMapPage activeProject={activeProject} setActiveProject={handleActiveProjectChange} />}
                   userRole={userRole}
                   userUid={auth.currentUser?.uid}
                   permissionKey="customMap"
                   permissions={permissions}
                   userPagePermissions={userPagePermissions}
                   featureName="Custom Map & Assets"
                 />
              } />
              <Route path="/playback" element={
                 <ProtectedRoute 
                   element={<PlaybackTab people={people} zones={ZONES} />}
                   userRole={userRole}
                   userUid={auth.currentUser?.uid}
                   permissionKey="playback"
                   permissions={permissions}
                   userPagePermissions={userPagePermissions}
                   featureName="Tracking History Playback"
                 />
              } />
              <Route path="/people" element={
                 <ProtectedRoute 
                   element={<PeopleTab people={people} />}
                   userRole={userRole}
                   userUid={auth.currentUser?.uid}
                   permissionKey="people"
                   permissions={permissions}
                   userPagePermissions={userPagePermissions}
                   featureName="Personnel Registry"
                 />
              } />
              <Route path="/visitors" element={
                 <ProtectedRoute 
                   element={<VisitorsTab />}
                   userRole={userRole}
                   userUid={auth.currentUser?.uid}
                   permissionKey="visitors"
                   permissions={permissions}
                   userPagePermissions={userPagePermissions}
                   featureName="Visitor Management"
                 />
              } />
              <Route path="/attendance" element={
                 <ProtectedRoute 
                   element={<AttendanceTab people={people} />}
                   userRole={userRole}
                   userUid={auth.currentUser?.uid}
                   permissionKey="attendance"
                   permissions={permissions}
                   userPagePermissions={userPagePermissions}
                   featureName="Attendance Insights"
                 />
              } />
              <Route path="/alerts" element={
                 <ProtectedRoute 
                   element={<AlertsTab alerts={alerts} />}
                   userRole={userRole}
                   userUid={auth.currentUser?.uid}
                   permissionKey="alerts"
                   permissions={permissions}
                   userPagePermissions={userPagePermissions}
                   featureName="Alerts & Trigger Feed"
                 />
              } />
              <Route path="/incidents" element={
                 <ProtectedRoute 
                   element={<IncidentsTab />}
                   userRole={userRole}
                   userUid={auth.currentUser?.uid}
                   permissionKey="incidents"
                   permissions={permissions}
                   userPagePermissions={userPagePermissions}
                   featureName="Incident Log File"
                 />
              } />
              <Route path="/analytics" element={
                 <ProtectedRoute 
                   element={<AnalyticsTab people={people}  />}
                   userRole={userRole}
                   userUid={auth.currentUser?.uid}
                   permissionKey="analytics"
                   permissions={permissions}
                   userPagePermissions={userPagePermissions}
                   featureName="Aggregated Traffic Analytics"
                 />
              } />
              <Route path="/ai-insights" element={
                 <ProtectedRoute 
                   element={<AIInsightsTab people={people} />}
                   userRole={userRole}
                   userUid={auth.currentUser?.uid}
                   permissionKey="aiInsights"
                   permissions={permissions}
                   userPagePermissions={userPagePermissions}
                   featureName="AI Insights and Predictions Reports"
                 />
              } />
              <Route path="/devices" element={
                 <ProtectedRoute 
                   element={<DevicesTab />}
                   userRole={userRole}
                   userUid={auth.currentUser?.uid}
                   permissionKey="devices"
                   permissions={permissions}
                   userPagePermissions={userPagePermissions}
                   featureName="Hardware Devices Administration"
                 />
              } />
              <Route path="/maintenance" element={
                 <ProtectedRoute 
                   element={<MaintenanceTab />}
                   userRole={userRole}
                   userUid={auth.currentUser?.uid}
                   permissionKey="maintenance"
                   permissions={permissions}
                   userPagePermissions={userPagePermissions}
                   featureName="Hardware Maintenance Schedule"
                 />
              } />
              <Route path="/settings" element={
                 <ProtectedRoute 
                   element={<SettingsTab />}
                   userRole={userRole}
                   userUid={auth.currentUser?.uid}
                   permissionKey="settings"
                   permissions={permissions}
                   userPagePermissions={userPagePermissions}
                   featureName="Global Settings Console"
                 />
              } />
              <Route path="/audit" element={
                 <ProtectedRoute 
                   element={<AuditTab />}
                   userRole={userRole}
                   userUid={auth.currentUser?.uid}
                   permissionKey="audit"
                   permissions={permissions}
                   userPagePermissions={userPagePermissions}
                   featureName="Compliance and Audit Ledger"
                 />
              } />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
        </div>
      </main>

      <ProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} onLogout={onLogout} />
    </div>
  );
}

function NavItem({ to, icon, label, hasNotification = false }: { to: string, icon: React.ReactNode, label: string, hasNotification?: boolean }) {
  return (
    <NavLink 
      to={to}
      className={({ isActive }) => `relative flex items-center gap-3 w-full px-4 py-3 rounded-lg transition-all duration-200 shrink-0 ${
        isActive 
          ? 'bg-[#007BC4] text-white shadow-md font-medium' 
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-[#007BC4] dark:hover:text-[#007BC4]'
      }`}
    >
      {icon}
      <span className="text-sm tracking-wide">{label}</span>
      {hasNotification && (
        <span className="absolute top-1/2 -translate-y-1/2 right-4 w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
      )}
      {hasNotification && (
        <span className="absolute top-1/2 -translate-y-1/2 right-4 w-1.5 h-1.5 bg-rose-500 rounded-full" />
      )}
    </NavLink>
  );
}

