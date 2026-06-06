import React, { useState } from 'react';
import { Shield, ShieldAlert, AlertTriangle, ShieldCheck, Cpu, Sliders } from 'lucide-react';

interface RiskManagementPanelProps {
  maxDrawdown: number;
  positionSizingPct: number;
  stopLossPct: number;
  balance?: number;
}

export default function RiskManagementPanel({
  maxDrawdown,
  positionSizingPct,
  stopLossPct,
  balance = 10000
}: RiskManagementPanelProps) {
  const [leverage, setLeverage] = useState(1);
  const aiRiskScore = 32; // Low risk score scale

  const currentProfitVal = balance - 10000.0;
  const allocatedEquityVal = Math.min(balance, currentProfitVal > 0 ? (10000.0 + currentProfitVal * 0.5) : balance);
  const sizingPercent = balance > 0 ? (allocatedEquityVal / balance) * 100 : 100;

  return (
    <div className="rounded-xl bg-[#090d16] border border-slate-800 p-5 shadow-xl relative overflow-hidden" id="risk-management-panel">
      <div className="absolute top-0 right-0 h-16 w-16 bg-gradient-to-br from-rose-500/5 to-transparent blur-md pointer-events-none" />

      <div className="flex justify-between items-center mb-4 border-b border-slate-850 pb-3">
        <h3 className="text-xs font-semibold tracking-wider font-mono text-cyan-400 uppercase flex items-center gap-2">
          <Shield className="h-4 w-4 text-cyan-400 animate-pulse" /> Core Risk Control console
        </h3>
        <span className="text-[9px] font-mono leading-none bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 py-1 px-2.5 rounded font-bold uppercase">
          AEGIS CONTROL SECURE
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        
        {/* Risk meter 1: Exposure Level */}
        <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-lg">
          <span className="block text-[9px] font-mono text-slate-500 uppercase leading-none">EXPOSURE RATIO</span>
          <span className="text-sm font-bold font-mono text-[#f8fafc] block mt-2.5">{sizingPercent.toFixed(1)}%</span>
          
          <div className="w-full bg-slate-900 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${sizingPercent}%` }} />
          </div>
          <span className="text-[9px] text-[#475569] font-mono mt-2 block uppercase text-emerald-400">100% PRINCIPAL + 50% Profit</span>
        </div>

        {/* Risk meter 2: Max Drawdown */}
        <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-lg">
          <span className="block text-[9px] font-mono text-slate-500 uppercase leading-none">HISTORIC MAX DRAWDOWN</span>
          <span className="text-sm font-bold font-mono text-rose-400 block mt-2.5">-{maxDrawdown.toFixed(2)}%</span>
          
          <div className="w-full bg-slate-900 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-rose-400 h-full rounded-full" style={{ width: `${Math.min(100, maxDrawdown * 10)}%` }} />
          </div>
          <span className="text-[9px] text-[#475569] font-mono mt-2 block uppercase">CRITICAL SYSTEM THRESHOLD: -10%</span>
        </div>

        {/* Risk meter 3: Positioning Sizing bounds */}
        <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-lg">
          <span className="block text-[9px] font-mono text-slate-500 uppercase leading-none">AUTO POSITION SIZING limit</span>
          <span className="text-sm font-bold font-mono text-slate-300 block mt-2.5">Capital + 50% Profit</span>
          
          <div className="w-full bg-slate-900 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-indigo-400 h-full rounded-full" style={{ width: `${sizingPercent}%` }} />
          </div>
          <span className="text-[9px] text-[#475569] font-mono mt-2 block uppercase text-[#a5f3fc]">Stop-loss boundary: {stopLossPct}%</span>
        </div>

        {/* Risk meter 4: Leverage monitor */}
        <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-lg flex flex-col justify-between">
          <div>
            <span className="block text-[9px] font-mono text-slate-500 uppercase leading-none">LEVERAGE MULTIPLIER</span>
            <span className="text-sm font-bold font-mono text-amber-500 block mt-2.5">{leverage}X SPOT SPORT</span>
          </div>

          <div className="flex items-center gap-1.5 mt-2 bg-slate-900 p-1 rounded border border-slate-850 justify-between font-mono text-[9px]">
            <button
              onClick={() => setLeverage(prev => Math.max(1, prev - 1))}
              className="px-1.5 py-0.5 hover:bg-slate-800 text-slate-300 rounded cursor-pointer font-bold select-none"
            >
              -
            </button>
            <span className="text-slate-400">MULTIPLIER</span>
            <button
              onClick={() => setLeverage(prev => Math.min(10, prev + 1))}
              className="px-1.5 py-0.5 hover:bg-slate-800 text-slate-300 rounded cursor-pointer font-bold select-none"
            >
              +
            </button>
          </div>
        </div>

        {/* Risk meter 5: Neural Risk Score dial */}
        <div className="p-4 bg-slate-950/40 border border-slate-900 rounded-lg relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <Cpu className="h-4 w-4 text-emerald-400 absolute right-3 top-3 animate-pulse" />
          
          <span className="block text-[9px] font-mono text-slate-500 uppercase leading-none">INTELLIGENT RISK SCORE</span>
          <span className="text-sm font-bold font-mono text-emerald-400 block mt-2.5">{aiRiskScore}/100</span>
          
          <div className="bg-emerald-405/10 text-emerald-400 text-[8px] font-mono py-0.5 px-1.5 border border-emerald-400/20 rounded mt-2 text-center uppercase font-bold tracking-wider leading-none">
            LOW_RISK_SPECTRUM
          </div>
        </div>

      </div>
    </div>
  );
}
