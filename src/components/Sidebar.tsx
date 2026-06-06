import React from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  Activity,
  History,
  Layers,
  Settings,
  Cpu,
  BarChart3,
  Terminal,
  Shield,
  Radio,
  Sliders,
  Brain
} from 'lucide-react';
import type { BotStatus } from '../types';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  status: Pick<BotStatus, 'isRunning' | 'isBinanceConnected'>;
}

export default function Sidebar({ currentTab, setCurrentTab, status }: SidebarProps) {
  const isRunning = status.isRunning;
  const isApiConnected = status.isBinanceConnected;
  const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
    { id: 'ai-observatory', name: 'AI Observatory 🧠', icon: Brain },
    { id: 'markets', name: 'Markets', icon: TrendingUp },
    { id: 'signals', name: 'Signals', icon: Activity },
    { id: 'positions', name: 'Positions', icon: Layers },
    { id: 'trades', name: 'Trades', icon: History },
    { id: 'strategies', name: 'Strategies', icon: Sliders },
    { id: 'analytics', name: 'Analytics', icon: BarChart3 },
    { id: 'ai-engine', name: 'AI Engine', icon: Cpu },
    { id: 'risk', name: 'Risk Manager', icon: Shield },
    { id: 'logs', name: 'System Logs', icon: Terminal },
    { id: 'settings', name: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-68 bg-[#090d18]/95 border-r border-slate-850 flex flex-col h-screen sticky top-0 shrink-0 select-none" id="futuristic-trading-sidebar">
      {/* Brand logo & premium title */}
      <div className="p-5 border-b border-slate-850 flex items-center gap-3">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-cyan-400 via-indigo-500 to-purple-600 flex items-center justify-center text-slate-900 shadow-[0_0_15px_rgba(34,211,238,0.3)]">
          <Cpu className="h-4.5 w-4.5 animate-pulse text-white" />
        </div>
        <div>
          <h2 className="text-xs font-bold font-mono tracking-widest text-[#f8fafc] bg-clip-text">
            APEX QUANT
          </h2>
          <span className="text-[9px] text-cyan-400 font-mono tracking-wider">AEGIS SERIES • V3</span>
        </div>
      </div>

      {/* Navigation list */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin">
        <span className="block text-[8px] font-bold font-mono tracking-widest text-slate-500 uppercase px-3 mb-2">
          OPERATIONAL LAYERS
        </span>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-mono font-medium transition-all group cursor-pointer ${
                isActive
                  ? 'bg-gradient-to-r from-cyan-500/10 to-indigo-500/5 text-cyan-400 border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.05)]'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/40 border border-transparent'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`h-4.5 w-4.5 transition-colors ${isActive ? 'text-cyan-400' : 'text-slate-500 group-hover:text-slate-300'}`} />
                <span>{item.name}</span>
              </div>
              {isActive && <div className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />}
            </button>
          );
        })}
      </nav>

      {/* Bottom Status Widget Panel */}
      <div className="p-4 border-t border-slate-850 bg-slate-950/40 space-y-2 text-[10px] font-mono">
        <span className="block text-[8px] font-bold font-mono tracking-widest text-slate-500 uppercase">
          SYSTEM TELEMETRY
        </span>

        {/* Operating status banner */}
        <div className="p-3.5 rounded-lg bg-[#0b0f19] border border-slate-900 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-slate-500">TRADING MODE:</span>
            <span className="flex items-center gap-1.5 font-bold text-cyan-400 text-[9px]">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-ping" />
              {isApiConnected ? 'SPOT LIVE' : 'PAPER SIM'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-500">TRADER STATUS:</span>
            <span className={`flex items-center gap-1.5 font-bold text-[9px] ${isRunning ? 'text-emerald-400' : 'text-rose-400'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isRunning ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
              {isRunning ? 'ACTIVE' : 'PAUSED'}
            </span>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-slate-500">WEBSOCKET:</span>
            <span className={`flex items-center gap-1.5 font-bold text-[9px] ${isApiConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
              <Radio className={`h-3 w-3 ${isApiConnected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
              {isApiConnected ? 'CONNECTED' : 'SIMULATED'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}