import { useState, useMemo, useEffect, useContext } from 'react';
import { AppModeContext } from '../App';
import { Person, Zone } from '../lib/simulation';
import { Play, Pause, FastForward, SkipBack, Search, Database } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { useGaoHistory } from '../lib/useGaoApi';
import { collection, query, orderBy, limit, getDocs, getCountFromServer } from '../lib/db';
import { db } from '../lib/firebase';

export default function PlaybackTab({ people, zones }: { people: Person[], zones: any }) {
  const { mode } = useContext(AppModeContext);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeIndex, setTimeIndex] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedPersonId, setHighlightedPersonId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'map'|'api'>('api');

  // History state
  const [skip, setSkip] = useState(0);
  const take = 20;
  
  // Real Firestore tracking data
  const [dbRecords, setDbRecords] = useState<any[]>([]);
  const [dbTotalCount, setDbTotalCount] = useState(0);
  const [isDbLoading, setIsDbLoading] = useState(false);

  // Fallback API History
  const { records: apiRecords, totalCount: apiTotalCount, isLoading: apiIsLoading, error: apiError } = useGaoHistory(skip, take);

  useEffect(() => {
    if (mode === 'real') {
      const fetchDbHistory = async () => {
        setIsDbLoading(true);
        try {
          const colRef = collection(db, 'tag_history');
          const countSnap = await getCountFromServer(colRef);
          setDbTotalCount(countSnap.data().count);
          
          // NOTE: True pagination in firestore is cursor based, but for simplicity we fetch limit and do a client slice for now
          // or we can just fetch a larger chunk. We'll do a simple limited query for demonstration:
          const q = query(colRef, orderBy('timestamp', 'desc'), limit(take + skip));
          const snap = await getDocs(q);
          
          const fetched = snap.docs.map(doc => {
            const data = doc.data();
            return {
              TagID: data.TagID,
              FirstName: data.name?.split(' ')[0] || '',
              LastName: data.name?.split(' ').slice(1).join(' ') || '',
              LocationName: data.toZone || data.currentZone || 'Unknown',
              EnterTimeStr: data.timestamp?.toDate().toLocaleString() || new Date().toLocaleString(),
              LeaveTimeStr: 'ACTIVE',
              Duration: 0.1, // mock duration for log entry
              role: data.role
            };
          });
          
          setDbRecords(fetched.slice(skip, skip + take));
        } catch (e) {
          console.error('Failed to fetch DB history', e);
        } finally {
          setIsDbLoading(false);
        }
      };
      fetchDbHistory();
    }
  }, [mode, skip, take]);

  const records = mode === 'real' ? dbRecords : apiRecords;
  const totalCount = mode === 'real' ? dbTotalCount : apiTotalCount;
  const isLoading = mode === 'real' ? isDbLoading : apiIsLoading;
  const error = mode === 'real' ? null : apiError;

  // Generate deterministic mock history based on current people's trail or fallback
  const simulatedHistory = useMemo(() => {
    const historyFrames: Person[][] = [];
    const frameCount = 100;
    
    for (let i = 0; i < frameCount; i++) {
       const frame = people.map(p => {
          const idHash = p.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
          const offsetX = Math.sin(i * 0.1 + idHash) * 10;
          const offsetY = Math.cos(i * 0.1 + idHash) * 10;
          
          return {
             ...p,
             x: Math.max(5, Math.min(95, p.x + offsetX)),
             y: Math.max(5, Math.min(95, p.y + offsetY)),
             presenceState: (Math.abs(offsetX) > 5) ? 'MOVING' : 'IDLE' as ('MOVING' | 'IDLE')
          };
       });
       historyFrames.push(frame);
    }
    return historyFrames;
  }, [people]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
         setTimeIndex(prev => {
            if (prev >= simulatedHistory.length - 1) {
               setIsPlaying(false);
               return prev;
            }
            return prev + 1;
         });
      }, 500 / speed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, speed, simulatedHistory.length]);

  const togglePlay = () => setIsPlaying(!isPlaying);
  const resetPlayback = () => { setIsPlaying(false); setTimeIndex(0); };

  const currentFramePeople = simulatedHistory[timeIndex] || people;
  
  const startTime = new Date();
  startTime.setHours(8, 0, 0, 0);
  const currentTime = new Date(startTime.getTime() + timeIndex * 60000 * 5);

  return (
    <div className="w-full flex flex-col p-6 gap-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between shrink-0 gap-4">
        <div>
           <h2 className="text-xl font-bold text-slate-900 tracking-tight">Historical Playback & Data</h2>
           <p className="text-slate-500 text-sm font-medium mt-1">Review map events or view true system history data logs</p>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="flex bg-slate-200/50 p-1 rounded-lg">
             <button 
               onClick={() => setViewMode('map')}
               className={`px-4 py-1.5 text-sm font-bold rounded-md transition ${viewMode === 'map' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               Map Replay
             </button>
             <button 
               onClick={() => setViewMode('api')}
               className={`px-4 py-1.5 text-sm font-bold rounded-md transition ${viewMode === 'api' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
               Analytics API Logs
             </button>
           </div>
           
           {viewMode === 'map' && (
             <div className="flex bg-white rounded-xl border border-slate-200 shadow-sm p-2 items-center gap-4">
                <div className="text-[#007BC4] font-mono text-sm font-bold bg-[#007BC4]/10 px-3 py-1.5 rounded-lg border border-[#007BC4]/20 shadow-sm">
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div className="w-px h-6 bg-slate-200" />
                <button onClick={resetPlayback} className="p-2 text-slate-500 hover:text-[#007BC4] hover:bg-slate-50 rounded-lg transition"><SkipBack className="w-4 h-4" /></button>
                <button onClick={togglePlay} className="p-2 text-white bg-[#007BC4] hover:bg-blue-700 rounded-lg shadow-md shadow-[#007BC4]/20 transition">
                  {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <button onClick={() => setSpeed(s => s === 1 ? 2 : s === 2 ? 4 : 1)} className="p-2 text-slate-500 hover:text-[#007BC4] hover:bg-slate-50 rounded-lg transition flex items-center gap-1 font-mono text-xs font-bold">
                  <FastForward className="w-4 h-4" /> {speed}x
                </button>
             </div>
           )}
        </div>
      </div>

      {viewMode === 'map' && (
         <>
            <div className="px-5 py-6 bg-white rounded-xl border border-slate-200 shadow-sm shrink-0">
               <Slider 
                  value={[timeIndex]} 
                  max={simulatedHistory.length - 1} 
                  step={1} 
                  onValueChange={(val) => setTimeIndex(val[0])}
                  className="w-full"
               />
            </div>
            <div className="flex-1 flex flex-col xl:flex-row gap-6 min-h-0">
               <div className="flex-1 bg-white rounded-xl border border-slate-200 p-4 relative shadow-sm overflow-hidden flex flex-col">
                  <PlaybackMap historyFrames={simulatedHistory} currentFrameIndex={timeIndex} zones={zones} highlightedPersonId={highlightedPersonId} />
               </div>

               <div className="w-full xl:w-80 flex flex-col gap-4 shrink-0">
                  <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col min-h-0 h-full shadow-sm">
                     <h3 className="text-sm font-bold text-slate-900 mb-4 tracking-tight">Track Person</h3>
                     <div className="relative mb-4">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input 
                           type="text" 
                           className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#007BC4] focus:ring-1 focus:ring-[#007BC4] outline-none transition shadow-inner"
                           placeholder="Search ID or Name..."
                           value={searchQuery}
                           onChange={e => setSearchQuery(e.target.value)}
                        />
                     </div>
                     <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                        {currentFramePeople.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.id.toLowerCase().includes(searchQuery.toLowerCase())).map(p => (
                           <button 
                           key={p.id}
                           onClick={() => setHighlightedPersonId(prev => prev === p.id ? null : p.id)}
                           className={`w-full text-left p-3 rounded-xl border transition-all ${highlightedPersonId === p.id ? 'bg-[#007BC4]/5 border-[#007BC4] shadow-sm' : 'bg-white border-slate-200 hover:border-[#007BC4]/50 hover:bg-slate-50 shadow-sm hover:shadow'}`}
                           >
                           <div className="flex items-center justify-between">
                              <span className="font-semibold text-slate-900 text-sm">{p.name}</span>
                              <span className={`text-[9px] px-2 py-0.5 rounded uppercase font-bold tracking-wider ${p.role === 'Visitor' ? 'bg-amber-100 text-amber-700' : p.role === 'Security' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-[#007BC4]'}`}>{p.role}</span>
                           </div>
                           <span className="text-xs text-slate-500 mt-1 block font-mono font-medium">{p.id}</span>
                           </button>
                        ))}
                     </div>
                  </div>
               </div>
            </div>
         </>
      )}

      {viewMode === 'api' && (
         <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col min-h-0 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
               <div className="flex items-center gap-2 font-bold text-slate-700">
                  <Database className="w-5 h-5 text-[#007BC4]" />
                  Secure Aperture System Log History
               </div>
               <div className="text-sm font-semibold text-slate-500 bg-white border border-slate-200 shadow-sm px-3 py-1 rounded">
                 {totalCount > 0 ? `Total Stored Events: ${totalCount}` : isLoading ? 'Synchronizing...' : 'No events'}
               </div>
            </div>
            
            <div className="flex-1 overflow-auto bg-slate-50">
               <table className="w-full text-left border-collapse">
                  <thead className="bg-[#007BC4] text-white sticky top-0 shadow z-10">
                     <tr>
                        <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest border-b border-[#005B92]">Tag ID</th>
                        <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest border-b border-[#005B92]">User Info</th>
                        <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest border-b border-[#005B92]">Zone Location</th>
                        <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest border-b border-[#005B92]">Entry Log (UTC)</th>
                        <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest border-b border-[#005B92]">Exit Log (UTC)</th>
                        <th className="py-3 px-4 text-[10px] font-black uppercase tracking-widest border-b border-[#005B92] text-right">Dwell Time</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                     {isLoading && records.length === 0 && (
                        <tr><td colSpan={6} className="py-12 text-center text-slate-500 font-bold">Querying secure endpoints...</td></tr>
                     )}
                     {error && records.length === 0 && (
                        <tr><td colSpan={6} className="py-12 text-center text-rose-500 font-bold bg-rose-50 border-y border-rose-200">System Connection Error. Please verify integration parameters in Settings.</td></tr>
                     )}
                     {records.map((r, i) => (
                        <tr key={i} className="hover:bg-[#007BC4]/5 transition-colors">
                           <td className="py-3 px-4">
                             <div className="font-mono text-xs text-[#007BC4] font-bold bg-[#007BC4]/10 inline-block px-1.5 py-0.5 rounded border border-[#007BC4]/20">{r.TagID}</div>
                           </td>
                           <td className="py-3 px-4">
                             <span className="font-bold text-slate-900 block">{r.FirstName} {r.LastName}</span>
                           </td>
                           <td className="py-3 px-4">
                              <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold border border-slate-200 uppercase">{r.LocationName}</span>
                           </td>
                           <td className="py-3 px-4 font-mono text-xs text-slate-600 font-semibold">{r.EnterTime || r.EnterTimeStr || 'UNAVAILABLE'}</td>
                           <td className="py-3 px-4 font-mono text-xs text-slate-600 font-semibold">{r.LeaveTime || r.LeaveTimeStr || 'ACTIVE'}</td>
                           <td className="py-3 px-4 text-slate-700 font-bold text-right tabular-nums">{r.Duration} <span className="text-[10px] text-slate-400 font-medium">hrs</span></td>
                        </tr>
                     ))}
                     {!isLoading && !error && records.length === 0 && totalCount > 0 && (
                        <tr><td colSpan={6} className="py-12 text-center text-slate-500 font-bold">No records found for current range.</td></tr>
                     )}
                     {!isLoading && !error && records.length === 0 && totalCount === 0 && (
                        <tr><td colSpan={6} className="py-12 text-center text-slate-500 font-bold">No historical data available in secure storage.</td></tr>
                     )}
                  </tbody>
               </table>
            </div>

            <div className="p-3 border-t border-slate-200 bg-white flex justify-between items-center shadow-[0_-4px_10px_rgba(0,0,0,0.02)] z-20">
               <button 
                  disabled={skip === 0}
                  onClick={() => setSkip(Math.max(0, skip - take))}
                  className="px-4 py-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-md text-slate-700 disabled:opacity-50 hover:bg-slate-100 transition shadow-sm uppercase tracking-wider"
               >
                  Reverse
               </button>
               <span className="text-xs font-bold text-[#007BC4] bg-[#007BC4]/10 px-3 py-1 rounded-full">
                 DISPLAYING {totalCount > 0 ? skip + 1 : 0} – {Math.min(skip + take, totalCount)} OF {totalCount}
               </span>
               <button 
                  disabled={(skip + take) >= totalCount || totalCount === 0}
                  onClick={() => setSkip(skip + take)}
                  className="px-4 py-2 text-xs font-bold bg-[#007BC4] border border-[#007BC4] rounded-md text-white disabled:opacity-50 disabled:bg-slate-200 disabled:border-slate-200 disabled:text-slate-400 hover:bg-blue-700 transition shadow-sm uppercase tracking-wider"
               >
                  Forward
               </button>
            </div>
         </div>
      )}
    </div>
  );
}

function PlaybackMap({ historyFrames, currentFrameIndex, zones, highlightedPersonId }: { historyFrames: Person[][], currentFrameIndex: number, zones: any, highlightedPersonId: string | null }) {
  const zoneEntries = Object.entries(zones);
  const currentPeople = historyFrames[currentFrameIndex] || [];
  
  return (
    <div className="w-full h-full relative bg-transparent overflow-hidden flex items-center justify-center">
      <div className="absolute inset-0 z-0 opacity-10" style={{ backgroundImage: 'linear-gradient(#007BC4 1px, transparent 1px), linear-gradient(90deg, #007BC4 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      
      <div className="relative w-full h-full border-0 rounded-lg bg-transparent z-10 overflow-hidden">
        {zoneEntries.map(([name, rect]: any) => (
           <div 
            key={name}
            className="absolute border border-[#007BC4]/20 bg-white/40 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-2"
            style={{ 
              left: `${rect.x}%`, 
              top: `${rect.y}%`, 
              width: `${rect.width}%`, 
              height: `${rect.height}%`
            }}
           >
              <div className="bg-white/90 text-[#007BC4] border border-[#007BC4]/20 rounded-full px-3 py-1 text-[10px] font-bold shadow backdrop-blur-sm whitespace-nowrap">{name}</div>
           </div>
        ))}

        <svg className="absolute inset-0 w-full h-full z-10 pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
           {historyFrames[0].map((baselinePerson, i) => {
              const isVisitor = baselinePerson.role === 'Visitor';
              const isSecurity = baselinePerson.role === 'Security';
              const color = isVisitor ? '#f59e0b' : isSecurity ? '#10b981' : '#007BC4';
              
              if (highlightedPersonId && highlightedPersonId !== baselinePerson.id) return null;

              // Build points string taking this person's coordinate from frame 0 up to current frame index
              const pointsStr = historyFrames.slice(0, currentFrameIndex + 1).map(frame => {
                 const p = frame[i];
                 return p ? `${p.x},${p.y}` : ''; // Since we are using percentages directly
              }).filter(Boolean).map((pt) => { // need to compute percentage space into svg space but we can't easily. So we will use a relative viewBox or standard % coords using percentages. Since SVG polyline doesn't support percentage coords natively, we must write a small workaround. We'll use 100x100 viewBox and coords 0-100.
                 return pt;
              }).join(' ');

              if (!pointsStr) return null;

              return (
                 <polyline
                    key={`trail-${baselinePerson.id}`}
                    points={pointsStr}
                    fill="none"
                    stroke={color}
                    strokeWidth="0.5" // very thin relative to 100x100
                    strokeDasharray="1 1"
                    strokeOpacity={highlightedPersonId ? 0.9 : 0.3}
                 />
              )
           })}
        </svg>

        {currentPeople.map(p => {
          const isHighlighted = highlightedPersonId === p.id;
          const opacity = highlightedPersonId ? (isHighlighted ? 1 : 0.2) : 1;
          
          return (
            <div
              key={p.id}
              className="absolute w-4 h-4 rounded-full border-[2px]"
              style={{
                left: `${p.x}%`,
                top: `${p.y}%`,
                transform: 'translate(-50%, -50%)',
                transition: 'left 0.5s ease-out, top 0.5s ease-out',
                opacity,
                zIndex: isHighlighted ? 50 : 20,
                backgroundColor: p.role === 'Visitor' ? '#f59e0b' : p.role === 'Security' ? '#10b981' : '#007BC4',
                borderColor: '#ffffff',
                boxShadow: isHighlighted ? '0 0 20px rgba(0,123,196,0.8)' : '0 0 5px rgba(0,0,0,0.2)'
              }}
            >
              {isHighlighted && (
                <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-white text-slate-900 border border-slate-200 text-[10px] font-bold px-2 py-0.5 rounded shadow-xl whitespace-nowrap z-50">
                  {p.name}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
