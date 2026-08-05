import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  AlertTriangle, 
  Users, 
  ArrowUpRight, 
  Zap, 
  Radio, 
  Clock, 
  Database, 
  CheckCircle2, 
  Cpu, 
  ShieldAlert, 
  Loader2, 
  Trash2, 
  PlusCircle, 
  Compass, 
  Flame,
  ArrowRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useGaoRealtime, useGaoHistory } from '../lib/useGaoApi';
import { Person } from '../lib/simulation';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from '../lib/db';
import { db } from '../lib/firebase';

interface AIInsightsTabProps {
  people?: Person[];
}

interface GeminiAnomaly {
  tagId: string;
  name?: string;
  zone?: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
}

interface GeminiOptimization {
  category: string;
  title: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  actionableSteps: string;
}

interface GeminiPersonnelEfficiency {
  tagId: string;
  name?: string;
  inferredActivity: string;
  efficiencyScore: number;
  dwellTimeInfo?: string;
}

interface GeminiReport {
  executiveSummary: string;
  anomalies: GeminiAnomaly[];
  optimizations: GeminiOptimization[];
  personnelEfficiency: GeminiPersonnelEfficiency[];
}

interface PersistedRecommendation {
  id: string;
  category: string;
  title: string;
  impact: string;
  description: string;
  actionableSteps: string;
  appliedAt: any;
}

