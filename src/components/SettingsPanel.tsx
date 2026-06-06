import React, { useState } from 'react';
import { Play, Square, RotateCcw, ShieldCheck, RefreshCw, Layers, Search, PlusCircle, Zap, Radio } from 'lucide-react';
import { BotStatus } from '../types';

interface SettingsPanelProps {
  status: BotStatus;
  selectedSymbol: string;
  onSymbolChange: (symbol: string) => void;
  onToggleBot: () => void;
  onForceEvolve: () => void;
  onReset: () => void;
  isEvolving: boolean;
}

const BINANCE_ASSETS = {
  MAJORS: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'LTCUSDT'],
  ALTS: ['AVAXUSDT', 'ADAUSDT', 'DOTUSDT', 'MATICUSDT', 'LINKUSDT', 'ATOMUSDT', 'NEARUSDT', 'FILUSDT', 'ICPUSDT', 'FTMUSDT', 'AAVEUSDT'],
  MEMES: ['DOGEUSDT', 'SHIBUSDT', 'PEPEUSDT', 'WIFUSDT', 'BONKUSDT', 'FLOKIUSDT'],
  TRENDING: ['APTUSDT', 'OPUSDT', 'ARBUSDT', 'SUIUSDT', 'TIAUSDT', 'LDOUSDT', 'RENDERUSDT', 'FETUSDT']
};

