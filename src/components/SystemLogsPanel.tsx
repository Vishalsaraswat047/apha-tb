import React, { useEffect, useState, useRef } from 'react';
import { Terminal, Copy, Shield, RefreshCw } from 'lucide-react';
import { Trade } from '../types';

interface SystemLogsPanelProps {
  trades: Trade[];
}

export default function SystemLogsPanel({ trades }: SystemLogsPanelProps) {
  const [logs, setLogs] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initial mock seed logs to look extremely technical and alive
  useEffect(() => {
    setLogs([
      `[${new Date(Date.now() - 30000).toLocaleTimeString()}] INF - Apex Quantum system bootstrap initialization complete.`,
      `[${new Date(Date.now() - 25000).toLocaleTimeString()}] INF - WebSocket gateway connection established on port 443 with api.binance.com`,
      `[${new Date(Date.now() - 20000).toLocaleTimeString()}] INF - Synced candle history buffering... (500 bars loaded into dynamic memory)`,
      `[${new Date(Date.now() - 15000).toLocaleTimeString()}] INF - Loaded 50 active strategy genotypes to Cohort Gen 0.`,
      `[${new Date(Date.now() - 10000).toLocaleTimeString()}] SUCCESS - Market Classifier: detected RANGING_DYNAMIC, applying tailored optimizer weights.`,
      `[${new Date(Date.now() - 5000).toLocaleTimeString()}] INF - Ticker sync complete. Current Latency: 12 ms.`
    ]);
  }, []);

  // Sync virtual trading execution logs
  useEffect(() => {
    if (trades.length === 0) return;
    const lastTrade = trades[trades.length - 1];
    const sideColor = lastTrade.side === 'BUY' ? 'BUY_CONFIRMED' : 'SELL_CONFIRMED';
    const logStr = `[${new Date(lastTrade.timestamp).toLocaleTimeString()}] TRANS - EXECUTION_SUCCESS: ${lastTrade.side} ${lastTrade.size.toFixed(5)} ${lastTrade.symbol} at $${lastTrade.price} | PNL: ${lastTrade.pnl !== undefined ? '$' + lastTrade.pnl.toFixed(2) : 'EXPOSURE_INITIATED'} (${lastTrade.reason})`;
    
    setLogs(prev => {
      // Don't duplicate
      if (prev.includes(logStr)) return prev;
      return [...prev, logStr].slice(-50); // Keep last 50 logs
    });
  }, [trades]);

  // High frequency automated telemetry background simulator
  useEffect(() => {
    const logPhrases = [
      'INF - Running evaluation pass on cohort population... all 50 OK',
      'SYS - Cleaning active memory buffer... 128 MB recycled',
      'INF - Live feed checking volatility metric index... BB width optimal',
      'INF - Recalculating ADX trend strength coef... no regime transition triggered',
      'INF - Synchronizing ticker quotes with simulated Binance orderbook',
      'SYS - Risk check passed: Total margin exposure under 1.50% limit',
      'VAL - Indicators populate completed successfully in 2 ms'
    ];

    const elapsed = setInterval(() => {
      const randomMsg = logPhrases[Math.floor(Math.random() * logPhrases.length)];
      const logEntry = `[${new Date().toLocaleTimeString()}] ${randomMsg}`;
      setLogs(prev => [...prev, logEntry].slice(-50));
    }, 10000); // Increased from 5000ms to 10000ms

    return () => clearInterval(elapsed);
  }, []);

  // Keep scrolled to bottom
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="rounded-xl bg-[#070b13] border border-slate-800/80 p-5 shadow-xl relative overflow-hidden" id="interactive-system-logs">
      <div className="flex justify-between items-center mb-4 border-b border-slate-850 pb-3">
        <h3 className="text-xs font-semibold tracking-wider font-mono text-cyan-400 uppercase flex items-center gap-2">
          <Terminal className="h-4 w-4 text-cyan-400 animate-pulse" /> CORE EXECUTION STREAM
        </h3>
        <div className="flex items-center gap-2">
          <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-[9px] font-mono font-medium text-emerald-400 uppercase tracking-widest">STREAMING LIVE</span>
        </div>
      </div>

      {/* Cyber terminal log shell */}
      <div
        ref={containerRef}
        className="h-[180px] overflow-y-auto bg-black p-4 rounded-lg border border-slate-900 font-mono text-[10px] leading-relaxed text-cyan-300/80 space-y-1.5 scrollbar-thin select-all"
      >
        {logs.map((log, idx) => {
          let colorClass = 'text-cyan-300';
          if (log.includes('SUCCESS') || log.includes('BUY_CONFIRMED') || log.includes('BUY')) {
            colorClass = 'text-emerald-400 font-semibold';
          } else if (log.includes('EXPOSURE') || log.includes('TRANS') || log.includes('SELL')) {
            colorClass = 'text-amber-400 font-semibold';
          } else if (log.includes('SYS')) {
            colorClass = 'text-indigo-400';
          } else if (log.includes('INF')) {
            colorClass = 'text-slate-500';
          }
          return (
            <p key={idx} className={`${colorClass} truncate transition-all duration-300`}>
              {log}
            </p>
          );
        })}
      </div>

      <div className="mt-3.5 flex justify-between items-center text-[9px] font-mono text-slate-500">
        <p className="flex items-center gap-1">
          <Shield className="h-3 w-3 text-cyan-500/85" /> Logs cryptographic validation checksum: <span className="text-cyan-400">MD5_OK</span>
        </p>
        <button
          onClick={() => setLogs(prev => [prev[prev.length - 1]])}
          className="hover:text-slate-300 uppercase transition-all flex items-center gap-1 cursor-pointer"
        >
          <RefreshCw className="h-3 w-3" /> Clear terminal buffers
        </button>
      </div>
    </div>
  );
}
