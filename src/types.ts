export interface IndicatorParams {
  rsi_period: number;
  ema_fast: number;
  ema_slow: number;
  atr_period: number;
  bb_period: number;
  bb_std: number;
  adx_period: number;
}

export interface EntryRules {
  rsi_oversold: number;
  price_above_ema: boolean;
  use_bb_bounce: boolean;
  use_volume_filter: boolean;
}

export interface ExitRules {
  rsi_overbought: number;
  trailing_stop: number;
  use_bb_exit: boolean;
}

export interface RiskRules {
  position_size_pct: number; // e.g. 1%
  stop_loss_pct: number;     // e.g. 0.5%
  take_profit_pct: number;   // e.g. 1.2%
}

export interface StrategyFilters {
  volume_spike_multiplier: number; // e.g. 2.0
  momentum_pct_threshold: number;  // e.g. 0.02 (2%)
}

export interface StrategyDna {
  id: string;
  name: string;
  generation: number;
  indicators: string[]; // e.g. ["RSI", "EMA", "ATR", "Bollinger Bands", "ADX"]
  params: IndicatorParams;
  entry_rules: EntryRules;
  exit_rules: ExitRules;
  risk_rules: RiskRules;
  timeframe: '1m' | '5m' | '15m';
  filters: StrategyFilters;
  fitness?: number;
  metrics?: {
    profit_factor: number;
    win_rate: number;
    max_drawdown: number;
    total_trades: number;
    net_profit: number;
  };
  retired?: boolean; // if true, strategy should not be used for entries
  // Live performance tracking — used by evolvePopulation to bias
  // crossover and ranking toward actually-profitable strategies.
  liveLossPenalty?: number;
  liveWinBonus?: number;
}

export type MarketRegime = 'Trending Bullish' | 'Trending Bearish' | 'Ranging Dynamic' | 'High Volatility' | 'Low Volatility';

export interface Candle {
  time: number; // timestamp
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  // Computed indicator values
  rsi?: number;
  ema_fast?: number;
  ema_slow?: number;
  atr?: number;
  bb_upper?: number;
  bb_middle?: number;
  bb_lower?: number;
  adx?: number;
}

export interface Position {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  entryPrice: number;
  size: number; // amount of base token
  cost: number; // size * entryPrice in USDT
  entryFee?: number; // recorded entry fee in USDT
  stopLoss: number;
  takeProfit: number;
  timestamp: number;
  strategyId?: string;
  strategyName?: string;
}

export interface Trade {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  type: 'ENTRY' | 'EXIT';
  price: number;
  size: number;
  value: number;
  pnl?: number;
  pnl_pct?: number;
  strategyId?: string;
  strategyName?: string;
  timestamp: number;
  reason: string;
}

export interface BotStatus {
  isRunning: boolean;
  currentRegime: MarketRegime;
  // ─── Portfolio accounting (the source of truth) ─────────────────────────
  initialBalance: number;   // baseline the bot was started with
  availableBalance: number; // realized cash on hand (= paperBalance)
  capitalLocked: number;    // cost of currently-open positions
  unrealizedPnl: number;    // floating PnL on open positions
  realizedPnl: number;      // sum of closed-trade pnl
  totalEquity: number;      // available + locked + unrealized
  // Backward-compatible aliases
  balance: number;          // = availableBalance
  paperBalance: number;     // = availableBalance
  // ─── Trade-derived stats ───────────────────────────────────────────────
  averageWin: number;
  averageLoss: number;
  largestWin: number;
  largestLoss: number;
  // ─── Engine state ──────────────────────────────────────────────────────
  generation: number;
  populationSize: number;
  eligibleStrategyCount?: number;
  topStrategyId: string;
  topStrategyName?: string;
  topStrategyFitness?: number;
  activePositionsCount: number;
  lastEvolvedTimestamp: number;
  isBinanceConnected: boolean;
  selectedSymbol: string;
  isContinuousMode: boolean;
  afcsActive?: boolean;
  isHaltedByLossGuard?: boolean;
  aggressiveEntryMode?: boolean;
  brainActivityLogs?: string[];
  allCoinsTickers?: any[];
  exitMode?: 'DYNAMIC' | 'FIXED_TIME';
  fixedTimeLimitMinutes?: number;
  // ─── Activity counters ──────────────────────────────────────────────────
  unifiedWinRate?: number;
  unifiedTotalTrades?: number;
  execTrades?: number;
  execWinCount?: number;
  execLossCount?: number;
  execBreakevenCount?: number;
  tradeAttemptCount?: number;
  tradeAcceptedCount?: number;
  tradeRejectedCount?: number;
  tradeNoSignalCount?: number;
  // ─── Signal stream ──────────────────────────────────────────────────────
  latestSignals?: Array<{
    symbol: string;
    confidence: number;
    decision: string;
    isAccepted: boolean;
    signalType: string;
  }>;
}
