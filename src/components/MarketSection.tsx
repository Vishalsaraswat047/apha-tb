import React, { useState } from 'react';
import { Activity, Coins, TrendingUp, TrendingDown, Eye, Compass, RefreshCw, Star } from 'lucide-react';
import { BotStatus } from '../types';

interface MarketSectionProps {
  status: BotStatus;
  onSymbolSelect: (symbol: string) => void;
}

export default function MarketSection({ status, onSymbolSelect }: MarketSectionProps) {
  const [search, setSearch] = useState('');
  const [favoriteCoins, setFavoriteCoins] = useState<string[]>(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']);

  const tickersList = status.allCoinsTickers || [];

  const toggleFavorite = (sym: string) => {
    if (favoriteCoins.includes(sym)) {
      setFavoriteCoins(prev => prev.filter(x => x !== sym));
    } else {
      setFavoriteCoins(prev => [...prev, sym]);
    }
  };

  const getMarketBias = (rsi: number) => {
    if (rsi < 30) return { label: 'STRONG BUY', color: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' };
    if (rsi < 40) return { label: 'BUY', color: 'border-emerald-500/20 text-emerald-500 bg-emerald-500/5' };
    if (rsi > 70) return { label: 'STRONG SELL', color: 'border-rose-500/30 text-rose-400 bg-rose-500/10' };
    if (rsi > 60) return { label: 'SELL', color: 'border-rose-500/20 text-rose-500 bg-rose-500/5' };
    return { label: 'HOLD & WAIT', color: 'border-slate-800 text-slate-500 bg-slate-950' };
  };

  const filteredCoins = tickersList.filter(coin => 
    coin.symbol.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="rounded-xl bg-[#090d16]/85 border border-slate-850 p-5 shadow-2xl relative overflow-hidden" id="binance-universe-market-ledgers">
      
      {/* Background glow flares */}
      <div className="absolute top-0 right-10 w-44 h-44 bg-cyan-500/5 rounded-full filter blur-xl pointer-events-none" />

      {/* Header telemetry metrics */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-slate-800 pb-4 select-none">
        
        <div>
          <h3 className="text-xs font-semibold tracking-wider font-mono text-cyan-400 uppercase flex items-center gap-2">
            <Compass className="h-4 w-4 animate-spin-slow" /> Binance Spot Net Ticker Matrix
          </h3>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">Real-time indicators stream across {tickersList.length} spot market pairings</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Quick search input */}
          <div className="relative flex-1 md:w-56 bg-slate-950 rounded-lg border border-slate-850 p-1 flex items-center">
            <input
              type="text"
              placeholder="Search ticker (e.g. SOLUSDT)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent border-none text-[10px] font-mono text-slate-200 outline-none w-full placeholder-slate-600 px-2"
            />
          </div>

          <span className="text-[9px] font-mono leading-none bg-cyan-500/10 border border-cyan-400/20 text-cyan-400 py-1.5 px-3 rounded font-bold uppercase flex items-center gap-1.5">
            <RefreshCw className="h-2.5 w-2.5 animate-spin" /> LIVE STREAMING
          </span>
        </div>

      </div>

      {/* Market table list layout */}
      <div className="overflow-x-auto w-full">
        {filteredCoins.length === 0 ? (
          <div className="p-12 text-center text-xs font-mono text-slate-500">
            No coin symbols matches configured searches.
          </div>
        ) : (
          <table className="w-full text-left font-mono text-[10px] select-none" id="binance-matrix-table">
            <thead>
              <tr className="border-b border-slate-800 text-slate-500 uppercase tracking-wider text-[8px] select-none">
                <th className="py-2.5 px-3 text-center w-8">Fav</th>
                <th className="py-2.5 px-3">Asset Pair</th>
                <th className="py-2.5 px-3">Trading Price</th>
                <th className="py-2.5 px-3">24h Change</th>
                <th className="py-2.5 px-3">24h Volume</th>
                <th className="py-2.5 px-3 text-center">RSI (14)</th>
                <th className="py-2.5 px-3 text-center">Market Bias</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {filteredCoins.map((coin) => {
                const isFav = favoriteCoins.includes(coin.symbol);
                const isPositive = (coin.priceChangePercent || 0) >= 0;
                const bias = getMarketBias(coin.rsi);
                const isActiveMainSymbol = status.selectedSymbol === coin.symbol;

                return (
                  <tr 
                    key={coin.symbol} 
                    className={`hover:bg-slate-900/50 transition-colors group ${
                      isActiveMainSymbol ? 'bg-cyan-500/5 border-l border-cyan-500' : ''
                    }`}
                  >
                    <td className="py-2 px-3 text-center">
                      <button 
                        onClick={() => toggleFavorite(coin.symbol)}
                        className={`hover:scale-110 transition-transform ${isFav ? 'text-amber-400' : 'text-slate-600 hover:text-slate-400'}`}
                      >
                        <Star className="h-3.5 w-3.5 fill-current" />
                      </button>
                    </td>

                    <td className="py-2 px-3 font-semibold text-slate-200">
                      <div className="flex items-center gap-1">
                        {isActiveMainSymbol && (
                          <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping mr-1" />
                        )}
                        <span>{coin.symbol}</span>
                      </div>
                    </td>

                    <td className="py-2 px-3 font-bold text-[#f1f5f9]">
                      ${coin.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </td>

                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center gap-0.5 font-bold ${
                        isPositive ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {isPositive ? '+' : ''}{(coin.priceChangePercent || 0).toFixed(2)}%
                      </span>
                    </td>

                    <td className="py-2 px-3 text-slate-400">
                      ${(coin.volume / 1_000_000).toFixed(2)}M USD
                    </td>

                    <td className="py-2 px-3 text-center">
                      <span className={`font-bold ${
                        coin.rsi < 36 ? 'text-emerald-400' : coin.rsi > 64 ? 'text-rose-400' : 'text-slate-300'
                      }`}>
                        {coin.rsi.toFixed(1)}
                      </span>
                    </td>

                    <td className="py-2 px-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[8px] font-bold border ${bias.color}`}>
                        {bias.label}
                      </span>
                    </td>

                    <td className="py-2 px-3 text-right">
                      {isActiveMainSymbol ? (
                        <span className="text-[8px] text-cyan-400 bg-cyan-500/10 border border-cyan-400/35 rounded px-2.5 py-1 font-bold">
                          CHARGING SIM
                        </span>
                      ) : (
                        <button
                          onClick={() => onSymbolSelect(coin.symbol)}
                          className="px-2.5 py-1 rounded bg-[#09152b] hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/20 hover:border-cyan-400/40 text-[9px] font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Eye className="h-3 w-3" /> Launch sim
                        </button>
                      )}
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
}
