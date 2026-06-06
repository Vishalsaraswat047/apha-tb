import React from 'react';
import { Target, Zap, Activity, Info, Trophy, ChevronRight } from 'lucide-react';
import { StrategyDna } from '../types';

interface StrategyListProps {
  strategies: StrategyDna[];
  generation: number;
}

export default function StrategyList({ strategies, generation }: StrategyListProps) {
  const top10 = strategies.slice(0, 10);
  const remainingCount = Math.max(0, strategies.length - 10);

  return (
    <div className="rounded-xl bg-[#0b0f19] border border-slate-800 p-5 shadow-xl" id="evolving-genetics-list">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold tracking-wide text-slate-200 uppercase flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" /> Active Survivors (Cohort Gen {generation})
        </h3>
        <span className="text-[10px] font-mono bg-cyan-500/10 border border-cyan-400/20 text-cyan-400 py-1 px-2.5 rounded font-medium">
          POPULATION: {strategies.length}/50
        </span>
      </div>

      <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1 select-none">
        {top10.map((strat, idx) => {
          const isTopTier = idx === 0;
          return (
            <div
              key={strat.id}
              className={`p-3 rounded-lg border transition-all ${
                isTopTier
                  ? 'bg-amber-400/[0.03] border-amber-400/30'
                  : 'bg-slate-900/50 border-slate-800 hover:border-slate-700/80'
              }`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold font-mono ${
                      isTopTier ? 'bg-amber-400 text-[#070a13]' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {idx + 1}
                  </span>
                  <div>
                    <h4 className="text-xs font-semibold text-slate-200 font-mono flex items-center gap-1.5 leading-none">
                      {strat.name}
                      {isTopTier && <span className="text-[9px] font-mono tracking-wider font-bold bg-amber-400/10 text-amber-400 px-1 rounded uppercase">Alpha</span>}
                    </h4>
                    <span className="text-[9px] text-slate-500 font-mono">ID: {strat.id}</span>
                  </div>
                </div>

                <div className="text-right font-mono">
                  <span className="block text-[10px] text-slate-500">Fitness</span>
                  <span className={`text-xs font-bold ${isTopTier ? 'text-amber-400' : 'text-slate-300'}`}>
                    {(strat.fitness || 0).toFixed(4)}
                  </span>
                </div>
              </div>

              {/* DNA Gene sequence summary */}
              <div className="mt-2.5 grid grid-cols-2 xs:grid-cols-3 gap-1.5 text-[9px] font-mono text-slate-400 bg-slate-950/40 p-2 rounded border border-slate-900">
                <div>
                  <span className="text-slate-500">RSI Period:</span>{' '}
                  <span className="text-cyan-400 font-semibold">{strat.params.rsi_period}</span>
                </div>
                <div>
                  <span className="text-slate-500">Fast EMA:</span>{' '}
                  <span className="text-amber-500 font-semibold">{strat.params.ema_fast}</span>
                </div>
                <div>
                  <span className="text-slate-500">Slow EMA:</span>{' '}
                  <span className="text-pink-400 font-semibold">{strat.params.ema_slow}</span>
                </div>
                <div>
                  <span className="text-slate-500">OS Threshold:</span>{' '}
                  <span className="text-indigo-400 font-semibold">≤ {strat.entry_rules.rsi_oversold}</span>
                </div>
                <div>
                  <span className="text-slate-500">OB Threshold:</span>{' '}
                  <span className="text-purple-400 font-semibold">≥ {strat.exit_rules.rsi_overbought}</span>
                </div>
                <div>
                  <span className="text-slate-500">TS Target:</span>{' '}
                  <span className="text-emerald-400 font-semibold">{(strat.exit_rules.trailing_stop * 100).toFixed(2)}%</span>
                </div>
              </div>

              {/* Performance Metrics */}
              {strat.metrics && (
                <div className="mt-2 flex justify-between items-center text-[10px] font-mono text-slate-400 bg-slate-900/60 p-1 px-2 rounded-md">
                  <div className="flex gap-3">
                    <span>
                      WinR:{' '}
                      <span className="text-emerald-400 font-semibold">
                        {(strat.metrics.win_rate).toFixed(1)}%
                      </span>
                    </span>
                    <span>
                      PF: <span className="text-cyan-400 font-semibold">{strat.metrics.profit_factor}</span>
                    </span>
                    <span>
                      DrawDown:{' '}
                      <span className="text-rose-400 font-semibold">
                        {strat.metrics.max_drawdown}%
                      </span>
                    </span>
                  </div>
                  <span className="text-slate-500 text-[9px]">Trades: {strat.metrics.total_trades}</span>
                </div>
              )}
            </div>
          );
        })}

        {remainingCount > 0 && (
          <div className="p-3 bg-slate-900/30 rounded-lg border border-dashed border-slate-800 text-center font-mono text-[10px] text-slate-500">
            + {remainingCount} other evolved genetic candidates in pool
          </div>
        )}
      </div>
    </div>
  );
}
