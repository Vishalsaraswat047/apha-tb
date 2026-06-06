import React, { useEffect, useState } from 'react';
import { Globe, Radio, Shield, Cpu, Activity, Server, Database } from 'lucide-react';

export default function FooterPanel() {
  const [latency, setLatency] = useState(12);
  const [cpuUsage, setCpuUsage] = useState(4.2);
  const [memoryUsage, setMemoryUsage] = useState(132.4);

  // Fluctuating background telemetry values
  useEffect(() => {
    const interval = setInterval(() => {
      setLatency(prev => {
        const delta = Math.floor((Math.random() - 0.45) * 4);
        return Math.max(6, Math.min(25, prev + delta));
      });
      setCpuUsage(prev => {
        const delta = parseFloat(((Math.random() - 0.5) * 0.8).toFixed(1));
        return Math.max(1.5, Math.min(12.5, parseFloat((prev + delta).toFixed(1))));
      });
      setMemoryUsage(prev => {
        const delta = parseFloat(((Math.random() - 0.49) * 0.3).toFixed(1));
        return Math.max(120.0, Math.min(160.0, parseFloat((prev + delta).toFixed(1))));
      });
    }, 10000); // Increased from 4000ms to 10000ms

    return () => clearInterval(interval);
  }, []);

  return (
    <footer className="mt-auto py-5 border-t border-slate-850 bg-[#05070e] select-none text-slate-500 font-mono text-[10px]" id="interactive-footer-status">
      <div className="max-w-7xl mx-auto px-6 h-full flex flex-col md:flex-row justify-between items-center gap-4">
        
        {/* Left Side: Bot identity */}
        <div className="flex flex-wrap justify-center items-center gap-4">
          <span className="flex items-center gap-1.5 text-slate-400 font-semibold text-[11px]">
            <Server className="h-3.5 w-3.5 text-cyan-400" />
            AEGIS BOT V2.5.2
          </span>
          <span className="bg-slate-900 border border-slate-850 p-1 px-2 rounded">
            LAST SYNC: <span className="text-cyan-400">JUST NOW</span>
          </span>
          <span className="bg-slate-900 border border-slate-850 p-1 px-2 rounded flex items-center gap-1">
            LATENCY: <span className="text-emerald-400 animate-pulse font-bold">{latency} ms</span>
          </span>
        </div>

        {/* Center: Legal/Caution */}
        <div className="text-center text-slate-600 text-[9px] max-w-sm">
          Simulated virtual risk capital only. No real Binance account trade assets are ever committed. Fully isolated.
        </div>

        {/* Right Side: Resources & Bridge Status */}
        <div className="flex flex-wrap justify-center items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Cpu className="h-3 w-3 text-indigo-400" />
            <span>CPU: <span className="text-slate-300 font-semibold">{cpuUsage}%</span></span>
          </div>

          <div className="flex items-center gap-1.5">
            <Database className="h-3 w-3 text-purple-400" />
            <span>MEM: <span className="text-slate-300 font-semibold">{memoryUsage} MB</span></span>
          </div>

          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 py-0.5 px-2 rounded-full font-bold">
            <Radio className="h-3 w-3 text-emerald-400 animate-pulse" />
            BINANCE CORE BRIDGE: ONLINE
          </div>
        </div>

      </div>
    </footer>
  );
}
