import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BotStatus, Candle, Position, Trade, StrategyDna } from './types';
import { safeCandles, safeTrades, safeEquity, safeStrategies, safePositions } from './lib/safeData';

// Importing Custom Subcomponents
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import AccountOverviewPanel from './components/AccountOverviewPanel';
import TradingChart from './components/TradingChart';
import LiveSignalsPanel from './components/LiveSignalsPanel';
import ActivePositions from './components/ActivePositions';
import TradeHistory from './components/TradeHistory';
import UnifiedEnginePanel from './components/UnifiedEnginePanel';
import AIStrategyAnalytics from './components/AIStrategyAnalytics';
import SystemLogsPanel from './components/SystemLogsPanel';
import RiskManagementPanel from './components/RiskManagementPanel';
import AIInsights from './components/AIInsights';
import SettingsPanel from './components/SettingsPanel';
import StrategyList from './components/StrategyList';
import FooterPanel from './components/FooterPanel';
import AIEvolutionObservatory from './components/AIEvolutionObservatory';
import MarketSection from './components/MarketSection';
import AIBotAssistant from './components/AIBotAssistant';

function mapStatusResponse(data: any): BotStatus {
  const isRunning = typeof data.running === 'boolean' ? data.running : data.isRunning ?? true;
  const isBinanceConnected = typeof data.api_connected === 'boolean'
    ? data.api_connected
    : data.isBinanceConnected ?? false;
  // Server exposes the canonical accounting model.
  const availableBalance = Number(
    data.availableBalance ?? data.paperBalance ?? data.balance ?? 10000
  );
  const initialBalance = Number(data.initialBalance ?? 10000);
  const capitalLocked = Number(data.capitalLocked ?? 0);
  const unrealizedPnl = Number(data.unrealizedPnl ?? 0);
  // Total Equity is always authoritative from the server. If missing, derive.
  const totalEquity = Number(
    data.totalEquity ?? (availableBalance + capitalLocked + unrealizedPnl)
  );
  // Realized PnL is the trade-derived sum (matches /api/trades).
  const realizedPnl = Number(data.realizedPnl ?? data.exec_pnl ?? 0);
  const activePositionsCount = Number(
    data.activePositionsCount ?? data.exec_positions ?? 0
  );
  return {
    isRunning,
    currentRegime: data.currentRegime ?? 'Ranging Dynamic',
    // Canonical portfolio
    initialBalance,
    availableBalance,
    capitalLocked,
    unrealizedPnl,
    realizedPnl,
    totalEquity,
    // Backward-compatible aliases
    balance: availableBalance,
    paperBalance: availableBalance,
    // Trade stats
    averageWin: Number(data.averageWin ?? 0),
    averageLoss: Number(data.averageLoss ?? 0),
    largestWin: Number(data.largestWin ?? 0),
    largestLoss: Number(data.largestLoss ?? 0),
    // Engine state
    generation: Number(data.generation ?? 0),
    populationSize: Number(data.populationSize ?? 0),
    eligibleStrategyCount: Number(data.eligibleStrategyCount ?? data.populationSize ?? 0),
    topStrategyId: data.topStrategyId ?? 'None',
    topStrategyName: data.topStrategyName ?? 'None',
    topStrategyFitness: Number(data.topStrategyFitness ?? 0),
    activePositionsCount,
    lastEvolvedTimestamp: Number(data.lastEvolvedTimestamp ?? Date.now()),
    isBinanceConnected,
    selectedSymbol: data.selectedSymbol ?? 'BTCUSDT',
    isContinuousMode: data.isContinuousMode ?? true,
    afcsActive: data.afcsActive,
    isHaltedByLossGuard: data.isHaltedByLossGuard ?? false,
    aggressiveEntryMode: data.aggressiveEntryMode,
    brainActivityLogs: data.brainActivityLogs,
    allCoinsTickers: data.allCoinsTickers,
    exitMode: data.exitMode,
    fixedTimeLimitMinutes: data.fixedTimeLimitMinutes,
    unifiedWinRate: data.unifiedWinRate,
    unifiedTotalTrades: data.unifiedTotalTrades,
    execTrades: Number(data.exec_trades ?? data.unifiedTotalTrades ?? 0),
    execWinCount: Number(data.exec_win_count ?? 0),
    execLossCount: Number(data.exec_loss_count ?? 0),
    execBreakevenCount: Number(data.exec_breakeven_count ?? 0),
    tradeAttemptCount: Number(data.tradeAttemptCount ?? 0),
    tradeAcceptedCount: Number(data.tradeAcceptedCount ?? 0),
    tradeRejectedCount: Number(data.tradeRejectedCount ?? 0),
    tradeNoSignalCount: Number(data.tradeNoSignalCount ?? 0),
    latestSignals: Array.isArray(data.latestSignals) ? data.latestSignals : [],
  };
}

