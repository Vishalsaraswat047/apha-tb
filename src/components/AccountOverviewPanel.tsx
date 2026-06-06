import React from 'react';
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import {
  Coins,
  TrendingUp,
  Award,
  Activity,
  Lock,
  Wallet,
  Crown
} from 'lucide-react';
import { BotStatus } from '../types';

interface AccountOverviewProps {
  status: BotStatus;
  winRate: number;
  activePositionsCount: number;
  totalTrades: number;
  wonTrades: number;
  lostTrades: number;
  breakevenTrades: number;
  onResetDashboard?: () => void | Promise<void>;
}

const AccountOverviewPanel = React.memo(function AccountOverviewPanel({
  status,
  winRate,
  activePositionsCount,
  totalTrades,
  wonTrades,
  lostTrades,
  breakevenTrades,
  onResetDashboard
}: AccountOverviewProps) {

  const initialBalance = status.initialBalance ?? 10000;
  const availableBalance = status.availableBalance ?? status.balance ?? initialBalance;
  const capitalLocked = status.capitalLocked ?? 0;
  const realizedPnl = status.realizedPnl ?? 0;

  const profitPct = initialBalance > 0 ? (realizedPnl / initialBalance) * 100 : 0;
  const isProfit = realizedPnl >= 0;
  const fmtMoney = (n: number) =>
    '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const realizedSpark = [
    { v: 0 },
    { v: realizedPnl * 0.1 },
    { v: realizedPnl * 0.4 },
    { v: realizedPnl * 0.5 },
    { v: realizedPnl * 0.8 },
    { v: realizedPnl }
  ];
  const winRateSpark = [
    { v: 35 }, { v: 42 }, { v: 48 }, { v: 50 }, { v: 55 }, { v: winRate }
  ];

  return (
    <div className="space-y-3 select-none" id="futuristic-account-overview-widgets">

      {/* Halt banner — visible whenever the loss guard has paused trading */}
      {status.isHaltedByLossGuard && (
        <div className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 text-rose-300">
            <span className="text-base">🛑</span>
            <div>
              <div className="font-mono font-bold uppercase tracking-wider text-sm">Trading Halted — Loss Guard Triggered</div>
              <div className="text-[10px] font-mono text-rose-400/80 uppercase tracking-wider">
                3 consecutive losses or recent win rate below 50%. No new entries until reset.
              </div>
            </div>
          </div>
          {onResetDashboard && (
            <button
              onClick={() => {
                if (window.confirm('Reset dashboard to resume trading? Strategy intelligence is preserved.')) {
                  void onResetDashboard();
                }
              }}
              className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-md border border-rose-500/50 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 transition-colors"
            >
              <Activity className="h-3 w-3" /> Reset to Resume
            </button>
          )}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-1">
        <div>
          <h2 className="text-base font-bold text-slate-100 tracking-tight">Portfolio &amp; Performance</h2>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            Initial capital · ${initialBalance.toLocaleString()}
          </p>
        </div>
        {onResetDashboard && (
          <button
            onClick={() => {
              if (window.confirm('Reset portfolio state only? Strategy intelligence, market data, and AI learning are preserved.')) {
                void onResetDashboard();
              }
            }}
            className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider px-3 py-1.5 rounded-md border border-slate-700 bg-slate-900/60 text-slate-300 hover:border-cyan-500/50 hover:text-cyan-300 transition-colors"
            title="Clear portfolio state only — strategy intelligence preserved"
          >
            <Activity className="h-3 w-3" /> Reset Dashboard
          </button>
        )}
      </div>

      {/* ─── Portfolio: 3 tiles ────────────────────────────────────────── */}
      <div>
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2 px-1">Portfolio</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

          {/* Initial Capital */}
          <div className="rounded-xl bg-[#090d16]/85 border border-slate-800/80 p-5 shadow-xl">
            <Coins className="h-4 w-4 text-cyan-400 float-right" />
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Initial Capital</div>
            <div className="text-2xl font-bold font-mono text-cyan-300 mt-1 tracking-tight">
              ${initialBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-slate-600 font-mono mt-1 uppercase">Baseline at start</div>
          </div>

          {/* Available Balance */}
          <div className="rounded-xl bg-[#090d16]/85 border border-slate-800/80 p-5 shadow-xl">
            <Wallet className="h-4 w-4 text-emerald-400 float-right" />
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Available Balance</div>
            <div className="text-2xl font-bold font-mono text-emerald-300 mt-1 tracking-tight">
              {fmtMoney(availableBalance)}
            </div>
            <div className="text-[10px] text-slate-600 font-mono mt-1 uppercase">Cash on hand</div>
          </div>

          {/* Capital Locked */}
          <div className="rounded-xl bg-[#090d16]/85 border border-slate-800/80 p-5 shadow-xl">
            <Lock className="h-4 w-4 text-amber-400 float-right" />
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Capital Locked</div>
            <div className="text-2xl font-bold font-mono text-amber-300 mt-1 tracking-tight">
              {fmtMoney(capitalLocked)}
            </div>
            <div className="text-[10px] text-slate-600 font-mono mt-1 uppercase">
              {activePositionsCount} open position{activePositionsCount === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Performance: 4 tiles ──────────────────────────────────────── */}
      <div>
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-2 px-1">Performance</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

          {/* Realized P/L — big number, just the closed-trade PnL */}
          <div className="rounded-xl bg-[#090d16]/85 border border-slate-800/80 p-5 shadow-xl">
            <TrendingUp className={`h-4 w-4 float-right ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`} />
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Realized P/L</div>
            <div className={`text-3xl font-bold font-mono mt-1 tracking-tight ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isProfit ? '+' : '-'}{fmtMoney(realizedPnl)}
            </div>
            <div className={`text-xs font-mono mt-1 ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
              {isProfit ? '+' : ''}{profitPct.toFixed(2)}%
            </div>
            <div className="h-8 mt-1 opacity-30" style={{ minWidth: '1px' }}>
              <ResponsiveContainer width="99%" height="99%" minWidth={1} minHeight={1} debounce={50}>
                <AreaChart data={realizedSpark} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                  <Area type="monotone" dataKey="v" stroke={isProfit ? '#34d399' : '#f87171'} strokeWidth={1} fill={isProfit ? '#34d399' : '#f87171'} fillOpacity={0.06} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Win Rate — big text, just W / L */}
          <div className="rounded-xl bg-[#090d16]/85 border border-slate-800/80 p-5 shadow-xl">
            <Award className="h-4 w-4 text-indigo-400 float-right" />
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Win Rate</div>
            <div className="text-3xl font-bold font-mono text-[#f1f5f9] mt-1 tracking-tight">
              {winRate.toFixed(1)}%
            </div>
            <div className="text-base font-mono mt-1 flex gap-3">
              <span className="text-emerald-400">W {wonTrades}</span>
              <span className="text-slate-500">BE {breakevenTrades}</span>
              <span className="text-rose-400">L {lostTrades}</span>
            </div>
            <div className="h-8 mt-1 opacity-30" style={{ minWidth: '1px' }}>
              <ResponsiveContainer width="99%" height="99%" minWidth={1} minHeight={1} debounce={50}>
                <AreaChart data={winRateSpark} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                  <Area type="monotone" dataKey="v" stroke="#818cf8" strokeWidth={1} fill="#818cf8" fillOpacity={0.06} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Closed Trades — big number only */}
          <div className="rounded-xl bg-[#090d16]/85 border border-slate-800/80 p-5 shadow-xl">
            <Activity className="h-4 w-4 text-amber-400 float-right" />
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Closed Trades</div>
            <div className="text-3xl font-bold font-mono text-amber-300 mt-1 tracking-tight">
              {totalTrades}
            </div>
            <div className="text-[10px] text-slate-600 font-mono mt-1 uppercase">
              {activePositionsCount > 0 ? `${activePositionsCount} active` : 'no active positions'}
            </div>
          </div>

          {/* Top Strategy — just the name */}
          <div className="rounded-xl bg-[#090d16]/85 border border-slate-800/80 p-5 shadow-xl">
            <Crown className="h-4 w-4 text-purple-400 float-right" />
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Top Strategy</div>
            <div className="text-lg font-bold font-mono text-purple-200 mt-1 tracking-tight truncate" title={status.topStrategyName ?? 'None'}>
              {status.topStrategyName ?? 'None'}
            </div>
            <div className="text-[10px] text-slate-600 font-mono mt-1 uppercase">
              {status.eligibleStrategyCount ?? status.populationSize ?? 0} eligible
            </div>
          </div>
        </div>
      </div>

    </div>
  );
});

export default AccountOverviewPanel;
