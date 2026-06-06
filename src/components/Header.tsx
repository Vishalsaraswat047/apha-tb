import React, { useEffect, useState } from 'react';
import {
  Bell,
  Cpu,
  Globe,
  Radio,
  Clock,
  Shield,
  Activity,
  User,
  Zap,
  TrendingUp,
  BrainCircuit
} from 'lucide-react';
import { BotStatus } from '../types';

interface HeaderProps {
  status: BotStatus;
  currentSymbol: string;
  tradeAttemptCount: number;
  tradeAcceptedCount: number;
}

export default function Header({ status, currentSymbol, tradeAttemptCount, tradeAcceptedCount }: HeaderProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Pull live prices from server tickers instead of fake local state
  const tickers = status.allCoinsTickers || [];
  const btcTicker = tickers.find((t: any) => t.symbol === 'BTCUSDT');
  const ethTicker = tickers.find((t: any) => t.symbol === 'ETHUSDT');

  const btcPrice = btcTicker?.price ?? 0;
  const ethPrice = ethTicker?.price ?? 0;
  const btcChange = btcTicker?.priceChangePercent ?? 0;
  const ethChange = ethTicker?.priceChangePercent ?? 0;

  // Fear & Greed proxy from RSI average across all tickers
  const avgRsi = tickers.length > 0
    ? tickers.reduce((s: number, t: any) => s + (t.rsi || 50), 0) / tickers.length
    : 50;
  const fearGreedScore = Math.round(avgRsi);
  const fearGreedLabel = fearGreedScore >= 70 ? 'EXTREME GREED' : fearGreedScore >= 55 ? 'GREED' : fearGreedScore >= 45 ? 'NEUTRAL' : fearGreedScore >= 30 ? 'FEAR' : 'EXTREME FEAR';
  const fearGreedColor = fearGreedScore >= 60 ? 'text-emerald-400' : fearGreedScore >= 45 ? 'text-amber-400' : 'text-rose-400';

  return (
    <header className="h-16 border-b border-slate-850 bg-[#090d18]/85 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40 select-none w-full" id="futuristic-dashboard-header">
      
      {/* Live asset pair indicator & status ticker */}
      <div className="flex items-center gap-6">
        {/* BTC Widget */}
        <div className="hidden md:flex items-center gap-2.5 bg-slate-900/50 border border-slate-800 rounded-lg p-1.5 px-3">
          <div className="h-2 w-2 rounded-full bg-[#f7931a]" />
          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-[10px] font-bold font-mono text-slate-300">BTC/USDT</span>
              <span className={`text-[9px] font-mono font-bold ${btcChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {btcChange >= 0 ? '+' : ''}{btcChange.toFixed(2)}%
              </span>
            </div>
            <span className={`text-xs font-bold font-mono tracking-tight ${btcChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ${btcPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* ETH Widget */}
        <div className="hidden lg:flex items-center gap-2.5 bg-slate-900/50 border border-slate-800 rounded-lg p-1.5 px-3">
          <div className="h-2 w-2 rounded-full bg-[#627eea]" />
          <div>
            <div className="flex items-center gap-1.5 leading-none">
              <span className="text-[10px] font-bold font-mono text-slate-300">ETH/USDT</span>
              <span className={`text-[9px] font-mono font-bold ${ethChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {ethChange >= 0 ? '+' : ''}{ethChange.toFixed(2)}%
              </span>
            </div>
            <span className={`text-xs font-bold font-mono tracking-tight ${ethChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ${ethPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        {/* Global Market Sentiment — live from RSI average */}
        <div className="hidden xl:flex items-center gap-2.5 bg-slate-900/50 border border-slate-800 rounded-lg p-1.5 px-3">
          <Activity className="h-3.5 w-3.5 text-cyan-400" />
          <div>
            <span className="block text-[8px] font-mono text-slate-500 uppercase leading-none">GLOBAL SENTIMENT</span>
            <span className={`text-[10px] font-bold font-mono flex items-center gap-1 uppercase ${fearGreedColor}`}>
              {fearGreedLabel} ({fearGreedScore}/100) <TrendingUp className="h-3 w-3" />
            </span>
          </div>
        </div>
      </div>

      {/* Center live logo badge when sidebar is tucked in (on portable screens) */}
      <div className="flex md:hidden items-center gap-2">
        <Cpu className="h-5 w-5 text-cyan-400 animate-pulse" />
        <span className="text-xs font-bold font-mono text-[#f8fafc]">APEX QUANT</span>
      </div>

      {/* Meta Indicators, Clock, Profile */}
      <div className="flex items-center gap-4">
        {/* AI Health Meter */}
        <div className="flex items-center gap-2 bg-indigo-500/5 border border-indigo-500/20 rounded-lg p-1.5 px-2.5">
          <BrainCircuit className="h-4 w-4 text-cyan-400 animate-pulse" />
          <div className="hidden xs:block text-left leading-none font-mono">
            <span className="block text-[8px] text-slate-500 uppercase">AI ENGINE STATE</span>
            <span className="text-[10px] font-semibold text-indigo-300">OPTIMAL HEURISTICS</span>
          </div>
        </div>

        {/* WebSocket Signal */}
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-400 bg-slate-900/50 border border-slate-850 rounded-lg p-1.5 px-2.5">
          <Radio className="h-3.5 w-3.5 text-emerald-400 animate-ping" />
          <span className="hidden xs:inline">WS GATEWAY</span>
        </div>

        {/* Stats Badge */}
        <div className="hidden sm:flex items-center gap-2 bg-slate-900/50 border border-slate-850 rounded-lg p-1.5 px-3">
          <Zap className="h-3.5 w-3.5 text-amber-300" />
          <div className="text-right leading-none">
            <span className="block text-[8px] uppercase text-slate-500 font-mono">Attempts</span>
            <span className="text-[10px] font-semibold text-amber-300">{tradeAttemptCount}</span>
          </div>
          <div className="border-l border-slate-850 pl-3 text-right leading-none">
            <span className="block text-[8px] uppercase text-slate-500 font-mono">Accepted</span>
            <span className="text-[10px] font-semibold text-emerald-400">{tradeAcceptedCount}</span>
          </div>
        </div>

        {/* Real Clock */}
        <div className="hidden sm:flex items-center gap-1.5 font-mono text-[10px] text-slate-400 bg-slate-900/50 border border-slate-850 rounded-lg p-1.5 px-2.5">
          <Clock className="h-3.5 w-3.5 text-slate-500" />
          <span>{time.toLocaleTimeString()} UTC</span>
        </div>

        {/* Notification Bell */}
        <button className="p-1 px-2 rounded-lg bg-slate-900 border border-slate-850 text-slate-400 hover:text-[#f8fafc] hover:border-slate-700 transition-all relative cursor-pointer">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1 right-2 h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
        </button>

        {/* User Badge */}
        <div className="flex items-center gap-2 p-1 pl-1 pr-2.5 rounded-lg bg-gradient-to-r from-slate-900 to-indigo-950/20 border border-slate-850">
          <div className="h-6 w-6 rounded-md bg-cyan-500/15 flex items-center justify-center text-cyan-400">
            <User className="h-3.5 w-3.5" />
          </div>
          <div className="hidden md:block leading-none text-left">
            <span className="block text-[9px] text-[#f8fafc] font-bold font-mono">varsha.quant</span>
            <span className="text-[8px] text-slate-500 font-mono tracking-wide leading-none">ROOT ACCESS</span>
          </div>
        </div>
      </div>

    </header>
  );
}
