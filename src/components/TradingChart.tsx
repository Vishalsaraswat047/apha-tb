import React, { useState, useRef, useEffect } from 'react';
import { Candle, Trade } from '../types';
import {
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Compass,
  TrendingUp,
  Wallet,
  DollarSign,
  Gauge,
  LineChart,
  BarChart2
} from 'lucide-react';

interface TradingChartProps {
  candles: Candle[];
  trades: Trade[];
  selectedTimeframe: string;
  onTimeframeChange: (timeframe: '1m' | '5m' | '15m') => void;
  equityHistory?: { timestamp: number; equity: number }[];
}

const TradingChart = React.memo(function TradingChart({
  candles,
  trades,
  selectedTimeframe,
  onTimeframeChange,
  equityHistory = []
}: TradingChartProps) {
  // Dual-mode layout selection: Default to Flagship 'EQUITY' (Total Amount Fluctuation Flow Graph)
  const [activeMode, setActiveMode] = useState<'EQUITY' | 'PRICE'>('EQUITY');
  const [isLineMode, setIsLineMode] = useState(true); // smooth spline vs candlestick for price mode
  const [hoveredPoint, setHoveredPoint] = useState<{ timestamp: number; value: number } | null>(null);
  const [hoveredCandle, setHoveredCandle] = useState<Candle | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [mouseX, setMouseX] = useState<number | null>(null);
  const [mouseY, setMouseY] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [containerHeight, setContainerHeight] = useState<number>(300);

  // Coerce inputs to safe shapes — never trust API payloads.
  const safeCandles: Candle[] = Array.isArray(candles)
    ? candles.filter(
        (c): c is Candle =>
          c !== null &&
          typeof c === 'object' &&
          Number.isFinite((c as Candle).time) &&
          Number.isFinite((c as Candle).open) &&
          Number.isFinite((c as Candle).high) &&
          Number.isFinite((c as Candle).low) &&
          Number.isFinite((c as Candle).close) &&
          Number.isFinite((c as Candle).volume)
      )
    : [];

  const safeTrades: Trade[] = Array.isArray(trades) ? trades : [];
  const safeEquityHistory = Array.isArray(equityHistory) ? equityHistory : [];

  // Measure container so SVG has a real pixel size (avoids width(-1)/height(-0.25))
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0) setContainerWidth(rect.width);
      if (rect.height > 0) setContainerHeight(rect.height);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (safeCandles.length === 0) {
    return (
      <div className="flex h-80 items-center justify-center rounded-xl bg-[#090d16]/80 border border-slate-800 text-slate-500 font-mono text-xs select-none">
        <Activity className="h-4 w-4 animate-spin text-cyan-400 mr-2" /> Initializing multi-vector charting telemetry...
      </div>
    );
  }

  // Fallback if no equity history is present - store as profit/loss from initial 10000
  const activeEquityData = safeEquityHistory.length > 0
    ? safeEquityHistory.map(d => ({
        timestamp: d.timestamp,
        equity: d.equity - 10000  // Convert to profit/loss
      }))
    : [{ timestamp: Date.now() - 60000, equity: 0 }, { timestamp: Date.now(), equity: 0 }];

  // Dimensions of chart
  const width = 850;
  const height = 340;
  const padding = 45;
  const chartHeight = height - padding * 2;
  const chartWidth = width - padding * 2;

  // Mode A: EQUITY SCALING
  const equities = activeEquityData.map((d) => d.equity);
  const maxEquity = Math.max(...equities, 10000) * 1.001;
  const minEquity = Math.min(...equities, 10000) * 0.999;
  const equityRange = maxEquity - minEquity || 1;

  const getEquityX = (index: number) => {
    return padding + (index / (activeEquityData.length - 1)) * chartWidth;
  };

  const getEquityY = (val: number) => {
    return padding + chartHeight - ((val - minEquity) / equityRange) * chartHeight;
  };

  // Mode B: PRICE SCALING
  const highPrices = safeCandles.map((c) => c.high);
  const lowPrices = safeCandles.map((c) => c.low);
  const emaFasts = safeCandles.map((c) => c.ema_fast || c.close).filter((v): v is number => Number.isFinite(v));
  const emaSlows = safeCandles.map((c) => c.ema_slow || c.close).filter((v): v is number => Number.isFinite(v));

  const maxPrice = Math.max(...highPrices, ...emaFasts, ...emaSlows) * 1.0008;
  const minPrice = Math.min(...lowPrices, ...emaFasts, ...emaSlows) * 0.9992;
  const priceRange = maxPrice - minPrice || 1;
  const maxVolume = Math.max(...safeCandles.map((c) => c.volume)) || 1;

  const getPriceX = (index: number) => {
    return padding + (index / (safeCandles.length - 1)) * chartWidth;
  };

  const getPriceY = (price: number) => {
    return padding + chartHeight - ((price - minPrice) / priceRange) * chartHeight;
  };

  // Generate paths for EMAs (Price Mode)
  let fastEmaPath = '';
  let slowEmaPath = '';
  if (activeMode === 'PRICE') {
    safeCandles.forEach((c, i) => {
      if (c.ema_fast) {
        const x = getPriceX(i);
        const y = getPriceY(c.ema_fast);
        if (i === 0 || fastEmaPath === '') fastEmaPath = `M ${x} ${y}`;
        else fastEmaPath += ` L ${x} ${y}`;
      }
      if (c.ema_slow) {
        const x = getPriceX(i);
        const y = getPriceY(c.ema_slow);
        if (i === 0 || slowEmaPath === '') slowEmaPath = `M ${x} ${y}`;
        else slowEmaPath += ` L ${x} ${y}`;
      }
    });
  }

  // Generate Spline Paths for Equity Mode (Capital Fluctuation Flow)
  let equityPath = '';
  let equityFillPath = '';
  if (activeMode === 'EQUITY' && activeEquityData.length >= 2) {
    equityPath = `M ${getEquityX(0)} ${getEquityY(activeEquityData[0].equity)}`;
    equityFillPath = `M ${getEquityX(0)} ${height - padding} L ${getEquityX(0)} ${getEquityY(activeEquityData[0].equity)}`;

    for (let i = 0; i < activeEquityData.length - 1; i++) {
      const x0 = getEquityX(i);
      const y0 = getEquityY(activeEquityData[i].equity);
      const x1 = getEquityX(i + 1);
      const y1 = getEquityY(activeEquityData[i + 1].equity);
      const cpX1 = x0 + (x1 - x0) / 2.5;
      const cpY1 = y0;
      const cpX2 = x0 + (x1 - x0) / 1.67;
      const cpY2 = y1;

      equityPath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${x1} ${y1}`;
      equityFillPath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${x1} ${y1}`;
    }
    equityFillPath += ` L ${getEquityX(activeEquityData.length - 1)} ${height - padding} Z`;
  }

  // Generate Spline Paths for Price Mode
  let closeSplinePath = '';
  let closeFillPath = '';
  if (activeMode === 'PRICE' && safeCandles.length >= 2) {
    closeSplinePath = `M ${getPriceX(0)} ${getPriceY(safeCandles[0].close)}`;
    closeFillPath = `M ${getPriceX(0)} ${height - padding} L ${getPriceX(0)} ${getPriceY(safeCandles[0].close)}`;

    for (let i = 0; i < safeCandles.length - 1; i++) {
      const x0 = getPriceX(i);
      const y0 = getPriceY(safeCandles[i].close);
      const x1 = getPriceX(i + 1);
      const y1 = getPriceY(safeCandles[i + 1].close);
      const cpX1 = x0 + (x1 - x0) / 2.5;
      const cpY1 = y0;
      const cpX2 = x0 + (x1 - x0) / 1.67;
      const cpY2 = y1;

      closeSplinePath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${x1} ${y1}`;
      closeFillPath += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${x1} ${y1}`;
    }
    closeFillPath += ` L ${getPriceX(safeCandles.length - 1)} ${height - padding} Z`;
  }

  // Mouse Interaction Crosshair Mapping
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const svgX = (clickX / rect.width) * width;
    const svgY = (clickY / rect.height) * height;

    if (svgX >= padding && svgX <= width - padding) {
      setMouseX(svgX);
      setMouseY(svgY);

      if (activeMode === 'EQUITY') {
        const pct = (svgX - padding) / chartWidth;
        const index = Math.round(pct * (activeEquityData.length - 1));
        if (index >= 0 && index < activeEquityData.length) {
          setHoveredPoint({
            timestamp: activeEquityData[index].timestamp,
            value: activeEquityData[index].equity
          });
          setHoveredIdx(index);
        }
      } else {
        const pct = (svgX - padding) / chartWidth;
        const index = Math.round(pct * (safeCandles.length - 1));
        if (index >= 0 && index < safeCandles.length) {
          setHoveredCandle(safeCandles[index]);
          setHoveredIdx(index);
        }
      }
    } else {
      handleMouseLeave();
    }
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
    setHoveredCandle(null);
    setHoveredIdx(null);
    setMouseX(null);
    setMouseY(null);
  };

  // Performance computations
  const currentVal = activeEquityData[activeEquityData.length - 1].equity;
  const initialValue = activeEquityData[0].equity;
  const netEarnings = currentVal - initialValue;
  const pnlPercent = (netEarnings / initialValue) * 100;
  
  const recentCandles = safeCandles.slice(-10);
  const trendDir = recentCandles.length >= 2 && recentCandles[recentCandles.length - 1]?.close >= recentCandles[0]?.close ? 'BULLISH' : 'BEARISH';
  const livePrice = safeCandles[safeCandles.length - 1]?.close || 0;

  return (
    <div className="rounded-xl bg-[#090d16]/85 border border-slate-800 p-5 shadow-2xl relative overflow-hidden" id="premium-analytics-dashboard-chart">
      
      {/* Decorative premium header badge or neon glow */}
      <div className="absolute top-0 right-1/4 h-24 w-80 bg-gradient-to-br from-indigo-500/10 via-cyan-500/5 to-transparent blur-2xl pointer-events-none" />

      {/* Main Mode Toggle Tabs and Stats row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-5 border-b border-slate-850 pb-4 select-none">
        <div>
          <div className="flex items-center gap-2">
            <LineChart className="h-4.5 w-4.5 text-cyan-400" />
            <h3 className="text-sm font-semibold tracking-wider font-mono text-slate-100 uppercase">
              {activeMode === 'EQUITY' ? 'Realized Profit & Loss Dynamics' : 'Market Spot Telemetry'}
            </h3>
          </div>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5">
            {activeMode === 'EQUITY' 
              ? 'Real-Time Capital Curve dynamics & compounding flow tracker' 
              : `Binance Spot: Active Pair real-time candlesticks`}
          </p>
        </div>

        {/* Live dynamic quick stats */}
        <div className="flex items-center gap-6">
          {activeMode === 'EQUITY' ? (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="block text-[8px] font-mono text-slate-500 uppercase">Current P&L</span>
                <span className="text-sm font-extrabold font-mono text-cyan-400">
                  ${currentVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                </span>
              </div>
              <div className="text-right border-l border-slate-800 pl-4">
                <span className="block text-[8px] font-mono text-slate-500 uppercase">Daily P&L</span>
                <span className={`text-xs font-bold font-mono py-0.5 px-2 rounded-full inline-flex items-center gap-0.5 mt-0.5 ${
                  netEarnings >= 0 
                    ? 'bg-emerald-500/10 text-emerald-400' 
                    : 'bg-rose-500/10 text-rose-400'
                }`}>
                  {netEarnings >= 0 ? '+' : ''}${netEarnings.toFixed(2)} ({pnlPercent.toFixed(2)}%)
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <span className="block text-[8px] font-mono text-slate-500">LAST BINANCE SPOT</span>
                <span className="text-sm font-extrabold font-mono text-emerald-400 animate-pulse">
                  ${livePrice.toFixed(2)}
                </span>
              </div>
              <div className="text-right border-l border-slate-800 pl-4">
                <span className="block text-[8px] font-mono text-slate-500">TEN-BAR TREND</span>
                <span className={`text-[10px] font-bold font-mono inline-flex items-center gap-0.5 mt-0.5 ${
                  trendDir === 'BULLISH' ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {trendDir === 'BULLISH' ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                  {trendDir}
                </span>
              </div>
            </div>
          )}

          {/* High-fidelity switches */}
          <div className="flex items-center gap-1.5 bg-[#040810] p-1 rounded-lg border border-slate-850">
            <button
              onClick={() => setActiveMode('EQUITY')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeMode === 'EQUITY'
                  ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent'
              }`}
            >
              <Wallet className="h-3.5 w-3.5" /> CAPITAL FLOW
            </button>
            <button
              onClick={() => setActiveMode('PRICE')}
              className={`px-3 py-1.5 rounded-md text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeMode === 'PRICE'
                  ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-400/30'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent'
              }`}
            >
              <Activity className="h-3.5 w-3.5" /> SPOT ASSET
            </button>
          </div>
        </div>
      </div>

      {/* SVG Container Stage */}
      <div ref={containerRef} className="relative w-full" style={{ minHeight: '340px' }}>
        {/* Interactive hover values overlay */}
        {mouseX !== null && (
          <div
            className="absolute top-2 left-4 bg-[#0a0f1d]/90 border border-indigo-500/30 p-2.5 rounded-lg shadow-lg backdrop-blur-md z-20 font-mono text-[10px] leading-relaxed text-slate-300 pointer-events-none select-none max-w-xs animate-slideIn"
          >
            {activeMode === 'EQUITY' && hoveredPoint && (
              <>
                <div className="flex items-center gap-1.5 mb-1 text-slate-400 uppercase tracking-widest text-[8px]">
                  <Wallet className="h-3 w-3 text-indigo-400" /> Capital Point Value
                </div>
                <div>Account Volume: <span className="font-bold text-white">${hoveredPoint.value.toFixed(2)} USDT</span></div>
                <div>Timeline: <span className="text-slate-400">{new Date(hoveredPoint.timestamp).toLocaleTimeString()}</span></div>
                <div className="mt-1 flex items-center gap-1">
                  <span>Relative Win:</span>
                  <span className={`font-bold ${hoveredPoint.value >= 10000 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {(((hoveredPoint.value - 10000) / 10000) * 100).toFixed(2)}%
                  </span>
                </div>
              </>
            )}

            {activeMode === 'PRICE' && hoveredCandle && (
              <>
                <div className="flex items-center gap-1.5 mb-1 text-slate-400 uppercase tracking-widest text-[8px]">
                  <Compass className="h-3 w-3 text-cyan-400" /> Candle Telemetry
                </div>
                <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                  <span>Open: <span className="font-bold text-white">${hoveredCandle.open.toFixed(2)}</span></span>
                  <span>Close: <span className="font-bold text-white">${hoveredCandle.close.toFixed(2)}</span></span>
                  <span>High: <span className="font-bold text-white">${hoveredCandle.high.toFixed(2)}</span></span>
                  <span>Low: <span className="font-bold text-white">${hoveredCandle.low.toFixed(2)}</span></span>
                </div>
                <div className="mt-1 border-t border-slate-800 pt-1">
                  Volume: <span className="font-semibold text-cyan-400">{hoveredCandle.volume.toFixed(1)}</span>
                </div>
              </>
            )}
          </div>
        )}

        {containerWidth > 0 ? (
          <svg
            ref={svgRef}
            width={containerWidth}
            height={containerHeight}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className="w-full border border-slate-900 bg-[#040810]/60 rounded-xl cursor-crosshair overflow-visible"
            style={{ height: `${containerHeight}px` }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
          {/* Neon Gradients def */}
          <defs>
            <linearGradient id="equity-glow-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.25" />
              <stop offset="50%" stopColor="#4f46e5" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#312e81" stopOpacity="0.0" />
            </linearGradient>
            
            <linearGradient id="price-glow-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.22" />
              <stop offset="50%" stopColor="#06b6d4" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#0891b2" stopOpacity="0.0" />
            </linearGradient>

            <filter id="glow-neon-filter" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4.0" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* Guidelines on Y-axis */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
            let label = "";
            let y = 0;
            if (activeMode === 'EQUITY') {
              const val = minEquity + equityRange * ratio;
              y = getEquityY(val);
              label = `$${val.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
            } else {
              const val = minPrice + priceRange * ratio;
              y = getPriceY(val);
              label = `$${val.toFixed(2)}`;
            }

            return (
              <g key={i} className="opacity-[0.08] hover:opacity-25 transition-opacity duration-350">
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke={activeMode === 'EQUITY' ? '#818cf8' : '#38bdf8'} strokeWidth={1} strokeDasharray="3,3" />
                <text x={width - padding + 6} y={y + 3} fill="#94a3b8" className="text-[8.5px] font-mono" textAnchor="start">
                  {label}
                </text>
              </g>
            );
          })}

          {/* Time scales guides */}
          {[20, 50, 80].map((pct, i) => {
            let x = 0;
            let timeString = "";
            
            if (activeMode === 'EQUITY') {
              const idx = Math.floor((pct / 100) * (activeEquityData.length - 1));
              x = getEquityX(idx);
              timeString = new Date(activeEquityData[idx].timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            } else {
              const idx = Math.floor((pct / 100) * (safeCandles.length - 1));
              x = getPriceX(idx);
              timeString = new Date(safeCandles[idx].time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }

            return (
              <g key={i} className="opacity-[0.08]">
                <line x1={x} y1={padding} x2={x} y2={height - padding} stroke="#64748b" strokeWidth={0.5} />
                <text x={x} y={height - padding + 12} fill="#94a3b8" className="text-[8px] font-mono" textAnchor="middle">
                  {timeString}
                </text>
              </g>
            );
          })}

          {/* DRAW MODE A: EQUITY FLUCTUATION */}
          {activeMode === 'EQUITY' && activeEquityData.length >= 2 && (
            <>
              {/* Glowing gradient fill */}
              <path d={equityFillPath} fill="url(#equity-glow-gradient)" className="transition-all duration-300" />
              {/* Premium glowing spline line */}
              <path
                d={equityPath}
                fill="none"
                stroke="#6366f1"
                strokeWidth={2.5}
                filter="url(#glow-neon-filter)"
                className="transition-all duration-300"
              />
            </>
          )}

          {/* DRAW MODE B: SPOT PRICES */}
          {activeMode === 'PRICE' && (
            <>
              {isLineMode ? (
                <>
                  <path d={closeFillPath} fill="url(#price-glow-gradient)" />
                  <path
                    d={closeSplinePath}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth={2}
                    filter="url(#glow-neon-filter)"
                    className="transition-all duration-300"
                  />
                </>
              ) : (
                safeCandles.map((c, i) => {
                  const x = getPriceX(i);
                  const yHigh = getPriceY(c.high);
                  const yLow = getPriceY(c.low);
                  const yOpen = getPriceY(c.open);
                  const yClose = getPriceY(c.close);
                  const isBullish = c.close >= c.open;
                  const strokeColor = isBullish ? '#34d399' : '#f87171';
                  const candleWeight = Math.max(3, chartWidth / safeCandles.length * 0.65);

                  return (
                    <g key={`candle-${i}`}>
                      <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={strokeColor} strokeWidth={1} />
                      <line x1={x} y1={yOpen} x2={x} y2={yClose} stroke={strokeColor} strokeWidth={candleWeight} />
                    </g>
                  );
                })
              )}

              {/* Trade triggers overlay onto Price chart */}
              {safeTrades.map((trade, i) => {
                const candleIdx = safeCandles.findIndex((c) => Math.abs(c.time - trade.timestamp) < 5 * 60 * 1000);
                if (candleIdx === -1) return null;
                const x = getPriceX(candleIdx);
                const y = getPriceY(trade.price);
                const isBuy = trade.side === 'BUY';

                return (
                  <g key={`trade-point-${i}`} className="cursor-pointer">
                    <circle
                      cx={x}
                      cy={y}
                      r={4.5}
                      fill={isBuy ? '#10b981' : '#ef4444'}
                      stroke="#ffffff"
                      strokeWidth={1}
                    />
                    <polygon
                      points={isBuy ? `${x},${y + 11} ${x - 4.5},${y + 17} ${x + 4.5},${y + 17}` : `${x},${y - 11} ${x - 4.5},${y - 17} ${x + 4.5},${y - 17}`}
                      fill={isBuy ? '#10b981' : '#ef4444'}
                    />
                  </g>
                );
              })}
            </>
          )}

          {/* Interactive cursor lines overlay */}
          {mouseX !== null && (
            <g className="pointer-events-none opacity-80">
              <line x1={mouseX} y1={padding} x2={mouseX} y2={height - padding} stroke="#818cf8" strokeWidth={0.8} strokeDasharray="3,3" />
              {mouseY !== null && (
                <line x1={padding} y1={mouseY} x2={width - padding} y2={mouseY} stroke="#818cf8" strokeWidth={0.8} strokeDasharray="3,3" />
              )}
              {hoveredIdx !== null && (
                <circle
                  cx={activeMode === 'EQUITY' ? getEquityX(hoveredIdx) : getPriceX(hoveredIdx)}
                  cy={activeMode === 'EQUITY' ? getEquityY(activeEquityData[hoveredIdx].equity) : getPriceY(safeCandles[hoveredIdx].close)}
                  r={5}
                  fill={activeMode === 'EQUITY' ? '#6366f1' : '#22d3ee'}
                  stroke="#ffffff"
                  strokeWidth={1.5}
                />
              )}
            </g>
          )}
          </svg>
        ) : (
          <div className="h-80 flex items-center justify-center rounded-xl bg-[#040810]/60 border border-slate-900 text-slate-500 font-mono text-xs select-none">
            <Activity className="h-4 w-4 animate-spin text-cyan-400 mr-2" /> Calibrating chart geometry...
          </div>
        )}
      </div>

      <div className="mt-3.5 flex justify-between items-center text-[9px] font-mono text-slate-500 select-none">
        <span className="flex items-center gap-1">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
          </span>
          Streaming continuous neural balance analytics
        </span>

        {/* Dynamic buttons to toggle display components */}
        {activeMode === 'PRICE' && (
          <div className="flex gap-2">
            <button 
              onClick={() => setIsLineMode(true)}
              className={`px-2 py-0.5 rounded text-[8px] tracking-wider ${isLineMode ? 'bg-[#0f172a] text-cyan-400 border border-cyan-500/30' : 'text-slate-600'}`}
            >
              SPLINE
            </button>
            <button 
              onClick={() => setIsLineMode(false)}
              className={`px-2 py-0.5 rounded text-[8px] tracking-wider ${!isLineMode ? 'bg-[#0f172a] text-cyan-400 border border-cyan-500/30' : 'text-slate-600'}`}
            >
              CANDLES
            </button>
          </div>
        )}

        {activeMode === 'EQUITY' && (
          <span>Scale: Auto spanning {activeEquityData.length} records</span>
        )}
      </div>

    </div>
  );
});

export default TradingChart;
