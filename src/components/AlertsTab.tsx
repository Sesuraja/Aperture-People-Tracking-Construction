import { AIAlert } from '../lib/simulation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, FileWarning, Info, BellRing } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function AlertsTab({ alerts }: { alerts: AIAlert[] }) {
  // Let's create an extended list from alerts to simulate history if short
  const allAlerts = [...alerts].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <div className="flex flex-col gap-6 w-full p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Intelligence Log</h2>
          <p className="text-slate-500 font-medium">Complete history of all AI-generated alerts and events.</p>
        </div>
        <div className="flex gap-4">
           <Badge variant="outline" className="border-rose-200 text-rose-700 bg-rose-50 px-3 py-1 text-sm shadow-sm font-semibold">
             {alerts.filter(a => a.type === 'security').length} Security
           </Badge>
           <Badge variant="outline" className="border-amber-200 text-amber-700 bg-amber-50 px-3 py-1 text-sm shadow-sm font-semibold">
             {alerts.filter(a => a.type === 'warning').length} Warnings
           </Badge>
        </div>
      </div>

      <Card className="bg-white border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 bg-slate-50/50 py-4 flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2 text-slate-900 font-bold">
            <BellRing className="w-5 h-5 text-[#007BC4]" />
            Alert History
          </CardTitle>
          <span className="text-sm font-medium text-slate-500">{allAlerts.length} total events recorded</span>
        </CardHeader>
        <CardContent className="p-6 bg-slate-50/20">
          <div className="flex flex-col gap-4">
            {allAlerts.map(alert => (
              <div 
                key={alert.id}
                className={`flex flex-col sm:flex-row gap-4 p-4 rounded-xl border relative shadow-sm ${
                  alert.type === 'security' ? 'bg-rose-50 border-rose-200 hover:bg-rose-100 hover:border-rose-300' :
                  alert.type === 'warning' ? 'bg-amber-50 border-amber-200 hover:bg-amber-100 hover:border-amber-300' :
                  'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                } transition-colors`}
              >
                <div className={`p-3 rounded-lg shrink-0 self-start shadow-inner ${
                  alert.type === 'security' ? 'bg-rose-100 text-rose-600' :
                  alert.type === 'warning' ? 'bg-amber-100 text-amber-600' :
                  'bg-[#007BC4]/10 text-[#007BC4]'
                }`}>
                  {alert.type === 'security' && <AlertCircle className="w-6 h-6" />}
                  {alert.type === 'warning' && <FileWarning className="w-6 h-6" />}
                  {alert.type === 'info' && <Info className="w-6 h-6" />}
                </div>
                
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                       <Badge variant="outline" className={`text-[10px] sm:text-xs uppercase px-2 py-0.5 border-0 font-bold tracking-wider ${
                          alert.type === 'security' ? 'bg-rose-500/10 text-rose-700' :
                          alert.type === 'warning' ? 'bg-amber-500/10 text-amber-700' :
                          'bg-[#007BC4]/10 text-[#007BC4]'
                       }`}>
                         {alert.type}
                       </Badge>
                       <span className="text-sm font-semibold text-slate-500">
                         {alert.timestamp.toLocaleDateString()}
                       </span>
                    </div>
                    <div className="text-sm font-mono font-medium text-slate-600 bg-white border border-slate-200 shadow-sm px-2 py-1 rounded">
                       {alert.timestamp.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  </div>
                  
                  <p className="text-base font-bold text-slate-900 mt-1 leading-relaxed">
                    {alert.message}
                  </p>
                  
                  {alert.type === 'security' && (
                    <div className="mt-4 pt-4 border-t border-rose-200">
                       <div className="flex gap-4 text-sm font-medium text-rose-600 mb-3">
                         <span className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" /> Action required</span>
                         <span className="text-[#007BC4] cursor-pointer hover:underline font-bold">View on map →</span>
                       </div>
                       <div className="bg-white border text-left border-rose-200 rounded-xl p-4 shadow-sm flex items-start gap-4 hover:border-[#007BC4] transition cursor-pointer group">
                          <div className="w-24 h-16 bg-slate-100 rounded-lg border border-slate-200 overflow-hidden relative shrink-0">
                             <div className="absolute top-1 left-1 flex items-center gap-1 z-10">
                                <div className="w-1 h-1 bg-red-500 rounded-full animate-pulse" />
                                <span className="text-[8px] font-mono font-bold text-white uppercase drop-shadow flex">REC</span>
                             </div>
                             {/* Mock CCTV style background */}
                             <div className="absolute inset-0 bg-slate-800 flex items-center justify-center opacity-90 group-hover:opacity-100 transition">
                               <span className="text-[8px] font-mono text-slate-400 absolute bottom-1 right-1">{alert.timestamp.toLocaleTimeString()}</span>
                             </div>
                          </div>
                          <div>
                             <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                               CCTV Correlation Event
                               <Badge className="bg-[#007BC4]/10 text-[#007BC4] border-0 hover:bg-[#007BC4]/20 text-[10px] uppercase">Cam-4A</Badge>
                             </h4>
                             <p className="text-xs text-slate-500 font-medium mt-1">Automatic snapshot captured exactly at event trigger time {alert.timestamp.toLocaleTimeString()}.</p>
                             <span className="text-xs font-bold text-[#007BC4] block mt-1 hover:underline">View high-res frame →</span>
                          </div>
                       </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {allAlerts.length === 0 && (
              <div className="py-20 flex flex-col items-center justify-center text-slate-500 gap-4">
                <Info className="w-12 h-12 text-slate-300" />
                <p className="text-lg font-medium text-slate-600">No alerts recorded yet.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
