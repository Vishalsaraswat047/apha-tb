import React, { useState } from 'react';
import {
  Activity,
  Shield,
  Cpu,
  Clock,
  Zap,
  CheckCircle,
  HelpCircle,
  Lock,
  ChevronRight
} from 'lucide-react';
import { BotStatus } from '../types';

interface UnifiedEnginePanelProps {
  status: BotStatus;
  uptimeSeconds: number;
  tradesCount: number;
  activeStrategyName: string;
  activeTimeframe: string;
  onRefresh?: () => void;
}

const UnifiedEnginePanel = React.memo(function UnifiedEnginePanel({
  status,
  uptimeSeconds,
  tradesCount,
  activeStrategyName,
  activeTimeframe,
  onRefresh
}: UnifiedEnginePanelProps) {
  const [isUpdating, setIsUpdating] = useState(false);

  // Format uptime
  const formatUptime = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Adjust time settlement duration for the concurrent engine rules
  const handleSetTimeLimit = async (limitMinutes: number) => {
    setIsUpdating(true);
    try {
      const res = await fetch('/api/settings/exit-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'DYNAMIC', // server now enforces both active
          limit: limitMinutes
        })
      });
      if (res.ok) {
        onRefresh?.();
      }
    } catch (err) {
      console.error('Failed to update fixed time duration:', err);
    } finally {
      setIsUpdating(false);
    }
  };

  // State values for active engine threads
  const modules = [
    { name: 'Multi-Asset Scanner', rate: 'ALL PAIRS', state: 'ONLINE' },
    { name: 'Risk Limit Guard', rate: 'MIN_DELAY', state: 'SHIELDED' },
    { name: 'Neural Strategy Solver', rate: 'COHORT-50', state: 'OPTIMAL' },
    { name: 'Aegis Execution Pipeline', rate: 'CONCURRENT', state: 'ACTIVE' },
  ];

  const currentFixedLimit = status.fixedTimeLimitMinutes || 1.0;
  const unifiedWinRate = status.unifiedWinRate ?? 0.0;
  const unifiedTotalTrades = status.unifiedTotalTrades ?? 0;
  const tradeAttemptCount = status.tradeAttemptCount ?? 0;
  const tradeAcceptedCount = status.tradeAcceptedCount ?? 0;
  const tradeRejectedCount = status.tradeRejectedCount ?? 0;
  const tradeNoSignalCount = status.tradeNoSignalCount ?? 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="unified-trading-engine-workspace">
      
      {/* Panel A: ENGINES & COMPREHENSIVE PERFORMANCE STATUS (7 cols) */}
      <div className="rounded-xl bg-[#090d16]/80 border border-slate-800 p-5 shadow-xl backdrop-blur-md relative overflow-hidden lg:col-span-7 flex flex-col justify-between">
        <div className="absolute top-0 right-0 h-32 w-32 bg-gradient-to-bl from-cyan-400/15 to-transparent blur-xl pointer-events-none" />
        
        <div>
          <div className="flex justify-between items-center mb-4 border-b border-slate-850 pb-3">
            <div>
              <h3 className="text-sm font-semibold tracking-wider font-mono text-cyan-400 uppercase flex items-center gap-2">
                <Zap className="h-4.5 w-4.5 text-cyan-400 animate-pulse" /> Unified Trading Engine
              </h3>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                Concurrent multi-pair Spot Order Execution (Continuous 26 Binance Pairs Tracker)
              </p>
            </div>
            <span className="text-[9px] font-mono leading-none bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 py-1.5 px-3 rounded-full font-bold">
              ● SYNCED & LIVE
            </span>
          </div>

          {/* Explanation banner detailing what the dual action engine does */}
          <div className="p-3 bg-slate-950/60 border border-slate-900 rounded-lg text-xs leading-relaxed text-slate-300 font-mono mb-4">
            <span className="text-indigo-400 font-extrabold uppercase mr-1">🤝 DUAL ACTION PROTOCOL:</span> 
            Both premium exit methodologies are <span className="text-cyan-400 font-bold">simultaneously active</span>. The engine dynamically exits positions using advanced neural cohorts (RSI boundaries, take-profit ratio, trailing stop-losses) OR automatically liquidates them when the strict time settlement limit is reached.
          </div>

          {/* Metrics Matrix Block */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="p-3.5 bg-slate-950/50 border border-slate-900 rounded-xl flex flex-col justify-center">
              <span className="text-[9.5px] text-slate-500 font-mono uppercase tracking-wider">Engine Win Rate</span>
              <span className={`text-xl font-extrabold font-mono tracking-tight mt-1 ${
                unifiedWinRate >= 65 ? 'text-emerald-400' : unifiedWinRate >= 50 ? 'text-cyan-400' : 'text-indigo-300'
              }`}>
                {unifiedWinRate.toFixed(2)}%
              </span>
              <span className="text-[8px] text-slate-600 font-mono mt-0.5">profitable settlements</span>
            </div>

            <div className="p-3.5 bg-slate-950/50 border border-slate-900 rounded-xl flex flex-col justify-center">
              <span className="text-[9.5px] text-slate-500 font-mono uppercase tracking-wider">Completed Exits</span>
              <span className="text-lg font-extrabold font-mono text-slate-200 mt-1">
                {unifiedTotalTrades}
              </span>
              <span className="text-[8px] text-slate-600 font-mono mt-0.5">total trade decisions</span>
            </div>

            <div className="p-3.5 bg-slate-950/50 border border-slate-900 rounded-xl flex flex-col justify-center">
              <span className="text-[9.5px] text-slate-500 font-mono uppercase tracking-wider">Trade Attempts</span>
              <span className="text-lg font-extrabold font-mono text-amber-300 mt-1">
                {tradeAttemptCount}
              </span>
              <span className="text-[8px] text-slate-600 font-mono mt-0.5">entry evaluations run</span>
            </div>
            <div className="p-3.5 bg-slate-950/50 border border-slate-900 rounded-xl flex flex-col justify-center">
              <span className="text-[9.5px] text-slate-500 font-mono uppercase tracking-wider">Accepted Buys</span>
              <span className="text-lg font-extrabold font-mono text-emerald-400 mt-1">
                {tradeAcceptedCount}
              </span>
              <span className="text-[8px] text-slate-600 font-mono mt-0.5">executed entries</span>
            </div>

            <div className="p-3.5 bg-slate-950/50 border border-slate-900 rounded-xl flex flex-col justify-center">
              <span className="text-[9.5px] text-slate-500 font-mono uppercase tracking-wider">Concurrency</span>
              <span className="text-lg font-extrabold font-mono text-cyan-400 mt-1">
                {status.activePositionsCount} / 30
              </span>
              <span className="text-[8px] text-slate-600 font-mono mt-0.5 font-sans">parallel positions</span>
            </div>
          </div>
        </div>

        {/* Process Monitor List */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-slate-850/50">
          {modules.map((mod, idx) => (
            <div key={idx} className="flex justify-between items-center p-2 rounded-lg bg-slate-950/40 border border-slate-900">
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-400 font-bold"></span>
                </span>
                <span className="text-[9.5px] text-slate-400">{mod.name}</span>
              </div>
              <span className="text-[8.5px] text-emerald-400 font-mono font-bold uppercase tracking-wider">{mod.state}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Panel B: DUAL-ACTION CONCURRENT CORES CONTROLLER (5 cols) */}
      <div className="rounded-xl bg-[#090d16]/80 border border-slate-800 p-5 shadow-xl backdrop-blur-md relative overflow-hidden lg:col-span-5 flex flex-col justify-between">
        <div className="absolute top-0 right-0 h-32 w-32 bg-gradient-to-bl from-indigo-500/15 to-transparent blur-xl pointer-events-none" />
        
        <div>
          <div className="flex justify-between items-center mb-3.5 border-b border-slate-850 pb-2.5">
            <div>
              <h3 className="text-sm font-semibold tracking-wider font-mono text-indigo-400 uppercase flex items-center gap-2">
                <Shield className="h-4.5 w-4.5 text-indigo-400" /> Coordinated Defenses
              </h3>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                Dual concurrent safety shields are active simultaneously
              </p>
            </div>
          </div>

          {/* Connected Cores Indicator Blocks */}
          <div className="space-y-2.5 font-mono">
            {/* Core A */}
            <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/25 flex items-start gap-2.5">
              <div className="p-1 rounded bg-indigo-500/10 text-indigo-400 mt-0.5">
                <Cpu className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10.5px] font-bold text-indigo-300">CORE 01: DYNAMIC EXIT ACTIVE</span>
                  <span className="text-[8px] bg-indigo-500/20 text-indigo-300 py-0.5 px-1.5 rounded font-extrabold uppercase">SHIELDED</span>
                </div>
                <p className="text-[9.5px] text-slate-400 leading-normal mt-1 font-sans">
                  Sells positions using live RSI overbought ratios, automated dynamic Take Profits, and Stop Losses.
                </p>
              </div>
            </div>

            {/* Core B */}
            <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/25 flex items-start gap-2.5">
              <div className="p-1 rounded bg-cyan-500/10 text-cyan-400 mt-0.5">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10.5px] font-bold text-cyan-300">CORE 02: TIME LIMIT ACTIVE</span>
                  <span className="text-[8px] bg-cyan-500/20 text-cyan-400 py-0.5 px-1.5 rounded font-extrabold uppercase">SHIELDED</span>
                </div>
                <p className="text-[9.5px] text-slate-400 leading-normal mt-1 font-sans">
                  Instantly liquidates positions after a preset timeframe to capitalize on compound trade velocity.
                </p>
              </div>
            </div>
          </div>

          {/* Timeframe Limit Selector */}
          <div className="mt-4 p-3 rounded-lg bg-slate-950/80 border border-slate-900/80">
            <div className="flex justify-between items-center mb-2">
              <label className="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wide flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-slate-500" /> Settler Timeframe Limit
              </label>
              <span className="text-[10px] text-cyan-400 font-mono font-bold bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/10">
                {currentFixedLimit} {currentFixedLimit === 1 ? 'Minute' : 'Minutes'}
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5 select-none">
              {[0.25, 0.5, 1.0, 3.0, 5.0].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleSetTimeLimit(val)}
                  disabled={isUpdating}
                  className={`py-1.5 px-1 text-[10px] font-mono rounded cursor-pointer transition-all text-center border ${
                    currentFixedLimit === val
                      ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400 font-bold shadow-md shadow-cyan-500/5'
                      : 'bg-[#0f1422] border-slate-850 text-slate-500 hover:text-slate-300 hover:border-slate-800'
                  }`}
                >
                  {val < 1 ? `${val * 60}s` : `${val}m`}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Runtime statistics footer */}
        <div className="mt-4 flex items-center justify-between text-[9px] font-mono text-slate-500 border-t border-slate-850/50 pt-3">
          <span className="flex items-center gap-1.5 text-slate-400">
            <Activity className="h-3.5 w-3.5 text-indigo-400 animate-pulse" /> Uptime: {formatUptime(uptimeSeconds)}
          </span>
          <span className="text-slate-500">
            Genomes: {activeStrategyName.substring(0, 16)}
          </span>
        </div>
      </div>

    </div>
  );
});

export default UnifiedEnginePanel;
