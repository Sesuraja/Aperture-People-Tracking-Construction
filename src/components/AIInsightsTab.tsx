import React, { useState, useEffect, useCallback } from 'react';
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
  ArrowRight,
  Send,
  MessageSquare,
  Bot,
  FileText,
  Printer,
  Siren,
  ShieldCheck,
  Activity,
  Layers,
  Search,
  Wifi,
  BarChart3,
  Check,
  RotateCw,
  Save,
  Download,
  Target,
  BrainCircuit,
  Sliders,
  FileSpreadsheet,
  BookOpen,
  Microscope,
  Lightbulb,
  Share2,
  History,
  RefreshCw
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
  serverTimestamp,
  getDocs
} from '../lib/db';
import { db } from '../lib/firebase';
import { generatePDFReport, exportToCSV } from '../lib/exportUtils';
import { useWebSocket } from '../lib/useWebSocket';

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

interface GeminiRiskForecast {
  zone: string;
  riskScore: number;
  trend: 'Increasing' | 'Stable' | 'Decreasing';
  mainFactor: string;
}

interface GeminiReport {
  executiveSummary: string;
  safetyComplianceScore?: number;
  anomalies: GeminiAnomaly[];
  optimizations: GeminiOptimization[];
  personnelEfficiency: GeminiPersonnelEfficiency[];
  riskForecasts?: GeminiRiskForecast[];
  recommendations?: string[];
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

interface RcaReport {
  id: string;
  title: string;
  category: string;
  severity: string;
  locationZone: string;
  severityScore: number;
  aiSummary: string;
  probableRootCause: string;
  contributingFactors: string[];
  capaRecommendations: string[];
  regulatoryImpact: string;
  createdAt: any;
}

interface HazardPrediction {
  id: string;
  craneIntensity: string;
  windShear: number;
  workerDensity: string;
  nightShift: boolean;
  zoneForecasts: {
    zone: string;
    riskScore: number;
    trend: 'Increasing' | 'Stable' | 'Decreasing';
    mainFactor: string;
  }[];
  createdAt: any;
}

interface BiSynthesis {
  id: string;
  prompt: string;
  dateRange: string;
  synthesis: string;
  keyMetrics: {
    safetyCompliance: number;
    productivityIndex: number;
    trirRate: number;
    activeReadersUptime: number;
  };
  anomaliesDetected: string[];
  createdAt: any;
}

interface CopilotMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  suggestedActions?: string[];
}

interface CopilotSession {
  id: string;
  sessionTitle: string;
  messages: CopilotMessage[];
  createdAt: any;
}

