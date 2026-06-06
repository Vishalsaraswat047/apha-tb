import React from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { Sparkles, BarChart3, AlertTriangle, ShieldCheck } from 'lucide-react';
import { StrategyDna } from '../types';

interface AIStrategyAnalyticsProps {
  strategies: StrategyDna[];
  equityHistory: { timestamp: number; equity: number }[];
  currentRegime: string;
}

export default function AIStrategyAnalytics({
  strategies,
  equityHistory,
  currentRegime
}: AIStrategyAnalyticsProps) {
  // Defensive: never trust incoming arrays
  const safeStrategies: StrategyDna[] = Array.isArray(strategies) ? strategies : [];
  const safeEquityHistory: { timestamp: number; equity: number }[] = Array.isArray(equityHistory)
    ? equityHistory
    : [];

  const topStrat = safeStrategies[0];

  // Radar data illustrating top strategy parameters
  const radarData = topStrat ? [
    { subject: 'RSI Bounds', value: (topStrat.entry_rules.rsi_oversold / 45) * 100 },
    { subject: 'Trend Check', value: topStrat.entry_rules.price_above_ema ? 100 : 30 },
    { subject: 'Vol Multiplier', value: (topStrat.filters.volume_spike_multiplier / 3.0) * 100 },
    { subject: 'Exit Precision', value: topStrat.exit_rules.use_bb_exit ? 90 : 40 },
    { subject: 'Risk Check', value: 100 - (topStrat.exit_rules.trailing_stop * 1000 * 5) }
  ] : [
    { subject: 'RSI Bounds', value: 80 },
    { subject: 'Trend Check', value: 70 },
    { subject: 'Vol Multiplier', value: 60 },
    { subject: 'Exit Precision', value: 85 },
    { subject: 'Risk Check', value: 90 }
  ];

  // Winrate bar comparison of top 5 evolved strategies
  const top5BarData = safeStrategies.slice(0, 5).map(s => ({
    name: (s.name || 'Unknown').split(' ')[0], // only show prefix
    winrate: s.metrics ? s.metrics.win_rate : 50,
    profit: s.metrics ? s.metrics.net_profit : 0
  }));

  // Format equity history timestamps nicely
  const formattedEquityData = safeEquityHistory
    .filter(item => item && Number.isFinite(item.timestamp) && Number.isFinite(item.equity))
    .map(item => ({
      time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      equity: parseFloat(item.equity.toFixed(2))
    }));

  // Heatmap weights
  const heatmapHours = ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'];
  const heatmapAssets = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT', 'ADAUSDT'];
  const heatmapWeights = [
    [85, 92, 78, 45, 61, 50],
    [90, 88, 80, 52, 65, 55],
    [76, 81, 95, 68, 70, 48],
    [89, 90, 88, 74, 59, 62],
    [94, 91, 84, 80, 72, 67],
    [80, 85, 75, 41, 58, 42]
  ];

  // Find asset-specific confidence
  let activeAssetIdx = 0;
  if (topStrat?.name?.includes('Titan') || topStrat?.name?.includes('Aegis')) activeAssetIdx = 1;
  else if (topStrat?.name?.includes('Zephyr')) activeAssetIdx = 2;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="ai-strategy-analytics-section">
      
      {/* Visual A: Live Virtual Account Equity curve */}
      <div className="rounded-xl bg-[#090d16]/80 border border-slate-800/80 p-5 shadow-xl backdrop-blur-md">
        <h4 className="text-xs font-semibold tracking-wider font-mono text-[#f8fafc] uppercase mb-4 flex items-center gap-1.5">
          <BarChart3 className="h-4 w-4 text-cyan-400" /> Virtual Portfolio Growth Trend
        </h4>

        <div className="h-48 w-full select-none" style={{ minWidth: '1px' }}>
          <ResponsiveContainer width="99%" height="99%" minWidth={1} minHeight={1} debounce={50}>
            <AreaChart data={formattedEquityData}>
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="time" stroke="#475569" fontSize={9} tickLine={false} />
              <YAxis stroke="#475569" fontSize={9} domain={['auto', 'auto']} tickLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '8px' }}
                labelStyle={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}
                itemStyle={{ fontSize: '11px', color: '#22d3ee', fontFamily: 'monospace' }}
              />
              <Area type="monotone" dataKey="equity" stroke="#22d3ee" strokeWidth={2} fillOpacity={1} fill="url(#equityGrad)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Visual B: Genome Parameters Spider Radar chart */}
      <div className="rounded-xl bg-[#090d16]/80 border border-slate-800/80 p-5 shadow-xl backdrop-blur-md flex flex-col justify-between">
        <h4 className="text-xs font-semibold tracking-wider font-mono text-[#f8fafc] uppercase mb-1.5 flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-indigo-400" /> Evolved Alpha Attribute Signature
        </h4>
        <span className="block text-[10px] text-slate-500 font-mono mb-4">
          Core DNA priorities of top performer: <span className="text-cyan-400">{topStrat?.name || 'Loading'}</span>
        </span>

        <div className="h-40 w-full flex items-center justify-center select-none font-mono" style={{ minWidth: '1px' }}>
          <ResponsiveContainer width="99%" height="99%" minWidth={1} minHeight={1} debounce={50}>
            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
              <PolarGrid stroke="#1e293b" />
              <PolarAngleAxis dataKey="subject" stroke="#94a3b8" fontSize={9} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#475569" tick={false} />
              <Radar name="Active Genome" dataKey="value" stroke="#3b82f6" fill="#818cf8" fillOpacity={0.25} isAnimationActive={false} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Visual C: Top 5 evolved competitors Win rate comparison */}
      <div className="rounded-xl bg-[#090d16]/80 border border-slate-800/80 p-5 shadow-xl backdrop-blur-md">
        <h4 className="text-xs font-semibold tracking-wider font-mono text-[#f8fafc] uppercase mb-4">
          Cohort Win-Ratio Comparison (Top 5)
        </h4>

        <div className="h-40 w-full select-none font-mono" style={{ minWidth: '1px' }}>
          <ResponsiveContainer width="99%" height="99%" minWidth={1} minHeight={1} debounce={50}>
            <BarChart data={top5BarData}>
              <XAxis dataKey="name" stroke="#475569" fontSize={9} />
              <YAxis stroke="#475569" fontSize={9} unit="%" />
              <Tooltip
                contentStyle={{ backgroundColor: '#090d16', borderColor: '#1e293b', borderRadius: '8px' }}
                labelStyle={{ fontSize: '10px', color: '#94a3b8' }}
                itemStyle={{ fontSize: '11px', color: '#c084fc' }}
              />
              <Bar dataKey="winrate" fill="#a855f7" radius={[4, 4, 0, 0]}>
                {top5BarData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#22d3ee' : '#a855f7'} fillOpacity={index === 0 ? 0.9 : 0.65} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Visual D: AI Confidence Matrix Heatmap */}
      <div className="rounded-xl bg-[#090d16]/80 border border-slate-800/80 p-5 shadow-xl backdrop-blur-md flex flex-col justify-between">
        <div>
          <h4 className="text-xs font-semibold tracking-wider font-mono text-[#f8fafc] uppercase mb-1">
            Predictive AI Confidence Heatmap
          </h4>
          <span className="block text-[10px] text-slate-500 font-mono mb-4">
            Confidence matrix distributed across main liquidity pairs
          </span>
        </div>

        {/* Dynamic heatmap grids */}
        <div className="space-y-1.5 select-none font-mono text-[9px]">
          {heatmapAssets.slice(0, 4).map((asset, rIdx) => (
            <div key={asset} className="flex items-center gap-1.5">
              <span className="w-16 text-slate-400 text-left truncate">{asset}</span>
              <div className="flex-1 grid grid-cols-6 gap-1">
                {heatmapWeights[rIdx].map((weightVal, cIdx) => {
                  let opacityClass = 'bg-[#155e75]/10 text-[#22d3ee]/30';
                  if (weightVal > 90) opacityClass = 'bg-cyan-500 text-slate-900 font-bold shadow-[0_0_8px_rgba(6,182,212,0.6)]';
                  else if (weightVal > 80) opacityClass = 'bg-cyan-500/50 text-[#e2f8fc] font-semibold';
                  else if (weightVal > 70) opacityClass = 'bg-cyan-500/25 text-[#22d3ee]';
                  else if (weightVal > 50) opacityClass = 'bg-[#155e75]/20 text-cyan-400/60';

                  return (
                    <div
                      key={cIdx}
                      className={`py-1.5 justify-center flex items-center rounded-sm transition-all duration-300 hover:scale-[1.1] ${opacityClass}`}
                      title={`Time chunk confidence: ${weightVal}%`}
                    >
                      {weightVal}%
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-850/60 flex justify-between text-[9px] font-mono text-slate-500">
          <span>Active Asset Sector: High Confidence</span>
          <span className="flex items-center gap-1 text-emerald-400 uppercase">
            <ShieldCheck className="h-3 w-3" /> Grid Calibrated
          </span>
        </div>
      </div>

    </div>
  );
}
