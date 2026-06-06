import React, { useState } from 'react';
import { Activity, Search, ShieldAlert, Sparkles, Filter, ChevronUp, ChevronDown, CheckCircle, AlertTriangle } from 'lucide-react';
import { BotStatus, StrategyDna } from '../types';

interface LiveSignalsPanelProps {
  status: BotStatus;
  strategies: StrategyDna[];
}

const LiveSignalsPanel = React.memo(function LiveSignalsPanel({ status, strategies }: LiveSignalsPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'BUY' | 'SELL' | 'HOLD'>('ALL');

  const tickersList = status.allCoinsTickers || [];

  const serverSignalsMap = new Map(status.latestSignals?.map(sig => [sig.symbol, sig]) || []);

  // Generate enriched signals using the backend signal feed when available
  const enrichedSignals = tickersList.map((tick) => {
    const serverSignal = serverSignalsMap.get(tick.symbol);
    const confidence = serverSignal ? serverSignal.confidence : Math.min(98, Math.max(40, Math.round(45 + Math.abs(tick.rsi - 50) * 2.2)));
    const signalType = serverSignal ? serverSignal.signalType : (tick.rsi < 35 ? 'BUY' : tick.rsi > 65 ? 'SELL' : 'HOLD');
    const decision = serverSignal ? serverSignal.decision : (signalType === 'BUY' ? 'BUY (ACCEPTED)' : signalType === 'SELL' ? 'SELL (ACCEPTED)' : 'HOLD (MONITORING)');
    const isAccepted = serverSignal ? serverSignal.isAccepted : signalType !== 'HOLD';
    const badgeColor = serverSignal
      ? serverSignal.isAccepted
        ? signalType === 'BUY'
          ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 animate-pulse'
          : 'border-rose-500/30 text-rose-400 bg-rose-500/10'
        : 'border-slate-800 text-slate-500 bg-slate-950'
      : signalType === 'BUY'
        ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10 animate-pulse'
        : signalType === 'SELL'
          ? 'border-rose-500/30 text-rose-400 bg-rose-500/10'
          : 'border-slate-800 text-slate-500 bg-slate-950';

    return {
      symbol: tick.symbol,
      price: tick.price,
      change24h: tick.priceChangePercent || 0,
      volume: tick.volume,
      rsi: tick.rsi,
      confidence,
      signalType,
      decision,
      isAccepted,
      badgeColor
    };
  });

  // Apply Search and Tab logic filters
  const filtered = enrichedSignals.filter(sig => {
    const matchesSearch = sig.symbol.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'ALL' || sig.signalType === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="rounded-xl bg-[#090d16]/85 border border-slate-850 p-5 shadow-xl relative overflow-hidden" id="live-neural-signals-workspace">
      
      {/* Background neon light flare */}
      <div className="absolute top-0 right-1/4 w-32 h-32 bg-cyan-500/5 rounded-full filter blur-xl pointer-events-none" />

      {/* Header controls section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5 border-b border-slate-800/80 pb-4 select-none">
        <div>
          <h3 className="text-xs font-semibold tracking-wider font-mono text-cyan-400 uppercase flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-400 animate-pulse" /> Neural Co-Signal Feed
          </h3>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">Unified Real-Time Decision-Matrix of all Binance Pairs</p>
        </div>

        {/* Tab filters and searching bars */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Filter badges */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-850">
            {(['ALL', 'BUY', 'SELL', 'HOLD'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-2 py-1 rounded text-[9px] font-mono font-bold transition-all cursor-pointer ${
                  filterType === type
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-400/35'
                    : 'text-slate-500 hover:text-slate-300 border border-transparent'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          {/* Core search field */}
          <div className="relative flex-1 md:w-48 bg-slate-950 rounded-lg border border-slate-850 p-1 flex items-center">
            <Search className="h-3.5 w-3.5 text-slate-500 ml-1.5 mr-2" />
            <input
              type="text"
              placeholder="Search ticker..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-transparent border-none text-[10px] font-mono text-slate-200 outline-none w-full placeholder-slate-600"
            />
          </div>
        </div>
      </div>

      {/* Matrix Ledger table layout */}
      <div className="overflow-x-auto w-full">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs font-mono text-slate-500 select-none">
            No active neural assets matching selected telemetry filters.
          </div>
        ) : (
          <table className="w-full text-left font-mono text-[10px] select-none" id="neural-matrix-ledger">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider text-[8px]">
                <th className="py-2.5 px-3">Coin Ticker</th>
                <th className="py-2.5 px-3">Live Price</th>
                <th className="py-2.5 px-3">24h Change</th>
                <th className="py-2.5 px-3 text-center">RSI (14)</th>
                <th className="py-2.5 px-2">Volume (24h)</th>
                <th className="py-2.5 px-3 text-center">Confidence</th>
                <th className="py-2.5 px-3 text-right">Aegis AI recommendation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {filtered.map((sig, idx) => {
                const isPositive = sig.change24h >= 0;
                
                return (
                  <tr key={sig.symbol} className="hover:bg-slate-900/40 transition-colors group">
                    <td className="py-2 px-3 font-semibold text-slate-200 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500/20 group-hover:bg-cyan-400 group-hover:shadow-[0_0_6px_#22d3ee] transition-all" />
                      {sig.symbol}
                    </td>
                    <td className="py-2 px-3 text-slate-300 font-bold">
                      ${sig.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </td>
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center gap-0.5 font-semibold ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPositive ? '+' : ''}{sig.change24h.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex flex-col items-center">
                        <span className={`font-bold ${sig.rsi < 36 ? 'text-emerald-400' : sig.rsi > 64 ? 'text-rose-400' : 'text-slate-400'}`}>
                          {sig.rsi.toFixed(1)}
                        </span>
                        {/* Micro RSI slider visual */}
                        <div className="w-14 h-1 bg-slate-950 rounded-full mt-1 relative overflow-hidden border border-slate-900">
                          <div 
                            className={`h-full absolute rounded ${sig.rsi < 36 ? 'bg-emerald-400' : sig.rsi > 64 ? 'bg-rose-400' : 'bg-slate-700'}`}
                            style={{ left: `${Math.min(90, Math.max(10, sig.rsi))}%`, width: '4px', transform: 'translateX(-2px)' }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-2 px-2 text-slate-400 font-mono">
                      ${(sig.volume / 1_000_000).toFixed(1)}M
                    </td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-12 bg-slate-950 h-2 rounded overflow-hidden border border-slate-900">
                          <div 
                            className={`h-full rounded ${sig.isAccepted ? 'bg-cyan-400' : 'bg-slate-700'}`}
                            style={{ width: `${sig.confidence}%` }}
                          />
                        </div>
                        <span className={`font-semibold ${sig.isAccepted ? 'text-cyan-400' : 'text-slate-400'}`}>{sig.confidence}%</span>
                      </div>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] font-mono font-bold border ${sig.badgeColor}`}>
                        {sig.isAccepted ? <CheckCircle className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5 text-slate-500" />}
                        {sig.decision}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

    </div>
  );
});

export default LiveSignalsPanel;
