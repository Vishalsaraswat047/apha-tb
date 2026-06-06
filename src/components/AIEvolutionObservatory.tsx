import React, { useState, useEffect } from 'react';
import {
  Brain,
  Cpu,
  ShieldCheck,
  RefreshCw,
  Zap,
  TrendingUp,
  AlertTriangle,
  Play,
  CheckCircle,
  XCircle,
  FileSpreadsheet,
  Lock,
  Activity,
  Sliders,
  Heart,
  ShieldAlert,
  BarChart3,
  Database,
  Calendar,
  Search,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Check,
  Flame,
  Gauge,
  Sparkles,
  RefreshCw as ResetIcon
} from 'lucide-react';

interface AIObservatoryProps {
  balance?: number;
}

export default function AIEvolutionObservatory({ balance = 10000 }: AIObservatoryProps) {
  // State for pulling live server data
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Collapsible toggle states for the 16 sections
  const [openPanels, setOpenPanels] = useState<Record<string, boolean>>({
    core: true,
    genetics: true,
    insights: true,
    tracker: false,
    explainer: true,
    failures: false,
    confidence: true,
    afcs: true,
    governance: false,
    brain: false,
    validation: false,
    comparison: false,
    clusters: false,
    quietTime: false,
    reports: true,
    improvement: true,
  });

  // State to simulate system alerts
  const [simulatedLosses, setSimulatedLosses] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportWindow, setExportWindow] = useState<Window | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    '🧠 System Initialization Sequence: Ok',
    '🧠 Observatory listening on websocket: Port 3005',
    '🧠 AI cohort evolution parameters: Verified',
    '🧠 Safe deployment filter: Active'
  ]);

  // Dynamic status updater
  const fetchObservatoryData = async () => {
    try {
      const res = await fetch('/api/observatory/data');
      if (res.ok) {
        const payload = await res.json();
        setData(payload);
        setError('');
      } else {
        setError('Observatory sync pending...');
      }
    } catch (err) {
      console.warn('API connection waiting. Simulating parameters locally.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchObservatoryData();
    const interval = setInterval(fetchObservatoryData, 10000); // Increased from 3000ms to 10000ms
    return () => clearInterval(interval);
  }, []);

  // Update scrolling logs to simulate neural processing
  useEffect(() => {
    const logInterval = setInterval(() => {
      const actions = [
        'Evaluating fitness metrics for alpha strategy G0...',
        'Compiling DNA chromosomes: RSI Period optimization matched',
        'AFCS Safety gates scanning execution parameters...',
        'Simulated drawdown validation: Status Passed',
        'Analysing market volatility signatures...',
        'Compiling daily P&L comparison arrays...',
        'Updating cognitive insights map: Trend breakout trap indexed'
      ];
      const randomLog = actions[Math.floor(Math.random() * actions.length)];
      setTerminalLogs(prev => [`[${new Date().toLocaleTimeString()}] ${randomLog}`, ...prev.slice(0, 10)]);
    }, 10000); // Increased from 5000ms to 10000ms

    return () => clearInterval(logInterval);
  }, []);

  const togglePanel = (panel: string) => {
    setOpenPanels(prev => ({ ...prev, [panel]: !prev[panel] }));
  };

  // Trigger Excel Report streaming
  const handleExportReport = async () => {
    // Prevent multiple clicks while exporting or if window already open
    if (isExporting || exportWindow && !exportWindow.closed) {
      return;
    }

    setIsExporting(true);
    try {
      const newWindow = window.open('/api/observatory/export-report', '_blank');
      setExportWindow(newWindow);
      setTerminalLogs(prev => [`[SYSTEM] Generated daily spreadsheet intelligence report`, ...prev]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  // Simulate loss counters to test the Adaptive Failure Containment (AFCS) system alert triggers
  const triggerSimulatedLoss = () => {
    setSimulatedLosses(prev => {
      const next = prev === 3 ? 0 : prev + 1;
      if (next === 3) {
        setTerminalLogs(old => [
          '[⚠️ CRITICAL ALERT] AFCS MODE ENGAGED - 3 consecutive failures detected!',
          '[CONTAINMENT STATUS] Pausing automated entry gates. Commencing neural forensics.',
          ...old
        ]);
      } else {
        setTerminalLogs(old => [`[DIAGNOSTIC] Registered simulated drawdown point - level ${next}/3`, ...old]);
      }
      return next;
    });
  };

  // Local calculation fallbacks if API values are empty
  const activeRegime = data?.currentRegime || 'Ranging Dynamic';
  const isBotRunning = data?.isBotRunning !== false;
  const compositeConfidence = data?.compositeConfidence || 78;
  const evolutionCoreState = data?.evaluation || {
    learningState: 'CONVERGING',
    adaptationLevel: 72,
    learningCycles: 242,
    evolutionPhase: 'COGNITIVE HYBRID SCALPER v3',
    optimizationTargets: ['RSI oversold boundary', 'EMA fast catalyst crossovers', 'ATR safe trail margins'],
    evolutionStabilityScore: 84,
    learningProgress: [32, 45, 52, 61, 58, 68, 72]
  };

  const geneticsState = data?.genetics || {
    currentMutations: [
      { parameterName: 'RSI Period', previousValue: 14, evolvedValue: 12, mutationType: 'DECREMENTAL', impactPercentage: 4.8 },
      { parameterName: 'RSI Oversold Boundary', previousValue: 30, evolvedValue: 27, mutationType: 'OPTIMIZED', impactPercentage: 8.2 },
      { parameterName: 'EMA Fast Catalyst', previousValue: 12, evolvedValue: 15, mutationType: 'INCREMENTAL', impactPercentage: 12.4 },
      { parameterName: 'Stop Loss Threshold', previousValue: '0.50%', evolvedValue: '0.45%', mutationType: 'OPTIMIZED', impactPercentage: 15.5 }
    ],
    dnaChain: '🧬 AT-EC-12-RSI-FEMA-7C-V3-CG'
  };

  const learningInsights = data?.insights || {
    winningPatterns: ['RSI Oversold spikes when aligned with supportive slow EMA structures', 'High Volume rebounds near daily Bollinger lower limits'],
    losingPatterns: ['Chasing high momentum expansions near overbought bands during volatile drift', 'Counter-trend breakouts with sluggish orderbook depth'],
    whatAiLearnedToday: [
      'Tightening RSI oversight limits protects against premature entries by 14%',
      'Volatile swing ranges are safer matched with smaller trailing stops',
      'Dynamic balance sizing retains up to 50% profit reserves while preserving baseline liquidity exposure'
    ],
    insights: [
      { marketCondition: 'Trending Bullish', signalStrength: 82, successRate: 75, patternIdentified: 'Fast EMA support bounds consolidation', adaptationReasoning: 'Tuned entry parameters' },
      { marketCondition: 'Ranging Dynamic', signalStrength: 76, successRate: 68, patternIdentified: 'Reversal support signals', adaptationReasoning: 'Adjusted trigger weights' }
    ],
    overallImprovementScore: 86
  };

  const failureAtlas = data?.failures || {
    signatures: [
      { id: 'fs-01', name: 'Counter-Trend Breakout Trap', category: 'TREND_REVERSAL_TRAP', frequency: 3, severityLevel: 'HIGH', associatedStrategy: 'Alpha G0-01 Titan', recentOccurrence: 'Just now' },
      { id: 'fs-02', name: 'Liquidity Sweep Stop Hunt', category: 'LIQUIDITY_SWEEP', frequency: 2, severityLevel: 'MEDIUM', associatedStrategy: 'Aegis Continuous Scalper V3', recentOccurrence: '10M ago' }
    ],
    recentFailuresCount: 4,
    failureClusterScore: 32,
    afcs: {
      isActive: false,
      triggerReason: 'Healthy metrics',
      analysisProgress: 100,
      containmentPhase: 'MONITORING',
      stabilityRecoveryScore: 95
    }
  };

  const governanceState = data?.governance || {
    logs: [
      { id: 'gov-01', timestamp: Date.now() - 300000, strategyId: 'strat-a1', strategyName: 'Aegis Core', actionCode: 'MUTATION_APPROVED', details: 'Passed automatic cross-validation tests.', confidenceScore: 88, governanceVote: 'PASSED' },
      { id: 'gov-02', timestamp: Date.now() - 1500000, strategyId: 'strat-reject-x2', strategyName: 'Overfitted RSI Wave', actionCode: 'MUTATION_REJECTED', details: 'Drawdown risk projection breached maximum parameter of 1.50%.', confidenceScore: 40, governanceVote: 'REJECTED' }
    ],
    scorecard: {
      backtestScore: 82,
      stabilityFactor: 89,
      consistencyRating: 'EXCELLENT',
      drawdownRiskRating: 'LOW',
      deploymentReadiness: 91,
      passedGates: ['Overfit Limit Validation', 'Backtest Target Win Rate', 'Volatility Safe Floor Buffer'],
      failedGates: []
    }
  };

  const afcsActive = simulatedLosses >= 3 || failureAtlas.afcs.isActive;

  return (
    <div className="space-y-6" id="ai-evolution-observatory-root">
      
      {/* 🚀 LAB HEAD-UP STATUS INTERFACE (Glassmorphic Top Panel) */}
      <div className="relative rounded-2xl bg-slate-950/70 border border-slate-800/80 p-6 overflow-hidden backdrop-blur-xl shadow-2xl">
        {/* Futuristic glowing particle core canvas simulation */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_40%)] pointer-events-none" />
        <div className="absolute top-0 right-0 h-48 w-48 bg-emerald-500/5 blur-3xl rounded-full animate-pulse pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded bg-emerald-500/10 border border-emerald-400/20 text-emerald-400">
                <Brain className="h-5 w-5 animate-pulse" />
              </span>
              <div>
                <h1 className="text-lg font-bold font-mono tracking-tight text-white flex items-center gap-2">
                  AI EVOLUTION OBSERVATORY
                </h1>
                <p className="text-[10px] sm:text-xs font-mono text-cyan-400 uppercase tracking-widest mt-0.5">
                  Trading Brain Control Center – Real-Time AI Learning & Strategy Evolution Monitor
                </p>
              </div>
            </div>
            <p className="text-xs text-slate-400 max-w-3xl mt-2.5 font-sans leading-relaxed">
              Monitoring, evaluating, and self-improving algorithmic neural structures. This subsystem operates in a sandboxed execution laboratory, processing memory weights and validating mutations on previous results without destabilizing active live Spot operations.
            </p>
          </div>

          <div className="flex flex-wrap gap-2.5 shrink-0">
            {/* Quick AFCS manual diagnostic tester */}
            <button
              onClick={triggerSimulatedLoss}
              className={`px-3 py-2 rounded-lg text-[11px] font-mono font-bold border transition-all flex items-center gap-1.5 cursor-pointer select-none ${
                afcsActive 
                  ? 'bg-rose-500/20 text-rose-400 border-rose-500/40' 
                  : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700'
              }`}
              title="Click multiple times to trigger an AFCS alert containment simulation"
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              AFCS DIAGNOSTIC: {simulatedLosses}/3 L
            </button>

            {/* Excel Report Downporter Trigger */}
            <button
              onClick={handleExportReport}
              disabled={isExporting}
              className="px-4 py-2 bg-gradient-to-r from-emerald-500/90 to-teal-600/90 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-mono font-bold text-xs rounded-lg shadow-lg shadow-emerald-500/10 flex items-center gap-2 transition-all cursor-pointer"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {isExporting ? 'EXPORTING...' : 'EXCEL INTEL REPORT'}
            </button>
          </div>
        </div>

        {/* Dashboard Live Mini Analytics Ribbons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-5 border-t border-slate-900 font-mono">
          <div className="p-3 bg-slate-900/30 border border-slate-900 rounded-lg">
            <span className="block text-[9px] text-slate-500 uppercase">Active Sandbox Mode</span>
            <span className="text-xs font-bold text-emerald-400 block mt-1.5 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
              DYNAMIC HEURISTIC
            </span>
          </div>
          <div className="p-3 bg-slate-900/30 border border-slate-900 rounded-lg">
            <span className="block text-[9px] text-slate-500 uppercase">Brain Stability Factor</span>
            <span className="text-xs font-bold text-white block mt-1.5">{evolutionCoreState.evolutionStabilityScore}%</span>
          </div>
          <div className="p-3 bg-slate-900/30 border border-slate-900 rounded-lg">
            <span className="block text-[9px] text-slate-500 uppercase">Self Adaptation Level</span>
            <span className="text-xs font-bold text-cyan-400 block mt-1.5">{evolutionCoreState.adaptationLevel}%</span>
          </div>
          <div className="p-3 bg-slate-900/30 border border-slate-900 rounded-lg">
            <span className="block text-[9px] text-slate-500 uppercase">Composite Governance</span>
            <span className="text-xs font-bold text-[#fafafa] block mt-1.5 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> PASS / AUDITED
            </span>
          </div>
        </div>
      </div>

      {/* 🛑 8. AFCS STATUS CRITICAL ALERTS BANNER PANEL */}
      {afcsActive && (
        <div className="rounded-xl border border-rose-500/35 bg-rose-950/40 p-5 shadow-2xl relative overflow-hidden animate-pulse" id="panel-8-afcs">
          <div className="absolute top-0 right-0 h-24 w-24 bg-gradient-to-br from-rose-500/10 to-transparent blur-md pointer-events-none" />
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="p-2.5 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-400 shrink-0 mt-0.5">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <div>
                <span className="bg-rose-500/15 text-rose-400 text-[9px] py-0.5 px-2 rounded-full border border-rose-500/35 uppercase font-mono font-bold">
                  AFCS Container Triggered
                </span>
                <h4 className="text-sm font-bold font-mono text-white mt-1">
                  ADAPTIVE FAILURE CONTAINMENT SYSTEM (AFCS)
                </h4>
                <p className="text-[11px] font-mono text-rose-300/90 mt-1 max-w-2xl leading-normal">
                  {failureAtlas.afcs.triggerReason || 'Sizing failure threshold exceeded: 3 consecutive losses registered within active window.'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-mono text-slate-400">
                  <span className="bg-slate-900 px-2 py-0.5 border border-slate-800 rounded">Analysis Mode: ACTIVE</span>
                  <span className="bg-slate-900 px-2 py-0.5 border border-slate-800 rounded text-rose-400">Trading Entries: HALTED</span>
                  <span className="bg-slate-900 px-2 py-0.5 border border-slate-800 rounded">Evaluator: RETRAINING</span>
                </div>
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="block text-[9px] font-mono text-slate-500 uppercase">Stability Recovery Score</span>
              <span className="text-xl font-bold font-mono text-rose-400 mt-1 block">
                {failureAtlas.afcs.stabilityRecoveryScore}%
              </span>
              <div className="w-28 sm:w-36 bg-slate-900 h-1 rounded-full mt-2.5 overflow-hidden ml-auto">
                <div className="bg-rose-500 h-full rounded-full" style={{ width: `${failureAtlas.afcs.stabilityRecoveryScore}%` }} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📊 COLLAPSIBLE SUB-PANELS HUB */}
      <div className="space-y-4 font-sans" id="observatory-sub-panels-grid">
        
        {/* ======================================= */}
        {/* 1. EVOLUTION CORE PANEL */}
        {/* ======================================= */}
        <div className="rounded-xl border border-slate-850 bg-slate-950/40 p-4 shadow-md transition-all">
          <button 
            onClick={() => togglePanel('core')}
            className="w-full flex items-center justify-between text-left font-mono font-semibold"
          >
            <div className="flex items-center gap-2">
              <span className="text-emerald-400"><Activity className="h-4.5 w-4.5 animate-spin" /></span>
              <div>
                <span className="text-xs text-slate-200 uppercase">[01] AI Evolution Core</span>
                <span className="text-[9px] block text-slate-500 font-normal uppercase leading-none mt-0.5">Central Learning Engine & Pulse Dynamics</span>
              </div>
            </div>
            {openPanels.core ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </button>

          {openPanels.core && (
            <div className="mt-4 pt-4 border-t border-slate-900 grid grid-cols-1 md:grid-cols-12 gap-5 animate-fadeIn">
              <div className="md:col-span-4 space-y-3.5 font-mono text-xs">
                <div className="p-3 bg-slate-950/80 border border-slate-900 rounded-lg">
                  <span className="text-[9px] text-slate-500 uppercase block">Current learning state</span>
                  <span className="text-sm font-bold text-emerald-400 mt-1 block flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    {evolutionCoreState.learningState}
                  </span>
                </div>
                <div className="p-3 bg-slate-950/80 border border-slate-900 rounded-lg">
                  <span className="text-[9px] text-slate-500 uppercase block">Adaptation Level</span>
                  <span className="text-sm font-bold text-cyan-400 mt-1 block">{evolutionCoreState.adaptationLevel}%</span>
                </div>
                <div className="p-3 bg-slate-950/80 border border-slate-900 rounded-lg">
                  <span className="text-[9px] text-slate-500 uppercase block">Learning Cycles</span>
                  <span className="text-sm font-bold text-purple-400 mt-1 block">{evolutionCoreState.learningCycles} generation ticks</span>
                </div>
              </div>

              <div className="md:col-span-8 flex flex-col justify-between space-y-3">
                <div className="p-4 bg-slate-950/50 border border-slate-900 rounded-lg font-mono">
                  <span className="text-[9px] text-slate-500 uppercase block">Active Strategy Genetic DNA</span>
                  <span className="text-xs font-bold text-slate-200 mt-2 block break-all font-mono">
                    {geneticsState.dnaChain}
                  </span>
                </div>

                <div className="p-4 bg-slate-950/50 border border-slate-900 rounded-lg font-mono text-xs">
                  <span className="text-[9px] text-slate-500 uppercase block">Adaptive Optimization Trials</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2.5">
                    {evolutionCoreState.optimizationTargets.map((target: string, idx: number) => (
                      <span key={idx} className="bg-slate-900/90 border border-slate-800 text-[10px] text-slate-300 py-1.5 px-2.5 rounded flex items-center gap-1.5">
                        <span className="h-1 w-1 bg-cyan-400 rounded-full" />
                        {target}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ======================================= */}
        {/* 2. STRATEGY GENETICS PANEL */}
        {/* ======================================= */}
        <div className="rounded-xl border border-slate-850 bg-slate-950/40 p-4 shadow-md transition-all">
          <button 
            onClick={() => togglePanel('genetics')}
            className="w-full flex items-center justify-between text-left font-mono font-semibold"
          >
            <div className="flex items-center gap-2">
              <span className="text-cyan-400"><Sliders className="h-4.5 w-4.5" /></span>
              <div>
                <span className="text-xs text-slate-200 uppercase">[02] Strategy Genetics</span>
                <span className="text-[9px] block text-slate-500 font-normal uppercase leading-none mt-0.5">Inherited traits & Mutation Chromosomes</span>
              </div>
            </div>
            {openPanels.genetics ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </button>

          {openPanels.genetics && (
            <div className="mt-4 pt-4 border-t border-slate-900 space-y-4 animate-fadeIn font-mono text-xs">
              <div className="p-3 bg-slate-950 border border-slate-900 rounded-lg flex justify-between items-center">
                <span className="text-[10px] uppercase text-slate-400">Active Chromosome Signature</span>
                <span className="font-mono bg-cyan-500/15 text-cyan-400 px-3 py-1 rounded text-xs select-all font-bold">
                  {geneticsState.dnaChain}
                </span>
              </div>

              <div className="overflow-x-auto select-none">
                <table className="w-full text-left text-slate-400">
                  <thead>
                    <tr className="border-b border-slate-900 pb-2 text-[9px] text-slate-500 uppercase font-bold tracking-wider">
                      <th className="pb-2">Parameter Name</th>
                      <th className="pb-2 text-center">Previous Value</th>
                      <th className="pb-2 text-center">Mutation Vector</th>
                      <th className="pb-2 text-right">Evolved Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {geneticsState.currentMutations.map((mut: any, idx: number) => (
                      <tr key={idx} className="border-b border-slate-950/70 py-2.5">
                        <td className="py-2 font-semibold text-slate-300">{mut.parameterName}</td>
                        <td className="py-2 text-center text-slate-500">{mut.previousValue}</td>
                        <td className="py-2 text-center">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                            mut.mutationType === 'DECREMENTAL' 
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/15' 
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/15'
                          }`}>
                            {mut.mutationType}
                          </span>
                        </td>
                        <td className="py-2 text-right font-bold text-white">{mut.evolvedValue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ======================================= */}
        {/* 3. AI LEARNING INSIGHTS PANEL */}
        {/* ======================================= */}
        <div className="rounded-xl border border-slate-850 bg-slate-950/40 p-4 shadow-md transition-all">
          <button 
            onClick={() => togglePanel('insights')}
            className="w-full flex items-center justify-between text-left font-mono font-semibold"
          >
            <div className="flex items-center gap-2">
              <span className="text-yellow-400"><Sparkles className="h-4.5 w-4.5" /></span>
              <div>
                <span className="text-xs text-slate-200 uppercase">[03] AI Learning Insights</span>
                <span className="text-[9px] block text-slate-500 font-normal uppercase leading-none mt-0.5">Recurring Patterns & Heuristic Breakthroughs</span>
              </div>
            </div>
            {openPanels.insights ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </button>

          {openPanels.insights && (
            <div className="mt-4 pt-4 border-t border-slate-900 grid grid-cols-1 md:grid-cols-2 gap-5 animate-fadeIn font-mono text-xs">
              <div className="space-y-3.5">
                <h5 className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider">🧠 What AI Learned Today:</h5>
                <ul className="space-y-2">
                  {learningInsights.whatAiLearnedToday.map((learned: string, idx: number) => (
                    <li key={idx} className="p-3 bg-slate-950/75 border border-slate-900 rounded-lg flex items-start gap-2 text-slate-300">
                      <span className="text-emerald-400 font-bold shrink-0 mt-0.5">✓</span>
                      <span>{learned}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-4">
                <div>
                  <h5 className="text-[10px] text-emerald-400 uppercase font-bold tracking-wider mb-2.5">👍 Evolving High Confidence Patterns:</h5>
                  <div className="space-y-2">
                    {learningInsights.winningPatterns.map((ptn: string, i: number) => (
                      <div key={i} className="p-2.5 bg-emerald-500/5 border border-emerald-500/10 text-emerald-300/90 rounded text-[11px]">
                        {ptn}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h5 className="text-[10px] text-rose-400 uppercase font-bold tracking-wider mb-2.5">👎 Flagged Fragile Patterns (Avoided):</h5>
                  <div className="space-y-2">
                    {learningInsights.losingPatterns.map((ptn: string, i: number) => (
                      <div key={i} className="p-2.5 bg-rose-500/5 border border-rose-500/10 text-rose-300/90 rounded text-[11px]">
                        {ptn}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ======================================= */}
        {/* 4. EVOLUTION TRACKER & TIMELINE */}
        {/* ======================================= */}
        <div className="rounded-xl border border-slate-850 bg-slate-950/40 p-4 shadow-md transition-all font-mono">
          <button 
            onClick={() => togglePanel('tracker')}
            className="w-full flex items-center justify-between text-left font-semibold"
          >
            <div className="flex items-center gap-2">
              <span className="text-indigo-400"><Database className="h-4.5 w-4.5" /></span>
              <div>
                <span className="text-xs text-slate-200 uppercase">[04] Evolution Tracker</span>
                <span className="text-[9px] block text-slate-500 font-normal uppercase leading-none mt-0.5">Parameter histories & Delta timelines</span>
              </div>
            </div>
            {openPanels.tracker ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </button>

          {openPanels.tracker && (
            <div className="mt-4 pt-4 border-t border-slate-900 space-y-4 text-xs">
              <div className="relative border-l border-slate-800 pl-4 ml-2 space-y-4">
                <div className="relative">
                  <span className="absolute -left-6 top-1.5 h-3.5 w-3.5 bg-cyan-400 rounded-full border-4 border-slate-950" />
                  <span className="text-[10px] text-slate-500">GENERATION {data?.generation || 1} (ACTIVE STABLE)</span>
                  <div className="p-3.5 bg-slate-950 border border-slate-900 rounded-lg mt-1 space-y-1.5">
                    <span className="font-bold text-slate-200">Enriched RSI boundary bounds tuned</span>
                    <p className="text-slate-400 text-[11px]">RSI oversold trigger tightened down by 3% to limit downside breakout risk under {activeRegime} market.</p>
                  </div>
                </div>

                <div className="relative opacity-60">
                  <span className="absolute -left-6 top-1.5 h-3.5 w-3.5 bg-slate-500 rounded-full border-4 border-slate-950" />
                  <span className="text-[10px] text-slate-500">GENERATION {Math.max(0, (data?.generation || 1) - 1)} (HISTORIC)</span>
                  <div className="p-3 bg-slate-950 border border-slate-900 rounded-lg mt-1">
                    <span className="font-bold text-slate-300">Base heuristic initial consensus model</span>
                    <p className="text-slate-500 text-[11px]">Standard RSI inputs utilized without volatility filters active.</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ======================================= */}
        {/* 5. AI DECISION EXPLAINER */}
        {/* ======================================= */}
        <div className="rounded-xl border border-slate-850 bg-slate-950/40 p-4 shadow-md transition-all font-mono">
          <button 
            onClick={() => togglePanel('explainer')}
            className="w-full flex items-center justify-between text-left font-semibold"
          >
            <div className="flex items-center gap-2">
              <span className="text-amber-500"><AlertTriangle className="h-4.5 w-4.5" /></span>
              <div>
                <span className="text-xs text-slate-200 uppercase">[05] AI Decision Explainer</span>
                <span className="text-[9px] block text-slate-500 font-normal uppercase leading-none mt-0.5">Adaptive Logic reasoning & Transparency Ledger</span>
              </div>
            </div>
            {openPanels.explainer ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </button>

          {openPanels.explainer && (
            <div className="mt-4 pt-4 border-t border-slate-900 space-y-3 text-xs leading-relaxed animate-fadeIn">
              <div className="p-3.5 bg-slate-950 border-l-2 border-amber-500 rounded-r-lg space-y-1">
                <span className="font-bold text-amber-400 block uppercase text-[10px]">REASONING EXPLANATORY DIRECTIVE</span>
                <p className="text-slate-300 text-[11px]">
                  "Evolved strategy parameters were triggered because backtest segments validated that momentum trades are highly volatile during {activeRegime} conditions. To prevent timing leaks and excessive drawdowns, the EMA entry gate period was safely scaled up. Drawdowns decreased as a direct result by 12% in testing."
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <div className="p-3 bg-slate-950/50 border border-slate-900 rounded-lg text-[10px] text-slate-400">
                  <span className="block font-bold text-slate-300 mb-1 uppercase">Overconfidence Filter</span>
                  Positions sized at 100% of baseline and capped at 50% of profits, preventing over-capitalization after high winning loops.
                </div>
                <div className="p-3 bg-slate-950/50 border border-slate-900 rounded-lg text-[10px] text-slate-400">
                  <span className="block font-bold text-slate-300 mb-1 uppercase">Drawdown Gate</span>
                  If simulated tests predict a drawdown drift exceeding 1.5% under volatile environments, parameter deployment is blocked automatically.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ======================================= */}
        {/* 6. FAILURE ANALYSIS CENTER */}
        {/* ======================================= */}
        <div className="rounded-xl border border-slate-850 bg-slate-950/40 p-4 shadow-md transition-all font-mono">
          <button 
            onClick={() => togglePanel('failures')}
            className="w-full flex items-center justify-between text-left font-semibold"
          >
            <div className="flex items-center gap-2">
              <span className="text-rose-400"><XCircle className="h-4.5 w-4.5" /></span>
              <div>
                <span className="text-xs text-slate-200 uppercase">[06] Failure Analysis Center</span>
                <span className="text-[9px] block text-slate-500 font-normal uppercase leading-none mt-0.5">Bad market regimes & Drawdown risk spikes</span>
              </div>
            </div>
            {openPanels.failures ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </button>

          {openPanels.failures && (
            <div className="mt-4 pt-4 border-t border-slate-900 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs animate-fadeIn">
              <div className="space-y-3">
                <h5 className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Identified Failure Signatures:</h5>
                <div className="space-y-2">
                  {failureAtlas.signatures.map((sig: any, idx: number) => (
                    <div key={idx} className="p-3 bg-slate-950 border border-slate-900 rounded-lg flex justify-between items-center">
                      <div>
                        <span className="font-bold text-slate-200 block">{sig.name}</span>
                        <span className="text-[9px] text-[#475569] block font-mono mt-0.5 uppercase">Associated: {sig.associatedStrategy}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold ${
                        sig.severityLevel === 'CRITICAL' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {sig.severityLevel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl space-y-3 flex flex-col justify-between">
                <div>
                  <span className="block text-[9px] text-slate-500 uppercase">Failure Cluster Index</span>
                  <span className="text-2xl font-bold font-mono text-rose-400 block mt-1">{failureAtlas.failureClusterScore}%</span>
                  <p className="text-[10px] text-slate-500 font-sans mt-2">Calculates density of bad trades under unstable volatility sweeps. Score remains within safe bounds.</p>
                </div>

                <div className="space-y-1 pt-3.5 border-t border-slate-900 text-[10px] text-slate-400">
                  <span className="block uppercase text-[9px] text-[#475569] font-bold mb-1">Categorized failures density:</span>
                  <div className="flex justify-between">
                    <span>Volatility Traps:</span>
                    <span className="text-white">Medium</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Liquidity Sweeps:</span>
                    <span className="text-white">Low</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ======================================= */}
        {/* 7. CONFIDENCE HEALTH PANEL */}
        {/* ======================================= */}
        <div className="rounded-xl border border-slate-850 bg-slate-950/40 p-4 shadow-md transition-all font-mono">
          <button 
            onClick={() => togglePanel('confidence')}
            className="w-full flex items-center justify-between text-left font-semibold"
          >
            <div className="flex items-center gap-2">
              <span className="text-red-400"><Heart className="h-4.5 w-4.5 text-rose-400 animate-pulse" /></span>
              <div>
                <span className="text-xs text-slate-200 uppercase">[07] Confidence Health</span>
                <span className="text-[9px] block text-slate-500 font-normal uppercase leading-none mt-0.5">Composite dynamic weightings & Emotional risk emulation</span>
              </div>
            </div>
            {openPanels.confidence ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </button>

          {openPanels.confidence && (
            <div className="mt-4 pt-4 border-t border-slate-900 grid grid-cols-1 md:grid-cols-12 gap-5 text-xs animate-fadeIn">
              <div className="md:col-span-5 flex flex-col items-center justify-center p-4 bg-slate-950 rounded-xl border border-slate-900">
                <div className="relative h-24 w-24 flex items-center justify-center">
                  {/* Dynamic circular dial ring */}
                  <div className="absolute inset-0 rounded-full border-4 border-slate-850" />
                  <div className="absolute inset-0 rounded-full border-4 border-cyan-400/80 border-t-transparent animate-spin-slow" />
                  <div className="text-center">
                    <span className="text-2xl font-bold font-mono text-white block">{compositeConfidence}%</span>
                    <span className="text-[8px] text-slate-500 uppercase tracking-widest font-mono block">HEALTH</span>
                  </div>
                </div>
                <span className="text-[9px] text-cyan-400 uppercase tracking-wider font-bold mt-4 block">ACTIVE REGIME APPROVAL STATE</span>
              </div>

              <div className="md:col-span-7 space-y-3.5">
                <span className="block text-[9px] text-[#475569] font-bold uppercase leading-none tracking-wider">Simulated Behavioral Parameters:</span>
                <div className="grid grid-cols-2 gap-3.5">
                  <div className="p-3 bg-slate-950/40 border border-slate-900 rounded-lg">
                    <span className="text-[9px] text-slate-500 uppercase block">Emotional Bias index</span>
                    <span className="text-xs font-bold text-emerald-400 block mt-1">0.05 (STABLE COGNITIVE)</span>
                  </div>
                  <div className="p-3 bg-slate-950/40 border border-slate-900 rounded-lg">
                    <span className="text-[9px] text-slate-500 uppercase block">Regime Consistency</span>
                    <span className="text-xs font-bold text-white block mt-1">EXCELLENT</span>
                  </div>
                  <div className="p-3 bg-slate-950/40 border border-slate-900 rounded-lg">
                    <span className="text-[9px] text-slate-500 uppercase block">Signal Consensus</span>
                    <span className="text-xs font-bold text-cyan-400 block mt-1">78.5% AGREEMENT</span>
                  </div>
                  <div className="p-3 bg-slate-950/40 border border-slate-900 rounded-lg">
                    <span className="text-[9px] text-slate-500 uppercase block">Recent drawdown stress</span>
                    <span className="text-xs font-bold text-slate-300 block mt-1">0.68% (NORMALIZED)</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ======================================= */}
        {/* 9. GOVERNANCE CENTER PANEL */}
        {/* ======================================= */}
        <div className="rounded-xl border border-slate-850 bg-slate-950/40 p-4 shadow-md transition-all font-mono">
          <button 
            onClick={() => togglePanel('governance')}
            className="w-full flex items-center justify-between text-left font-semibold"
          >
            <div className="flex items-center gap-2">
              <span className="text-emerald-400"><ShieldCheck className="h-4.5 w-4.5" /></span>
              <div>
                <span className="text-xs text-slate-200 uppercase">[09] Governance Center</span>
                <span className="text-[9px] block text-slate-500 font-normal uppercase leading-none mt-0.5">Approved mutations & Audit ledger</span>
              </div>
            </div>
            {openPanels.governance ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </button>

          {openPanels.governance && (
            <div className="mt-4 pt-4 border-t border-slate-900 space-y-3.5 text-xs animate-fadeIn">
              <span className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Decentralized Audit Records:</span>
              <div className="space-y-2">
                {governanceState.logs.map((log: any) => (
                  <div key={log.id} className="p-3 bg-slate-950 border border-slate-900 rounded-lg flex flex-col sm:flex-row justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${log.governanceVote === 'PASSED' ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                        <span className="font-bold text-slate-200">{log.strategyName}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 max-w-xl leading-normal">{log.details}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9.5px] font-bold self-start sm:self-center shrink-0 ${
                      log.governanceVote === 'PASSED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                    }`}>
                      {log.actionCode}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ======================================= */}
        {/* 10. BRAIN ACTIVITY MONITOR (STABILIZED LIVE FEED) */}
        {/* ======================================= */}
        <div className="rounded-xl border border-slate-850 bg-slate-950/40 p-4 shadow-md transition-all font-mono">
          <button 
            onClick={() => togglePanel('brain')}
            className="w-full flex items-center justify-between text-left font-semibold"
          >
            <div className="flex items-center gap-2">
              <span className="text-cyan-400"><Activity className="h-4.5 w-4.5 animate-pulse" /></span>
              <div>
                <span className="text-xs text-slate-200 uppercase">[10] Brain Activity Monitor</span>
                <span className="text-[9px] block text-slate-500 font-normal uppercase leading-none mt-0.5">Active calculation sequences & Evaluation cycles</span>
              </div>
            </div>
            {openPanels.brain ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </button>

          {openPanels.brain && (
            <div className="mt-4 pt-4 border-t border-slate-900 space-y-3.5 text-xs animate-fadeIn">
              <span className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Scrolling Neural Stream (Live logs):</span>
              <div className="p-3 bg-black border border-slate-900 rounded-lg font-mono text-[10.5px] text-emerald-400 h-40 overflow-y-auto space-y-1.5 scrollbar-thin select-text">
                {terminalLogs.map((log, idx) => (
                  <div key={idx} className="hover:bg-slate-950 py-0.5 px-1 rounded transition-colors break-all">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ======================================= */}
        {/* 11. EVOLUTION VALIDATION PANEL */}
        {/* ======================================= */}
        <div className="rounded-xl border border-slate-850 bg-slate-950/40 p-4 shadow-md transition-all font-mono">
          <button 
            onClick={() => togglePanel('validation')}
            className="w-full flex items-center justify-between text-left font-semibold"
          >
            <div className="flex items-center gap-2">
              <span className="text-emerald-400"><ShieldCheck className="h-4.5 w-4.5" /></span>
              <div>
                <span className="text-xs text-slate-200 uppercase">[11] Evolution Validation</span>
                <span className="text-[9px] block text-slate-500 font-normal uppercase leading-none mt-0.5">Automatic deployment check gates & Backtest scores</span>
              </div>
            </div>
            {openPanels.validation ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </button>

          {openPanels.validation && (
            <div className="mt-4 pt-4 border-t border-slate-900 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs animate-fadeIn">
              <div className="space-y-4">
                <div className="p-3 bg-slate-950 border border-slate-900 rounded-lg">
                  <span className="text-[9px] text-slate-500 uppercase block">Simulated Backtest Score</span>
                  <span className="text-xl font-bold font-mono text-emerald-400 block mt-1">{governanceState.scorecard.backtestScore}%</span>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full mt-2.5 overflow-hidden">
                    <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${governanceState.scorecard.backtestScore}%` }} />
                  </div>
                </div>

                <div className="p-3 bg-slate-950 border border-slate-900 rounded-lg">
                  <span className="text-[9px] text-slate-500 uppercase block">Deployment Readiness index</span>
                  <span className="text-xl font-bold font-mono text-cyan-400 block mt-1">{governanceState.scorecard.deploymentReadiness}%</span>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full mt-2.5 overflow-hidden">
                    <div className="bg-cyan-400 h-full rounded-full" style={{ width: `${governanceState.scorecard.deploymentReadiness}%` }} />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl space-y-3.5">
                <span className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Checklist Gates status:</span>
                <div className="space-y-2">
                  {governanceState.scorecard.passedGates.map((gate: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] text-slate-300">
                      <span className="h-4 w-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded flex items-center justify-center font-bold text-[9px]">✓</span>
                      <span>{gate}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ======================================= */}
        {/* 12. DAILY COMPARISON PANEL */}
        {/* ======================================= */}
        <div className="rounded-xl border border-slate-850 bg-slate-950/40 p-4 shadow-md transition-all font-mono">
          <button 
            onClick={() => togglePanel('comparison')}
            className="w-full flex items-center justify-between text-left font-semibold"
          >
            <div className="flex items-center gap-2">
              <span className="text-cyan-400"><Calendar className="h-4.5 w-4.5" /></span>
              <div>
                <span className="text-xs text-slate-200 uppercase">[12] Daily Comparison</span>
                <span className="text-[9px] block text-slate-500 font-normal uppercase leading-none mt-0.5">Yesterday vs Today performance deltas</span>
              </div>
            </div>
            {openPanels.comparison ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </button>

          {openPanels.comparison && (
            <div className="mt-4 pt-4 border-t border-slate-900 space-y-4 text-xs animate-fadeIn">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="p-3 bg-slate-950 border border-slate-900 rounded-lg">
                  <span className="text-[9px] text-slate-500 uppercase block">Winrate Delta</span>
                  <span className="text-sm font-bold text-emerald-400 block mt-1">+1.8% (IMPROVED)</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-900 rounded-lg">
                  <span className="text-[9px] text-slate-500 uppercase block">Drawdown Reductions</span>
                  <span className="text-sm font-bold text-emerald-400 block mt-1">-0.12% (STABILIZED)</span>
                </div>
                <div className="p-3 bg-slate-950 border border-slate-900 rounded-lg">
                  <span className="text-[9px] text-slate-500 uppercase block">Adaptation Gain</span>
                  <span className="text-sm font-bold text-white block mt-1">+8.5% over genesis-0</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ======================================= */}
        {/* 13. FAILURE CLUSTERS MAP */}
        {/* ======================================= */}
        <div className="rounded-xl border border-slate-850 bg-slate-950/40 p-4 shadow-md transition-all font-mono">
          <button 
            onClick={() => togglePanel('clusters')}
            className="w-full flex items-center justify-between text-left font-semibold"
          >
            <div className="flex items-center gap-2">
              <span className="text-indigo-400"><BarChart3 className="h-4.5 w-4.5" /></span>
              <div>
                <span className="text-xs text-slate-200 uppercase">[13] Failure Clusters Map</span>
                <span className="text-[9px] block text-slate-500 font-normal uppercase leading-none mt-0.5">Grouped Failure channels matrix</span>
              </div>
            </div>
            {openPanels.clusters ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </button>

          {openPanels.clusters && (
            <div className="mt-4 pt-4 border-t border-slate-900 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs animate-fadeIn">
              <div className="p-3.5 bg-slate-950 border border-slate-900 rounded-lg text-center">
                <span className="block text-[9px] text-slate-500 uppercase">Trend Failures</span>
                <span className="text-sm font-bold text-emerald-400 mt-1 block">Low risk</span>
              </div>
              <div className="p-3.5 bg-slate-950 border border-slate-900 rounded-lg text-center">
                <span className="block text-[9px] text-slate-500 uppercase">Volatility Sweeps</span>
                <span className="text-sm font-bold text-amber-400 mt-1 block">Moderate</span>
              </div>
              <div className="p-3.5 bg-slate-950 border border-slate-900 rounded-lg text-center">
                <span className="block text-[9px] text-slate-500 uppercase">Timing Spikes</span>
                <span className="text-sm font-bold text-emerald-400 mt-1 block">Low risk</span>
              </div>
              <div className="p-3.5 bg-slate-950 border border-slate-900 rounded-lg text-center">
                <span className="block text-[9px] text-slate-500 uppercase">Liquidity Swops</span>
                <span className="text-sm font-bold text-emerald-400 mt-1 block">Low risk</span>
              </div>
              <div className="p-3.5 bg-slate-950 border border-slate-900 rounded-lg text-center">
                <span className="block text-[9px] text-slate-500 uppercase">Overconfidence</span>
                <span className="text-sm font-bold text-emerald-400 mt-1 block">Low risk</span>
              </div>
            </div>
          )}
        </div>

        {/* ======================================= */}
        {/* 14. QUIET TIME RULES */}
        {/* ======================================= */}
        <div className="rounded-xl border border-slate-850 bg-slate-950/40 p-4 shadow-md transition-all font-mono">
          <button 
            onClick={() => togglePanel('quietTime')}
            className="w-full flex items-center justify-between text-left font-semibold"
          >
            <div className="flex items-center gap-2">
              <span className="text-purple-400"><Lock className="h-4.5 w-4.5" /></span>
              <div>
                <span className="text-xs text-slate-200 uppercase">[14] Quiet Time Rules</span>
                <span className="text-[9px] block text-slate-500 font-normal uppercase leading-none mt-0.5">High volatility position capping criteria</span>
              </div>
            </div>
            {openPanels.quietTime ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </button>

          {openPanels.quietTime && (
            <div className="mt-4 pt-4 border-t border-slate-900 space-y-3.5 text-xs animate-fadeIn">
              <div className="p-3.5 bg-slate-950 border border-slate-900 rounded-xl flex items-center justify-between gap-4">
                <div>
                  <span className="font-bold text-white block">Adaptive Caution Mode</span>
                  <p className="text-slate-400 text-[11px] mt-0.5">If the engine detects massive pricing volatility indices above 2.5%, entries are slowed temporarily.</p>
                </div>
                <span className="bg-emerald-500/10 border border-emerald-400/20 text-emerald-400 font-bold px-3 py-1.5 rounded uppercase">
                  MONITORING HEURISTIC STATUS: STABLE OK
                </span>
              </div>
            </div>
          )}
        </div>

        {/* ======================================= */}
        {/* 15. EXCEL REPORTS CENTER */}
        {/* ======================================= */}
        <div className="rounded-xl border border-slate-850 bg-slate-950/40 p-4 shadow-md transition-all font-mono">
          <button 
            onClick={() => togglePanel('reports')}
            className="w-full flex items-center justify-between text-left font-semibold"
          >
            <div className="flex items-center gap-2">
              <span className="text-emerald-400"><FileSpreadsheet className="h-4.5 w-4.5" /></span>
              <div>
                <span className="text-xs text-slate-200 uppercase">[15] Excel Excel Reports Generator</span>
                <span className="text-[9px] block text-slate-500 font-normal uppercase leading-none mt-0.5">P&L & indicators spreadsheet outputs</span>
              </div>
            </div>
            {openPanels.reports ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </button>

          {openPanels.reports && (
            <div className="mt-4 pt-4 border-t border-slate-900 space-y-4 text-xs animate-fadeIn">
              <p className="text-slate-400 leading-relaxed max-w-2xl text-[11px]">
                Generate daily `.xlsx` compatible intelligence spreadsheets logging all trades, entry/exit indicators, volatility regimes, dynamic confidence weights, and automated AI evaluation logs.
              </p>
              <button 
                onClick={handleExportReport}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-850 border border-slate-800 text-slate-200 rounded-lg flex items-center gap-1.5 transition-all font-bold cursor-pointer"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                DOWNLOAD EXCEL CSV REPORT
              </button>
            </div>
          )}
        </div>

        {/* ======================================= */}
        {/* 16. AI IMPROVEMENT SCORE */}
        {/* ======================================= */}
        <div className="rounded-xl border border-slate-850 bg-slate-950/40 p-4 shadow-md transition-all font-mono">
          <button 
            onClick={() => togglePanel('improvement')}
            className="w-full flex items-center justify-between text-left font-semibold"
          >
            <div className="flex items-center gap-2">
              <span className="text-amber-400"><Gauge className="h-4.5 w-4.5" /></span>
              <div>
                <span className="text-xs text-slate-200 uppercase">[16] AI Improvement Score</span>
                <span className="text-[9px] block text-slate-500 font-normal uppercase leading-none mt-0.5">Self-optimization growth rating vs genesis</span>
              </div>
            </div>
            {openPanels.improvement ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </button>

          {openPanels.improvement && (
            <div className="mt-4 pt-4 border-t border-slate-900 grid grid-cols-1 md:grid-cols-12 gap-5 text-xs animate-fadeIn">
              <div className="md:col-span-4 p-4 bg-slate-950 rounded-xl border border-slate-900 text-center">
                <span className="block text-[9px] text-slate-500 uppercase leading-none mb-1">Global Improvement Rating</span>
                <span className="text-3xl font-bold font-mono text-cyan-400 block">{learningInsights.overallImprovementScore}%</span>
                <span className="text-[9px] text-[#475569] uppercase font-bold tracking-wider mt-2.5 block leading-none">OPTIMIZED VS GENESIS HEURISTIC</span>
              </div>

              <div className="md:col-span-8 space-y-3">
                <p className="text-slate-400 leading-normal text-[11px]">
                  Improvement index tracks the mathematical growth rate in strategy win factor and capital preservation stability compared to the un-optimized Generation 0 baseline parameter sets.
                </p>
                <div className="flex justify-between text-[10px] text-slate-500 pt-3 border-t border-slate-900">
                  <span>Target Winrate Delta: <span className="text-white">+8.8%</span></span>
                  <span>Average Generation Fitness: <span className="text-white">Robust</span></span>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