export default function AIInsightsTab({ people = [] }: AIInsightsTabProps) {
  // Tabs for output viewer
  const [dataTab, setDataTab] = useState<'live' | 'history'>('live');
  
  // Real-time reader scans & history
  const { tags: liveTags, error: liveError, isLoading: liveLoading } = useGaoRealtime(3000);
  const { records: historyRecords, isLoading: historyLoading, error: historyError } = useGaoHistory(0, 15);
  
  // Gemini report state
  const [report, setReport] = useState<GeminiReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Applied Optimizations state (Firestore persisted)
  const [savedRecommendations, setSavedRecommendations] = useState<PersistedRecommendation[]>([]);

  // Fetch applied recommendations from Firestore
  useEffect(() => {
    const q = query(
      collection(db, 'ai_recommendations'), 
      orderBy('appliedAt', 'desc')
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const list: PersistedRecommendation[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          category: data.category,
          title: data.title,
          impact: data.impact,
          description: data.description,
          actionableSteps: data.actionableSteps,
          appliedAt: data.appliedAt
        });
      });
      setSavedRecommendations(list);
    }, (err) => {
      console.error("Failed to read recommendations:", err);
    });
    return () => unsub();
  }, []);

  // Map Tag ID to Name and Role
  const resolvePerson = (tagId: string) => {
    if (!people || people.length === 0) return null;
    return people.find(p => p.id?.toLowerCase() === tagId?.toLowerCase());
  };

  // Run Gemini analysis through our direct server endpoint
  const runAiAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      // Map names into tags payload so Gemini knows who is who!
      const enrichedLiveTags = liveTags.map(t => {
        const match = resolvePerson(t.TagID);
        return {
          ...t,
          resolvedName: match ? match.name : 'Unknown Personnel',
          resolvedRole: match ? match.role : 'Visitor'
        };
      });

      const enrichedHistory = (historyRecords || []).map(r => {
        return {
          ...r,
          resolvedName: `${r.FirstName || ''} ${r.LastName || ''}`.trim() || 'Unknown'
        };
      });

      let result;
      const isDemo = localStorage.getItem('gao_app_mode') === 'demo';

      if (isDemo) {
        // Return beautiful offline simulated report
        result = {
          executiveSummary: "UHF hardhat RFID personnel scans are active across Metro Commercial Tower Construction Site. Telemetry has flagged unauthorized entry into Heavy Crane Exclusion Area and scaffolding congestion during shift changes. Safety rules and emergency muster readiness remain fully monitored.",
          anomalies: [
            {
              tagId: "2",
              name: "Bob Johnson",
              zone: "Heavy Crane & Exclusion Area",
              severity: "HIGH",
              title: "Exclusion Zone Permit Breach",
              description: "Bob Johnson (Subcontractor) was detected inside the Heavy Crane Swing Exclusion Area without high-risk work permit verification during active overhead lifts."
            },
            {
              tagId: "1",
              name: "Alice Smith",
              zone: "Confined Shaft & Tunneling",
              severity: "MEDIUM",
              title: "Stationary Welfare Ping",
              description: "Alice Smith has been stationary in Underground Tunnel Shaft B for over 25 minutes. Automated welfare check ping dispatched to Site Safety Lead."
            }
          ],
          optimizations: [
            {
              category: "Operations",
              title: "Optimize Security Patrol Route",
              impact: "HIGH",
              description: "Move patrol guards near Room 102 during afternoon shift rotations to reduce visitor loitering risks.",
              actionableSteps: "1. Update security dispatch schedules.\n2. Reallocate physical checkpoints."
            },
            {
              category: "Energy",
              title: "HVAC Zone Scheduling",
              impact: "MEDIUM",
              description: "Shut down climate controls in Meeting Room when unoccupied based on real-time scan histories.",
              actionableSteps: "1. Connect smart thermostat relay with Aperture API.\n2. Apply unoccupied standby offsets."
            }
          ],
          personnelEfficiency: [
            {
              tagId: "1",
              name: "Alice Smith",
              inferredActivity: "Sustained Focused Work",
              efficiencyScore: 92,
              dwellTimeInfo: "Dwell 154m (90% at office desk)"
            },
            {
              tagId: "3",
              name: "Charlie Davis",
              inferredActivity: "Patrol and Escort Duties",
              efficiencyScore: 88,
              dwellTimeInfo: "Dwell 45m in zones, 120m in transit"
            }
          ]
        };
      } else {
        const response = await fetch('/api/analyze-rfid-results', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            liveTags: enrichedLiveTags,
            historyRecords: enrichedHistory
          })
        });

        if (!response.ok) {
          throw new Error(`Server returned code ${response.status}`);
        }

        result = await response.json();
      }
      setReport(result);
    } catch (e: any) {
      console.error("AI Reader diagnostic failed:", e);
      setAnalysisError(e.message || "Failed to communicate with Gemini API backend server.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Persist a recommended improvement in Firestore
  const handleSaveRecommendation = async (opt: GeminiOptimization) => {
    try {
      await addDoc(collection(db, 'ai_recommendations'), {
        category: opt.category,
        title: opt.title,
        impact: opt.impact,
        description: opt.description,
        actionableSteps: opt.actionableSteps,
        appliedAt: serverTimestamp()
      });
      
      // Also write an info alert
      await addDoc(collection(db, 'alerts'), {
        type: 'info',
        message: `Applied AI Optimization suggestion: "${opt.title}"`,
        timestamp: new Date()
      });
    } catch (e) {
      console.error("Could not save recommendation:", e);
    }
  };

  // Delete a recommendation
  const handleRemoveRecommendation = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'ai_recommendations', id));
    } catch (e) {
      console.error("Failed to delete recommendation:", e);
    }
  };

  // Log detected anomaly into incidents database collection
  const logAnomalyAsIncident = async (anomaly: GeminiAnomaly) => {
    try {
      await addDoc(collection(db, 'incidents'), {
        title: `AI Identified Anomaly: ${anomaly.title}`,
        severity: anomaly.severity === 'HIGH' ? 'Critical' : anomaly.severity === 'MEDIUM' ? 'Major' : 'Minor',
        status: 'Open',
        officer: 'Security Officer Assigned',
        location: anomaly.zone || 'Multiple Zones',
        notes: `UHF Tag Scan Issue detected for ${anomaly.name || 'Tag ' + anomaly.tagId.substring(0, 8)}. Details: ${anomaly.description}`,
        screenshot: '',
        createdAt: serverTimestamp()
      });

      // Write security alert inside Firestore
      await addDoc(collection(db, 'alerts'), {
        type: anomaly.severity === 'HIGH' ? 'security' : 'warning',
        message: `SEC EVENT FLAGGED: ${anomaly.title} (${anomaly.zone || 'General Area'})`,
        timestamp: new Date()
      });

      alert(`Successfully registered incident: "${anomaly.title}" in Incident Management Center.`);
    } catch (e) {
      console.error("Could not log incident:", e);
    }
  };

  return (
    <div className="flex flex-col p-6 max-w-7xl mx-auto w-full gap-6">
      {/* Title block */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8 shrink-0 gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
             <Sparkles className="w-6 h-6 text-indigo-500 fill-indigo-100" />
             UHF RFID Systems Intelligence
          </h2>
          <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight">
            Review live reader logs, database histories, and activate Gemini to improve physical throughput outputs.
          </p>
        </div>
        
        <button
          onClick={runAiAnalysis}
          disabled={isAnalyzing}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm px-5 py-3 rounded-xl shadow-lg shadow-indigo-100 dark:shadow-none hover:shadow-indigo-200 transition-all disabled:opacity-75 cursor-pointer"
          id="btn-rfid-ai-diagnose"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Running Neural Scan...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 animate-pulse fill-white" />
              Run Gemini RFID Intelligence Analysis
            </>
          )}
        </button>
      </div>

      {/* Main Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 shrink-0" id="stats-dashboard">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
            <Radio className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Aperture Live Feeds</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{liveTags?.length || 0} Antennas</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Histories Tracked</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              {historyLoading ? 'Loading...' : `${historyRecords?.length || 0} Records`}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Personnel Monitored</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">{people?.length || 0} Active</div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-xl">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Applied Optimizations</div>
            <div className="text-xl font-bold text-slate-900 dark:text-white mt-0.5">
              {savedRecommendations.length} Rules
            </div>
          </div>
        </div>
      </div>

      {/* Two-Column Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Aperture Readers Outputs Display & Saved Action items */}
        <div className="lg:col-span-5 flex flex-col gap-6" id="left-workspace-column">
          
          {/* UHF RFID Reader Stream Results CARD */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4 mb-4">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Aperture RFID Reader Outputs</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Showing raw reader antenna transmissions.</p>
              </div>
              
              {/* Table Switcher */}
              <div className="flex bg-slate-100 dark:bg-slate-755 p-1 rounded-lg">
                <button
                  onClick={() => setDataTab('live')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-md transition ${dataTab === 'live' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-755'}`}
                >
                  Live (Aperture)
                </button>
                <button
                  onClick={() => setDataTab('history')}
                  className={`text-xs font-bold px-3 py-1.5 rounded-md transition ${dataTab === 'history' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-755'}`}
                >
                  Database
                </button>
              </div>
            </div>

            {/* Live tags list from useGaoRealtime */}
            {dataTab === 'live' && (
              <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                {liveLoading && liveTags.length === 0 && (
                  <div className="text-center py-10 text-xs text-slate-400 font-semibold flex flex-col items-center gap-2">
                    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                    Querying live Aperture antenna stream...
                  </div>
                )}
                {liveError && (
                  <div className="text-center py-6 text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/20 rounded-xl p-3 border border-rose-100 dark:border-rose-900/40">
                    Failed to fetch Aperture real-time stream. Ensure hardware port configuration is online.
                  </div>
                )}
                {liveTags.map((tag, i) => {
                  const matched = resolvePerson(tag.TagID);
                  return (
                    <div 
                      key={i} 
                      className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 rounded-xl flex flex-col gap-1 hover:border-indigo-200 dark:hover:border-indigo-900/50 hover:bg-indigo-50/20 transition shadow-inner"
                      id={`livetag-${tag.TagID}-${i}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-200/50 dark:bg-slate-700 px-1.5 py-0.5 rounded break-all max-w-[150px] truncate">
                          {tag.TagID}
                        </span>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold flex items-center gap-1">
                          <Clock className="w-3 h-3 text-indigo-500" />
                          {tag.Timestamp ? new Date(tag.Timestamp + "Z").toLocaleTimeString() : 'Just now'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <div className="text-sm font-bold text-slate-800 dark:text-white">
                          {matched ? matched.name : 'Unknown Personnel'}
                        </div>
                        <Badge variant="outline" className="text-[10px] bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 text-indigo-800 dark:text-indigo-300 rounded font-black uppercase tracking-wide">
                          {tag.Location}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
                {liveTags.length === 0 && !liveLoading && (
                  <div className="text-center py-12 text-slate-400 text-xs font-semibold">
                    No immediate RFID antenna events captured yet.
                  </div>
                )}
              </div>
            )}

            {/* History logs from useGaoHistory */}
            {dataTab === 'history' && (
              <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                {historyLoading && (
                  <div className="text-center py-10 text-xs text-slate-400 font-semibold flex flex-col items-center gap-2">
                    <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                    Connecting database reports...
                  </div>
                )}
                {historyError && (
                  <div className="text-center py-6 text-xs text-rose-500 bg-rose-50 dark:bg-rose-950/20 rounded-xl p-3 border border-rose-100 dark:border-rose-900/40">
                    Failed to fetch historical database logs. Check Firestore sync connection.
                  </div>
                )}
                {(historyRecords || []).map((rec, i) => (
                  <div 
                    key={i} 
                    className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 rounded-xl flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[9px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-100/30 dark:bg-indigo-950/50 px-2 py-0.5 rounded select-all truncate max-w-[120px]">
                        Tag: {rec.TagID}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-emerald-500" />
                        {rec.EnterTimeStr || rec.EnterTime || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-black text-slate-800 dark:text-white">
                        {rec.FirstName} {rec.LastName}
                      </span>
                      <span className="bg-slate-200/60 dark:bg-slate-750 text-slate-700 dark:text-slate-300 font-extrabold px-2 py-0.5 rounded text-[10px] uppercase">
                        {rec.LocationName}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] bg-white dark:bg-slate-800 p-1 rounded border border-slate-100 dark:border-slate-700 font-medium text-slate-500">
                      <span>Dwell duration:</span>
                      <span className="font-black text-slate-700 dark:text-slate-300">{rec.Duration} Hrs</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Persistent applied AI Optimizations (Firestore collection synchronization) */}
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 shadow-sm shadow-slate-100 dark:shadow-none">
            <h3 className="font-black text-sm text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Applied AI Optimizations Board
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">
              Real-time persistent instructions synced directly into your cloud database for hardware planners.
            </p>

            <div className="space-y-3">
              {savedRecommendations.map((opt) => (
                <div 
                  key={opt.id} 
                  className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-4 flex flex-col justify-between shadow-sm relative group hover:shadow transition"
                  id={`saved-recommendation-${opt.id}`}
                >
                  <button 
                    onClick={() => handleRemoveRecommendation(opt.id)}
                    className="absolute top-3 right-3 text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition"
                    title="Archive optimization"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <div className="pr-6">
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      <Badge className="text-[9px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300 rounded hover:bg-emerald-100">
                        {opt.category}
                      </Badge>
                      <Badge className="text-[9px] font-black bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 rounded hover:bg-purple-100">
                        IMPACT: {opt.impact}
                      </Badge>
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1 leading-tight">{opt.title}</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-300 font-medium leading-relaxed mb-2 pr-2">{opt.description}</p>
                    
                    <div className="bg-white/80 dark:bg-slate-800/80 rounded-lg p-2.5 border border-emerald-100 dark:border-emerald-900/30">
                      <span className="text-[9px] uppercase font-black text-emerald-700 dark:text-emerald-450 tracking-wider block mb-1">
                        Steps to complete:
                      </span>
                      <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-305 font-mono">{opt.actionableSteps}</p>
                    </div>
                  </div>
                </div>
              ))}

              {savedRecommendations.length === 0 && (
                <div className="text-center py-10 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 text-xs font-semibold flex flex-col items-center gap-2">
                  <Compass className="w-6 h-6 opacity-40 text-slate-400" />
                  No operational directives currently saved.<br/>Use Gemini above to analyze scans and save rules.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: AI Analysis Center Content */}
        <div className="lg:col-span-7 flex flex-col gap-6" id="right-workspace-column">
          
          {/* Active Diagnostic Status Panel */}
          {analysisError && (
            <div className="bg-rose-50 border border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/50 p-5 rounded-3xl text-sm font-semibold text-rose-500 shadow-sm flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Gemini Diagnostic Communication Issue</div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                  {analysisError}
                </div>
              </div>
            </div>
          )}

          {!report && !isAnalyzing && (
            <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-8 shadow-xl flex flex-col items-center justify-center text-center relative overflow-hidden min-h-[400px]">
              <div className="absolute inset-0 z-0 opacity-10 bg-[linear-gradient(45deg,#4f46e5_1px,transparent_1px)]" style={{ backgroundSize: '15px 15px' }} />
              <div className="w-16 h-16 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center mb-5 z-10 border border-indigo-400/20 animate-pulse">
                <Cpu className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black tracking-tight mb-2 z-10">UHF Scan Quality Improvement Centre</h3>
              <p className="text-indigo-200 max-w-md text-xs font-medium leading-relaxed mb-6 z-10">
                Integrate dynamic intelligence models with the live system. Clicking below imports all active personnel, maps user roles, scans histories, and predicts performance optimizations.
              </p>
              <button 
                onClick={runAiAnalysis}
                className="bg-indigo-500 hover:bg-indigo-400 text-white z-10 font-bold px-6 py-2.5 rounded-xl text-xs uppercase shadow-lg shadow-indigo-950 flex items-center gap-2 transition hover:scale-103 cursor-pointer"
              >
                Let AI Analyze Outputs Now <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {isAnalyzing && (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-8 shadow-sm flex flex-col items-center justify-center text-center min-h-[400px] animate-in fade-in duration-300">
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
              <h3 className="font-bold text-slate-900 dark:text-white mb-2 text-base">Gemini is Processing RFID Stream...</h3>
              <p className="text-xs text-slate-500 max-w-sm font-medium leading-relaxed">
                Loading database tables, verifying claims constraints, parsing live zone transitions, and planning automated layout recommendations ("improved outputs"). This takes 4-7 seconds.
              </p>
              <div className="mt-6 flex flex-wrap gap-2 justify-center max-w-sm">
                <Badge variant="outline" className="text-[10px] uppercase bg-slate-50 text-slate-400">Claims: Verified</Badge>
                <Badge variant="outline" className="text-[10px] uppercase bg-slate-50 text-slate-400 text-indigo-500 border-indigo-200 animate-pulse">Model: gemini-3.5-flash</Badge>
                <Badge variant="outline" className="text-[10px] uppercase bg-slate-50 text-slate-400">Context: 30 logs</Badge>
              </div>
            </div>
          )}

          {report && !isAnalyzing && (
            <div className="space-y-6 animate-in fade-in duration-500">
              
              {/* Executive Summary Report Widget */}
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-3xl p-6 shadow-sm">
                <h4 className="font-bold text-indigo-900 dark:text-indigo-400 text-base mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-500 fill-indigo-200" />
                  AI Executive Intelligence Report
                </h4>
                <p className="text-indigo-950 dark:text-slate-300 text-xs font-medium leading-relaxed bg-white/70 dark:bg-slate-800/70 p-4 rounded-2xl border border-white dark:border-slate-700">
                  {report.executiveSummary}
                </p>
              </div>

              {/* Anomalies Detected Panel */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
                <h4 className="font-bold text-slate-900 dark:text-white text-base mb-1 flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-500" />
                  Detected Flow & Safety Anomalies
                </h4>
                <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">
                  Gemini identified potential loitering, escort breaches, or antenna alignment bottlenecks.
                </p>

                <div className="space-y-3">
                  {report.anomalies && report.anomalies.map((an, i) => (
                    <div 
                      key={i} 
                      className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-rose-200 dark:hover:border-rose-950 duration-200"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={`text-[9px] font-black rounded ${
                            an.severity === 'HIGH' ? 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300' :
                            an.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300' :
                            'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                          }`}>
                            {an.severity} RISK
                          </Badge>
                          {an.zone && (
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              Zone: {an.zone}
                            </span>
                          )}
                        </div>
                        <h5 className="font-bold text-slate-900 dark:text-white text-sm mt-1">{an.title}</h5>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed pr-3">{an.description}</p>
                        <div className="text-[10px] text-slate-500 font-mono font-bold pt-1">
                          Tag ID: {an.tagId} {an.name ? `| Resolved: ${an.name}` : ''}
                        </div>
                      </div>

                      <button
                        onClick={() => logAnomalyAsIncident(an)}
                        className="bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-450 border border-rose-200/40 font-bold text-xs py-2 px-3 rounded-xl transition shrink-0 uppercase tracking-wider max-w-[150px] cursor-pointer"
                      >
                        Log as Incident
                      </button>
                    </div>
                  ))}

                  {(!report.anomalies || report.anomalies.length === 0) && (
                    <div className="text-center py-6 text-slate-400 text-xs font-semibold">
                      No facility flow or safety anomalies reported. Great hardware response!
                    </div>
                  )}
                </div>
              </div>

              {/* AI Layout & Device Placement Optimizations ("improved output") */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
                <h4 className="font-black text-slate-900 dark:text-white text-base mb-1 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-teal-500" />
                  Antenna Placement & Operational Tuning
                </h4>
                <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">
                  AI suggestions for restructuring hardware, shifting antenna parameters, or zone configurations to improve accuracy.
                </p>

                <div className="space-y-4">
                  {report.optimizations && report.optimizations.map((opt, i) => (
                    <div 
                      key={i} 
                      className="border border-slate-100 dark:border-slate-700/80 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-850 hover:border-indigo-100 dark:hover:border-indigo-950 transition"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                        <div className="flex items-center gap-2">
                          <Badge className="text-[9px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 rounded hover:bg-indigo-100">
                            {opt.category}
                          </Badge>
                          <Badge variant="outline" className={`text-[9.5px] rounded ${
                            opt.impact === 'HIGH' ? 'bg-teal-50 text-teal-700 border-teal-200' : 'bg-slate-50 text-slate-500 border-slate-200'
                          }`}>
                            IMPACT: {opt.impact}
                          </Badge>
                        </div>
                        
                        <button
                          onClick={() => handleSaveRecommendation(opt)}
                          className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-3 py-1 rounded-lg flex items-center gap-1 hover:shadow shadow-sm transition uppercase tracking-wider text-[10px] cursor-pointer"
                        >
                          <PlusCircle className="w-3.5 h-3.5" /> Save Rule
                        </button>
                      </div>

                      <h5 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{opt.title}</h5>
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed mb-3">{opt.description}</p>
                      
                      <div className="p-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl">
                        <span className="text-[9px] uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-widest block mb-1">
                          Implementation Step:
                        </span>
                        <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-300">{opt.actionableSteps}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Personnel Activity Classifier Profiles */}
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
                <h4 className="font-bold text-slate-900 dark:text-white text-base mb-1 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-500" />
                  Personnel Activity Profiles (Classifier)
                </h4>
                <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">
                  Inferred tasks resolved dynamically using chronologic RFID antenna dwells.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {report.personnelEfficiency && report.personnelEfficiency.map((pe, i) => (
                    <div 
                      key={i} 
                      className="p-4 bg-slate-50 dark:bg-slate-800/20 border border-slate-150 dark:border-slate-700 rounded-2xl flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-black text-slate-800 dark:text-white text-xs block">
                            {pe.name || `Tag ${pe.tagId.substring(0,6).toUpperCase()}`}
                          </span>
                          <span className="font-mono text-[9px] font-bold text-slate-400 bg-slate-200/50 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                            {pe.tagId.substring(0,8)}...
                          </span>
                        </div>
                        <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40 p-2.5 rounded-lg border border-indigo-100/40 mb-3">
                          {pe.inferredActivity}
                        </p>
                        {pe.dwellTimeInfo && (
                          <span className="text-[10px] text-slate-400 font-medium block">
                            {pe.dwellTimeInfo}
                          </span>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-200/40">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mb-1">
                          <span>ACTIVITY DENSITY SCORE</span>
                          <span className="text-indigo-600 dark:text-indigo-400">{pe.efficiencyScore}%</span>
                        </div>
                        <div className="w-full bg-slate-205 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-indigo-600 h-1.5 rounded-full" 
                            style={{ width: `${pe.efficiencyScore || 80}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>

      </div>

    </div>
  );
}