export default function App() {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1m' | '5m' | '15m'>('5m');
  const [uptimeSeconds, setUptimeSeconds] = useState(14820); // Standalone ticker

  const [status, setStatus] = useState<BotStatus>({
    isRunning: true,
    currentRegime: 'Ranging Dynamic',
    initialBalance: 10000,
    availableBalance: 10000,
    capitalLocked: 0,
    unrealizedPnl: 0,
    realizedPnl: 0,
    totalEquity: 10000,
    balance: 10000,
    paperBalance: 10000,
    averageWin: 0,
    averageLoss: 0,
    largestWin: 0,
    largestLoss: 0,
    generation: 0,
    populationSize: 50,
    eligibleStrategyCount: 0,
    topStrategyId: 'None',
    activePositionsCount: 0,
    lastEvolvedTimestamp: Date.now(),
    isBinanceConnected: false,
    selectedSymbol: 'BTCUSDT',
    isContinuousMode: true
  });

  const [candles, setCandles] = useState<Candle[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [equity, setEquity] = useState<{ timestamp: number; equity: number }[]>([]);
  const [strategies, setStrategies] = useState<StrategyDna[]>([]);
  
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [isEvolving, setIsEvolving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // API response caching to reduce redundant fetches
  const cacheRef = useRef<Map<string, { data: any; timestamp: number }>>(new Map());
  const STATUS_CACHE_DURATION = 8000;  // match server tick interval
  const DETAILS_CACHE_DURATION = 30000; // details refresh every 30s
  const timerRef = useRef<number | null>(null);
  const isUpdatingRef = useRef(false);
  
  // Track pending requests to prevent duplicate calls
  const pendingRequestsRef = useRef<Set<string>>(new Set());
  
  useEffect(() => {
    const startTimer = () => {
      if (timerRef.current !== null) return;
      timerRef.current = window.setInterval(() => {
        setUptimeSeconds(prev => prev + 1);
      }, 1000);
    };

    const stopTimer = () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    startTimer();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopTimer();
      } else {
        startTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      stopTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Sync core telemetry status and details from database
  const fetchStatus = async () => {
    try {
      const cacheKey = 'status';
      const cached = cacheRef.current.get(cacheKey);
      const now = Date.now();

      if (cached && (now - cached.timestamp) < STATUS_CACHE_DURATION) {
        setStatus(cached.data);
        if (cached.data.selectedSymbol) {
          setSelectedSymbol(cached.data.selectedSymbol);
        }
        return;
      }

      // Check if request is already pending
      if (pendingRequestsRef.current.has(cacheKey)) {
        return;
      }
      pendingRequestsRef.current.add(cacheKey);

      const res = await fetch('/api/status', { headers: { 'Accept-Encoding': 'gzip' } });
      const data = await res.json();
      const mapped = mapStatusResponse(data);
      cacheRef.current.set(cacheKey, { data: mapped, timestamp: now });
      setStatus(mapped);
      if (data.selectedSymbol) {
        setSelectedSymbol(data.selectedSymbol);
      }
      pendingRequestsRef.current.delete(cacheKey);
    } catch (err) {
      console.error('Failed to sync system status from API:', err);
      pendingRequestsRef.current.delete('status');
    }
  };

  const fetchDetails = async () => {
    const cacheKey = 'details';
    try {
      const cached = cacheRef.current.get(cacheKey);
      const now = Date.now();

      if (cached && (now - cached.timestamp) < DETAILS_CACHE_DURATION) {
        setPositions(cached.data.positions);
        setTrades(cached.data.trades);
        setCandles(cached.data.candles);
        setStrategies(cached.data.strategies);
        setEquity(cached.data.equity);
        return;
      }

      if (pendingRequestsRef.current.has(cacheKey) || isUpdatingRef.current) {
        return;
      }
      pendingRequestsRef.current.add(cacheKey);
      isUpdatingRef.current = true;

      // Parallelize fetching
      const [posRes, tradesRes, candlesRes, strategiesRes, equityRes] = await Promise.all([
        fetch('/api/positions'),
        fetch('/api/trades'),
        fetch('/api/candles'),
        fetch('/api/self-evolving/strategies'),
        fetch('/api/equity-history')
      ]);

      const [pRaw, tRaw, cRaw, sRaw, eqRaw] = await Promise.all([
        posRes.json().catch(() => []),
        tradesRes.json().catch(() => []),
        candlesRes.json().catch(() => []),
        strategiesRes.json().catch(() => []),
        equityRes.json().catch(() => [])
      ]);

      const p = safePositions<Position>(pRaw, 'positions');
      const t = safeTrades(tRaw, 'trades');
      const c = safeCandles(cRaw, 'candles');
      const s = safeStrategies(sRaw, 'strategies');
      const eq = safeEquity(eqRaw, 'equity');

      cacheRef.current.set(cacheKey, {
        data: { positions: p, trades: t, candles: c, strategies: s, equity: eq },
        timestamp: now
      });

      setPositions(p);
      setTrades(t);
      setCandles(c);
      setStrategies(s);
      setEquity(eq);
      pendingRequestsRef.current.delete(cacheKey);
    } catch (err) {
      console.warn('Backend syncing state pending...', err);
      pendingRequestsRef.current.delete(cacheKey);
    } finally {
      isUpdatingRef.current = false;
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchDetails();

    const statusInterval = window.setInterval(() => {
      if (currentTab === 'dashboard') {
        fetchStatus();
      }
    }, 10000); // Status every 10 seconds — matches server tick

    const detailsInterval = window.setInterval(() => {
      if (currentTab === 'dashboard') {
        fetchDetails();
      }
    }, 20000); // Details every 20 seconds

    return () => {
      window.clearInterval(statusInterval);
      window.clearInterval(detailsInterval);
    };
  }, [currentTab]);

  // Adjust configured symbol pairing
  const handleSymbolChange = useCallback(async (sym: string) => {
    setSelectedSymbol(sym);
    try {
      const response = await fetch('/api/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym, interval: selectedTimeframe })
      });
      if (response.ok) {
        // Clear cache on configuration change
        cacheRef.current.clear();
        fetchStatus();
        fetchDetails();
      }
    } catch (err) {
      console.error(err);
    }
  }, [selectedTimeframe]);

  // Adjust configured timeframe interval
  const handleTimeframeChange = useCallback(async (tf: '1m' | '5m' | '15m') => {
    setSelectedTimeframe(tf);
    try {
      const response = await fetch('/api/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: selectedSymbol, interval: tf })
      });
      if (response.ok) {
        // Clear cache on configuration change
        cacheRef.current.clear();
        fetchStatus();
        fetchDetails();
      }
    } catch (err) {
      console.error(err);
    }
  }, [selectedSymbol]);

  // Run/Pause continuous ticker trader state
  const handleToggleBot = useCallback(async () => {
    const route = status.isRunning ? '/api/stop' : '/api/start';
    try {
      const response = await fetch(route, { method: 'POST' });
      if (response.ok) {
        fetchStatus();
      }
    } catch (err) {
      console.error(err);
    }
  }, [status.isRunning]);

  // Evolve Generation manually
  const handleForceEvolve = useCallback(async () => {
    setIsEvolving(true);
    setErrorMessage('');
    try {
      const response = await fetch('/api/self-evolving/force-evolve', { method: 'POST' });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Evolution failure');
      }
      fetchStatus();
      fetchDetails();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsEvolving(false);
    }
  }, []);

  // Reset virtual simulations
  const handleReset = useCallback(async () => {
    if (confirm('Are you sure you want to reset simulation paper account details & generation states back to gen 0?')) {
      try {
        const response = await fetch('/api/reset', { method: 'POST' });
        if (response.ok) {
          fetchStatus();
          fetchDetails();
        }
      } catch (err) {
        console.error(err);
      }
    }
  }, []);

  // Fetch updated status when a position was closed manually
  const handlePositionClosed = useCallback(() => {
    fetchStatus();
    fetchDetails();
  }, []);

  const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
  const topStrat = strategies[0];
  const winRateMean = topStrat && topStrat.metrics ? topStrat.metrics.win_rate : 62.4;
  const activeStrategyDescName = topStrat ? topStrat.name : 'Alpha G0-01 Titan';

  // Extract trade statistics metrics cleanly
  const exitedTrades = trades.filter(t => t.type === 'EXIT');
  const totalTradesCount = exitedTrades.length; // only closed (EXIT) trades count
  const wonTradesCount = exitedTrades.filter(t => (t.pnl || 0) > 0).length;
  const lostTradesCount = exitedTrades.filter(t => (t.pnl || 0) < 0).length;
  const breakevenTradesCount = exitedTrades.filter(t => Math.abs(t.pnl || 0) < 0.0001).length;
  const calculatedWinrate = exitedTrades.length > 0 ? (wonTradesCount / exitedTrades.length) * 100 : winRateMean;

  const handleResetDashboard = async () => {
    try {
      const r = await fetch('/api/reset-dashboard', { method: 'POST' });
      if (!r.ok) {
        setErrorMessage(`Reset failed: HTTP ${r.status}`);
        return;
      }
      const data = await r.json().catch(() => null);
      if (data && data.success) {
        setErrorMessage('');
        // Force an immediate status refresh.
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('focus'));
      } else {
        setErrorMessage('Reset failed: server returned non-success');
      }
    } catch (err) {
      setErrorMessage(`Reset failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#050810] text-[#cfd3ea] flex font-sans selection:bg-cyan-500/20 selection:text-cyan-200">
      
      {/* Sidebar Navigation */}
      <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} status={status} />

      {/* Main Workspace Frame */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Dynamic Telemetry Header */}
        <Header
          status={status}
          currentSymbol={selectedSymbol}
          tradeAttemptCount={status.tradeAttemptCount ?? 0}
          tradeAcceptedCount={status.tradeAcceptedCount ?? 0}
        />

        {/* Dynamic Alerts notification overlay */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 font-mono text-xs flex justify-between animate-fadeIn">
            <span>⚠️ Fail: {errorMessage}</span>
            <button onClick={() => setErrorMessage('')} className="hover:text-rose-300 font-bold ml-4 cursor-pointer">✕</button>
          </div>
        )}

        {/* Content body based on currentTab */}
        <main className="p-6 space-y-6 flex-1 overflow-y-auto">
          
          {currentTab === 'dashboard' && (
            <>
              {/* Account Overview Panel at the absolute top */}
              <AccountOverviewPanel
                status={status}
                winRate={calculatedWinrate}
                activePositionsCount={status.activePositionsCount}
                totalTrades={totalTradesCount}
                wonTrades={wonTradesCount}
                lostTrades={lostTradesCount}
                breakevenTrades={breakevenTradesCount}
                onResetDashboard={handleResetDashboard}
              />

              {/* Grid 1: Trading Chart workstation */}
              <TradingChart
                candles={candles}
                trades={trades}
                selectedTimeframe={selectedTimeframe}
                onTimeframeChange={handleTimeframeChange}
                equityHistory={equity}
              />

              {/* Grid 2: Active Positions row ledger table */}
              <ActivePositions
                positions={positions}
                currentPrice={currentPrice}
                allCoinsTickers={status.allCoinsTickers}
                onPositionClosed={handlePositionClosed}
              />

              {/* Grid 3: Recent Trades History directly below active positions */}
              <TradeHistory trades={trades} />

              {/* Grid 4: Live Signals tabular matrix list */}
              <LiveSignalsPanel status={status} strategies={strategies} />

              {/* Grid 5: Unified Trading Engine operational levels */}
              <UnifiedEnginePanel
                status={status}
                uptimeSeconds={uptimeSeconds}
                tradesCount={trades.length}
                activeStrategyName={activeStrategyDescName}
                activeTimeframe={selectedTimeframe}
                onRefresh={() => {
                  fetchStatus();
                  fetchDetails();
                }}
              />
            </>
          )}

          {currentTab === 'ai-observatory' && (
            <div className="animate-fadeIn">
              <AIEvolutionObservatory balance={status.balance} />
            </div>
          )}

          {currentTab === 'markets' && (
            <div className="space-y-6 animate-fadeIn">
              {/* Premium tabular Binance coin matrix section */}
              <MarketSection
                status={status}
                onSymbolSelect={handleSymbolChange}
              />

              <TradingChart
                candles={candles}
                trades={trades}
                selectedTimeframe={selectedTimeframe}
                onTimeframeChange={handleTimeframeChange}
              />
            </div>
          )}

          {currentTab === 'signals' && (
            <div className="animate-fadeIn">
              <LiveSignalsPanel status={status} strategies={strategies} />
            </div>
          )}

          {currentTab === 'positions' && (
            <div className="space-y-6 animate-fadeIn">
              <ActivePositions
                positions={positions}
                currentPrice={currentPrice}
                onPositionClosed={handlePositionClosed}
              />
              <TradeHistory trades={trades} />
            </div>
          )}

          {currentTab === 'trades' && (
            <div className="animate-fadeIn">
              <TradeHistory trades={trades} />
            </div>
          )}

          {currentTab === 'strategies' && (
            <div className="animate-fadeIn">
              <StrategyList strategies={strategies} generation={status.generation} />
            </div>
          )}

          {currentTab === 'analytics' && (
            <div className="animate-fadeIn">
              <AIStrategyAnalytics
                strategies={strategies}
                equityHistory={equity}
                currentRegime={status.currentRegime}
              />
            </div>
          )}

          {currentTab === 'ai-engine' && (
            <div className="space-y-6 animate-fadeIn">
              <AIInsights currentRegime={status.currentRegime} />
              <AIStrategyAnalytics
                strategies={strategies}
                equityHistory={equity}
                currentRegime={status.currentRegime}
              />
            </div>
          )}

          {currentTab === 'risk' && (
            <div className="animate-fadeIn">
              <RiskManagementPanel
                maxDrawdown={topStrat?.metrics ? topStrat.metrics.max_drawdown : 1.4}
                positionSizingPct={topStrat?.risk_rules ? topStrat.risk_rules.position_size_pct * 10 || 1.0 : 1.0}
                stopLossPct={topStrat?.risk_rules ? topStrat.risk_rules.stop_loss_pct || 0.5 : 0.5}
                balance={status.balance}
              />
            </div>
          )}

          {currentTab === 'logs' && (
            <div className="animate-fadeIn animate-pulse">
              <SystemLogsPanel trades={trades} />
            </div>
          )}

          {currentTab === 'settings' && (
            <div className="max-w-2xl mx-auto animate-fadeIn">
              <SettingsPanel
                status={status}
                selectedSymbol={selectedSymbol}
                onSymbolChange={handleSymbolChange}
                onToggleBot={handleToggleBot}
                onForceEvolve={handleForceEvolve}
                onReset={handleReset}
                isEvolving={isEvolving}
              />
              <div className="mt-6">
                <AIBotAssistant />
              </div>
            </div>
          )}

        </main>

        {/* Global Footer status bar */}
        <FooterPanel />

      </div>

    </div>
  );
}
