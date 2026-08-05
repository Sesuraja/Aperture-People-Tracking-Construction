import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { Person } from '../lib/simulation';
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Network, ActivitySquare, LayoutGrid, Download } from 'lucide-react';

const COLORS = ['#6366f1', '#38bdf8', '#10b981', '#f59e0b', '#f43f5e'];

export default function AnalyticsTab({ people, isLoading }: { people: Person[], isLoading?: boolean }) {
  // Aggregate data
  const zoneData = useMemo(() => {
    const defaultData = people.reduce((acc, p) => {
      if (!acc[p.currentZone]) {
         acc[p.currentZone] = { count: 0, totalDwell: 0 };
      }
      acc[p.currentZone].count += 1;
      acc[p.currentZone].totalDwell += p.dwellTime;
      return acc;
    }, {} as Record<string, {count: number, totalDwell: number}>);

    return Object.keys(defaultData).map(zone => ({
      name: zone,
      occupancy: defaultData[zone].count,
      avgDwell: defaultData[zone].count > 0 ? Math.round(defaultData[zone].totalDwell / defaultData[zone].count) : 0
    }));
  }, [people]);

  const roleData = useMemo(() => {
    const counts = people.reduce((acc, p) => {
      acc[p.role] = (acc[p.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.keys(counts).map(role => ({
      name: role,
      value: counts[role]
    }));
  }, [people]);

  const mockTimelineData = useMemo(() => {
    const base = [
      { time: '09:00', load: 12 },
      { time: '10:00', load: 18 },
      { time: '11:00', load: 25 },
      { time: '12:00', load: 35 },
      { time: '13:00', load: 45 },
      { time: '14:00', load: 30 },
      { time: '15:00', load: 28 },
      { time: '16:00', load: 32 },
    ];
    base.push({ time: new Date().toLocaleTimeString([], { hour: '2-digit', minute:'2-digit' }), load: Object.keys(zoneData).reduce((s, z) => s + (zoneData as any)[z]?.occupancy || 0, 20) + (Math.random() * 5) });
    return base;
  }, [zoneData]);

  const handleDownloadCsv = () => {
    if (people.length === 0) return;
    
    const headers = ['ID', 'Name', 'Role', 'Current Zone', 'State', 'Dwell Time (s)', 'Last Seen'];
    const rows = people.map(p => [
      p.id,
      p.name,
      p.role,
      p.currentZone,
      p.presenceState,
      p.dwellTime,
      p.lastSeen.toISOString()
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `facility_export_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col w-full h-full p-6 items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors">
        <div className="flex flex-col items-center gap-4 animate-pulse">
           <div className="w-12 h-12 rounded-full border-4 border-[#007BC4] border-t-transparent animate-spin"></div>
           <div className="text-slate-500 font-medium">Loading analytics history...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-full p-6 overflow-auto gap-6 bg-slate-50 dark:bg-slate-900 transition-colors">
      <div className="flex justify-between items-center shrink-0">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Facility Analytics</h2>
          <p className="text-slate-500 font-medium">High-level insights, movement patterns, and occupancy rates.</p>
        </div>
        <button 
          onClick={handleDownloadCsv}
          disabled={people.length === 0}
          className="flex items-center gap-2 bg-[#007BC4] hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-md transition disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> Download CSV
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6 shrink-0">
         <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm transition hover:shadow-md">
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
               Total Coverage
               <ActivitySquare className="w-4 h-4 text-[#007BC4]" />
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-black text-slate-900 dark:text-white">100%</div>
             <p className="text-xs font-semibold text-[#007BC4] mt-1">All 9 active readers online</p>
           </CardContent>
         </Card>
         <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm transition hover:shadow-md">
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
               Peak Occupancy
               <LayoutGrid className="w-4 h-4 text-emerald-500" />
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-black text-slate-900 dark:text-white">45</div>
             <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Recorded at 13:00 today</p>
           </CardContent>
         </Card>
         <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm transition hover:shadow-md">
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center justify-between">
               System Latency
               <Network className="w-4 h-4 text-amber-500" />
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="text-3xl font-black text-slate-900 dark:text-white">14ms</div>
             <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">Real-time WebSocket feed</p>
           </CardContent>
         </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 flex-1 min-h-[400px]">
        {/* Main trend chart */}
        <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm flex flex-col transition hover:shadow-md">
           <CardHeader>
             <CardTitle className="text-slate-900 dark:text-white">Occupancy Timeline (24hr)</CardTitle>
           </CardHeader>
           <CardContent className="flex-1 min-h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={mockTimelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorLoadStats" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#007BC4" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#007BC4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', padding: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="load" stroke="#007BC4" strokeWidth={3} fillOpacity={1} fill="url(#colorLoadStats)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm flex-1 flex flex-col transition hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-white">Personnel Roles</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-[150px]">
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={roleData}
                     cx="50%"
                     cy="50%"
                     innerRadius={60}
                     outerRadius={80}
                     paddingAngle={5}
                     dataKey="value"
                     stroke="none"
                   >
                     {roleData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                     ))}
                   </Pie>
                   <Tooltip 
                     contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                     itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                   />
                 </PieChart>
               </ResponsiveContainer>
               <div className="flex justify-center gap-4 mt-4">
                 {roleData.map((entry, index) => (
                    <div key={entry.name} className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      {entry.name}
                    </div>
                 ))}
               </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm flex-1 flex flex-col transition hover:shadow-md">
            <CardHeader>
              <CardTitle className="text-slate-900 dark:text-white">Zone Distribution & Dwell Times</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 min-h-[150px] flex flex-col gap-4">
               <div className="h-[150px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={zoneData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis hide />
                      <Tooltip 
                        cursor={{ fill: '#f8fafc' }}
                        contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        itemStyle={{ color: '#0f172a', fontWeight: 'bold' }}
                      />
                      <Bar dataKey="occupancy" fill="#007BC4" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
               </div>
               <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100">
                  {zoneData.slice(0, 4).map(z => (
                     <div key={z.name} className="flex flex-col bg-slate-50 p-2 rounded justify-between">
                        <span className="text-[10px] text-slate-500 uppercase font-bold truncate">{z.name}</span>
                        <div className="flex items-center gap-2">
                           <span className="text-xs font-medium text-slate-700">{z.occupancy} occ.</span>
                           <span className="text-xs font-semibold text-[#007BC4]">{Math.floor(z.avgDwell/60)}m {z.avgDwell%60}s</span>
                        </div>
                     </div>
                  ))}
               </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
