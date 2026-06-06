import React, { useState } from 'react';
import { Layers, ShieldAlert, Ban, RefreshCw, TrendingUp } from 'lucide-react';
import { Position } from '../types';

interface ActivePositionsProps {
  positions: Position[];
  currentPrice: number;
  allCoinsTickers?: any[];
  onPositionClosed: () => void;
}

type SortKey = 'symbol' | 'side' | 'entryPrice' | 'currentPrice' | 'cost' | 'pnl';

const ActivePositions = React.memo(function ActivePositions({
  positions,
  currentPrice,
  allCoinsTickers,
  onPositionClosed
}: ActivePositionsProps) {
  const [sortKey, setSortKey] = useState<SortKey>('symbol');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeError, setCloseError] = useState('');

  // Handle position termination trigger
  const handleClosePosition = async (pid: string) => {
    setClosingId(pid);
    setCloseError('');
    try {
      const res = await fetch('/api/close-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: pid })
      });
      if (res.ok) {
        onPositionClosed();
      } else {
        setCloseError('Failed to close position. Try again.');
      }
    } catch (err) {
      setCloseError('Network error closing position.');
    } finally {
      setClosingId(null);
    }
  };

  // Safe guarding positions map
  const activeList = positions.map(pos => {
    const ticker = allCoinsTickers?.find((t: any) => t.symbol === pos.symbol);
    const coinPrice = ticker ? ticker.price : currentPrice;
    // Side-aware PnL: LONG = (mark - entry) * size, SHORT = (entry - mark) * size
    const direction = pos.side === 'SELL' ? -1 : 1;
    const pnl = (coinPrice - pos.entryPrice) * pos.size * direction;
    const pnlPct = pos.entryPrice > 0
      ? ((coinPrice - pos.entryPrice) / pos.entryPrice) * 100 * direction
      : 0;
    return {
      ...pos,
      currentPrice: coinPrice,
      pnl,
      pnlPct,
      strategyName: pos.strategyName || 'Aegis Strategy'
    };
  });

  // Handle sorting logic safely
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const sortedList = [...activeList].sort((a, b) => {
    let aVal: any = a[sortKey];
    let bVal: any = b[sortKey];

    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    } else {
      return aVal < bVal ? 1 : -1;
    }
  });

  if (positions.length === 0) {
    return (
      <div className="rounded-xl bg-[#090d16]/80 border border-slate-800/85 p-5 shadow-xl min-h-[180px] flex flex-col items-center justify-center select-none" id="no-positions-visual">
        <TrendingUp className="h-7 w-7 text-slate-600 mb-2 stroke-[1.5] animate-pulse" />
        <p className="text-slate-400 font-mono text-xs font-semibold uppercase tracking-wider">NO ACTIVE EXPOSURE</p>
        <p className="text-[10px] text-[#475569] font-mono text-center mt-1.5 max-w-xs">
          Neural network scanning Binance orderbooks and rsi/ema parameters to initiate Setup Gen 0...
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[#090d16]/85 border border-slate-800 p-5 shadow-2xl relative overflow-hidden" id="active-exposure-station">
      <div className="flex justify-between items-center mb-4 border-b border-slate-850 pb-3 select-none">
        <h3 className="text-xs font-semibold tracking-wider font-mono text-cyan-400 uppercase flex items-center gap-1.5">
          <Layers className="h-4 w-4 text-cyan-400" /> Active Exposure logs
        </h3>
        <span className="flex items-center gap-1.5 text-[9px] font-mono font-bold text-emerald-400 leading-none bg-emerald-500/10 border border-emerald-500/20 py-0.5 px-2 rounded-full animate-pulse">
          SPOT EXPOSURE AT RISK
        </span>
      </div>

      {/* Sortable Table */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left font-mono text-xs text-slate-300">
          <thead>
            <tr className="border-b border-slate-850 text-slate-500 text-[10px] select-none">
              <th onClick={() => handleSort('symbol')} className="pb-2.5 font-bold tracking-wider uppercase cursor-pointer hover:text-slate-200">PAIR</th>
              <th onClick={() => handleSort('side')} className="pb-2.5 font-bold tracking-wider uppercase cursor-pointer hover:text-slate-200 text-center">SIDE</th>
              <th onClick={() => handleSort('entryPrice')} className="pb-2.5 font-bold tracking-wider uppercase cursor-pointer hover:text-slate-200 text-right">ENTRY</th>
              <th onClick={() => handleSort('currentPrice')} className="pb-2.5 font-bold tracking-wider uppercase cursor-pointer hover:text-slate-200 text-right">MARK_PRICE</th>
              <th onClick={() => handleSort('cost')} className="pb-2.5 font-bold tracking-wider uppercase cursor-pointer hover:text-slate-200 text-right">AMOUNT USED</th>
              <th onClick={() => handleSort('pnl')} className="pb-2.5 font-bold tracking-wider uppercase cursor-pointer hover:text-slate-200 text-right">PNL / NET_%</th>
              <th className="pb-2.5 font-bold tracking-wider uppercase text-center">SL / TP</th>
              <th className="pb-2.5 font-bold tracking-wider uppercase text-left pl-4">STRATEGY</th>
              <th className="pb-2.5 font-bold tracking-wider uppercase text-center">LIQUIDATE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-850/50">
            {sortedList.map((pos) => {
              const isProfit = pos.pnl >= 0;
              const isThisClosing = closingId === pos.id;
              return (
                <tr key={pos.id} className="hover:bg-slate-900/30 transition-colors animate-fadeIn">
                  
                  {/* Pair Column */}
                  <td className="py-3 font-semibold text-[#f8fafc] flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
                    {pos.symbol}
                  </td>

                  {/* Side Column */}
                  <td className="py-3 text-center">
                    <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      {pos.side}
                    </span>
                  </td>

                  {/* Entry Price Column */}
                  <td className="py-3 text-right font-medium text-slate-400">
                    ${pos.entryPrice.toFixed(pos.entryPrice > 100 ? 2 : pos.entryPrice > 1 ? 3 : 6)}
                  </td>

                  {/* Current Mark Price Column */}
                  <td className={`py-3 text-right font-bold transition-all duration-300 ${
                    pos.pnlPct > 0 ? 'text-emerald-400' : pos.pnlPct < 0 ? 'text-rose-400' : 'text-[#f1f5f9]'
                  }`}>
                    ${pos.currentPrice.toFixed(pos.currentPrice > 100 ? 2 : pos.currentPrice > 1 ? 3 : 6)}
                  </td>

                  {/* Amount Used */}
                  <td className="py-3 text-right">
                    <span className="block font-bold text-cyan-400 font-mono">
                      ${pos.cost.toFixed(2)}
                    </span>
                    <span className="text-[9.5px] text-slate-500 font-mono mt-0.5 block">
                      {pos.size.toFixed(5)} Qty
                    </span>
                  </td>

                  {/* PnL Column */}
                  <td className="py-3 text-right">
                    <span className={`block font-bold leading-none ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isProfit ? '+' : ''}${pos.pnl.toFixed(2)}
                    </span>
                    <span className={`text-[10px] font-medium leading-none mt-1 inline-block ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {isProfit ? '+' : ''}{pos.pnlPct.toFixed(2)}%
                    </span>
                  </td>

                  {/* SL / TP Column — real values from position */}
                  <td className="py-3 text-center">
                    <span className="block text-[9px] text-rose-400 font-mono">SL -{pos.stopLoss?.toFixed(2) ?? '—'}%</span>
                    <span className="block text-[9px] text-emerald-400 font-mono">TP +{pos.takeProfit?.toFixed(2) ?? '—'}%</span>
                  </td>

                  {/* Strategy label */}
                  <td className="py-3 text-left pl-4 text-slate-400 text-[11px] font-medium max-w-[120px] truncate">
                    {pos.strategyName}
                  </td>

                  {/* Action buttons column */}
                  <td className="py-3 text-center">
                    <button
                      onClick={() => handleClosePosition(pos.id)}
                      disabled={isThisClosing}
                      className="inline-flex items-center justify-center gap-1.5 py-1 px-3.5 rounded bg-rose-500 hover:bg-rose-600 disabled:opacity-45 text-[#070a13] font-bold text-[10px] tracking-wide transition-all select-none cursor-pointer"
                    >
                      {isThisClosing ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
                      EXIT
                    </button>
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Error feedback */}
      {closeError && (
        <div className="mt-2 text-[10px] font-mono text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded px-3 py-1.5">
          ⚠ {closeError}
        </div>
      )}

      {/* Trailing protection levels — dynamic from actual positions */}
      <div className="mt-4 pt-4 border-t border-slate-850/70 flex flex-col xs:flex-row justify-between text-[10px] font-mono text-slate-500">
        <span className="flex items-center gap-1.5">
          <ShieldAlert className="h-3.5 w-3.5 text-rose-500" />
          Avg Stop-Loss: <span className="text-rose-400 font-bold ml-1">
            -{positions.length > 0 ? (positions.reduce((s, p) => s + (p.stopLoss || 0), 0) / positions.length).toFixed(2) : '—'}%
          </span>
        </span>
        <span className="mt-1 xs:mt-0 flex items-center gap-1 text-emerald-400">
          Avg Take-Profit: <span className="font-bold ml-1">
            +{positions.length > 0 ? (positions.reduce((s, p) => s + (p.takeProfit || 0), 0) / positions.length).toFixed(2) : '—'}%
          </span>
        </span>
      </div>

    </div>
  );
});

export default ActivePositions;