export default function AIInsightsTab({ people = [] }: AIInsightsTabProps) {
  // Navigation & Sub-view states
  const [activeSection, setActiveSection] = useState<
    'insights' | 'copilot' | 'briefing' | 'rca' | 'simulator' | 'bi_synthesis'
  >('insights');
  const [dataTab, setDataTab] = useState<'live' | 'history'>('live');

  // Real-time reader scans & history
  const { tags: liveTags, error: liveError, isLoading: liveLoading } = useGaoRealtime(3000);
  const { records: historyRecords, isLoading: historyLoading, error: historyError } = useGaoHistory(0, 20);

  // WebSocket connection for zero-latency alert dispatch
  const { isConnected: isWsConnected, triggerSafetyAlert: wsTriggerSafetyAlert } = useWebSocket();

  // Primary Gemini report state
  const [report, setReport] = useState<GeminiReport | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  // Toast feedback state
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'info' | 'error'; text: string } | null>(null);

  // --- MongoDB Persisted Collections ---
  const [savedRecommendations, setSavedRecommendations] = useState<PersistedRecommendation[]>([]);
  const [savedRcaReports, setSavedRcaReports] = useState<RcaReport[]>([]);
  const [savedPredictions, setSavedPredictions] = useState<HazardPrediction[]>([]);
  const [savedBiSyntheses, setSavedBiSyntheses] = useState<BiSynthesis[]>([]);
  const [savedCopilotSessions, setSavedCopilotSessions] = useState<CopilotSession[]>([]);

  // AI Copilot Chat state
  const [copilotQuestion, setCopilotQuestion] = useState('');
  const [isCopilotThinking, setIsCopilotThinking] = useState(false);
  const [chatHistory, setChatHistory] = useState<CopilotMessage[]>([
    {
      id: 'init-1',
      sender: 'ai',
      text: '👋 **Hello! I am your GAO AI Site Safety & Operational Copilot.**\n\nI continuously monitor active RFID tag dwells, antenna RSSI metrics, and site exclusion zones in real time.\n\nAsk me any question about lone worker safety, scaffolding overcrowding, PPE compliance, or crane exclusion zones!',
      timestamp: new Date().toLocaleTimeString(),
      suggestedActions: [
        'Check Crane Exclusion Zone Breaches',
        'Predict Scaffolding Congestion',
        'Audit Subcontractor PPE Compliance',
        'Generate EHS Shift Briefing'
      ]
    }
  ]);

  // AI RCA Form & State
  const [rcaTitle, setRcaTitle] = useState('Crane Exclusion Zone Breach & Signal Loss');
  const [rcaCategory, setRcaCategory] = useState('Exclusion Zone Breach');
  const [rcaSeverity, setRcaSeverity] = useState('Critical');
  const [rcaLocation, setRcaLocation] = useState('Heavy Crane Swing Zone A');
  const [rcaEquipment, setRcaEquipment] = useState('Liebherr 250t Tower Crane & Reader Portal 04');
  const [rcaDescription, setRcaDescription] = useState('Subcontractor personnel entered crane swing perimeter without active high-risk permit verification during active overhead steel truss lift.');
  const [isAnalyzingRca, setIsAnalyzingRca] = useState(false);
  const [currentRcaResult, setCurrentRcaResult] = useState<Partial<RcaReport> | null>(null);

  // Predictive Hazard Simulator State
  const [simCraneIntensity, setSimCraneIntensity] = useState<'High' | 'Moderate' | 'Low'>('High');
  const [simWindShear, setSimWindShear] = useState<number>(24);
  const [simWorkerDensity, setSimWorkerDensity] = useState<'Overcrowded' | 'Normal' | 'Sparse'>('Overcrowded');
  const [simNightShift, setSimNightShift] = useState<boolean>(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [currentSimResult, setCurrentSimResult] = useState<HazardPrediction | null>(null);

  // BI Synthesizer State
  const [biPrompt, setBiPrompt] = useState('Synthesize worker attendance productivity, scaffolding dwell times, and PPE compliance over the past 7 days.');
  const [biDateRange, setBiDateRange] = useState<'24h' | '7d' | '30d'>('7d');
  const [biSelectedSite, setBiSelectedSite] = useState('Metro Commercial Tower');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [currentBiResult, setCurrentBiResult] = useState<BiSynthesis | null>(null);

  // Helper: Trigger Toast Notification
  const showToast = (type: 'success' | 'info' | 'error', text: string) => {
    setToastMsg({ type, text });
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Map Tag ID to Name and Role
  const resolvePerson = (tagId: string) => {
    if (!people || people.length === 0) return null;
    return people.find(p => p.id?.toLowerCase() === tagId?.toLowerCase());
  };

  // 1. Fetch persistent collection streams from MongoDB / Firestore
  useEffect(() => {
    // 1.1 Saved Recommendations
    const qRecs = query(collection(db, 'ai_recommendations'), orderBy('appliedAt', 'desc'));
    const unsubRecs = onSnapshot(qRecs, (snapshot) => {
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
    }, (err) => console.error("Error reading ai_recommendations:", err));

    // 1.2 Saved RCA Reports
    const qRca = query(collection(db, 'ai_rca_reports'), orderBy('createdAt', 'desc'));
    const unsubRca = onSnapshot(qRca, (snapshot) => {
      const list: RcaReport[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          title: data.title,
          category: data.category,
          severity: data.severity,
          locationZone: data.locationZone,
          severityScore: data.severityScore,
          aiSummary: data.aiSummary,
          probableRootCause: data.probableRootCause,
          contributingFactors: data.contributingFactors || [],
          capaRecommendations: data.capaRecommendations || [],
          regulatoryImpact: data.regulatoryImpact,
          createdAt: data.createdAt
        });
      });
      setSavedRcaReports(list);
    }, (err) => console.error("Error reading ai_rca_reports:", err));

    // 1.3 Saved Hazard Predictions
    const qPred = query(collection(db, 'ai_hazard_predictions'), orderBy('createdAt', 'desc'));
    const unsubPred = onSnapshot(qPred, (snapshot) => {
      const list: HazardPrediction[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          craneIntensity: data.craneIntensity,
          windShear: data.windShear,
          workerDensity: data.workerDensity,
          nightShift: data.nightShift,
          zoneForecasts: data.zoneForecasts || [],
          createdAt: data.createdAt
        });
      });
      setSavedPredictions(list);
    }, (err) => console.error("Error reading ai_hazard_predictions:", err));

    // 1.4 Saved BI Syntheses
    const qBi = query(collection(db, 'analytics_metrics'), orderBy('createdAt', 'desc'));
    const unsubBi = onSnapshot(qBi, (snapshot) => {
      const list: BiSynthesis[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.synthesis) {
          list.push({
            id: d.id,
            prompt: data.prompt,
            dateRange: data.dateRange,
            synthesis: data.synthesis,
            keyMetrics: data.keyMetrics || { safetyCompliance: 98, productivityIndex: 92, trirRate: 0.12, activeReadersUptime: 99.9 },
            anomaliesDetected: data.anomaliesDetected || [],
            createdAt: data.createdAt
          });
        }
      });
      setSavedBiSyntheses(list);
    }, (err) => console.error("Error reading analytics_metrics:", err));

    // 1.5 Saved Copilot Sessions
    const qChat = query(collection(db, 'ai_copilot_chats'), orderBy('createdAt', 'desc'));
    const unsubChat = onSnapshot(qChat, (snapshot) => {
      const list: CopilotSession[] = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          id: d.id,
          sessionTitle: data.sessionTitle,
          messages: data.messages || [],
          createdAt: data.createdAt
        });
      });
      setSavedCopilotSessions(list);
    }, (err) => console.error("Error reading ai_copilot_chats:", err));

    return () => {
      unsubRecs();
      unsubRca();
      unsubPred();
      unsubBi();
      unsubChat();
    };
  }, []);

  // Run Gemini analysis through our direct server endpoint
  const runAiAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
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

      const response = await fetch('/api/analyze-rfid-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          liveTags: enrichedLiveTags,
          historyRecords: enrichedHistory,
          context: 'Metro Commercial Tower Construction Site'
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned code ${response.status}`);
      }

      const result: GeminiReport = await response.json();
      setReport(result);

      // Save analysis summary to MongoDB `ai_insights_history`
      await addDoc(collection(db, 'ai_insights_history'), {
        summary: result.executiveSummary,
        safetyComplianceScore: result.safetyComplianceScore,
        anomaliesCount: result.anomalies.length,
        createdAt: serverTimestamp()
      });

      showToast('success', 'Gemini AI site safety analysis completed and persisted to MongoDB!');
    } catch (e: any) {
      console.error("AI Reader diagnostic failed:", e);
      setAnalysisError(e.message || "Failed to communicate with Gemini API backend server.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Run initial AI analysis automatically on mount
  useEffect(() => {
    if (!report && !isAnalyzing) {
      runAiAnalysis();
    }
  }, []);

  // Handle Copilot Question Submission
  const handleAskCopilot = async (questionText?: string) => {
    const q = (questionText || copilotQuestion).trim();
    if (!q || isCopilotThinking) return;

    const userMsg: CopilotMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString()
    };

    const newHistory = [...chatHistory, userMsg];
    setChatHistory(newHistory);
    setCopilotQuestion('');
    setIsCopilotThinking(true);

    try {
      const response = await fetch('/api/ai-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          context: {
            activeTagCount: liveTags.length,
            historyCount: historyRecords?.length || 0,
            reportSummary: report?.executiveSummary,
            anomaliesCount: report?.anomalies?.length || 0
          }
        })
      });

      const data = await response.json();

      const aiMsg: CopilotMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: data.answer || 'Analysis completed.',
        timestamp: new Date().toLocaleTimeString(),
        suggestedActions: data.suggestedActions
      };

      setChatHistory([...newHistory, aiMsg]);
    } catch (err) {
      console.error('Failed to ask AI Copilot:', err);
      setChatHistory(prev => [...prev, {
        id: `err-${Date.now()}`,
        sender: 'ai',
        text: '⚠️ **Communication Error**: Unable to reach AI Copilot backend server. Please check your network connection.',
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setIsCopilotThinking(false);
    }
  };

  // Save current Copilot Chat Session to MongoDB
  const handleSaveCopilotSession = async () => {
    if (chatHistory.length <= 1) return;
    try {
      const sessionTitle = chatHistory.find(m => m.sender === 'user')?.text.slice(0, 40) || 'AI Safety Consultation';
      await addDoc(collection(db, 'ai_copilot_chats'), {
        sessionTitle,
        messages: chatHistory,
        createdAt: serverTimestamp()
      });
      showToast('success', `Saved Copilot session "${sessionTitle}" to MongoDB database.`);
    } catch (e) {
      console.error("Failed to save copilot session:", e);
      showToast('error', "Could not save session to MongoDB.");
    }
  };

  // Persist a recommended optimization in MongoDB
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
      
      await addDoc(collection(db, 'alerts'), {
        type: 'info',
        message: `Applied AI Optimization suggestion: "${opt.title}"`,
        timestamp: new Date().toISOString()
      });

      showToast('success', `Saved directive "${opt.title}" to MongoDB database.`);
    } catch (e) {
      console.error("Could not save recommendation:", e);
      showToast('error', 'Failed to save directive to MongoDB.');
    }
  };

  // Delete a recommendation from MongoDB
  const handleRemoveRecommendation = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'ai_recommendations', id));
      showToast('info', 'Directive removed from MongoDB database.');
    } catch (e) {
      console.error("Failed to delete recommendation:", e);
    }
  };

  // Log anomaly into incident database & trigger zero-latency panic if high risk
  const logAnomalyAsIncident = async (anomaly: GeminiAnomaly) => {
    try {
      await addDoc(collection(db, 'incidents'), {
        title: `AI Flagged Anomaly: ${anomaly.title}`,
        severity: anomaly.severity === 'HIGH' ? 'Critical' : anomaly.severity === 'MEDIUM' ? 'Major' : 'Minor',
        status: 'Open',
        officer: 'Marcus Vance (EHS Lead)',
        location: anomaly.zone || 'Multiple Zones',
        notes: `UHF Tag Scan issue detected for ${anomaly.name || 'Tag ' + anomaly.tagId}. Details: ${anomaly.description}`,
        createdAt: serverTimestamp()
      });

      await addDoc(collection(db, 'alerts'), {
        type: anomaly.severity === 'HIGH' ? 'security' : 'warning',
        message: `SEC EVENT FLAGGED: ${anomaly.title} (${anomaly.zone || 'General Area'})`,
        timestamp: new Date().toISOString()
      });

      if (anomaly.severity === 'HIGH') {
        wsTriggerSafetyAlert(
          `🚨 CRITICAL AI ANOMALY: ${anomaly.title}`,
          anomaly.zone || 'Exclusion Perimeter',
          'critical'
        );
      }

      showToast('success', `Logged Incident "${anomaly.title}" into MongoDB Incidents collection.`);
    } catch (e) {
      console.error("Could not log incident:", e);
      showToast('error', 'Failed to register incident in MongoDB.');
    }
  };

  // Run AI Root Cause Analysis (RCA)
  const handleRunRca = async () => {
    setIsAnalyzingRca(true);
    try {
      const response = await fetch('/api/analyze-incident', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: rcaTitle,
          category: rcaCategory,
          severity: rcaSeverity,
          locationZone: rcaLocation,
          equipmentInvolved: rcaEquipment,
          description: rcaDescription
        })
      });

      const data = await response.json();
      setCurrentRcaResult({
        title: rcaTitle,
        category: rcaCategory,
        severity: rcaSeverity,
        locationZone: rcaLocation,
        severityScore: data.severityScore,
        aiSummary: data.aiSummary,
        probableRootCause: data.probableRootCause,
        contributingFactors: data.contributingFactors,
        capaRecommendations: data.capaRecommendations,
        regulatoryImpact: data.regulatoryImpact
      });

      showToast('success', 'AI Root Cause Analysis completed!');
    } catch (e) {
      console.error("Failed to run RCA:", e);
      showToast('error', 'RCA calculation failed.');
    } finally {
      setIsAnalyzingRca(false);
    }
  };

  // Save RCA Report to MongoDB
  const handleSaveRcaToMongo = async () => {
    if (!currentRcaResult) return;
    try {
      await addDoc(collection(db, 'ai_rca_reports'), {
        ...currentRcaResult,
        createdAt: serverTimestamp()
      });
      showToast('success', `Saved RCA Report "${currentRcaResult.title}" to MongoDB database.`);
    } catch (e) {
      console.error("Failed to save RCA report:", e);
      showToast('error', 'Could not save RCA report to MongoDB.');
    }
  };

  // Delete RCA Report from MongoDB
  const handleDeleteRca = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'ai_rca_reports', id));
      showToast('info', 'RCA report removed from MongoDB.');
    } catch (e) {
      console.error("Failed to delete RCA:", e);
    }
  };

  // Run Predictive Hazard Simulator
  const handleRunHazardSimulation = async () => {
    setIsSimulating(true);
    try {
      // Calculate realistic forecast risks based on parameters
      const craneFactor = simCraneIntensity === 'High' ? 25 : simCraneIntensity === 'Moderate' ? 12 : 5;
      const windFactor = simWindShear > 30 ? 30 : simWindShear > 20 ? 15 : 5;
      const densityFactor = simWorkerDensity === 'Overcrowded' ? 20 : simWorkerDensity === 'Normal' ? 10 : 2;
      const nightFactor = simNightShift ? 15 : 0;

      const craneRisk = Math.min(98, 40 + craneFactor + densityFactor + nightFactor);
      const scaffoldRisk = Math.min(95, 30 + windFactor + densityFactor);
      const shaftRisk = Math.min(90, 20 + densityFactor + nightFactor);

      const simData: HazardPrediction = {
        id: `sim-${Date.now()}`,
        craneIntensity: simCraneIntensity,
        windShear: simWindShear,
        workerDensity: simWorkerDensity,
        nightShift: simNightShift,
        zoneForecasts: [
          {
            zone: 'Heavy Crane Lift Perimeter',
            riskScore: craneRisk,
            trend: craneRisk > 70 ? 'Increasing' : 'Stable',
            mainFactor: `${simCraneIntensity} crane swing lifts with ${simWorkerDensity.toLowerCase()} deck density`
          },
          {
            zone: 'Scaffolding Tiers 3 & 4',
            riskScore: scaffoldRisk,
            trend: scaffoldRisk > 65 ? 'Increasing' : 'Stable',
            mainFactor: `Wind shear recorded at ${simWindShear} km/h near perimeter`
          },
          {
            zone: 'Underground Tunnel Shaft B',
            riskScore: shaftRisk,
            trend: shaftRisk > 50 ? 'Increasing' : 'Decreasing',
            mainFactor: simNightShift ? 'Reduced lighting & lone worker dwell interval' : 'Optimal airflow and ventilation'
          }
        ],
        createdAt: new Date().toISOString()
      };

      setCurrentSimResult(simData);
      showToast('success', 'Predictive Hazard Radar updated!');
    } finally {
      setIsSimulating(false);
    }
  };

  // Save Predictive Hazard Report to MongoDB
  const handleSavePredictionToMongo = async () => {
    if (!currentSimResult) return;
    try {
      await addDoc(collection(db, 'ai_hazard_predictions'), {
        craneIntensity: currentSimResult.craneIntensity,
        windShear: currentSimResult.windShear,
        workerDensity: currentSimResult.workerDensity,
        nightShift: currentSimResult.nightShift,
        zoneForecasts: currentSimResult.zoneForecasts,
        createdAt: serverTimestamp()
      });
      showToast('success', 'Saved Predictive Hazard Forecast to MongoDB!');
    } catch (e) {
      console.error("Failed to save hazard forecast:", e);
      showToast('error', 'Failed to save forecast to MongoDB.');
    }
  };

  // Run Custom AI BI Telemetry Synthesizer
  const handleRunBiSynthesis = async () => {
    setIsSynthesizing(true);
    try {
      const response = await fetch('/api/analyze-telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: biPrompt,
          dateRange: biDateRange,
          selectedSite: biSelectedSite,
          metricsContext: {
            activeTagCount: liveTags.length,
            historyCount: historyRecords.length
          }
        })
      });

      const data = await response.json();
      const biObj: BiSynthesis = {
        id: `bi-${Date.now()}`,
        prompt: biPrompt,
        dateRange: biDateRange,
        synthesis: data.synthesis,
        keyMetrics: data.keyMetrics || { safetyCompliance: 98.4, productivityIndex: 92.1, trirRate: 0.12, activeReadersUptime: 99.9 },
        anomaliesDetected: data.anomaliesDetected || [],
        createdAt: new Date().toISOString()
      };

      setCurrentBiResult(biObj);
      showToast('success', 'AI Telemetry Synthesis completed!');
    } catch (e) {
      console.error("Failed BI synthesis:", e);
      showToast('error', 'Telemetry synthesis failed.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Save BI Synthesis to MongoDB
  const handleSaveBiToMongo = async () => {
    if (!currentBiResult) return;
    try {
      await addDoc(collection(db, 'analytics_metrics'), {
        prompt: currentBiResult.prompt,
        dateRange: currentBiResult.dateRange,
        synthesis: currentBiResult.synthesis,
        keyMetrics: currentBiResult.keyMetrics,
        anomaliesDetected: currentBiResult.anomaliesDetected,
        createdAt: serverTimestamp()
      });
      showToast('success', 'Saved BI Synthesis Report to MongoDB!');
    } catch (e) {
      console.error("Failed to save BI report:", e);
      showToast('error', 'Could not save BI report to MongoDB.');
    }
  };

  // Export Briefing or RCA to PDF
  const handleExportBriefingPDF = () => {
    const reportTitle = "AI Executive EHS Safety & Personnel Audit Briefing";
    const subtitle = "Metro Commercial Tower - EHS Shift Audit";
    const dataToExport = (report?.anomalies || []).map(an => ({
      Category: 'Anomaly',
      Zone: an.zone || 'Site Wide',
      Severity: an.severity,
      Title: an.title,
      Description: an.description,
      Personnel: an.name || an.tagId
    }));

    const columns = [
      { key: 'Category', label: 'TYPE' },
      { key: 'Zone', label: 'ZONE' },
      { key: 'Severity', label: 'SEVERITY' },
      { key: 'Title', label: 'INCIDENT TITLE' },
      { key: 'Description', label: 'AI ANALYSIS DETAILS' }
    ];

    const metrics = [
      { label: 'COMPLIANCE SCORE', value: `${report?.safetyComplianceScore || 94}%` },
      { label: 'FLAGGED ANOMALIES', value: dataToExport.length },
      { label: 'ACTIVE READER ANOMALIES', value: liveTags.length },
      { label: 'MONGODB RULES ACTIVE', value: savedRecommendations.length }
    ];

    generatePDFReport(reportTitle, subtitle, columns, dataToExport, metrics);
  };

  return (
    <div className="flex flex-col p-4 md:p-6 max-w-7xl mx-auto w-full gap-6">
      
      {/* Toast Notification Banner */}
      {toastMsg && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-lg animate-in fade-in slide-in-from-top duration-300 ${
          toastMsg.type === 'success' 
            ? 'bg-emerald-600 text-white border-emerald-700' 
            : toastMsg.type === 'error'
            ? 'bg-rose-600 text-white border-rose-700'
            : 'bg-indigo-600 text-white border-indigo-700'
        }`}>
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="animate-spin" />
            <span>{toastMsg.text}</span>
          </div>
          <button onClick={() => setToastMsg(null)} className="font-bold underline text-[10px] cursor-pointer">Dismiss</button>
        </div>
      )}

      {/* Top Header & Navigation Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-7 h-7 text-indigo-500 fill-indigo-100 animate-pulse" />
              AI Intelligence & Safety Center
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Gemini 3.6 Flash Active
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 border ${
              isWsConnected 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
            }`}>
              <Wifi size={12} className={isWsConnected ? 'text-emerald-500 animate-pulse' : 'text-amber-500'} />
              {isWsConnected ? '0ms WS Live Sync' : 'WS Reconnecting'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <Database size={11} /> MongoDB gao_rfid Connected
            </span>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium text-xs md:text-sm mt-1">
            Real-time RFID telemetry diagnostics, zero-latency safety predictions, Root Cause Analysis (RCA), and AI Copilot
          </p>
        </div>

        {/* Action Controls & Navigation Tabs */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 flex-wrap">
            <button
              onClick={() => setActiveSection('insights')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeSection === 'insights'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Activity size={14} /> Safety Insights
            </button>
            <button
              onClick={() => setActiveSection('copilot')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeSection === 'copilot'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Bot size={14} /> AI Copilot
            </button>
            <button
              onClick={() => setActiveSection('rca')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeSection === 'rca'
                  ? 'bg-white dark:bg-slate-700 text-rose-600 dark:text-rose-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Microscope size={14} /> Root Cause (RCA)
            </button>
            <button
              onClick={() => setActiveSection('simulator')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeSection === 'simulator'
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Sliders size={14} /> Risk Simulator
            </button>
            <button
              onClick={() => setActiveSection('bi_synthesis')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeSection === 'bi_synthesis'
                  ? 'bg-white dark:bg-slate-700 text-teal-600 dark:text-teal-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <BrainCircuit size={14} /> BI Synthesizer
            </button>
            <button
              onClick={() => setActiveSection('briefing')}
              className={`px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeSection === 'briefing'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FileText size={14} /> Shift Briefing
            </button>
          </div>

          <button
            onClick={runAiAnalysis}
            disabled={isAnalyzing}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition disabled:opacity-75 cursor-pointer"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Scanning...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4 fill-white animate-pulse" />
                Re-Analyze AI
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Stats Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Compliance</div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {report?.safetyComplianceScore || 94}%
              </div>
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg">Optimal</span>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400 rounded-xl">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">AI Anomalies</div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {report?.anomalies?.length || 0} Flagged
              </div>
            </div>
          </div>
          <span className="text-[10px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-lg">High Risk</span>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400 rounded-xl">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Active Tags</div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {liveTags?.length || 0} Scans
              </div>
            </div>
          </div>
          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-lg">0ms WS</span>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Directives</div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {savedRecommendations.length} Saved
              </div>
            </div>
          </div>
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-lg">MongoDB</span>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3.5 rounded-2xl shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400 rounded-xl">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">RCA Reports</div>
              <div className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {savedRcaReports.length} Mongo
              </div>
            </div>
          </div>
          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-lg">ISO 45001</span>
        </div>
      </div>

      {/* SECTION 1: AI SAFETY INSIGHTS & DIAGNOSTICS */}
      {activeSection === 'insights' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Live Reader Stream & MongoDB Saved Directives */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* UHF Reader Stream Card */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4 mb-4">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base">Aperture RFID Reader Telemetry</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Raw reader antenna transmission stream.</p>
                </div>
                
                <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                  <button
                    onClick={() => setDataTab('live')}
                    className={`text-xs font-bold px-3 py-1.5 rounded-md transition ${dataTab === 'live' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
                  >
                    Live (Aperture)
                  </button>
                  <button
                    onClick={() => setDataTab('history')}
                    className={`text-xs font-bold px-3 py-1.5 rounded-md transition ${dataTab === 'history' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}
                  >
                    Database
                  </button>
                </div>
              </div>

              {/* Live Tags Stream */}
              {dataTab === 'live' && (
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                  {liveLoading && liveTags.length === 0 && (
                    <div className="text-center py-10 text-xs text-slate-400 font-semibold flex flex-col items-center gap-2">
                      <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                      Querying live Aperture antenna stream...
                    </div>
                  )}
                  {liveTags.map((tag, i) => {
                    const matched = resolvePerson(tag.TagID);
                    return (
                      <div 
                        key={i} 
                        className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 rounded-xl flex flex-col gap-1 hover:border-indigo-200 dark:hover:border-indigo-900/50 transition shadow-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] font-bold text-slate-400 bg-slate-200/50 dark:bg-slate-700 px-1.5 py-0.5 rounded truncate max-w-[150px]">
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
                          <Badge variant="outline" className="text-[10px] bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 text-indigo-800 dark:text-indigo-300 rounded font-black uppercase">
                            {tag.Location}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                  {liveTags.length === 0 && !liveLoading && (
                    <div className="text-center py-10 text-slate-400 text-xs font-semibold">
                      No live RFID antenna scans detected.
                    </div>
                  )}
                </div>
              )}

              {/* Database Records */}
              {dataTab === 'history' && (
                <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                  {(historyRecords || []).map((rec, i) => (
                    <div 
                      key={i} 
                      className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/50 rounded-xl flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[9px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-100/30 dark:bg-indigo-950/50 px-2 py-0.5 rounded">
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
                        <span className="bg-slate-200/60 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-extrabold px-2 py-0.5 rounded text-[10px] uppercase">
                          {rec.LocationName}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Saved Directives in MongoDB */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 shadow-sm">
              <h3 className="font-black text-sm text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Applied Directives in MongoDB (gao_rfid)
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">
                Active rules persisted in MongoDB collection <code className="text-indigo-500 font-mono">ai_recommendations</code>.
              </p>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {savedRecommendations.map((opt) => (
                  <div 
                    key={opt.id} 
                    className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-2xl p-3.5 flex flex-col justify-between relative group hover:shadow transition"
                  >
                    <button 
                      onClick={() => handleRemoveRecommendation(opt.id)}
                      className="absolute top-3 right-3 text-slate-400 hover:text-rose-500 p-1 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition cursor-pointer"
                      title="Delete directive from MongoDB"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <div className="pr-6">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <Badge className="text-[9px] font-black bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300 rounded">
                          {opt.category}
                        </Badge>
                        <Badge className="text-[9px] font-black bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300 rounded">
                          IMPACT: {opt.impact}
                        </Badge>
                      </div>
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs mb-1">{opt.title}</h4>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium leading-relaxed mb-2">{opt.description}</p>
                    </div>
                  </div>
                ))}

                {savedRecommendations.length === 0 && (
                  <div className="text-center py-8 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-slate-400 text-xs font-semibold">
                    No active rules saved in MongoDB yet.<br/>Use "Save Rule" on AI recommendations.
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* Right Column: AI Executive Analysis, Anomaly Radar & Risk Predictions */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Diagnostic Failure Banner */}
            {analysisError && (
              <div className="bg-rose-50 border border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/50 p-4 rounded-2xl text-xs font-semibold text-rose-500 shadow-sm flex items-start gap-3">
                <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-sm">Gemini Analysis Warning</div>
                  <div>{analysisError}</div>
                </div>
              </div>
            )}

            {/* AI Executive Intelligence Summary */}
            {report && (
              <div className="bg-gradient-to-br from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-400 fill-indigo-400/20" />
                    Gemini Executive EHS Safety Assessment
                  </span>
                  <Badge className="bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 text-[10px] font-bold">
                    Score: {report.safetyComplianceScore || 94}%
                  </Badge>
                </div>
                <p className="text-sm text-indigo-100 font-medium leading-relaxed bg-white/10 dark:bg-slate-900/60 p-4 rounded-2xl border border-white/10 backdrop-blur-sm">
                  {report.executiveSummary}
                </p>
              </div>
            )}

            {/* Predictive Risk Radar per Zone */}
            {report?.riskForecasts && report.riskForecasts.length > 0 && (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
                <h4 className="font-bold text-slate-900 dark:text-white text-base mb-1 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-amber-500" />
                  Predictive Zone Hazard & Risk Radar
                </h4>
                <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">
                  AI-forecasted risk probabilities based on worker density, dwell hours, and crane operations.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {report.riskForecasts.map((rf, idx) => (
                    <div key={idx} className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700 rounded-2xl flex flex-col justify-between gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 dark:text-white truncate">{rf.zone}</span>
                        <Badge className={`text-[9px] font-extrabold ${
                          rf.riskScore > 70 ? 'bg-rose-100 text-rose-800' : rf.riskScore > 50 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          Risk: {rf.riskScore}%
                        </Badge>
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">
                        Factor: <span className="text-slate-700 dark:text-slate-300 font-bold">{rf.mainFactor}</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-slate-200/40">
                        <span>Trend:</span>
                        <span className={`font-bold ${rf.trend === 'Increasing' ? 'text-rose-500' : 'text-emerald-500'}`}>{rf.trend}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Anomalies Detected Panel */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rose-500" />
                  Flagged Flow & Safety Anomalies
                </h4>
                <Badge variant="outline" className="text-[10px] font-bold border-rose-200 text-rose-600 bg-rose-50">
                  {report?.anomalies?.length || 0} Incident(s)
                </Badge>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">
                Identified exclusion breaches, stationary lone workers, or RFID signal anomalies.
              </p>

              <div className="space-y-3">
                {report?.anomalies?.map((an, i) => (
                  <div 
                    key={i} 
                    className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-rose-200 transition"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={`text-[9px] font-black rounded ${
                          an.severity === 'HIGH' ? 'bg-rose-100 text-rose-800' :
                          an.severity === 'MEDIUM' ? 'bg-amber-100 text-amber-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {an.severity} SEVERITY
                        </Badge>
                        {an.zone && (
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                            Zone: {an.zone}
                          </span>
                        )}
                      </div>
                      <h5 className="font-bold text-slate-900 dark:text-white text-sm">{an.title}</h5>
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{an.description}</p>
                      <div className="text-[10px] text-slate-400 font-mono font-bold">
                        Tag: {an.tagId} {an.name ? `| Resolved: ${an.name}` : ''}
                      </div>
                    </div>

                    <button
                      onClick={() => logAnomalyAsIncident(an)}
                      className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2 px-3.5 rounded-xl transition shrink-0 uppercase tracking-wider shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <Siren size={14} /> Log Incident to MongoDB
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Hardware & Optimization Tuning */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
              <h4 className="font-black text-slate-900 dark:text-white text-base mb-1 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-teal-500" />
                Antenna Placement & Operational Tuning
              </h4>
              <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">
                Recommended hardware tuning, shift schedule offsets, and zone threshold parameters.
              </p>

              <div className="space-y-3">
                {report?.optimizations?.map((opt, i) => (
                  <div key={i} className="border border-slate-100 dark:border-slate-700 rounded-2xl p-4 bg-slate-50/50 dark:bg-slate-800/20">
                    <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className="text-[9px] font-black bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                          {opt.category}
                        </Badge>
                        <Badge variant="outline" className="text-[9.5px] rounded bg-teal-50 text-teal-700 border-teal-200">
                          IMPACT: {opt.impact}
                        </Badge>
                      </div>
                      
                      <button
                        onClick={() => handleSaveRecommendation(opt)}
                        className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition uppercase tracking-wider text-[10px] cursor-pointer"
                      >
                        <PlusCircle className="w-3.5 h-3.5" /> Save Rule to Mongo
                      </button>
                    </div>

                    <h5 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{opt.title}</h5>
                    <p className="text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed mb-2">{opt.description}</p>
                    
                    <div className="p-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl font-mono text-[11px] text-slate-800 dark:text-slate-200 font-semibold">
                      {opt.actionableSteps}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Personnel Activity Classifier Profiles */}
            {report?.personnelEfficiency && (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
                <h4 className="font-bold text-slate-900 dark:text-white text-base mb-1 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-500" />
                  Personnel Activity Classifier (Dwell Heatmaps)
                </h4>
                <p className="text-slate-500 dark:text-slate-400 text-xs mb-4">
                  Inferred tasks resolved dynamically using chronologic RFID antenna dwells.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {report.personnelEfficiency.map((pe, i) => (
                    <div key={i} className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-150 dark:border-slate-700 rounded-2xl flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-black text-slate-800 dark:text-white text-xs">{pe.name || pe.tagId}</span>
                          <span className="text-[10px] font-bold text-slate-400 font-mono">{pe.tagId.substring(0,6)}</span>
                        </div>
                        <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/40 p-2 rounded-lg border border-indigo-100/40 mb-2">
                          {pe.inferredActivity}
                        </p>
                        {pe.dwellTimeInfo && (
                          <span className="text-[10px] text-slate-400 block font-medium">{pe.dwellTimeInfo}</span>
                        )}
                      </div>

                      <div className="mt-3 pt-2 border-t border-slate-200/40">
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mb-1">
                          <span>ACTIVITY DENSITY SCORE</span>
                          <span className="text-indigo-600 dark:text-indigo-400">{pe.efficiencyScore}%</span>
                        </div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-indigo-600 h-1.5 rounded-full" style={{ width: `${pe.efficiencyScore || 85}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {/* SECTION 2: INTERACTIVE AI SAFETY COPILOT CHAT */}
      {activeSection === 'copilot' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm flex flex-col min-h-[550px]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-md">
                  <Bot className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Gemini 3.6 Flash Site Safety Copilot</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Ask natural language questions about site compliance, worker dwells, and exclusion zones.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveCopilotSession}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 shadow transition cursor-pointer"
                >
                  <Save size={13} /> Save Session to Mongo
                </button>
              </div>
            </div>

            {/* Quick Prompt Chips */}
            <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
              <span className="text-[11px] font-black uppercase text-slate-400 shrink-0">Quick Queries:</span>
              {[
                'Check Crane Exclusion Zone Breaches',
                'Predict Scaffolding Congestion',
                'Audit Subcontractor PPE Compliance',
                'Generate EHS Shift Briefing'
              ].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAskCopilot(chip)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-50 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 hover:text-indigo-600 text-xs font-bold rounded-xl whitespace-nowrap transition border border-slate-200 dark:border-slate-600 shrink-0 cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Chat Message History */}
            <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 overflow-y-auto space-y-4 border border-slate-100 dark:border-slate-700/50 max-h-[400px]">
              {chatHistory.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-[85%] ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                    msg.sender === 'user' ? 'bg-slate-900 text-white' : 'bg-indigo-600 text-white shadow'
                  }`}>
                    {msg.sender === 'user' ? 'YOU' : <Bot size={18} />}
                  </div>

                  <div className={`p-4 rounded-2xl text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-indigo-600 text-white font-medium rounded-tr-none'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 shadow-sm rounded-tl-none space-y-2'
                  }`}>
                    <div className="whitespace-pre-line">{msg.text}</div>

                    {msg.suggestedActions && msg.suggestedActions.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400 block w-full uppercase">Suggested Actions:</span>
                        {msg.suggestedActions.map((act, i) => (
                          <button
                            key={i}
                            onClick={() => handleAskCopilot(act)}
                            className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-extrabold text-[10px] rounded-lg border border-indigo-200/50 hover:bg-indigo-100 transition cursor-pointer"
                          >
                            → {act}
                          </button>
                        ))}
                      </div>
                    )}

                    <span className="text-[9px] opacity-60 block text-right mt-1 font-mono">{msg.timestamp}</span>
                  </div>
                </div>
              ))}

              {isCopilotThinking && (
                <div className="flex gap-3 max-w-[80%]">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <Bot size={18} />
                  </div>
                  <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-bold text-indigo-600 flex items-center gap-2 shadow-sm">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gemini 3.6 Flash analyzing site telemetry...
                  </div>
                </div>
              )}
            </div>

            {/* Question Input Box */}
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={copilotQuestion}
                onChange={(e) => setCopilotQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskCopilot()}
                placeholder="Ask AI Copilot: 'Are any lone workers stationary in underground shaft B?'..."
                className="flex-1 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={() => handleAskCopilot()}
                disabled={isCopilotThinking || !copilotQuestion.trim()}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-bold text-xs flex items-center gap-2 shadow-md transition cursor-pointer"
              >
                <Send size={15} /> Send
              </button>
            </div>
          </div>

          {/* Saved Copilot Chat Sessions from MongoDB */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-5 shadow-sm space-y-4">
            <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <History size={16} className="text-indigo-500" />
              Saved Copilot Sessions in MongoDB
            </h4>
            <p className="text-xs text-slate-500">Archived AI consultation history from <code className="text-indigo-500 font-mono">ai_copilot_chats</code>.</p>

            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {savedCopilotSessions.map(session => (
                <div key={session.id} className="p-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700 rounded-2xl space-y-1 hover:border-indigo-300 transition">
                  <div className="font-bold text-xs text-slate-800 dark:text-white truncate">{session.sessionTitle}</div>
                  <div className="text-[10px] text-slate-400 flex justify-between items-center font-mono">
                    <span>{session.messages?.length || 0} messages</span>
                    <button
                      onClick={() => setChatHistory(session.messages)}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer"
                    >
                      Load Session →
                    </button>
                  </div>
                </div>
              ))}

              {savedCopilotSessions.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400 font-semibold border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                  No saved Copilot chat sessions in MongoDB.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: NEW FEATURE - AI ROOT CAUSE ANALYSIS (RCA) ENGINE */}
      {activeSection === 'rca' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* RCA Input Form */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Microscope className="w-5 h-5 text-rose-500" />
                AI Root Cause Analysis Generator
              </h3>
              <p className="text-xs text-slate-500">Run automated OSHA 1926 & ISO 45001 root cause calculations on site incidents.</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Incident Title</label>
                <input
                  type="text"
                  value={rcaTitle}
                  onChange={(e) => setRcaTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Category</label>
                  <select
                    value={rcaCategory}
                    onChange={(e) => setRcaCategory(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-bold text-slate-800 dark:text-slate-100"
                  >
                    <option>Exclusion Zone Breach</option>
                    <option>Stationary Lone Worker</option>
                    <option>Scaffolding Overcrowding</option>
                    <option>PPE Compliance Failure</option>
                    <option>Equipment Near-Miss</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Severity</label>
                  <select
                    value={rcaSeverity}
                    onChange={(e) => setRcaSeverity(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-bold text-slate-800 dark:text-slate-100"
                  >
                    <option>Critical</option>
                    <option>High</option>
                    <option>Medium</option>
                    <option>Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Location Zone</label>
                <input
                  type="text"
                  value={rcaLocation}
                  onChange={(e) => setRcaLocation(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Equipment Involved</label>
                <input
                  type="text"
                  value={rcaEquipment}
                  onChange={(e) => setRcaEquipment(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-medium"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Incident Description</label>
                <textarea
                  rows={3}
                  value={rcaDescription}
                  onChange={(e) => setRcaDescription(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-medium"
                />
              </div>

              <button
                onClick={handleRunRca}
                disabled={isAnalyzingRca}
                className="w-full bg-rose-600 hover:bg-rose-700 text-white font-bold py-3 rounded-2xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isAnalyzingRca ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Calculating OSHA Root Cause...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 fill-white animate-pulse" />
                    Generate AI Root Cause Analysis
                  </>
                )}
              </button>
            </div>
          </div>

          {/* RCA Results & MongoDB Reports */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Live Result View */}
            {currentRcaResult ? (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase text-rose-500 tracking-wider">AI Root Cause Report</span>
                    <h4 className="text-lg font-black text-slate-900 dark:text-white">{currentRcaResult.title}</h4>
                  </div>
                  <button
                    onClick={handleSaveRcaToMongo}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow transition cursor-pointer"
                  >
                    <Save size={14} /> Save RCA to MongoDB
                  </button>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900/60 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-3 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-500">Threat Severity Index:</span>
                    <Badge className="bg-rose-600 text-white font-black text-xs">
                      {currentRcaResult.severityScore} / 100
                    </Badge>
                  </div>

                  <div>
                    <span className="font-extrabold text-slate-900 dark:text-white block mb-0.5">Probable Primary Root Cause:</span>
                    <p className="text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 font-medium">
                      {currentRcaResult.probableRootCause}
                    </p>
                  </div>

                  <div>
                    <span className="font-extrabold text-slate-900 dark:text-white block mb-0.5">Contributing Factors:</span>
                    <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-300">
                      {currentRcaResult.contributingFactors?.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <span className="font-extrabold text-slate-900 dark:text-white block mb-0.5">Recommended CAPA Actions:</span>
                    <ul className="list-decimal pl-5 space-y-1 text-indigo-700 dark:text-indigo-400 font-bold">
                      {currentRcaResult.capaRecommendations?.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 text-[10px] text-slate-500 font-semibold">
                    Regulatory Assessment: {currentRcaResult.regulatoryImpact}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-8 text-center text-slate-400 text-xs font-semibold">
                Click "Generate AI Root Cause Analysis" to analyze the incident parameters.
              </div>
            )}

            {/* Saved RCA Reports from MongoDB */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Database className="w-5 h-5 text-amber-500" />
                Persisted RCA Reports in MongoDB (<code className="text-indigo-500 font-mono">ai_rca_reports</code>)
              </h4>

              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {savedRcaReports.map(rca => (
                  <div key={rca.id} className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700 rounded-2xl flex justify-between items-start gap-4">
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-rose-100 text-rose-800 text-[9px] font-black">{rca.severity} SEVERITY</Badge>
                        <span className="text-[10px] font-bold text-slate-400">{rca.locationZone}</span>
                      </div>
                      <h5 className="font-bold text-slate-900 dark:text-white">{rca.title}</h5>
                      <p className="text-slate-600 dark:text-slate-300 font-medium">{rca.probableRootCause}</p>
                    </div>

                    <button
                      onClick={() => handleDeleteRca(rca.id)}
                      className="text-slate-400 hover:text-rose-500 p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                      title="Delete from MongoDB"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}

                {savedRcaReports.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-xs font-semibold border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                    No saved RCA reports in MongoDB yet.
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* SECTION 4: NEW FEATURE - PREDICTIVE HAZARD & ZONE SIMULATOR */}
      {activeSection === 'simulator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Simulator Controls */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="w-5 h-5 text-amber-500" />
                Predictive Zone Hazard Simulator
              </h3>
              <p className="text-xs text-slate-500">Adjust active site environmental parameters to simulate AI zone risk probability.</p>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 flex justify-between mb-1">
                  <span>Crane Overhead Lift Activity</span>
                  <span className="text-amber-600 font-black">{simCraneIntensity}</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Low', 'Moderate', 'High'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setSimCraneIntensity(lvl)}
                      className={`py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                        simCraneIntensity === lvl 
                          ? 'bg-amber-600 text-white border-amber-700 shadow-sm' 
                          : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 flex justify-between mb-1">
                  <span>Perimeter Wind Shear Speed</span>
                  <span className="text-indigo-600 font-black">{simWindShear} km/h</span>
                </label>
                <input
                  type="range"
                  min={5}
                  max={50}
                  value={simWindShear}
                  onChange={(e) => setSimWindShear(parseInt(e.target.value))}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 flex justify-between mb-1">
                  <span>Scaffolding Worker Density</span>
                  <span className="text-purple-600 font-black">{simWorkerDensity}</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Sparse', 'Normal', 'Overcrowded'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setSimWorkerDensity(d)}
                      className={`py-2 rounded-xl text-xs font-bold transition border cursor-pointer ${
                        simWorkerDensity === d 
                          ? 'bg-purple-600 text-white border-purple-700 shadow-sm' 
                          : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
                <span className="font-bold text-slate-700 dark:text-slate-300">Night Shift Operations Mode</span>
                <input
                  type="checkbox"
                  checked={simNightShift}
                  onChange={(e) => setSimNightShift(e.target.checked)}
                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                />
              </div>

              <button
                onClick={handleRunHazardSimulation}
                disabled={isSimulating}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 rounded-2xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Zap className="w-4 h-4 fill-white animate-pulse" />
                Run Hazard Simulation
              </button>
            </div>
          </div>

          {/* Simulation Output & Mongo Persistence */}
          <div className="lg:col-span-7 space-y-6">
            
            {currentSimResult ? (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider">Simulated Risk Forecast</span>
                    <h4 className="text-lg font-black text-slate-900 dark:text-white">Active Site Zone Hazard Probabilities</h4>
                  </div>
                  <button
                    onClick={handleSavePredictionToMongo}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow transition cursor-pointer"
                  >
                    <Save size={14} /> Save Forecast to MongoDB
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {currentSimResult.zoneForecasts.map((zf, idx) => (
                    <div key={idx} className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-xs text-slate-900 dark:text-white">{zf.zone}</span>
                        <Badge className={`text-[9px] font-black ${
                          zf.riskScore > 75 ? 'bg-rose-600 text-white' : zf.riskScore > 50 ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'
                        }`}>
                          Risk {zf.riskScore}%
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                        {zf.mainFactor}
                      </p>
                      <div className="text-[10px] text-slate-400 font-bold">
                        Trend: <span className={zf.trend === 'Increasing' ? 'text-rose-500' : 'text-emerald-500'}>{zf.trend}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-8 text-center text-slate-400 text-xs font-semibold">
                Click "Run Hazard Simulation" to view calculated zone risks.
              </div>
            )}

            {/* Saved Predictions in MongoDB */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Database className="w-5 h-5 text-indigo-500" />
                Saved Hazard Forecasts in MongoDB (<code className="text-indigo-500 font-mono">ai_hazard_predictions</code>)
              </h4>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {savedPredictions.map(pred => (
                  <div key={pred.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-150 dark:border-slate-700 rounded-2xl text-xs space-y-1">
                    <div className="flex justify-between items-center font-bold text-slate-800 dark:text-white">
                      <span>Crane: {pred.craneIntensity} | Wind: {pred.windShear}km/h</span>
                      <span className="text-[10px] text-slate-400 font-mono">{new Date(pred.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Zones evaluated: {pred.zoneForecasts?.map(z => `${z.zone} (${z.riskScore}%)`).join(', ')}
                    </div>
                  </div>
                ))}

                {savedPredictions.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-xs font-semibold border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                    No saved hazard forecasts in MongoDB yet.
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* SECTION 5: NEW FEATURE - CUSTOM AI BI TELEMETRY SYNTHESIZER */}
      {activeSection === 'bi_synthesis' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Controls */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-700 pb-3">
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <BrainCircuit className="w-5 h-5 text-teal-500" />
                Enterprise AI Telemetry Synthesizer
              </h3>
              <p className="text-xs text-slate-500">Synthesize raw worker scans, equipment load factors, and safety compliance.</p>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Analytical Query Prompt</label>
                <textarea
                  rows={3}
                  value={biPrompt}
                  onChange={(e) => setBiPrompt(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Time Horizon</label>
                  <select
                    value={biDateRange}
                    onChange={(e: any) => setBiDateRange(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-bold"
                  >
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Past 7 Days</option>
                    <option value="30d">Past 30 Days</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Facility Site</label>
                  <input
                    type="text"
                    value={biSelectedSite}
                    onChange={(e) => setBiSelectedSite(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 font-medium"
                  />
                </div>
              </div>

              <button
                onClick={handleRunBiSynthesis}
                disabled={isSynthesizing}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 rounded-2xl shadow-md transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSynthesizing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Synthesizing BI Telemetry...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 fill-white" />
                    Run AI Telemetry Synthesis
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results & Mongo Persistence */}
          <div className="lg:col-span-7 space-y-6">
            
            {currentBiResult ? (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3">
                  <div>
                    <span className="text-[10px] font-black uppercase text-teal-600 tracking-wider">Gemini Executive Synthesis</span>
                    <h4 className="text-lg font-black text-slate-900 dark:text-white">{biSelectedSite} Analytics</h4>
                  </div>
                  <button
                    onClick={handleSaveBiToMongo}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow transition cursor-pointer"
                  >
                    <Save size={14} /> Save BI Report to Mongo
                  </button>
                </div>

                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3 text-xs leading-relaxed">
                  <div className="whitespace-pre-line text-slate-800 dark:text-slate-200 font-medium">
                    {currentBiResult.synthesis}
                  </div>

                  {currentBiResult.keyMetrics && (
                    <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-200 dark:border-slate-800 text-center">
                      <div className="bg-white dark:bg-slate-800 p-2 rounded-xl">
                        <div className="text-[9px] text-slate-400 font-bold uppercase">Safety</div>
                        <div className="text-sm font-black text-emerald-600">{currentBiResult.keyMetrics.safetyCompliance}%</div>
                      </div>
                      <div className="bg-white dark:bg-slate-800 p-2 rounded-xl">
                        <div className="text-[9px] text-slate-400 font-bold uppercase">Productivity</div>
                        <div className="text-sm font-black text-indigo-600">{currentBiResult.keyMetrics.productivityIndex}%</div>
                      </div>
                      <div className="bg-white dark:bg-slate-800 p-2 rounded-xl">
                        <div className="text-[9px] text-slate-400 font-bold uppercase">TRIR Rate</div>
                        <div className="text-sm font-black text-purple-600">{currentBiResult.keyMetrics.trirRate}</div>
                      </div>
                      <div className="bg-white dark:bg-slate-800 p-2 rounded-xl">
                        <div className="text-[9px] text-slate-400 font-bold uppercase">Readers</div>
                        <div className="text-sm font-black text-amber-600">{currentBiResult.keyMetrics.activeReadersUptime}%</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-8 text-center text-slate-400 text-xs font-semibold">
                Click "Run AI Telemetry Synthesis" to generate enterprise BI report.
              </div>
            )}

            {/* Saved BI Reports in MongoDB */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm space-y-4">
              <h4 className="font-bold text-slate-900 dark:text-white text-base flex items-center gap-2">
                <Database className="w-5 h-5 text-teal-500" />
                Persisted BI Reports in MongoDB (<code className="text-indigo-500 font-mono">analytics_metrics</code>)
              </h4>

              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                {savedBiSyntheses.map(bi => (
                  <div key={bi.id} className="p-3.5 bg-slate-50 dark:bg-slate-800/40 border border-slate-150 dark:border-slate-700 rounded-2xl text-xs space-y-1">
                    <div className="font-bold text-slate-800 dark:text-white truncate">{bi.prompt}</div>
                    <div className="text-[10px] text-slate-400 flex justify-between font-mono">
                      <span>Range: {bi.dateRange}</span>
                      <span>{new Date(bi.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}

                {savedBiSyntheses.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-xs font-semibold border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl">
                    No saved BI telemetry reports in MongoDB yet.
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>
      )}

      {/* SECTION 6: DAILY EHS SHIFT BRIEFING & PRINTABLE REPORT */}
      {activeSection === 'briefing' && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                Daily EHS Shift Safety & Compliance Briefing
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Generated for Site Safety Managers, Subcontractor Leads, and Shift Supervisors.</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportBriefingPDF}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow transition cursor-pointer"
              >
                <Printer size={14} /> Export Printable EHS PDF
              </button>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-4 font-mono text-xs leading-relaxed text-slate-800 dark:text-slate-200">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex justify-between items-center font-sans font-bold">
              <span className="text-indigo-600 dark:text-indigo-400 text-sm">METRO COMMERCIAL TOWER - DAILY SHIFT AUDIT</span>
              <span className="text-slate-400">{new Date().toLocaleDateString()} | 07:00 SHIFT</span>
            </div>

            <div>
              <strong className="text-slate-900 dark:text-white font-sans text-xs uppercase block mb-1">1. EXECUTIVE SAFETY STATUS:</strong>
              <p className="font-sans text-xs text-slate-600 dark:text-slate-300">
                {report?.executiveSummary || "All UHF hardhat RFID readers active across 5 site zones. Zero-latency WebSocket tracking verified."}
              </p>
            </div>

            <div>
              <strong className="text-slate-900 dark:text-white font-sans text-xs uppercase block mb-1">2. HIGH-RISK WORK PERMIT & EXCLUSION ZONES:</strong>
              <ul className="list-disc pl-5 font-sans space-y-1 text-slate-600 dark:text-slate-300">
                <li>Heavy Crane Overhead Lift Zone: Active badge verification required before entering within 10m radius.</li>
                <li>Underground Tunnel Shaft B: 20-minute lone worker welfare check interval enforced.</li>
                <li>Scaffolding Tiers 3 & 4: Wind shear speeds monitored continuously. Harness tie-off required.</li>
              </ul>
            </div>

            <div>
              <strong className="text-slate-900 dark:text-white font-sans text-xs uppercase block mb-1">3. ACTIONABLE TOOLBOX TALK TOPICS FOR TODAY:</strong>
              <ol className="list-decimal pl-5 font-sans space-y-1 text-slate-600 dark:text-slate-300">
                <li>Review exclusion zone turnstile interlocks with subcontractors.</li>
                <li>Verify hardhat RFID tag positioning to prevent antenna signal degradation.</li>
                <li>Re-confirm muster station emergency roll call procedures via RFID gate sweeps.</li>
              </ol>
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-[10px] text-slate-400 font-sans font-bold">
              <span>APPROVED BY: Marcus Vance (EHS Director)</span>
              <span>VERIFIED VIA GEMINI 3.6 FLASH AI & MONGODB Persistence</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