export default function SettingsPanel({
  status,
  selectedSymbol,
  onSymbolChange,
  onToggleBot,
  onForceEvolve,
  onReset,
  isEvolving
}: SettingsPanelProps) {
  const [activeCategory, setActiveCategory] = useState<'MAJORS' | 'ALTS' | 'MEMES' | 'TRENDING'>('MAJORS');
  const [searchQuery, setSearchQuery] = useState('');
  const [customSymbol, setCustomSymbol] = useState('');
  const [isTogglingContinuous, setIsTogglingContinuous] = useState(false);
  const [customError, setCustomError] = useState('');

  // Extract all assets for the search feature
  const allPrefixedSymbols = [
    ...BINANCE_ASSETS.MAJORS,
    ...BINANCE_ASSETS.ALTS,
    ...BINANCE_ASSETS.MEMES,
    ...BINANCE_ASSETS.TRENDING
  ];

  // Unique list of symbols
  const uniquePredefined = Array.from(new Set(allPrefixedSymbols));

  // Handle continuous toggle API trigger
  const handleToggleContinuous = async () => {
    setIsTogglingContinuous(true);
    try {
      const res = await fetch('/api/toggle-continuous', { method: 'POST' });
      if (res.ok) {
        // Trigger a symbol reload or refresh on same symbol to update parent state telemetry
        onSymbolChange(selectedSymbol);
      }
    } catch (err) {
      console.error('Failed to toggle continuous mode:', err);
    } finally {
      setIsTogglingContinuous(false);
    }
  };

  // Submission handler for custom currency type-in
  const handleCustomSymbolSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCustomError('');
    
    let sanitized = customSymbol.trim().toUpperCase();
    if (!sanitized) return;

    // Standardize symbol suffix
    if (!sanitized.endsWith('USDT') && !sanitized.endsWith('BUSD')) {
      sanitized += 'USDT';
    }

    if (sanitized.length < 5) {
      setCustomError('Invalid cryptocurrency pairing string.');
      return;
    }

    onSymbolChange(sanitized);
    setCustomSymbol('');
  };

  // Filter based on selected category or search filter
  const displayedSymbols = searchQuery
    ? uniquePredefined.filter(sym => sym.toLowerCase().includes(searchQuery.toLowerCase()))
    : BINANCE_ASSETS[activeCategory];

  return (
    <div className="rounded-xl bg-[#0b0f19]/80 border border-slate-800/85 p-5 shadow-xl backdrop-blur-md space-y-6" id="settings-control-panel">
      
      {/* Visual Workspace header */}
      <div className="flex justify-between items-center border-b border-slate-850 pb-3">
        <h3 className="text-sm font-semibold tracking-wide text-slate-200 uppercase flex items-center gap-2">
          <Layers className="h-4.5 w-4.5 text-cyan-400" /> Multi-Token Configuration
        </h3>
        <span className="text-[9px] font-mono leading-none bg-cyan-500/10 border border-cyan-400/20 text-cyan-400 py-1 px-2.5 rounded font-bold uppercase">
          {selectedSymbol} LOADING
        </span>
      </div>

      {/* Categorized Token Finder with Search Filter */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Select Active Binance Market Asset
          </label>
          
          {/* Quick Search filter Input */}
          <div className="relative w-full sm:w-48 text-xs">
            <span className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none text-slate-500">
              <Search className="h-3.5 w-3.5" />
            </span>
            <input
              type="text"
              placeholder="Search coins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1 rounded bg-slate-950 border border-slate-850 text-[11px] text-slate-200 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>
        </div>

        {/* Categories Tab Selector (Visible when search query is empty) */}
        {!searchQuery && (
          <div className="flex flex-wrap gap-1 bg-slate-950 p-1 rounded-lg border border-slate-900 select-none">
            {(['MAJORS', 'ALTS', 'MEMES', 'TRENDING'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`flex-1 py-1 px-2.5 rounded text-[10px] uppercase font-mono font-bold transition-all text-center cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-slate-900 border border-slate-800 text-cyan-400 font-bold'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Render coins Grid selection */}
        <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
          {displayedSymbols.map((sym) => (
            <button
              key={sym}
              onClick={() => {
                setSearchQuery('');
                onSymbolChange(sym);
              }}
              className={`flex-1 py-2 px-3 rounded-lg text-[11px] font-mono justify-center transition-all cursor-pointer ${
                selectedSymbol === sym
                  ? 'bg-cyan-500/10 border border-cyan-400 text-cyan-400 font-bold shadow-inner'
                  : 'bg-slate-950/60 border border-slate-850 text-slate-400 hover:bg-slate-900 hover:text-slate-300'
              }`}
            >
              {sym.replace('USDT', '')}
              <span className="text-[8px] text-slate-600 ml-1 font-normal">/USDT</span>
            </button>
          ))}
          {displayedSymbols.length === 0 && (
            <div className="col-span-full text-center py-4 text-slate-500 text-[10px] font-mono">
              No matching preset coins in catalog.
            </div>
          )}
        </div>
      </div>

      {/* Custom Pair form to add anything on Binance */}
      <form onSubmit={handleCustomSymbolSubmit} className="space-y-2 border-t border-slate-850/60 pt-4">
        <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider">
          Query Any Valid Binance Asset Pairing (Direct API)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. PEPE, BNB, MATIC, ATOM, LINK"
            value={customSymbol}
            onChange={(e) => setCustomSymbol(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-[#f8fafc] placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 border border-slate-800 hover:bg-slate-850 hover:text-slate-100 text-slate-300 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
          >
            <PlusCircle className="h-4 w-4 text-cyan-400" /> Apply Pair
          </button>
        </div>
        {customError && (
          <p className="text-[10px] text-rose-400 font-mono">{customError}</p>
        )}
        <p className="text-[9px] text-[#475569] font-mono">
          Loads real historical data directly from Binance public REST endpoints automatically. No API connection token keys required.
        </p>
      </form>

      {/* Advanced continuous frequency scalp settings */}
      <div className="space-y-3 border-t border-slate-850/60 pt-4">
        <div className="flex justify-between items-center">
          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider">
              Aegis Continuous Scalping Engine
            </label>
            <span className="text-[9px] text-slate-500 font-mono block mt-0.5">
              Keep strategy evolution continuous while only allowing high-confidence consensus entries
            </span>
          </div>

          <button
            type="button"
            onClick={handleToggleContinuous}
            disabled={isTogglingContinuous}
            className={`px-3 py-1 rounded text-[10px] font-mono font-bold uppercase transition-all select-none cursor-pointer ${
              status.isContinuousMode
                ? 'bg-emerald-500/10 border border-emerald-400/30 text-emerald-400'
                : 'bg-slate-950 border border-slate-850 text-slate-500'
            }`}
          >
            {status.isContinuousMode ? 'ACTIVE / CONTINUOUS' : 'STANDARD CONSENSUS'}
          </button>
        </div>
      </div>

      {/* Execution Control triggers */}
      <div className="space-y-3 border-t border-slate-850/60 pt-4">
        <label className="block text-[11px] font-mono text-slate-400 uppercase tracking-wider">
          Simulated Auto-Trader Controllers
        </label>
        
        <div className="flex flex-col gap-2">
          <button
            onClick={onToggleBot}
            className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-mono text-xs font-medium cursor-pointer transition-all ${
              status.isRunning
                ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30'
                : 'bg-emerald-500 hover:bg-emerald-600 text-[#070a13] font-bold shadow-lg shadow-emerald-500/10'
            }`}
          >
            {status.isRunning ? (
              <>
                <Square className="h-4 w-4 fill-current" /> PAUSE AUTOMATION
              </>
            ) : (
              <>
                <Play className="h-4 w-4 fill-current" /> ACTIVE AEGIS TRADER
              </>
            )}
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={onForceEvolve}
              disabled={isEvolving}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-cyan-500 text-[#070a13] font-bold text-xs font-mono select-none hover:bg-cyan-400 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isEvolving ? 'animate-spin' : ''}`} /> EVOLVE COHORT
            </button>

            <button
              onClick={onReset}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-slate-950 text-slate-400 border border-slate-850 text-xs font-mono font-medium hover:bg-slate-900 hover:text-slate-200 transition-all cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5" /> RESET SIMULATION
            </button>
          </div>
        </div>
      </div>

      {/* Security Check stamp */}
      <div className="pt-3 border-t border-slate-850/50 flex items-center justify-between text-[10px] font-mono text-slate-500 select-none">
        <span>Active Asset Type</span>
        <span className="flex items-center gap-1 text-emerald-400 font-bold">
          <ShieldCheck className="h-3.5 w-3.5" /> SECURE SPOT BRIDGE
        </span>
      </div>

    </div>
  );
}
