import React from 'react';
import { History, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { Trade } from '../types';

interface TradeHistoryProps {
  trades: Trade[];
}

const TradeHistory = React.memo(function TradeHistory({ trades }: TradeHistoryProps) {
  // Only render last 50 trades — rendering 1000 rows causes UI lag
  const reversedTrades = trades.slice(-50).reverse();

  return (
    <div className="rounded-xl bg-[#0b0f19] border border-slate-800 p-5 shadow-xl select-none" id="bot-completed-trades-list">
      <h3 className="text-sm font-semibold tracking-wide text-slate-200 uppercase mb-4 flex items-center gap-2">
        <History className="h-4 w-4 text-cyan-400" /> Executive Order Logs
      </h3>

      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {reversedTrades.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <Clock className="h-6 w-6 text-slate-600 mb-2 stroke-1" />
            <p className="text-slate-500 font-mono text-xs">No transactions recorded yet.</p>
            <p className="text-[10px] text-slate-600 font-mono mt-0.5">Ensemble engine scanning market parameters...</p>
          </div>
        ) : (
          reversedTrades.map((trade) => {
            const isBuy = trade.side === 'BUY';
            const hasPnl = trade.pnl !== undefined;
            const isProfit = (trade.pnl || 0) > 0;

            return (
              <div
                key={trade.id}
                className="p-3 bg-[#0e1422] border border-slate-850 rounded-lg flex flex-col md:flex-row justify-between md:items-center gap-2 transition-all hover:border-slate-800"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`flex h-6 px-2 items-center justify-center rounded text-[10px] font-bold font-mono tracking-wider ${
                      isBuy
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                        : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                    }`}
                  >
                    {trade.side}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-slate-300 font-mono leading-none">
                        {trade.symbol}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {new Date(trade.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono mt-1 italic max-w-lg">
                      {trade.reason}
                    </p>
                  </div>
                </div>

                <div className="text-right font-mono flex items-center justify-between md:flex-col md:justify-center md:items-end border-t border-slate-850/50 md:border-t-0 pt-2 md:pt-0">
                  <div className="flex flex-col items-start md:items-end">
                    <span className="text-[9px] text-slate-500 uppercase leading-none md:mb-1">VALUE</span>
                    <span className="text-xs font-semibold text-slate-300">${trade.value.toFixed(2)}</span>
                  </div>

                  {hasPnl && (
                    <div className="flex flex-col items-end mt-0 md:mt-1.5 pl-4 md:pl-0 border-l border-slate-850 md:border-l-0">
                      <span className="text-[9px] text-slate-500 uppercase leading-none mb-1 hidden md:inline">PNL</span>
                      <span
                        className={`text-xs font-bold leading-none ${
                          isProfit ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isProfit ? '+' : ''}${trade.pnl?.toFixed(2)} ({isProfit ? '+' : ''}
                        {(trade.pnl_pct ?? 0).toFixed(2)}%)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
});

export default TradeHistory;
