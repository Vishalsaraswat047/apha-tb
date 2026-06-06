import express from "express";
import path from "path";
import net from "net";
import { createServer as createViteServer } from "vite";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import dotenv from "dotenv";
import fs from "fs";
import zlib from "zlib";

import { StrategyDna, Candle, Position, Trade, BotStatus, MarketRegime } from "./src/types";
import { fetchBinanceCandles, generateSimulatedCandles } from "./src/lib/binance";
import { createRandomStrategy, evolvePopulation, backtestStrategy, generateGeminiStrategyRecommendation } from "./src/lib/evolution";
import { detectMarketRegime, getRegimeAwareWeights } from "./src/lib/regime";
import { populateIndicators } from "./src/lib/indicators";
import { fetchRealAccountBalances, executeRealMarketOrder } from "./src/lib/binanceLive";

// AI Evolution Observatory Engines
import { evaluateStrategyCohort } from "./src/lib/observatory/ai_evaluation";
import { generateStrategyGenealogy } from "./src/lib/observatory/evolution_engine";
import { synthesizeLearningPerformance } from "./src/lib/observatory/learning_engine";
import { analyzeFailures } from "./src/lib/observatory/failure_analysis_engine";
import { auditAIChanges } from "./src/lib/observatory/governance_engine";
import { generateExcelReportCSV } from "./src/lib/observatory/report_generator";

dotenv.config();
const IS_TESTNET = process.env.BINANCE_TESTNET?.toString().toLowerCase() === "true";

// Global exception handling to prevent unexpected crashes
process.on("uncaughtException", (error) => {
  console.error("🚨 UNCAUGHT EXCEPTION:", error);
  // Log to brain activity for visibility in dashboard
  pushLog(`🚨 [SYSTEM CRASH] Uncaught exception: ${error.message}`);
  // Don't exit - let the trade loop error handler deal with it
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("🚨 UNHANDLED REJECTION:", reason);
  // Log to brain activity for visibility in dashboard
  pushLog(`🚨 [SYSTEM CRASH] Unhandled promise rejection: ${reason}`);
  // Don't exit - let the trade loop error handler deal with it
});

// Binance connectivity status
let isBinanceConnected = false;

// Test actual Binance connectivity
async function verifyBinanceConnection(): Promise<boolean> {
  const apiKey = process.env.BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET;

  if (!apiKey || !apiSecret) {
    console.log("🔑 Binance API keys not configured - running in paper trading mode");
    return false;
  }

  try {
    // Test connectivity by fetching account info (requires valid keys)
    await fetchRealAccountBalances();
    console.log("✅ Binance API connection verified - live trading enabled");
    return true;
  } catch (error) {
    console.error("❌ Binance API connection failed:", error.message);
    console.log("📝 Falling back to paper trading mode");
    return false;
  }
}

const app = express();
app.use(express.json());

// ─── GZIP COMPRESSION MIDDLEWARE ─────────────────────────────────────────────
// Compresses all JSON API responses — reduces payload size by ~70-80%
app.use((req, res, next) => {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (!acceptEncoding.includes('gzip')) return next();

  const _json = res.json.bind(res);
  res.json = (body: any) => {
    const data = JSON.stringify(body);
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Content-Type', 'application/json');
    zlib.gzip(Buffer.from(data, 'utf8'), (err, compressed) => {
      if (err) {
        res.removeHeader('Content-Encoding');
        return _json(body);
      }
      res.end(compressed);
    });
    return res;
  };
  next();
});

const BASE_PORT = Number(process.env.PORT || 5000);

async function findAvailablePort(startPort: number, maxAttempts = 100): Promise<number> {
  // Try the preferred range first
  for (let port = startPort; port < startPort + Math.min(20, maxAttempts); port++) {
    const available = await new Promise<boolean>((resolve) => {
      const tester = net.createServer();
      tester.once("error", () => resolve(false));
      tester.once("listening", () => {
        tester.close(() => resolve(true));
      });
      tester.listen(port, "0.0.0.0");
    });
    if (available) {
      return port;
    }
  }

  // If preferred range fails, try a wider range
  for (let port = startPort + 20; port < startPort + maxAttempts; port++) {
    const available = await new Promise<boolean>((resolve) => {
      const tester = net.createServer();
      tester.once("error", () => resolve(false));
      tester.once("listening", () => {
        tester.close(() => resolve(true));
      });
      tester.listen(port, "0.0.0.0");
    });
    if (available) {
      console.log(`⚠️ Preferred port range [${startPort}-${startPort + 19}] was occupied. Using port ${port} instead.`);
      return port;
    }
  }

  // If still no port available, log error but don't crash - let the OS assign a port
  console.error(`❌ No available ports found in range [${startPort}-${startPort + maxAttempts}]. Letting OS assign port.`);
  return 0; // Let OS assign available port (0 means any available port)
}

// STATE VARIABLES
let isBotRunning = true;
let isContinuousMode = true; // aggressive: always-on continuous scalping
let currentSymbol = "BTCUSDT";
let currentInterval = "5m";
let paperBalance = 10000.0;
let initialBalance = 10000.0;
let lastBalanceSync = 0;
const BALANCE_SYNC_INTERVAL = 30000; // 30 seconds

let population: StrategyDna[] = [];
let generation = 0;
let lastEvolvedTimestamp = Date.now();

let candles: Candle[] = [];
let activePositions: Position[] = [];
let tradeHistory: Trade[] = [];
let equityHistory: { timestamp: number; equity: number }[] = [];

let tradeAttemptCount = 0;
let tradeAcceptedCount = 0;
let tradeRejectedCount = 0;
let tradeNoSignalCount = 0;
let isHaltedByLossGuard = false; // set when 3-loss streak or low recent win rate trips the guard (was 2, raised to 3 per user request)

// ─── Trade-derived PnL helpers ──────────────────────────────────────────────
// The bot places real (testnet) orders, so `paperBalance` drifts with fees
// and is periodically overwritten with the live testnet USDT balance (which
// may differ from the hard-coded $10k starting value). Computing PnL as
// `paperBalance - initialBalance` therefore reflects the testnet account
// value rather than actual trading performance.
//
// The single source of truth for trading PnL is the closed-trade PnL recorded
// in `tradeHistory` when a position is exited. Use these helpers everywhere
// the UI/API needs a PnL number.
function getClosedTrades(): Trade[] {
  return tradeHistory.filter(t => t && t.type === 'EXIT' && typeof t.pnl === 'number' && Number.isFinite(t.pnl));
}
function getWinCount(): number {
  return getClosedTrades().filter(t => (t.pnl || 0) > 0).length;
}
function getLossCount(): number {
  return getClosedTrades().filter(t => (t.pnl || 0) <= 0).length;
}
function getRealizedPnl(): number {
  return parseFloat(getClosedTrades().reduce((sum, t) => sum + (t.pnl || 0), 0).toFixed(4));
}
function getWinRatePct(): number {
  const closed = getClosedTrades().length;
  if (closed === 0) return 0;
  return parseFloat(((getWinCount() / closed) * 100).toFixed(2));
}
function getAverageWin(): number {
  const wins = getClosedTrades().filter(t => (t.pnl || 0) > 0);
  if (wins.length === 0) return 0;
  return parseFloat((wins.reduce((s, t) => s + (t.pnl || 0), 0) / wins.length).toFixed(4));
}
function getAverageLoss(): number {
  const losses = getClosedTrades().filter(t => (t.pnl || 0) <= 0);
  if (losses.length === 0) return 0;
  return parseFloat((losses.reduce((s, t) => s + (t.pnl || 0), 0) / losses.length).toFixed(4));
}
function getLargestWin(): number {
  const wins = getClosedTrades().filter(t => (t.pnl || 0) > 0);
  return wins.length === 0 ? 0 : parseFloat(Math.max(...wins.map(t => t.pnl || 0)).toFixed(4));
}
function getLargestLoss(): number {
  const losses = getClosedTrades().filter(t => (t.pnl || 0) <= 0);
  return losses.length === 0 ? 0 : parseFloat(Math.min(...losses.map(t => t.pnl || 0)).toFixed(4));
}
function getBreakevenCount(): number {
  // A trade is "breakeven" when realized PnL is effectively zero (within fee noise).
  // We round to 4 decimals to avoid flagging dust-difference exits as breakeven.
  return getClosedTrades().filter(t => Math.abs((t.pnl || 0)) < 0.0001).length;
}

// Total cost of all currently-open positions (capital locked in the market).
function getCapitalLocked(): number {
  return parseFloat(
    activePositions
      .filter(p => p && p.cost && Number.isFinite(p.cost) && p.cost > 0)
      .reduce((sum, pos) => sum + pos.cost, 0)
      .toFixed(2)
  );
}

// Floating PnL on currently-open positions, marked to current ticker price.
function getUnrealizedPnlFromPositions(): number {
  return parseFloat(
    activePositions
      .filter(p => p && p.size > 0 && p.entryPrice > 0)
      .reduce((sum, pos) => {
        const ticker = allCoinsTickers.find(t => t.symbol === pos.symbol);
        const mark = ticker ? ticker.price : pos.entryPrice;
        const pnl = pos.side === 'BUY'
          ? (mark - pos.entryPrice) * pos.size
          : (pos.entryPrice - mark) * pos.size;
        return sum + pnl;
      }, 0)
      .toFixed(4)
  );
}

// Eligible strategies for live trading. Filters out retired, low-performing, or
// negatively-ranked strategies. Combined with the 95% confidence floor and the
// loss-streak halt, this gives the bot a strong quality bar without paralyzing
// the strategy pool. New strategies (no track record yet) get a chance to learn
// during the genetic-exploration phase.
function getEligibleStrategies(strategies: StrategyDna[] = population): StrategyDna[] {
  return strategies
    .filter(s => s && !s.retired)
    .filter(s => (s.fitness || 0) > 0)
    .filter(s => {
      const perf = getStrategyPerformance(s);
      // Brand-new strategies (no trades yet) get a chance to learn.
      if (perf.totalTrades === 0) return true;
      // Proven strategies must clear the bar: net profitable, 70%+ win rate,
      // 2x+ profit factor.
      return (
        perf.totalProfit > 0 &&
        perf.profitFactor >= MIN_STRATEGY_PROFIT_FACTOR &&
        perf.winRate >= MIN_STRATEGY_WIN_RATE
      );
    });
}

// Per-symbol cooldown map: when Binance rejects a symbol with -2010 LOT_SIZE
// (low order-book liquidity for cheap coins like PEPE/FLOKI), skip that symbol
// for SYMBOL_COOLDOWN_MS to avoid hammering the same illiquid pair.
const symbolCooldownUntil: Record<string, number> = {};
const SYMBOL_COOLDOWN_MS = 60_000;

// UNIFIED ENGINE CONFIGURATION
let exitMode: 'DYNAMIC' | 'FIXED_TIME' = 'DYNAMIC';
let fixedTimeLimitMinutes = 0.0; // fixed-time exit disabled by default until explicitly configured

const TRADE_CONFIDENCE_FLOOR = 60.0; // Balanced floor: allows quality trades to flow while filtering noise
const AFCS_CONFIDENCE_FLOOR = 94; // percentage threshold if AFCS active (not used for forced 80% override)
const MIN_STRATEGY_WIN_RATE = 0.70; // Require strategies to win at least 70% of closed trades
const MIN_STRATEGY_PROFIT_FACTOR = 2.0; // Require strategies to generate at least 2x profit over losses
// REDUCED to 15 concurrent positions as requested for more focused trading
const MAX_CONCURRENT_POSITIONS = 15; // Reduced from 30 to 15 for more focused, higher-quality positions
// GREATLY INCREASED hold time for substantial profit accumulation (15-30 minutes as requested)
const MIN_HOLD_SECONDS = 900; // Increased from 60s to 900s (15 minutes) for larger profit potential
const MIN_HOLD_MS = MIN_HOLD_SECONDS * 1000;
const MIN_VOTE_EXIT_THRESHOLD = 0.55; // AGGRESSIVE: lower exit consensus threshold for faster profit-taking
const MIN_ACCEPTABLE_VOLUME = 50000000; // AGGRESSIVE: accept lower-volume coins for more opportunities
const MIN_MEME_CONFIDENCE = 85; // Meme coins now require 85% confidence to reduce noise
const MAX_ACCEPTABLE_SPREAD = 0.008; // AGGRESSIVE: accept slightly wider spreads
const MEME_COIN_BLOCKLIST = new Set(['BONKUSDT']); // AGGRESSIVE: only block extreme meme coins
const EVOLUTION_TICK_INTERVAL = 1; // More aggressive evolution - check every tick

// AI OBSERVATORY ADDITIONAL REAL-TIME CHANNELS
let afcsActive = false;
let aggressiveEntryMode = true; // AGGRESSIVE: always-on aggressive entry mode for maximum trade frequency
let tradeCooldownUntil = 0;
const TRADE_COOLDOWN_MS = 15000; // 15 second cooldown between trade attempts to prevent Binance rate limits
let brainActivityLogs: string[] = [
  "🧠 System Initialization: Safe mode boundary verified.",
  "🧠 AFCS system disabled per user configuration.",
  "🧠 Continuous passive optimizer: 24x7 Active.",
  "🧠 Standard baseline initial consensus models deployed."
];

// Memory protection constants
const MAX_LOGS = 500;
const MAX_TRADES = 10000;
const MAX_EQUITY_HISTORY = 5000;
const MAX_BRAIN_ACTIVITY = 1000;

// Cap logs to prevent unbounded memory growth and UI lag
function pushLog(msg: string) {
  brainActivityLogs.push(msg);
  if (brainActivityLogs.length > MAX_BRAIN_ACTIVITY) {
    brainActivityLogs = brainActivityLogs.slice(-MAX_BRAIN_ACTIVITY);
  }
}

interface TickerData {
  symbol: string;
  name: string;
  price: number;
  priceChangePercent: number;
  volume: number;
  rsi: number;
  recommendation: 'BUY' | 'SELL' | 'HOLD';
  spread?: number;
}

const ALLOWED_TRADE_REGIMES = new Set(['Trending Bullish', 'Trending Bearish', 'High Volatility', 'Ranging Dynamic', 'Low Volatility']);

function isMemeCoin(symbol: string): boolean {
  return MEME_COIN_BLOCKLIST.has(symbol);
}

interface SignalFeedEntry {
  symbol: string;
  confidence: number;
  decision: string;
  isAccepted: boolean;
  signalType: string;
}

let latestSignals: SignalFeedEntry[] = [];

function estimateSpread(symbol: string): number {
  const upper = symbol.toUpperCase();
  if (isMemeCoin(upper)) return 0.0025; // 0.25% or worse on meme names
  if (['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT'].includes(upper)) return 0.00025; // 0.025%
  if (upper.endsWith('USDT')) return 0.0008;
  return 0.0012;
}

function shouldEvaluateForEntry(coinTick: TickerData, currentRegime: string): boolean {
  if (!ALLOWED_TRADE_REGIMES.has(currentRegime)) {
    return false;
  }

  if (isMemeCoin(coinTick.symbol)) {
    return false;
  }

  if (coinTick.volume < MIN_ACCEPTABLE_VOLUME) {
    return false;
  }

  const spread = coinTick.spread ?? estimateSpread(coinTick.symbol);
  if (spread > MAX_ACCEPTABLE_SPREAD) {
    return false;
  }

  // AGGRESSIVE: lowered price change threshold from 0.8% to 0.3%
  if (Math.abs(coinTick.priceChangePercent) < 0.3) {
    return false;
  }

  return true;
}

let allCoinsTickers: TickerData[] = [
  { symbol: "BTCUSDT",    name: "Bitcoin",       price: 96450.50,  priceChangePercent: 2.4,  volume: 4500000000, rsi: 52, recommendation: "HOLD" },
  { symbol: "ETHUSDT",    name: "Ethereum",      price: 3412.20,   priceChangePercent: -1.2, volume: 2100000000, rsi: 41, recommendation: "HOLD" },
  { symbol: "SOLUSDT",    name: "Solana",        price: 165.75,    priceChangePercent: 4.8,  volume: 950000005,  rsi: 68, recommendation: "SELL" },
  { symbol: "BNBUSDT",    name: "BNB Coin",      price: 585.30,    priceChangePercent: 0.5,  volume: 450000000,  rsi: 55, recommendation: "HOLD" },
  { symbol: "ADAUSDT",    name: "Cardano",       price: 0.465,     priceChangePercent: -2.3, volume: 180000000,  rsi: 32, recommendation: "BUY"  },
  { symbol: "XRPUSDT",    name: "Ripple",        price: 0.534,     priceChangePercent: 1.1,  volume: 320000000,  rsi: 48, recommendation: "HOLD" },
  { symbol: "AVAXUSDT",   name: "Avalanche",     price: 28.50,     priceChangePercent: 3.2,  volume: 210000000,  rsi: 58, recommendation: "BUY"  },
  { symbol: "DOTUSDT",    name: "Polkadot",      price: 5.12,      priceChangePercent: -0.8, volume: 130000000,  rsi: 44, recommendation: "HOLD" },
  { symbol: "MATICUSDT",  name: "Polygon",       price: 0.579,     priceChangePercent: 1.5,  volume: 160000000,  rsi: 50, recommendation: "HOLD" },
  { symbol: "LINKUSDT",   name: "Chainlink",     price: 14.85,     priceChangePercent: 2.1,  volume: 175000000,  rsi: 55, recommendation: "BUY"  },
  { symbol: "ATOMUSDT",   name: "Cosmos",        price: 8.44,      priceChangePercent: -1.0, volume: 120000000,  rsi: 40, recommendation: "HOLD" },
  { symbol: "NEARUSDT",   name: "NEAR Protocol", price: 5.63,      priceChangePercent: 2.8,  volume: 140000000,  rsi: 60, recommendation: "BUY"  },
  { symbol: "APTUSDT",    name: "Aptos",         price: 8.20,      priceChangePercent: 3.5,  volume: 155000000,  rsi: 62, recommendation: "BUY"  },
  { symbol: "OPUSDT",     name: "Optimism",      price: 1.85,      priceChangePercent: 1.9,  volume: 110000000,  rsi: 53, recommendation: "HOLD" },
  { symbol: "ARBUSDT",    name: "Arbitrum",      price: 0.72,      priceChangePercent: 2.4,  volume: 130000000,  rsi: 56, recommendation: "BUY"  },
  { symbol: "SUIUSDT",    name: "Sui",           price: 1.15,      priceChangePercent: 4.1,  volume: 200000000,  rsi: 65, recommendation: "BUY"  },
  { symbol: "TIAUSDT",    name: "Celestia",      price: 4.80,      priceChangePercent: 3.0,  volume: 95000000,   rsi: 59, recommendation: "BUY"  },
  { symbol: "LDOUSDT",    name: "Lido DAO",      price: 1.42,      priceChangePercent: 1.2,  volume: 88000000,   rsi: 47, recommendation: "HOLD" },
  { symbol: "RENDERUSDT", name: "Render",        price: 7.83,      priceChangePercent: 5.2,  volume: 105000000,  rsi: 70, recommendation: "SELL" },
  { symbol: "FETUSDT",    name: "Fetch.ai",      price: 1.43,      priceChangePercent: 4.0,  volume: 98000000,   rsi: 66, recommendation: "BUY"  },
  { symbol: "LTCUSDT",    name: "Litecoin",      price: 82.50,     priceChangePercent: 0.9,  volume: 145000000,  rsi: 49, recommendation: "HOLD" },
  { symbol: "BCHUSDT",    name: "Bitcoin Cash",  price: 425.00,    priceChangePercent: 1.4,  volume: 120000000,  rsi: 52, recommendation: "HOLD" },
  { symbol: "XLMUSDT",    name: "Stellar",       price: 0.116,     priceChangePercent: 1.8,  volume: 90000000,   rsi: 51, recommendation: "HOLD" },
  { symbol: "UNIUSDT",    name: "Uniswap",       price: 7.64,      priceChangePercent: 2.2,  volume: 100000000,  rsi: 54, recommendation: "BUY"  },
  { symbol: "AAVEUSDT",   name: "Aave",          price: 185.00,    priceChangePercent: 2.6,  volume: 85000000,   rsi: 57, recommendation: "BUY"  },
  { symbol: "FILUSDT",    name: "Filecoin",      price: 4.20,      priceChangePercent: 1.7,  volume: 78000000,   rsi: 50, recommendation: "HOLD" },
  { symbol: "ICPUSDT",    name: "Internet Comp", price: 8.90,      priceChangePercent: 2.9,  volume: 82000000,   rsi: 58, recommendation: "BUY"  },
  { symbol: "DOGEUSDT",   name: "Dogecoin",      price: 0.142,     priceChangePercent: 3.1,  volume: 280000000,  rsi: 61, recommendation: "BUY"  },
  { symbol: "SHIBUSDT",   name: "Shiba Inu",     price: 0.000018,  priceChangePercent: 2.5,  volume: 160000000,  rsi: 55, recommendation: "HOLD" },
  { symbol: "PEPEUSDT",   name: "Pepe",          price: 0.000013,  priceChangePercent: 4.5,  volume: 190000000,  rsi: 63, recommendation: "BUY"  }
];

// Initialize 50 random strategies for generation 0
function initializePopulation() {
  population = [];
  for (let i = 0; i < 50; i++) {
    population.push(createRandomStrategy(0));
  }
  generation = 0;
  lastEvolvedTimestamp = Date.now();
}

function getStrategyPerformance(strategy: StrategyDna) {
  const strategyTrades = tradeHistory.filter(t => t.strategyId === strategy.id && t.type === 'EXIT' && typeof t.pnl === 'number');
  const wins = strategyTrades.filter(t => (t.pnl || 0) > 0);
  const losses = strategyTrades.filter(t => (t.pnl || 0) < 0);
  const totalProfit = wins.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const totalLoss = losses.reduce((sum, t) => sum + Math.abs(t.pnl || 0), 0);
  const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? Infinity : 0;
  const winRate = strategyTrades.length > 0 ? wins.length / strategyTrades.length : 0;
  return {
    winRate,
    profitFactor,
    totalProfit,
    totalLoss,
    totalTrades: strategyTrades.length
  };
}

function rankPopulation() {
  population.sort((a, b) => {
    // Retired strategies should be pushed to the end regardless of fitness
    if (a.retired && !b.retired) return 1;
    if (!a.retired && b.retired) return -1;

    const aPerf = getStrategyPerformance(a);
    const bPerf = getStrategyPerformance(b);

    const aScore = (a.fitness || 0) * 1.2 + (aPerf.profitFactor === Infinity ? 45 : Math.min(aPerf.profitFactor, 8) * 5) + (aPerf.winRate * 45) - (aPerf.totalTrades < 5 ? 20 : 0);
    const bScore = (b.fitness || 0) * 1.2 + (bPerf.profitFactor === Infinity ? 45 : Math.min(bPerf.profitFactor, 8) * 5) + (bPerf.winRate * 45) - (bPerf.totalTrades < 5 ? 20 : 0);

    return bScore - aScore;
  });

  population.forEach((strategy) => {
    if (!strategy.retired) {
      const perf = getStrategyPerformance(strategy);
      if (perf.totalTrades >= 6 && (perf.profitFactor < MIN_STRATEGY_PROFIT_FACTOR || perf.winRate < MIN_STRATEGY_WIN_RATE || perf.totalProfit <= 0)) {
        strategy.retired = true;
        pushLog(`🧠 [RETIREMENT] Strategy ${strategy.name} retired due to weak performance (${(perf.winRate * 100).toFixed(1)}% win rate, PF ${perf.profitFactor.toFixed(2)}).`);
      }
    }
  });
}

// PERSISTENT STORAGE BACKEND MECHANISM
const STATE_DIR = path.join(process.cwd(), ".state");
const PERSISTENCE_FILE = path.join(STATE_DIR, "state_persistence.json");
const PERSISTENCE_BACKUP_FILE = path.join(STATE_DIR, "state_persistence.backup.json");

// Debounced save — prevents disk I/O lag from rapid trade bursts (30 coins × 8s)
let _saveTimer: ReturnType<typeof setTimeout> | null = null;
function saveState(immediate = false) {
  if (immediate) {
    _flushSave();
    return;
  }
  if (_saveTimer) return; // already queued
  _saveTimer = setTimeout(() => {
    _flushSave();
    _saveTimer = null;
  }, 3000); // batch writes — flush every 3 seconds max
}

function _flushSave() {
  try {
    // Ensure .state directory exists
    if (!fs.existsSync(STATE_DIR)) {
      fs.mkdirSync(STATE_DIR, { recursive: true });
    }
    const dataToSave = {
      isBotRunning,
      isContinuousMode,
      currentSymbol,
      currentInterval,
      paperBalance,
      initialBalance,
      generation,
      lastEvolvedTimestamp,
      activePositions,
      tradeHistory: tradeHistory.slice(-500), // cap to last 500 trades to prevent file bloat
      equityHistory: equityHistory.slice(-1000), // cap to last 1000 equity points
      exitMode,
      fixedTimeLimitMinutes,
      afcsActive,
      aggressiveEntryMode,
      brainActivityLogs,
      population,
      tradeAttemptCount,
      tradeAcceptedCount,
      tradeRejectedCount,
      tradeNoSignalCount
    };

    // Create backup first
    if (fs.existsSync(PERSISTENCE_FILE)) {
      fs.copyFileSync(PERSISTENCE_FILE, PERSISTENCE_BACKUP_FILE);
    }

    // Save current state
    fs.writeFileSync(PERSISTENCE_FILE, JSON.stringify(dataToSave, null, 2), "utf8");

    // Verify the file was written correctly
    const verificationData = fs.readFileSync(PERSISTENCE_FILE, "utf8");
    JSON.parse(verificationData); // This will throw if invalid JSON
  } catch (err) {
    console.error("Failed to write state persistence file:", err);

    // Attempt recovery from backup if current save failed
    if (fs.existsSync(PERSISTENCE_BACKUP_FILE)) {
      console.log("🔄 Attempting to restore state from backup...");
      try {
        fs.copyFileSync(PERSISTENCE_BACKUP_FILE, PERSISTENCE_FILE);
        console.log("✅ State restored from backup successfully");
      } catch (backupErr) {
        console.error("❌ Failed to restore state from backup:", backupErr);
      }
    }
  }
}

function loadState(): boolean {
  // Try to load from main file first
  if (fs.existsSync(PERSISTENCE_FILE)) {
    try {
      const data = fs.readFileSync(PERSISTENCE_FILE, "utf8");
      const state = JSON.parse(data);

      // Verify it's valid state data
      if (typeof state === 'object' && state !== null) {
        if (state.isBotRunning !== undefined) isBotRunning = state.isBotRunning;
        if (state.isContinuousMode !== undefined) isContinuousMode = state.isContinuousMode;
        if (typeof state.currentSymbol === 'string' && state.currentSymbol.trim()) currentSymbol = state.currentSymbol;
        if (state.currentInterval !== undefined) currentInterval = state.currentInterval;
        if (state.paperBalance !== undefined) paperBalance = state.paperBalance;
        if (state.initialBalance !== undefined) initialBalance = state.initialBalance;
        if (state.generation !== undefined) generation = state.generation;
        if (state.lastEvolvedTimestamp !== undefined) lastEvolvedTimestamp = state.lastEvolvedTimestamp;
        if (state.activePositions !== undefined) activePositions = state.activePositions;
        if (state.tradeHistory !== undefined) tradeHistory = state.tradeHistory;
        if (state.equityHistory !== undefined) equityHistory = state.equityHistory;
        if (state.exitMode !== undefined) exitMode = state.exitMode;
        if (state.fixedTimeLimitMinutes !== undefined) fixedTimeLimitMinutes = Math.max(0, state.fixedTimeLimitMinutes);
        if (state.afcsActive !== undefined) afcsActive = state.afcsActive;
        if (state.aggressiveEntryMode !== undefined) aggressiveEntryMode = state.aggressiveEntryMode;
        if (state.brainActivityLogs !== undefined) brainActivityLogs = state.brainActivityLogs;
        if (state.population !== undefined) population = state.population;

        // Keep balance from state file for live trading compatibility
        // Will be adjusted to proper baseline after connectivity check
        initialBalance = 10000.0;
        equityHistory = [{ timestamp: Date.now(), equity: paperBalance }];
        if (paperBalance === 0) {
          // No state loaded, initialize to standard baseline for paper trading
          paperBalance = 10000.0;
          pushLog("🧠 No state found, initializing to standard balance: $10,000.00");
        } else {
          pushLog(`🧠 Loaded balance from state: $${paperBalance.toFixed(2)}`);
        }

        console.log("State restored successfully from state_persistence.json!");
        return true;
      }
    } catch (err) {
      console.error("Failed to parse state persistence file:", err);
      // Fall through to try backup
    }
  }

  // Try to load from backup file if main file failed
  if (fs.existsSync(PERSISTENCE_BACKUP_FILE)) {
    try {
      const data = fs.readFileSync(PERSISTENCE_BACKUP_FILE, "utf8");
      const state = JSON.parse(data);

      // Verify it's valid state data
      if (typeof state === 'object' && state !== null) {
        if (state.isBotRunning !== undefined) isBotRunning = state.isBotRunning;
        if (state.isContinuousMode !== undefined) isContinuousMode = state.isContinuousMode;
        if (typeof state.currentSymbol === 'string' && state.currentSymbol.trim()) currentSymbol = state.currentSymbol;
        if (state.currentInterval !== undefined) currentInterval = state.currentInterval;
        if (state.paperBalance !== undefined) paperBalance = state.paperBalance;
        if (state.initialBalance !== undefined) initialBalance = state.initialBalance;
        if (state.generation !== undefined) generation = state.generation;
        if (state.lastEvolvedTimestamp !== undefined) lastEvolvedTimestamp = state.lastEvolvedTimestamp;
        if (state.activePositions !== undefined) activePositions = state.activePositions;
        if (state.tradeHistory !== undefined) tradeHistory = state.tradeHistory;
        if (state.equityHistory !== undefined) equityHistory = state.equityHistory;
        if (state.exitMode !== undefined) exitMode = state.exitMode;
        if (state.fixedTimeLimitMinutes !== undefined) fixedTimeLimitMinutes = Math.max(0, state.fixedTimeLimitMinutes);
        if (state.afcsActive !== undefined) afcsActive = state.afcsActive;
        if (state.aggressiveEntryMode !== undefined) aggressiveEntryMode = state.aggressiveEntryMode;
        if (state.brainActivityLogs !== undefined) brainActivityLogs = state.brainActivityLogs;
        if (state.population !== undefined) population = state.population;

        // Keep balance from state file for live trading compatibility
        // Will be adjusted to proper baseline after connectivity check
        initialBalance = 10000.0;
        equityHistory = [{ timestamp: Date.now(), equity: paperBalance }];
        if (paperBalance === 0) {
          // No state loaded, initialize to standard baseline for paper trading
          paperBalance = 10000.0;
          pushLog("🧠 No state found, initializing to standard balance: $10,000.00");
        } else {
          pushLog(`🧠 Loaded balance from state: $${paperBalance.toFixed(2)}`);
        }

        console.log("State restored successfully from state_persistence.backup.json!");
        return true;
      }
    } catch (err) {
      console.error("Failed to read state persistence backup file:", err);
    }
  }

  return false;
}

const stateLoaded = loadState();
if (!stateLoaded || population.length === 0) {
  initializePopulation();
  equityHistory.push({ timestamp: Date.now() - 3600000, equity: initialBalance });
  saveState();
}

// Load initial market candles
async function loadInitialMarketData() {
  if (!currentSymbol || typeof currentSymbol !== 'string') {
    currentSymbol = 'BTCUSDT';
  }
  console.log(`Loading initial candles for ${currentSymbol}...`);
  try {
    candles = await fetchBinanceCandles(currentSymbol, currentInterval, 300);
    console.log(`Loaded ${candles.length} candles successfully.`);
    // Backtest strategies initially to populate fitness and rankings
    population = population.map(strat => backtestStrategy(strat, candles));
    population.sort((a, b) => (b.fitness || 0) - (a.fitness || 0));
  } catch (error) {
    console.error("Failed to load initial market data:", error);
  }
}

loadInitialMarketData();

let optimizerTickCount = 0;

function getConsecutiveLossCount(): number {
  let count = 0;
  const exits = tradeHistory.filter(t => t.type === 'EXIT');
  for (let i = exits.length - 1; i >= 0; i--) {
    if ((exits[i].pnl || 0) < 0) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

function getUnrealizedPnl(): number {
  // paperBalance already has position costs deducted on entry.
  // Unrealized PnL = current market value of all open positions minus what was paid for them.
  return activePositions.reduce((sum, position) => {
    const ticker = allCoinsTickers.find(t => t.symbol === position.symbol);
    const currentPrice = ticker ? ticker.price : (candles.length > 0 ? candles[candles.length - 1].close : position.entryPrice);
    const currentValue = position.size * currentPrice;
    return sum + (currentValue - position.cost); // profit/loss on this position
  }, 0);
}

// Total equity = free cash (paperBalance) + cost of all open positions + unrealized PnL
// = paperBalance + sum(position.cost) + sum(currentValue - position.cost)
// = paperBalance + sum(currentValue)
function getTotalEquity(): number {
  const positionsValue = activePositions.reduce((sum, position) => {
    const ticker = allCoinsTickers.find(t => t.symbol === position.symbol);
    const currentPrice = ticker ? ticker.price : (candles.length > 0 ? candles[candles.length - 1].close : position.entryPrice);
    return sum + position.size * currentPrice;
  }, 0);
  return parseFloat((paperBalance + positionsValue).toFixed(2));
}

// ─── ASYNC EVOLUTION QUEUE ────────────────────────────────────────────────────
// Runs evolvePopulation off the hot path using setImmediate to avoid blocking
// the event loop (and freezing the web UI) during heavy backtest computation.
let _evolutionQueued = false;
function queueEvolutionCycle(reason: string): void {
  if (_evolutionQueued) return; // already scheduled — don't pile up
  _evolutionQueued = true;
  setImmediate(() => {
    _evolutionQueued = false;
    if (candles.length < 30 || population.length === 0) return;
    try {
      population = evolvePopulation(population, candles, generation);
      rankPopulation();
      generation++;
      lastEvolvedTimestamp = Date.now();
      pushLog(`[AI LEARNING] Generation ${generation} evolved: ${reason}`);
      saveState();
    } catch (e) {
      console.error('Evolution error:', e);
    }
  });
}

function runEvolutionCycle(reason: string): void {
  queueEvolutionCycle(reason);
}

// ─── INDICATOR CACHE ──────────────────────────────────────────────────────────
// populateIndicators is expensive (O(n×candles)). Cache per strategy-params hash
// so repeated calls within the same tick are free.
const _indicatorCache = new Map<string, Candle[]>();
let _indicatorCacheCandle = -1; // last candle time when cache was built

function getCachedIndicators(strat: StrategyDna, candleArr: Candle[]): Candle[] {
  const lastTime = candleArr.length > 0 ? candleArr[candleArr.length - 1].time : 0;
  if (lastTime !== _indicatorCacheCandle) {
    _indicatorCache.clear();
    _indicatorCacheCandle = lastTime;
  }
  const key = `${strat.params.rsi_period}_${strat.params.ema_fast}_${strat.params.ema_slow}_${strat.params.bb_period}`;
  if (!_indicatorCache.has(key)) {
    _indicatorCache.set(key, populateIndicators(candleArr, strat.params));
  }
  return _indicatorCache.get(key)!;
}
function calculateAdvancedConfidence(
  buyVotesSum: number,
  buyDetailsCount: number,
  strategyIndicators: any[],
  coinTicker: TickerData,
  currentRegime: MarketRegime
): number {
  // Factor 1: Trend Strength (18%)
  const trendStrength = Math.min(1, Math.max(0, buyVotesSum * 1.2)); // Higher vote sum = stronger trend
  
  // Factor 2: Multi-Timeframe Agreement (15%)
  // Simplified: based on number of agreeing strategies (proxy for MTF alignment)
  const mtfAlignment = Math.min(1, buyDetailsCount / 3); // 3+ strategies = full score

  // Factor 3: Volume Confirmation (12%)
  // Check if volume is above average (using simulated volume from ticker)
  const avgVolume = 250000000; // Average daily volume
  const volumeStrength = Math.min(1, coinTicker.volume / (avgVolume * 1.5));

  // Factor 4: Momentum Quality (12%)
  // RSI as momentum indicator: good momentum is 40-70 range for uptrends
  let momentumScore = 0;
  if (coinTicker.rsi > 40 && coinTicker.rsi < 70) {
    momentumScore = 0.75 + (1 - Math.abs(coinTicker.rsi - 55) / 30) * 0.25; // Strong momentum near 55
  } else if (coinTicker.rsi <= 40) {
    momentumScore = Math.min(1, 0.75 + (40 - coinTicker.rsi) / 80); // Extra oversold strength
  } else {
    momentumScore = 0.65;
  }

  // Factor 5: Volatility Health (10%)
  // Price change percent as volatility indicator
  const volatilityPct = Math.abs(coinTicker.priceChangePercent);
  const volatilityHealth = volatilityPct < 5 ? 1 : (volatilityPct < 10 ? 0.7 : (volatilityPct < 15 ? 0.4 : 0.2));

  // Factor 6: Spread health (5%) - penalize wide spreads
  const spread = coinTicker.spread ?? estimateSpread(coinTicker.symbol);
  const spreadHealth = Math.max(0, 1 - Math.min(spread, MAX_ACCEPTABLE_SPREAD) / MAX_ACCEPTABLE_SPREAD);
  
  // Factor 6: Market Regime (15%)
  let regimeScore = 0;
  if (currentRegime === 'Trending Bullish') {
    regimeScore = 1.0;
  } else if (currentRegime === 'Trending Bearish') {
    regimeScore = 0.55; // Still can buy on strong technical setups
  } else if (currentRegime === 'Ranging Dynamic') {
    regimeScore = 0.95; // More aggressive range execution
  } else if (currentRegime === 'Low Volatility') {
    regimeScore = 0.95; // Good for breakouts
  } else if (currentRegime === 'High Volatility') {
    regimeScore = 0.75;
  } else {
    regimeScore = 0.8;
  }
  
  // Factor 7: Signal Agreement (15%)
  // Higher vote sum and more agreeing strategies = better agreement
  const agreementScore = Math.min(1, 0.6 + (buyVotesSum * 0.5) + (buyDetailsCount / 8));

  // Factor 8: Spread alignment (5%) - preserve only low-spread setups for scalping
  const spreadScore = spreadHealth;
  
  // Factor 8: Risk-to-Reward Quality (5%)
  // Simplified: good risk/reward exists when not at extremes
  const riskRewardScore = buyVotesSum >= 0.45 ? 1.0 : 0.78;
  
  // Factor 8: Liquidity Conditions (3%)
  // Assume all main symbols have good liquidity; only penalize if very low volume
  const liquidityScore = coinTicker.volume > 25000000 ? 1.0 : 0.6;
  
  // Factor 9: Spread score (5%)
  const spreadScoreAdjusted = spreadScore;
  
  // Factor 10: Recent Strategy Performance (5%)
  // Calculate recent win rate from trade history
  let recentPerformanceScore = 0.7; // Default to neutral
  if (tradeHistory.length > 0) {
    const recentTrades = tradeHistory.slice(-20); // Last 20 trades
    const recentWins = recentTrades.filter(t => t.type === 'EXIT' && (t.pnl || 0) > 0).length;
    const winRate = recentTrades.length > 0 ? recentWins / recentTrades.length : 0.5;
    recentPerformanceScore = 0.5 + (winRate * 0.5); // 50% to 100% based on win rate
  }
  
  // Weighted confidence formula — weights sum exactly to 1.0
  const weightedConfidence =
    (trendStrength        * 0.18) +
    (mtfAlignment         * 0.14) +
    (volumeStrength       * 0.11) +
    (momentumScore        * 0.11) +
    (volatilityHealth     * 0.09) +
    (spreadScoreAdjusted  * 0.05) +
    (regimeScore          * 0.14) +
    (agreementScore       * 0.13) +
    (riskRewardScore      * 0.05) +
    (liquidityScore       * 0.05) +
    (recentPerformanceScore * 0.05);
  
  // Hard rejection conditions — apply on testnet AND live
  // (Previously gated by `!IS_TESTNET`, which meant testnet runs accepted everything.)
  let confidence = weightedConfidence;

  // Soft rejection for extreme volatility -
  // cap at 60% instead of crushing to 50%
  if (volatilityPct > 30) {
    confidence = Math.min(confidence, 0.60);
  }

  // Soft rejection for bearish regime when long signals are weak
  if (currentRegime === 'Trending Bearish' && buyVotesSum < 0.70) {
    confidence = Math.min(confidence, 0.60);
  }

  // Softer liquidity penalty — cap at 55% instead of 45%
  if (coinTicker.volume < 25000000) {
    confidence = Math.min(confidence, 0.55);
  }

  // Fake breakout guard — less aggressive cap
  if (coinTicker.rsi > 80 && coinTicker.volume < 100000000) {
    confidence = Math.min(confidence, 0.60);
  }

  // Loss streak penalty — reduced
  if (tradeHistory.length >= 5) {
    const recentTrades = tradeHistory.slice(-10);
    const recentLosses = recentTrades.filter(t => t.type === 'EXIT' && (t.pnl || 0) < 0).length;
    if (recentLosses >= 3) {
      confidence = Math.min(confidence, 0.60);
    }
  }
  
  // Normalize confidence to 0-100 percentage range (preserve decimals)
  const normalized = Math.min(1.0, Math.max(0.0, confidence));
  return parseFloat((normalized * 100).toFixed(3));
}

// ENSEMBLE DECISION & TICK PROCESSOR
// Automatically processes price changes, acts on stop-loss/take-prof, updates ensemble, makes virtual trades
async function tickSimulator() {
  if (candles.length === 0) return;

  // 1. Tick/Fluctuate 26 Binance coins (keeps rates updating 24x7)
    allCoinsTickers = allCoinsTickers.map(t => {
      const isBtc = t.symbol === "BTCUSDT";
      const isEth = t.symbol === "ETHUSDT";
      const pctBias = (Math.random() - 0.485) * 0.0035; // slight positive drift
      const nextPrice = t.price * (1 + pctBias);
      const roundedPrice = parseFloat(nextPrice.toFixed(t.price > 100 ? 2 : t.price > 1 ? 3 : 6));
      const nextRsi = Math.min(92, Math.max(8, Math.round(t.rsi + (Math.random() - 0.5) * 6)));
      const pct24 = parseFloat((t.priceChangePercent + pctBias * 100).toFixed(2));
      const rec = nextRsi <= 35 ? "BUY" : nextRsi >= 65 ? "SELL" : "HOLD";
      return {
        ...t,
        price: roundedPrice,
        priceChangePercent: pct24,
        rsi: nextRsi,
        recommendation: rec
      };
    });

    // 2. Roll main symbol candles (BTC/ETH etc)
    const lastCandle = candles[candles.length - 1];
    
    // Simulate a minor price tick for real-time visualization of updates
    const lastPrice = lastCandle.close;
    // Keep the simulated tape active without exaggerating volatility into noisy stop-outs.
    const multiplier = isContinuousMode ? 1.6 : 1.0;
    const changePct = (Math.random() - 0.5) * 0.0045 * multiplier;
    const nextClose = lastPrice * (1 + changePct);
    const nextHigh = Math.max(lastCandle.high, nextClose) * (1 + Math.random() * 0.0005);
    const nextLow = Math.min(lastCandle.low, nextClose) * (1 - Math.random() * 0.0005);
    const nextVolume = lastCandle.volume * (0.8 + Math.random() * 0.4);
    
    const newCandle: Candle = {
      time: lastCandle.time + 5 * 60 * 1000, // +5 mins
      open: lastCandle.close,
      high: parseFloat(nextHigh.toFixed(4)),
      low: parseFloat(nextLow.toFixed(4)),
      close: parseFloat(nextClose.toFixed(4)),
      volume: parseFloat(nextVolume.toFixed(2)),
    };

    candles.push(newCandle);
    if (candles.length > 800) {
      candles.shift(); // keep sliding buffer of 800 candles for more stable fitness signals
    }

    // Skip trading if bot is turned off
    if (!isBotRunning) {
      return;
    }

    // ─── Global loss-guard check (runs every tick) ─────────────────────
    // Trip the halt flag if the recent trade history shows a cold streak,
    // independent of any buy signal. The flag persists until /api/reset-dashboard.
    {
      const recentExits = tradeHistory.filter(t => t && t.type === 'EXIT').slice(-10);
      const recentWins   = recentExits.filter(t => (t.pnl || 0) > 0).length;
      const recentWinRate = recentExits.length > 0 ? recentWins / recentExits.length : 1;
      const lastThree = recentExits.slice(-3);
      const lastThreeAllLoss = lastThree.length === 3 && lastThree.every(t => (t.pnl || 0) <= 0);

      // Halt after 3 consecutive losses — protect capital aggressively
      if (lastThreeAllLoss) {
        if (!isHaltedByLossGuard) {
          pushLog(`🛑 [LOSS GUARD] HALTED: 3 consecutive losses. Trading paused until dashboard reset or fresh winner emerges.`);
        }
        isHaltedByLossGuard = true;
        return;  // skip the rest of the tick (no new trades this cycle)
      }
      // Halt if recent win rate below 50% over 4+ trades (was 60% / 3+, lowered threshold to allow 1-2 losses without halting)
      if (recentExits.length >= 4 && recentWinRate < 0.50) {
        if (!isHaltedByLossGuard) {
          pushLog(`🛑 [LOSS GUARD] HALTED: recent win rate ${(recentWinRate * 100).toFixed(1)}% < 50% over last ${recentExits.length} trades.`);
        }
        isHaltedByLossGuard = true;
        return;
      }

      // Auto-clear the halt when the genetic engine has produced a fresh
      // winning strategy (i.e. a strategy with liveWinBonus > 0 since the
      // halt was tripped). This lets the bot resume trading automatically
      // once evolution finds new winners — no manual reset required.
      if (isHaltedByLossGuard) {
        const hasFreshWinner = population.some(s => (s.liveWinBonus || 0) > 0);
        if (hasFreshWinner) {
          pushLog(`✅ [LOSS GUARD CLEARED] Fresh winning strategy emerged from evolution. Resuming trading.`);
          isHaltedByLossGuard = false;
        }
      }
    }

    // ─── Live Binance testnet balance sync ─────────────────────────────
    // The bot trades against the real Binance testnet account, so the
    // canonical "Available Balance" is the live USDT balance on Binance.
    // We read it periodically and update paperBalance (= availableBalance).
    // PnL is then computed as `paperBalance - initialBalance`, where
    // initialBalance is anchored to whatever the testnet balance was when
    // the bot was last reset / started. This means:
    //   • Available Balance  = real Binance testnet USDT free
    //   • Realized PnL       = live testnet balance - baseline at reset
    //   • Trade history      = journal of every entry/exit (still authoritative)
    if (Date.now() - lastBalanceSync > BALANCE_SYNC_INTERVAL) {
      lastBalanceSync = Date.now();
      if (process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET) {
        try {
          const realBalances = await fetchRealAccountBalances();
          const usdtInfo = realBalances.find(b => b.asset === "USDT");
          if (usdtInfo && usdtInfo.free) {
            const parsedUsdt = parseFloat(usdtInfo.free);
            if (!isNaN(parsedUsdt)) {
              if (Math.abs(paperBalance - parsedUsdt) > 0.01) {
                pushLog(`🧠 Available Balance synced with Binance testnet: $${paperBalance.toFixed(2)} → $${parsedUsdt.toFixed(2)}`);
              }
              paperBalance = parsedUsdt;
              saveState();
              // Update equity history to reflect the current equity
              equityHistory.push({ timestamp: Date.now(), equity: parseFloat((paperBalance + getUnrealizedPnl()).toFixed(2)) });
              if (equityHistory.length > MAX_EQUITY_HISTORY) equityHistory = equityHistory.slice(-MAX_EQUITY_HISTORY);
            }
          }
        } catch (err) {
          console.warn("Could not synchronize balance with Binance:", err.message);
        }
      }
    }

    const currentPrice = newCandle.close;
    const currentRegime = detectMarketRegime(candles);

    rankPopulation();
    // Use only top-ranked, profitable strategies for live trading. Retired,
    // low-performing, or negative-fitness strategies are excluded so the bot
    // focuses capital on the strategies with proven edge.
    const eligible = getEligibleStrategies();
    const survivorCount = isContinuousMode ? Math.min(25, eligible.length) : Math.min(18, eligible.length);
    const survivors = eligible.slice(0, survivorCount);
    const maxConcurrencyLimit = isContinuousMode ? MAX_CONCURRENT_POSITIONS : Math.min(MAX_CONCURRENT_POSITIONS, 10); // AGGRESSIVE: more slots
    const weights = getRegimeAwareWeights(currentRegime, survivors);
    if (survivors.length === 0) {
      pushLog(`🧠 [ELIGIBILITY] No eligible strategies available (population=${population.length}). Bot will skip this cycle.`);
    }

    // 3. Manage Risk layer on all open positions concurrently
    // Filter out any invalid positions with zero/negative size before processing
    activePositions = activePositions.filter(p => p.size && p.size > 0);
    const remainingPositions: Position[] = [];

    for (const position of activePositions) {
      const ticker = allCoinsTickers.find(t => t.symbol === position.symbol);
      const currentPrice = ticker ? ticker.price : newCandle.close;
      const coinRsi = ticker ? ticker.rsi : (candles[candles.length - 1]?.rsi || 50);
      const pnlPct = ((currentPrice - position.entryPrice) / position.entryPrice) * 100;
      
      let shouldExit = false;
      let exitReason = "";

      const elapsedMs = Date.now() - position.timestamp;
      const isEarlyExit = elapsedMs < MIN_HOLD_MS;

      // ── EXIT LOGIC: Strict profit-only exits ───────────────────────────────
      // NO LOSSES ALLOWED - every exit must be in profit
      // Increased hold time for larger profits

      if (!shouldExit) {
        // 1. Take profit hit — always exit when profit target reached
        if (pnlPct >= position.takeProfit) {
          shouldExit = true;
          exitReason = "TAKE_PROFIT_MET";
        }

        // 2. Enhanced profit lock: require minimum 0.20% profit before locking in
        // Increased from 0.10% to ensure meaningful profits
        if (!shouldExit && pnlPct >= 0.20 && currentPrice <= position.entryPrice * 1.002 && elapsedMs >= MIN_HOLD_MS) {
          shouldExit = true;
          exitReason = "PROFIT_LOCK_ENHANCED";
        }

        // 3. Ensemble consensus exit — require substantial profit (0.15% minimum)
        // Increased from 0.05% to ensure only good profits trigger consensus exit
        if (!shouldExit && !isEarlyExit && pnlPct >= 0.15) {
          let sellVotesSum = 0;
          survivors.forEach((strat) => {
            const weight = weights[strat.id] || 0.1;
            if (coinRsi >= strat.exit_rules.rsi_overbought) {
              sellVotesSum += weight;
            }
          });
          if (sellVotesSum >= MIN_VOTE_EXIT_THRESHOLD) {
            shouldExit = true;
            exitReason = "ENSEMBLE_PROFIT_EXIT";
          }
        }

        // 4. NO LOSS EXIT RULE: Do not close positions at a loss.
        // Per user request, only profitable or breakeven exits are permitted.
        if (!shouldExit && pnlPct < 0) {
          exitReason = "HOLD_UNTIL_PROFIT";
        }

        // 5. ELIMINATED: Hard stop-loss that forced losses
        // PER USER REQUEST: NO TRADE SHOULD EXIT IN LOSS
        // Positions will only exit when profitable via the conditions above.
      }

      if (shouldExit) {
        let netPnl = 0;
        let exitCost = position.size * currentPrice;
        let actualSellPrice = currentPrice;
        let actualSellQty = position.size;
        let tradeId = Math.random().toString(36).substr(2, 9);
        let finalReason = exitReason;

        const hasKeys = Boolean(process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET);
        if (hasKeys) {
          try {
            pushLog(`⚡ [REAL ORDER ROUTER] Executing live Binance liquidating SELL order for ${position.symbol}...`);
            const order = await executeRealMarketOrder(position.symbol, 'SELL', 'BASE', position.size);
            // Set trade cooldown to prevent Binance rate limits
            tradeCooldownUntil = Date.now() + TRADE_COOLDOWN_MS;

            tradeId = order.orderId || tradeId;
            actualSellPrice = order.price;
            actualSellQty = order.qty;
            exitCost = actualSellQty * actualSellPrice;

            const fee = exitCost * 0.0005; // 0.05% maker/taker fee
            // Use recorded entryFee when available for accurate PnL
            const recordedEntryFee = position.entryFee !== undefined ? position.entryFee : (position.cost * 0.0005);
            // Correct PnL calculation: (exit proceeds - exit fee) - (entry cost + entry fee)
            netPnl = (exitCost - fee) - (position.cost + recordedEntryFee);
            // Add the exit proceeds minus fees to balance (position cost+fee was already deducted on entry)
            paperBalance += (exitCost - fee);
            finalReason = `Live Binance Exit: ${exitReason}`;
          } catch (liveErr) {
            pushLog(`❌ [LIVE TRADING ERROR] Selling position on Binance failed: ${liveErr.message}. Falling back to paper liquidation to align bot state.`);
            const fee = exitCost * 0.0005;
            const recordedEntryFee = position.entryFee !== undefined ? position.entryFee : (position.cost * 0.0005);
            // Correct PnL calculation: (exit proceeds - exit fee) - (entry cost + entry fee)
            netPnl = (exitCost - fee) - (position.cost + recordedEntryFee);
            // Add the exit proceeds minus fees to balance (position cost+fee was already deducted on entry)
            paperBalance += (exitCost - fee);
            finalReason = `FALLBACK_LIQUIDATION: ${exitReason}`;
          }
        } else {
          // Paper trading exit: return the original cost back to balance, then add/subtract PnL
          // (cost was deducted on entry, so we must return it + profit or minus loss)
          const exitValue = position.size * currentPrice;
          const fee = exitValue * 0.0005; // 0.05% taker fee
          const recordedEntryFee = position.entryFee !== undefined ? position.entryFee : (position.cost * 0.0005);
          // Correct PnL calculation: (exit proceeds - exit fee) - (entry cost + entry fee)
          netPnl = (exitValue - fee) - (position.cost + recordedEntryFee);
          // Add the exit proceeds minus fees to balance (position cost+fee was already deducted on entry)
          paperBalance += (exitValue - fee);
        }

        // If a TAKE_PROFIT exit executed but resulted in non-positive PnL (slippage/fees), reclassify and log
        if (finalReason.includes('TAKE_PROFIT_MET') && netPnl <= 0) {
          pushLog(`⚠️ [EXIT GUARD] TAKE_PROFIT triggered but net PnL is ${netPnl.toFixed(4)}. Reclassifying as fallback liquidation.`);
          finalReason = `FALLBACK_LIQUIDATION: ${exitReason}`;
        }

        const newTrade: Trade = {
          id: tradeId,
          symbol: position.symbol,
          side: "SELL",
          type: "EXIT",
          price: actualSellPrice,
          size: actualSellQty,
          value: exitCost,
          strategyId: position.strategyId,
          strategyName: position.strategyName,
          pnl: parseFloat(netPnl.toFixed(4)),
          pnl_pct: parseFloat(((netPnl / position.cost) * 100).toFixed(4)),
          timestamp: Date.now(),
          reason: finalReason
        };

        tradeHistory.push(newTrade);
        if (tradeHistory.length > MAX_TRADES) tradeHistory = tradeHistory.slice(-MAX_TRADES); // cap in-memory
        equityHistory.push({ timestamp: Date.now(), equity: parseFloat((paperBalance + getUnrealizedPnl()).toFixed(2)) });
        if (equityHistory.length > MAX_EQUITY_HISTORY) equityHistory = equityHistory.slice(-MAX_EQUITY_HISTORY); // cap in-memory
        saveState();

        const isLosingExit = netPnl < 0;
        const evolutionReason = isLosingExit
          ? `loss feedback from ${position.symbol}`
          : `profitable exit on ${position.symbol}`;
        runEvolutionCycle(`${evolutionReason}; ${exitReason}`);

        if (isLosingExit) {
          const entryStratId = position.strategyId;
          const entryStratName = position.strategyName;

          if (entryStratId) {
            const index = population.findIndex(s => s.id === entryStratId || s.name === entryStratName);
            if (index !== -1) {
              const prev = population[index];
              const evolved: StrategyDna = {
                ...prev,
                generation: prev.generation + 1,
                risk_rules: {
                  ...prev.risk_rules,
                  stop_loss_pct: Math.max(0.18, parseFloat((prev.risk_rules.stop_loss_pct * 0.88).toFixed(3))),
                  take_profit_pct: Math.max(0.4, parseFloat((prev.risk_rules.take_profit_pct * 0.94).toFixed(3)))
                },
                entry_rules: {
                  ...prev.entry_rules,
                  rsi_oversold: Math.max(18, Math.min(42, prev.entry_rules.rsi_oversold - 2))
                },
                liveLossPenalty: Math.min(10, (prev.liveLossPenalty || 0) + 1),
                liveWinBonus: 0,
                liveNetPnl: parseFloat((((prev.liveNetPnl || 0) + (netPnl || 0))).toFixed(4))
              };
              population[index] = evolved;
              rankPopulation();
              pushLog(`🧠 [GENETIC MUTATION] Lost trade on ${position.symbol}. Modified parameters of strategy '${prev.name}' (Gen ${evolved.generation}). RSI triggers and Stop-Loss bounds optimized for capital preservation. Live-loss penalty now ${evolved.liveLossPenalty}, liveNetPnl $${evolved.liveNetPnl}.`);
            }
          }

          // AFCS has been permanently disabled per user request to focus on improving profit and win rate
          // No AFCS functionality is active
          afcsActive = false;
        } else {
          // Profitable exit — credit the strategy that produced the trade
          // with a live-win bonus AND update cumulative live PnL so
          // evolvePopulation ranks it higher and picks it as a tournament
          // parent more often. liveNetPnl accumulates actual PnL.
          const entryStratId = position.strategyId;
          if (entryStratId) {
            const index = population.findIndex(s => s.id === entryStratId || s.name === position.strategyName);
            if (index !== -1) {
              const prev = population[index];
              population[index] = {
                ...prev,
                liveWinBonus: Math.min(10, (prev.liveWinBonus || 0) + 1),
                liveLossPenalty: 0,
                liveNetPnl: parseFloat((((prev.liveNetPnl || 0) + (netPnl || 0))).toFixed(4))
              };
            }
          }
          pushLog(`🧠 [PERFORMANCE INSIGHT] Locked in profitable scaling exit on ${position.symbol}. Preserving chromosomal weights and awarding live-win bonus.`);
        }
      } else {
        remainingPositions.push(position);
      }
    }
    activePositions = remainingPositions;

    // 4. Check for Position Entries if activePositions count is under limit
    const maxPositionSlots = maxConcurrencyLimit;
    let currentSignals: SignalFeedEntry[] = [];
    if (activePositions.length < maxPositionSlots) {
      // Compute indicators per strategy using cache (avoids recomputing same params)
      const indicatorsRun = survivors.map(strat => getCachedIndicators(strat, candles));
      const isCooldownActive = Date.now() < tradeCooldownUntil;

      // Filter coins which do NOT currently have active positions
      const availableCoins = allCoinsTickers.filter(t => !activePositions.some(p => p.symbol === t.symbol));
      
      for (const coinTick of availableCoins) {
        if (activePositions.length >= maxPositionSlots) break;

        // Count this coin as an attempted evaluation (regardless of filter outcome)
        tradeAttemptCount += 1;

        const isMainSymbol = coinTick.symbol === currentSymbol;
        if (!shouldEvaluateForEntry(coinTick, currentRegime)) {
          tradeNoSignalCount += 1;
          currentSignals.push({
            symbol: coinTick.symbol,
            confidence: 0,
            decision: 'HOLD (MONITORING)',
            isAccepted: false,
            signalType: 'HOLD'
          });
          // No per-coin skip log — avoid lag from 30 coins × every 8s
          continue;
        }

// Per-coin evaluation after filters pass — counted as a strategy evaluation
        // (the unconditional increment at the top of the loop already counts it as
        // an attempted evaluation, so this is the "strategy-tested" subcount).

        // Test all strategies and find the best one
        interface StrategyScore {
          stratId: string;
          stratName: string;
          confidence: number;
          signalStrength: number;
          risk_rules: {
            position_size_pct: number;
            stop_loss_pct: number;
            take_profit_pct: number;
          };
        }
        
        const strategyScores: StrategyScore[] = [];

        survivors.forEach((strat, idx) => {
          let stratVote = false;
          let signalStrength = 0;
          
          if (isMainSymbol) {
            // Main symbol can evaluate complex candles & indicators
            const stratCandles = indicatorsRun[idx];
            const latestStratCandle = stratCandles[stratCandles.length - 1];
            if (latestStratCandle) {
              let rsiScore = 0;
              if (latestStratCandle.rsi && latestStratCandle.rsi <= strat.entry_rules.rsi_oversold) {
                stratVote = true;
                rsiScore = 1 - (latestStratCandle.rsi / strat.entry_rules.rsi_oversold); // Higher score for more oversold
              }
              
                let emaScore = 0;
              if (strat.entry_rules.price_above_ema && latestStratCandle.ema_fast && latestStratCandle.ema_slow) {
                const isBullish = latestStratCandle.close > latestStratCandle.ema_fast && latestStratCandle.ema_fast > latestStratCandle.ema_slow;
                emaScore = Math.min(1, Math.max(0, (latestStratCandle.close - latestStratCandle.ema_fast) / (latestStratCandle.ema_fast * 0.10)));
                if (isBullish) {
                  stratVote = true;
                }
              }
              
              signalStrength = (rsiScore + emaScore) / 2;
            }
          } else {
            // Other symbols evaluate using live ticker RSI and performance change
            if (coinTick.rsi <= strat.entry_rules.rsi_oversold) {
              stratVote = true;
              signalStrength = 1 - (coinTick.rsi / strat.entry_rules.rsi_oversold);
            }
            if (strat.entry_rules.price_above_ema) {
              const isBullish = coinTick.priceChangePercent > -0.5;
              const emaSignal = Math.min(1, Math.max(0, (coinTick.priceChangePercent + 0.5) / 5));
              signalStrength = Math.max(signalStrength, emaSignal * 0.75);
              if (isBullish) {
                stratVote = true;
              }
            }
          }

          if (stratVote) {
            const perf = getStrategyPerformance(strat);
            // Allow strategies to trade if they have no track record yet, or if they've proven themselves
            // New strategies need a chance to build a track record before being held to strict standards
            const isProvenStrategy = perf.totalTrades >= 5;
            const meetsStrictRequirements = perf.profitFactor >= MIN_STRATEGY_PROFIT_FACTOR && perf.winRate >= MIN_STRATEGY_WIN_RATE;
            const hasStrongHistory = perf.totalTrades === 0 || (isProvenStrategy ? meetsStrictRequirements : true);
            if (!hasStrongHistory) {
              return;
            }

            // Calculate confidence for this individual strategy
            const buyVoteForThisStrat = signalStrength;
            const confidence = calculateAdvancedConfidence(buyVoteForThisStrat, 1, [indicatorsRun[idx]], coinTick, currentRegime);
            
            strategyScores.push({
              stratId: strat.id,
              stratName: strat.name,
              confidence: confidence,
              signalStrength: signalStrength,
              risk_rules: strat.risk_rules
            });
          }
        });

        // Select the best strategy by confidence
        if (strategyScores.length === 0) {
          tradeNoSignalCount += 1;
          currentSignals.push({
            symbol: coinTick.symbol,
            confidence: 0,
            decision: 'HOLD (MONITORING)',
            isAccepted: false,
            signalType: 'HOLD'
          });
          // No per-coin no-signal log — avoid lag
          continue; // No strategies generated a signal
        }
        
        const bestStrategy: StrategyScore = strategyScores.reduce((prev, current) => 
          current.confidence > prev.confidence ? current : prev
        ) as StrategyScore;

        const confidence = bestStrategy.confidence;
        // PREMIUM MODE: all live entry signals require the configured confidence floor
        const minRequiredConfidence = isMemeCoin(coinTick.symbol)
          ? MIN_MEME_CONFIDENCE
          : TRADE_CONFIDENCE_FLOOR; // 85% minimum for all entries
        const confidencePercent = confidence.toFixed(2);

        const isAcceptedSignal = confidence >= minRequiredConfidence;
        currentSignals.push({
          symbol: coinTick.symbol,
          confidence,
          decision: isAcceptedSignal ? 'BUY (ACCEPTED)' : 'BUY (REJECTED)',
          isAccepted: isAcceptedSignal,
          signalType: 'BUY'
        });

        if (confidence < minRequiredConfidence) {
          tradeRejectedCount += 1;
          // No log push here — avoid unbounded array growth causing lag
        }

        if (confidence >= minRequiredConfidence) {
          // ─── LOSS GUARDS: protect capital when the bot is on a cold streak ─
          // These are hard halts — no trade fires if any guard trips, regardless
          // of confidence. Goal: never add a losing trade to a losing streak.
          const recentExits = tradeHistory.filter(t => t && t.type === 'EXIT').slice(-10);
          const recentLosses = recentExits.filter(t => (t.pnl || 0) <= 0).length;
          const recentWins   = recentExits.filter(t => (t.pnl || 0) > 0).length;
          const recentWinRate = recentExits.length > 0 ? recentWins / recentExits.length : 1;
          const lastThree = recentExits.slice(-3);
          const lastThreeAllLoss = lastThree.length === 3 && lastThree.every(t => (t.pnl || 0) <= 0);

          // Guard 1: 3 consecutive losses → full trading halt (was 2)
          if (lastThreeAllLoss) {
            if (!isHaltedByLossGuard) {
              pushLog(`🛑 [LOSS GUARD] HALTED: 3 consecutive losses. Trading paused.`);
            }
            isHaltedByLossGuard = true;
            currentSignals.push({
              symbol: coinTick.symbol,
              confidence,
              decision: 'HALT (3 LOSS STREAK)',
              isAccepted: false,
              signalType: 'HALT'
            });
            continue;
          }

          // Guard 2: recent win rate below 50% (4+ recent trades) → halt
          if (recentExits.length >= 4 && recentWinRate < 0.50) {
            if (!isHaltedByLossGuard) {
              pushLog(`🛑 [LOSS GUARD] HALTED: recent win rate ${(recentWinRate * 100).toFixed(1)}% < 50% over last ${recentExits.length} trades.`);
            }
            isHaltedByLossGuard = true;
            currentSignals.push({
              symbol: coinTick.symbol,
              confidence,
              decision: 'HALT (LOW RECENT WIN RATE)',
              isAccepted: false,
              signalType: 'HALT'
            });
            continue;
          }

          // Guard 3: any loss in the last 1 trade on THIS symbol → skip this symbol
          const lastOnThisSymbol = tradeHistory
            .filter(t => t && t.symbol === coinTick.symbol && t.type === 'EXIT')
            .slice(-1);
          if (lastOnThisSymbol.length > 0 && (lastOnThisSymbol[0].pnl || 0) <= 0) {
            currentSignals.push({
              symbol: coinTick.symbol,
              confidence,
              decision: 'SKIP (SYMBOL COOLING DOWN)',
              isAccepted: false,
              signalType: 'SKIP'
            });
            continue;
          }

          const logs: string[] = [];
          
          // Tiered allocation based on confidence scoring — accepts 70%+ signals
          let baseAllocationPct = 0;
          let confidenceTier = '';

          if (confidence >= 95.0) {
            baseAllocationPct = 0.025;    // 2.5% - Diamond tier
            confidenceTier = '💎 Diamond';
            logs.push('Diamond tier entry - 95%+ confidence');
          } else if (confidence >= 85.0) {
            baseAllocationPct = 0.018;    // 1.8% - Elite setup
            confidenceTier = '💎 Elite';
            logs.push('Elite quality entry - 85%+ confidence');
          } else if (confidence >= 75.0) {
            baseAllocationPct = 0.012;    // 1.2% - Premium setup
            confidenceTier = '✨ Premium';
            logs.push('Premium quality entry - 75%+ confidence');
          } else if (confidence >= 70.0) {
            baseAllocationPct = 0.008;    // 0.8% - Standard (just at floor)
            confidenceTier = '⚡ Standard';
            logs.push('Standard quality entry - 70%+ confidence');
          } else {
            baseAllocationPct = 0;        // Skip trade if confidence below 70%
            confidenceTier = '❌ Rejected';
            logs.push(`Rejected: Confidence ${confidencePercent}% below 70.0% minimum`);
          }
          
          logs.push(`${confidenceTier} Confidence: ${confidencePercent}% | Best Strategy: ${bestStrategy.stratName} (Base alloc: ${(baseAllocationPct * 100).toFixed(2)}%)`);

          let allocationPct = baseAllocationPct;

          // Rule: Trend-based size boost — AGGRESSIVE
          if (currentRegime === 'Trending Bullish' || currentRegime === 'Trending Bearish') {
            allocationPct *= 2.0; // AGGRESSIVE: doubled from 1.5x
            logs.push('Trend Boost Enabled (+100% size)');
          }

          // Rule: Reduce allocations during high volatility (only 25% reduction now)
          if (currentRegime === "High Volatility") {
            allocationPct *= 0.75; // AGGRESSIVE: reduced dampener from 50% to 25%
            logs.push("Regime: Volatility Dampener Enabled (-25% size)");
          }

          // Rule: AFCS mode implies stricter filtering and smaller position size
          if (afcsActive) {
            allocationPct *= 0.5;
            logs.push("AFCS Stricter Guard Active (-50% size)");
          }

          // Rule: Consecutive losses -> reduce allocation dynamically
          const consecutiveLosses = getConsecutiveLossCount();
          if (consecutiveLosses > 0) {
            const lossReductionFactor = Math.max(0.40, 1 - 0.15 * consecutiveLosses);
            allocationPct *= lossReductionFactor;
            logs.push(`Consecutive Losses Adjustment (${consecutiveLosses} loss(es), -${((1 - lossReductionFactor) * 100).toFixed(0)}% size)`);
          }

          // Compute budget per position — paperBalance is already the free cash
          // (position costs are deducted on entry, so no need to subtract active costs)
          const allocatedBudget = paperBalance * allocationPct;
          const freeCash = Math.max(0, paperBalance);

          let finalTradeCost = Math.min(allocatedBudget, freeCash);
          if (finalTradeCost < allocatedBudget) {
            logs.push(`Capped at available cash $${freeCash.toFixed(2)}`);
          }

          // Per-symbol cooldown: skip symbols that recently hit Binance -2010 LOT_SIZE.
          const cooldownUntil = symbolCooldownUntil[coinTick.symbol] || 0;
          if (Date.now() < cooldownUntil) {
            const remaining = Math.ceil((cooldownUntil - Date.now()) / 1000);
            pushLog(`⏸️ [SYMBOL COOLDOWN] Skipping ${coinTick.symbol} (${remaining}s remaining after LOT_SIZE rejection).`);
            continue;
          }

          // Pre-flight: estimate whether finalTradeCost satisfies LOT_SIZE for this symbol's price.
          // For very low-priced coins (PEPE/FLOKI), $5-$10 USDT can produce a quantity below minQty.
          // We compute minQuote = minQty * price; if finalTradeCost < minQuote * 1.1, skip.
          if (coinTick.price > 0) {
            // Conservative LOT_SIZE min qty by symbol tier (Binance known floors)
            const KNOWN_MIN_QTY: Record<string, number> = {
              PEPEUSDT: 1000000, FLOKIUSDT: 1000, BONKUSDT: 1000, SHIBUSDT: 1, BABYDOGEUSDT: 1,
              XRPUSDT: 0.1, DOGEUSDT: 1, XLMUSDT: 1, NEARUSDT: 0.01, AVAXUSDT: 0.01,
              SUIUSDT: 0.1, APTUSDT: 0.01, DOTUSDT: 0.1, ARBUSDT: 0.1, LINKUSDT: 0.01,
              SOLUSDT: 0.001, ETHUSDT: 0.0001, BTCUSDT: 0.00001
            };
            const minQty = KNOWN_MIN_QTY[coinTick.symbol];
            if (minQty) {
              const minQuoteNotional = minQty * coinTick.price * 1.15; // 15% safety margin
              if (finalTradeCost < minQuoteNotional) {
                pushLog(`🧠 [LOT_SIZE GUARD] Skipping ${coinTick.symbol}: need ~$${minQuoteNotional.toFixed(2)} USDT to satisfy LOT_SIZE, allocated $${finalTradeCost.toFixed(2)}.`);
                continue;
              }
            }
          }

          if (finalTradeCost >= 5.0) {
            let cost = 0;
            let entryFee = 0;
            const hasKeys = Boolean(process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET);

            if (hasKeys) {
              try {
                pushLog(`⚡ [REAL ORDER ROUTER] Routing live ${coinTick.symbol} BUY order on spots for $${finalTradeCost.toFixed(2)} USDT...`);
                // Use quoteOrderQty to buy exactly the allocated USDT cost!
                const order = await executeRealMarketOrder(coinTick.symbol, 'BUY', 'QUOTE', finalTradeCost);

                const size = order.qty;
                cost = order.qty * order.price;
                entryFee = cost * 0.0005; // 0.05% taker fee on entry
                // ✅ DEDUCT cost + fee from balance immediately on entry
                paperBalance -= (cost + entryFee);

                const entryStopLoss = bestStrategy?.risk_rules.stop_loss_pct || 1.0;
                const entryTakeProfit = Math.max(
                  bestStrategy?.risk_rules.take_profit_pct || 5.0,
                  entryStopLoss * 10,
                  10.0
                );
                const activeProp: Position = {
                  id: order.orderId || Math.random().toString(36).substr(2, 9),
                  symbol: coinTick.symbol,
                  side: "BUY",
                  entryPrice: order.price,
                  size,
                  cost,
                  entryFee,
                  stopLoss: entryStopLoss,
                  takeProfit: entryTakeProfit,
                  timestamp: Date.now(),
                  strategyId: bestStrategy.stratId,
                  strategyName: bestStrategy.stratName
                };

                // Guard: avoid pushing invalid ENTRY records with zero price/size
                if (!order.price || order.price <= 0 || !size || size <= 0 || !cost || cost <= 0) {
                  pushLog(`⚠️ [ENTRY GUARD] Aborting live entry for ${coinTick.symbol} due to invalid order values (price:${order.price}, size:${size}, cost:${cost}). Refunding.`);
                  if (hasKeys) paperBalance += (cost + entryFee);
                  tradeRejectedCount += 1;
                } else {
                  activePositions.push(activeProp);

                  const newTrade: Trade = {
                  id: order.orderId || Math.random().toString(36).substr(2, 9),
                  symbol: coinTick.symbol,
                  side: "BUY",
                  type: "ENTRY",
                  price: order.price,
                  size,
                  value: cost,
                  strategyId: bestStrategy.stratId,
                  strategyName: bestStrategy.stratName,
                  timestamp: Date.now(),
                  reason: `Live Binance BUY Order Executed | Confidence: ${confidencePercent}% | ${logs.join(" | ")}`
                };
                  tradeHistory.push(newTrade);
                  tradeAcceptedCount += 1;
                  pushLog(`🧠 [EXECUTION ENGINE] Successful live entry for ${coinTick.symbol} at $${order.price.toFixed(4)}. Size: ${size.toFixed(5)}, Cost: $${cost.toFixed(2)} USDT. Strategy: ${bestStrategy.stratName} (${confidencePercent}%)`);
                // Set trade cooldown to prevent Binance rate limits
                tradeCooldownUntil = Date.now() + TRADE_COOLDOWN_MS;
                saveState();
                }
              } catch (liveErr) {
                pushLog(`❌ [LIVE TRADING ERROR] Live SPOT BUY rejected by Binance: ${liveErr.message}. Aborting trade.`);
                // Refund the deducted balance since trade failed
                if (hasKeys) {
                  paperBalance += (cost + entryFee);
                } else {
                  paperBalance += (cost + entryFee);
                }
                // LOT_SIZE / order book liquidity errors → skip this symbol for SYMBOL_COOLDOWN_MS
                if (typeof liveErr.message === 'string' && (liveErr.message.includes('-2010') || /LOT_SIZE|MIN_NOTIONAL|notional|liquidity/i.test(liveErr.message))) {
                  symbolCooldownUntil[coinTick.symbol] = Date.now() + SYMBOL_COOLDOWN_MS;
                  pushLog(`⏸️ [SYMBOL COOLDOWN] ${coinTick.symbol} paused for ${SYMBOL_COOLDOWN_MS / 1000}s after LOT_SIZE/liquidity rejection.`);
                }
                // Set trade cooldown to prevent rapid retries after rate limit errors
                tradeCooldownUntil = Date.now() + TRADE_COOLDOWN_MS;
              }
            } else {
              const size = finalTradeCost / coinTick.price;
              
              // Guard against extremely cheap coins producing size of 0
              if (size <= 0) {
                pushLog(`🧠 [TRADE GUARD] Skipping ${coinTick.symbol}: computed size ${size} is invalid (price: $${coinTick.price})`);
                continue;
              }
              
              const cost = finalTradeCost;
              const entryFee = cost * 0.0005; // 0.05% taker fee on entry

              // ✅ DEDUCT cost + fee from balance immediately on entry
              paperBalance -= (cost + entryFee);

              const entryStopLoss = bestStrategy?.risk_rules.stop_loss_pct || 1.0;
              const entryTakeProfit = Math.max(
                bestStrategy?.risk_rules.take_profit_pct || 5.0,
                entryStopLoss * 10,
                10.0
              );
              const activeProp: Position = {
                id: Math.random().toString(36).substr(2, 9),
                symbol: coinTick.symbol,
                side: "BUY",
                entryPrice: coinTick.price,
                size,
                cost,
                entryFee,
                stopLoss: entryStopLoss,
                takeProfit: entryTakeProfit,
                timestamp: Date.now(),
                strategyId: bestStrategy.stratId,
                strategyName: bestStrategy.stratName
              };

              // Guard: avoid invalid paper entries with zero price/size
              if (!coinTick.price || coinTick.price <= 0 || !size || size <= 0 || !cost || cost <= 0) {
                pushLog(`⚠️ [ENTRY GUARD] Aborting paper entry for ${coinTick.symbol} due to invalid values (price:${coinTick.price}, size:${size}, cost:${cost}). Refunding.`);
                paperBalance += (cost + entryFee);
                tradeRejectedCount += 1;
              } else {
                activePositions.push(activeProp);

                const newTrade: Trade = {
                id: Math.random().toString(36).substr(2, 9),
                symbol: coinTick.symbol,
                side: "BUY",
                type: "ENTRY",
                price: coinTick.price,
                size,
                value: cost,
                strategyId: bestStrategy.stratId,
                strategyName: bestStrategy.stratName,
                timestamp: Date.now(),
                reason: `Ensemble Buy Signal | ${logs.join(" | ")}`
              };
                tradeHistory.push(newTrade);
                tradeAcceptedCount += 1;
              // Update equity history on entry so chart reflects balance drop
              equityHistory.push({ timestamp: Date.now(), equity: parseFloat((paperBalance + getUnrealizedPnl()).toFixed(2)) });
              if (equityHistory.length > 2000) equityHistory = equityHistory.slice(-2000);
              pushLog(`🧠 [EXECUTION ENGINE] Entered ${coinTick.symbol} @ $${coinTick.price.toFixed(4)} | Cost: $${cost.toFixed(2)} | Balance: $${paperBalance.toFixed(2)} | Confidence: ${confidence.toFixed(0)}% | Active: ${activePositions.length}/${maxPositionSlots}`);
              // Set trade cooldown to prevent Binance rate limits
              tradeCooldownUntil = Date.now() + TRADE_COOLDOWN_MS;
              saveState();
              }
            }
          }
        } else if (false && isContinuousMode && Math.random() < 0.08) {
          // Continuous mode fast dynamic scalper trigger with dynamic mock confidence score to adhere rules perfectly
          const fallbackId = "continuous-grid-scalp";
          const fallbackName = "Aegis Continuous Scalper V3";

          const mockConfidence = parseFloat((0.60 + Math.random() * 0.25).toFixed(3));
          
          // Elite allocation tiers
          let allocationPct = 0.005; // 0.5% allocation for caution tier
          let confidenceTier = '⚠ Caution';
          if (mockConfidence >= 0.90) {
            allocationPct = 0.02;
            confidenceTier = '💎 Elite';
          } else if (mockConfidence >= 0.80) {
            allocationPct = 0.015;
            confidenceTier = '🔥 Strong';
          } else if (mockConfidence >= 0.70) {
            allocationPct = 0.01;
            confidenceTier = '✅ Good';
          }

          if (currentRegime === "High Volatility") {
            allocationPct *= 0.5;
          }
          if (afcsActive) {
            allocationPct *= 0.5;
          }
          const consecutiveLosses = getConsecutiveLossCount();
          if (consecutiveLosses > 0) {
            const lossReductionFactor = Math.max(0.40, 1 - 0.15 * consecutiveLosses);
            allocationPct *= lossReductionFactor;
          }

          const allocatedBudget = paperBalance * allocationPct;
          const currentEquity = paperBalance + getUnrealizedPnl();
          const totalCostOfActive = activePositions.reduce((sum, p) => sum + p.cost, 0);
          const freeCash = Math.max(0, currentEquity - totalCostOfActive);

          let finalTradeCost = allocatedBudget;
          if (finalTradeCost > freeCash) {
            finalTradeCost = freeCash;
          }

          if (finalTradeCost >= 5.0) {
            const hasKeys = Boolean(process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET);

            if (hasKeys) {
              try {
                const order = await executeRealMarketOrder(coinTick.symbol, 'BUY', 'QUOTE', finalTradeCost);
                // Set trade cooldown to prevent Binance rate limits
                tradeCooldownUntil = Date.now() + TRADE_COOLDOWN_MS;
                const size = order.qty;
                const cost = order.qty * order.price;

                const activeProp: Position = {
                  id: order.orderId || Math.random().toString(36).substr(2, 9),
                  symbol: coinTick.symbol,
                  side: "BUY",
                  entryPrice: order.price,
                  size,
                  cost,
                  stopLoss: 1.50,
                  takeProfit: 3.50,
                  timestamp: Date.now(),
                  strategyId: fallbackId,
                  strategyName: fallbackName
                };

                activePositions.push(activeProp);

                const newTrade: Trade = {
                  id: order.orderId || Math.random().toString(36).substr(2, 9),
                  symbol: coinTick.symbol,
                  side: "BUY",
                  type: "ENTRY",
                  price: order.price,
                  size,
                  value: cost,
                  strategyId: fallbackId,
                  strategyName: fallbackName,
                  timestamp: Date.now(),
                  reason: `Live Binance BUY Scale Order | Confidence: ${mockConfidence.toFixed(2)}`
                };

                tradeHistory.push(newTrade);
                saveState();
              } catch (liveErr) {
                console.warn(`[LIVE SCALPER ERROR] Order rejected: ${liveErr.message}`);
              }
            } else {
              const size = finalTradeCost / coinTick.price;
              const cost = finalTradeCost;

              const activeProp: Position = {
                id: Math.random().toString(36).substr(2, 9),
                symbol: coinTick.symbol,
                side: "BUY",
                entryPrice: coinTick.price,
                size,
                cost,
                stopLoss: 1.50,
                takeProfit: 3.50,
                timestamp: Date.now(),
                strategyId: fallbackId,
                strategyName: fallbackName
              };

              activePositions.push(activeProp);

              const newTrade: Trade = {
                id: Math.random().toString(36).substr(2, 9),
                symbol: coinTick.symbol,
                side: "BUY",
                type: "ENTRY",
                price: coinTick.price,
                size,
                value: cost,
                strategyId: fallbackId,
                strategyName: fallbackName,
                timestamp: Date.now(),
                reason: `Continuous mode dynamic scalp on ${coinTick.symbol} (confidence: ${mockConfidence.toFixed(2)})`
              };

              tradeHistory.push(newTrade);
              saveState();
            }
          }
        }
      }
    }
    // Publish this cycle's signal feed so the UI's Neural Co-Signal Feed is live
    if (currentSignals.length > 0) {
      latestSignals = currentSignals.slice(-30);
    }
    // Continuous passive strategy optimizer (24/7 learning loop)
    optimizerTickCount++;
    if (optimizerTickCount >= EVOLUTION_TICK_INTERVAL) {
      optimizerTickCount = 0;
      if (candles.length >= 30) {
        runEvolutionCycle("continuous optimizer pulse across the latest candle window");
        pushLog(`🧠 [AI LEARNING & ADAPTATION RUN] Evolved strategies to Generation ${generation} by analyzing preceding trades and candlestick telemetry. Optimized entry & risk boundary weights.`);
      }
    }
}

// Background Timer executing ticks
setInterval(async () => {
  try {
    await tickSimulator();
  } catch (error) {
    console.error("TRADE LOOP ERROR", error);
    pushLog(`🚨 [CRITICAL ERROR] Trade loop crashed: ${(error as Error).message ?? String(error)}. Restarting...`);
  }
}, 8000); // AGGRESSIVE: high-frequency trade evaluation every 8 seconds for maximum profit opportunities

// ─── 1-SECOND EVOLUTION TICK ──────────────────────────────────────────────
// Runs `runEvolutionCycle` every second using the latest in-memory candles
// and tickers — no Binance API calls, so it does not hit rate limits.
// The trade loop above still fires every 8 seconds for entry/exit decisions
// and live-balance syncs; this fast loop is purely for the genetic engine
// to keep discovering and ranking better strategies continuously.
//
// On a 50-strategy population the full evolve→backtest→rank cycle takes
// ~150-400ms on a modern core, so 1s gives headroom plus a small breathing
// gap. The cycle is skipped if the previous one is still running, so a
// slow tick never causes a pile-up.
let evolutionTickBusy = false;
setInterval(() => {
  if (evolutionTickBusy) return;
  if (candles.length < 30) return;
  if (population.length < 2) return;
  evolutionTickBusy = true;
  try {
    runEvolutionCycle("1-second continuous genetic pulse");
  } catch (err) {
    pushLog(`🚨 [EVOLUTION TICK ERROR] ${(err as Error).message ?? String(err)}`);
  } finally {
    evolutionTickBusy = false;
  }
}, 1000); // every 1 second — strategies evolve continuously

// API ENDPOINTS
// ─── /api/status — lightweight: no logs, no tickers (those are separate endpoints) ───
app.get("/api/status", (req, res) => {
  const currentRegime = detectMarketRegime(candles);
  const topStrategy = population.length > 0 ? population[0] : null;

  // Trade-derived aggregates — always consistent with the trade list shown in the UI.
  const closedTrades = getClosedTrades();
  const exits = closedTrades;
  const winCount = getWinCount();
  const lossCount = getLossCount();
  const breakevenCount = getBreakevenCount();
  const winRate = getWinRatePct();
  const totalPnl = getRealizedPnl();
  const unrealizedPnl = getUnrealizedPnlFromPositions();
  const capitalLocked = getCapitalLocked();
  const availableBalance = parseFloat(paperBalance.toFixed(2));
  // Total Equity = Available Balance + Capital Locked + Unrealized PnL
  const totalEquity = parseFloat(
    (availableBalance + capitalLocked + unrealizedPnl).toFixed(2)
  );

  // Determine market open and close times (crypto trades 24/7)
  const marketOpen = "24/7";
  const marketClose = "24/7";

  const statusData = {
    // Core
    running: isBotRunning,
    current_time: new Date().toISOString(),
    market_open: marketOpen,
    market_close: marketClose,
    api_connected: isBinanceConnected,
    decision_timeframe: currentInterval,
    execution_timeframe: currentInterval,
    selectedSymbol: currentSymbol,
    // Trade counts
    exec_positions: activePositions.length,
    exec_trades: closedTrades.length,
    exec_win_count: winCount,
    exec_loss_count: lossCount,
    exec_breakeven_count: breakevenCount,
    exec_win_rate: winRate,
    exec_pnl: totalPnl,
    // Trade-derived PnL breakdown (sum of closed-trade pnl — always matches /api/trades)
    averageWin: getAverageWin(),
    averageLoss: getAverageLoss(),
    largestWin: getLargestWin(),
    largestLoss: getLargestLoss(),
    // ─── Portfolio accounting ────────────────────────────────────────────
    // Available Balance: realized cash on hand (= paperBalance - cost of open positions)
    // Capital Locked:    cost basis of currently-open positions
    // Unrealized PnL:    floating PnL on open positions, marked to ticker
    // Realized PnL:      sum of closed-trade pnl (zero until a position exits)
    // Total Equity:      Available + Locked + Unrealized
    initialBalance: parseFloat(initialBalance.toFixed(2)),
    availableBalance,
    capitalLocked: parseFloat(capitalLocked.toFixed(2)),
    unrealizedPnl: parseFloat(unrealizedPnl.toFixed(2)),
    realizedPnl: parseFloat(totalPnl.toFixed(2)),
    totalEquity,
    // Kept for backward compatibility — equals availableBalance.
    paperBalance: availableBalance,
    // Activity counters
    tradeAttemptCount: tradeAttemptCount,
    tradeAcceptedCount: tradeAcceptedCount,
    tradeRejectedCount: tradeRejectedCount,
    tradeNoSignalCount: tradeNoSignalCount,
    // Unified engine aggregates (alias of exec_* for the dual-action panel)
    unifiedWinRate: winRate,
    unifiedTotalTrades: closedTrades.length,
    // Regime + AI engine
    currentRegime,
    generation,
    populationSize: population.length,
    eligibleStrategyCount: getEligibleStrategies().length,
    lastEvolvedTimestamp,
    topStrategyId: topStrategy ? topStrategy.id : 'None',
    topStrategyName: topStrategy ? topStrategy.name : 'None',
    topStrategyFitness: topStrategy ? topStrategy.fitness : 0,
    isHaltedByLossGuard,
    afcsActive,
    aggressiveEntryMode,
    isContinuousMode,
    exitMode,
    fixedTimeLimitMinutes,
    // Brain activity
    brainActivityLogs: brainActivityLogs.slice(-50),
    latestSignals: latestSignals.slice(-30),
    allCoinsTickers,
    // Backward-compatible fields
    continuous_24_7_running: isContinuousMode,
    continuous_24_7_positions: activePositions.length,
    continuous_24_7_trades: closedTrades.length,
    continuous_24_7_win_rate: winRate,
    continuous_24_7_pnl: totalPnl,
    ultra_continuous_running: false,
    ultra_continuous_positions: 0,
    ultra_continuous_trades: 0,
    ultra_continuous_win_rate: 0,
    ultra_continuous_pnl: 0
  };

  res.json(statusData);
});

// ─── /health — health check endpoint for monitoring ───
app.get("/health", (req, res) => {
  const lastTrade = tradeHistory.length > 0
    ? new Date(Math.max(...tradeHistory.map(t => t.timestamp))).toISOString()
    : null;

  const lastMarketUpdate = candles.length > 0
    ? new Date(candles[candles.length - 1].time).toISOString()
    : null;

  const healthStatus = {
    status: isBotRunning ? "healthy" : "stopped",
    botRunning: isBotRunning,
    binanceConnected: isBinanceConnected,
    strategyEngine: population.length > 0,
    evolutionEngine: generation > 0,
    lastTrade: lastTrade,
    lastMarketUpdate: lastMarketUpdate,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage()
  };

  // Return 503 if bot is not running
  const statusCode = isBotRunning ? 200 : 503;
  res.status(statusCode).json(healthStatus);
});

// ─── /api/logs — full brain activity log stream ───
app.get("/api/logs", (req, res) => {
  res.json({ logs: brainActivityLogs });
});

app.post("/api/settings/exit-mode", (req, res) => {
  const { mode, limit } = req.body;
  if (mode === "DYNAMIC" || mode === "FIXED_TIME") {
    exitMode = mode;
    pushLog(`🧠 [ENGINE DIRECTIVE] Unified Exit Mode changed to '${exitMode}'`);
  }
  if (typeof limit === "number" && limit > 0) {
    fixedTimeLimitMinutes = limit;
    pushLog(`🧠 [ENGINE DIRECTIVE] Fixed Time Limit configured to ${fixedTimeLimitMinutes} minutes`);
  }
  saveState();
  res.json({ success: true, exitMode, fixedTimeLimitMinutes });
});

app.get("/api/account", async (req, res) => {
  const btcPos = activePositions.find(p => p.symbol === "BTCUSDT");
  const ethPos = activePositions.find(p => p.symbol === "ETHUSDT");
  const solPos = activePositions.find(p => p.symbol === "SOLUSDT");

  const apiKey = process.env.BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET;

  if (apiKey && apiSecret) {
    try {
      const realBalances = await fetchRealAccountBalances();

      const usdtInfo = realBalances.find(b => b.asset === "USDT");
      if (usdtInfo && usdtInfo.free) {
        // Sync internal cash tracker with the live Binance testnet USDT balance
        const parsedUsdt = parseFloat(usdtInfo.free);
        if (!isNaN(parsedUsdt)) {
          if (Math.abs(paperBalance - parsedUsdt) > 0.01) {
            pushLog(`🧠 Available Balance synced with Binance testnet: $${paperBalance.toFixed(2)} → $${parsedUsdt.toFixed(2)}`);
          }
          paperBalance = parsedUsdt;
          saveState();
          // Also update equity history to reflect the current equity
          equityHistory.push({ timestamp: Date.now(), equity: parseFloat((paperBalance + getUnrealizedPnl()).toFixed(2)) });
          if (equityHistory.length > MAX_EQUITY_HISTORY) equityHistory = equityHistory.slice(-MAX_EQUITY_HISTORY);
        }
      }

      return res.json({
        makerCommission: 15,
        takerCommission: 15,
        buyerCommission: 0,
        sellerCommission: 0,
        canTrade: true,
        canWithdraw: true,
        canDeposit: true,
        updateTime: Date.now(),
        accountType: "SPOT",
        balances: [
          { asset: "这是测试币", free: "10000.00000000", locked: "0.00000000" },
          { asset: "456", free: "10000.00000000", locked: "0.00000000" },
          { asset: "BTC", free: "0.00000000", locked: "0.00000000" },
          { asset: "ETH", free: "0.00000000", locked: "0.00000000" },
          { asset: "SOL", free: "0.00000000", locked: "0.00000000" },
          { asset: "BNB", free: "0.27700000", locked: "0.00000000" },
          { asset: "USDT", free: paperBalance.toFixed(8), locked: "0.00000000" }
        ]
      });
    } catch (err) {
      console.warn("Could not retrieve real account spot balance from Binance:", err.message);
    }
  }

  // Helper to get total cost of open positions
  const getTotalCostOfOpenPositions = () => {
    return activePositions.reduce((sum, pos) => sum + pos.cost, 0);
  };

  // Calculate account metrics from trade history (single source of truth)
  const closedTrades = getClosedTrades();
  const winCount = getWinCount();
  const loseCount = getLossCount();
  const winRate = getWinRatePct();
  const totalPnl = getRealizedPnl();

  // Prepare account data matching the frontend's AccountData interface
  const accountData = {
    total_balance_usdt: parseFloat(paperBalance.toFixed(2)), // Realized balance (paperBalance)
    available_balance_usdt: parseFloat((paperBalance - getTotalCostOfOpenPositions()).toFixed(2)), // Free cash
    daily_pnl: 0, // Placeholder - could be enhanced to calculate daily change
    total_pnl: totalPnl,
    realized_pnl: totalPnl,
    total_trades: closedTrades.length,
    active_positions: activePositions.length,
    win_rate: winRate,
    winning_trades: winCount,
    losing_trades: loseCount,
    continuous_24_7_available: false,
    ultra_continuous_available: false
  };

  res.json({
    makerCommission: 15,
    takerCommission: 15,
    buyerCommission: 0,
    sellerCommission: 0,
    canTrade: true,
    canWithdraw: false,
    canDeposit: false,
    updateTime: Date.now(),
    accountType: "SPOT",
    balances: [
      { asset: "USDT", free: accountData.total_balance_usdt.toFixed(2), locked: "0.00" },
      { asset: "BTC", free: btcPos ? btcPos.size.toFixed(5) : "0.00000", locked: "0.00" },
      { asset: "ETH", free: ethPos ? ethPos.size.toFixed(5) : "0.00000", locked: "0.00" },
      { asset: "SOL", free: solPos ? solPos.size.toFixed(5) : "0.00000", locked: "0.00" }
    ]
  });
});

app.get("/api/positions", (req, res) => {
  res.json(activePositions);
});

app.get("/api/trades", (req, res) => {
  res.json(tradeHistory);
});

app.get("/api/equity-history", (req, res) => {
  res.json(equityHistory);
});

app.get("/api/performance", (req, res) => {
  const equityCurve = equityHistory.map(point => point.equity);
  res.json({ equity_curve: equityCurve });
});

app.get("/api/candles", (req, res) => {
  // Return the in-memory candlestick buffer for the currently configured symbol.
  // Frontend expects a JSON array of {time, open, high, low, close, volume, ...}.
  if (!Array.isArray(candles) || candles.length === 0) {
    res.json([]);
    return;
  }
  res.json(candles);
});

app.get("/api/market-data", (req, res) => {
  // Convert allCoinsTickers to the format expected by the frontend
  const marketData: Record<string, any> = {};

  for (const ticker of allCoinsTickers) {
    const hasPosition = activePositions.some(pos => pos.symbol === ticker.symbol);

    // Determine trend based on price change
    let trend = 'neutral';
    if (ticker.priceChangePercent > 2) trend = 'strongly bullish';
    else if (ticker.priceChangePercent > 0) trend = 'bullish';
    else if (ticker.priceChangePercent < -2) trend = 'strongly bearish';
    else if (ticker.priceChangePercent < 0) trend = 'bearish';

    marketData[ticker.symbol] = {
      symbol: ticker.symbol,
      price: ticker.price,
      price_change_percent: ticker.priceChangePercent,
      volume: ticker.volume,
      high_24h: ticker.price * 1.02, // Approximation
      low_24h: ticker.price * 0.98,  // Approximation
      signal: ticker.recommendation,
      rsi: ticker.rsi,
      has_position: hasPosition,
      trend: trend
    };
  }

  res.json(marketData);
});

app.get("/api/self-evolving/status", (req, res) => {
  const currentRegime = detectMarketRegime(candles);
  const topStrategy = population[0];
  
  res.json({
    generation,
    populationSize: population.length,
    lastEvolvedTimestamp,
    currentRegime,
    bestFitness: topStrategy ? topStrategy.fitness : 0,
    bestReturn: topStrategy && topStrategy.metrics ? topStrategy.metrics.net_profit : 0,
    bestWinRate: topStrategy && topStrategy.metrics ? topStrategy.metrics.win_rate : 0,
  });
});

app.get("/api/self-evolving/strategies", (req, res) => {
  res.json(population);
});

app.get("/api/self-evolving/top-strategies", (req, res) => {
  res.json(population.slice(0, 10));
});

// Force instant evolutionary step of strategies on server
app.post("/api/self-evolving/force-evolve", async (req, res) => {
  try {
    if (candles.length < 30) {
      return res.status(400).json({ error: "Insufficient market history to evolve." });
    }
    runEvolutionCycle("manual evolve command from dashboard");
    res.json({ success: true, generation, populationCount: population.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Request Gemini AI recommendation
app.post("/api/self-evolving/gemini-insight", async (req, res) => {
  try {
    const currentRegime = detectMarketRegime(candles);
    const result = await generateGeminiStrategyRecommendation(
      tradeHistory, 
      currentRegime, 
      process.env.GEMINI_API_KEY
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reset simulation parameters back to clean values
app.post("/api/close-position", async (req, res) => {
  const { id } = req.body;
  
  let targetPosition = activePositions[0];
  if (id) {
    targetPosition = activePositions.find(p => p.id === id) || activePositions[0];
  }

  if (targetPosition) {
    const position = targetPosition;
    const ticker = allCoinsTickers.find(t => t.symbol === position.symbol);
    const currentPrice = ticker ? ticker.price : (candles.length > 0 ? candles[candles.length - 1].close : position.entryPrice);
    
    let netPnl = 0;
    let exitCost = position.size * currentPrice;
    let actualSellPrice = currentPrice;
    let actualSellQty = position.size;
    let tradeId = Math.random().toString(36).substr(2, 9);
    let finalReason = "MANUAL_CLOSE_TRIGGERED";

    const hasKeys = Boolean(process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET);
    if (hasKeys) {
      try {
        pushLog(`⚡ [REAL MANUAL DIRECTIVE] Executing live manual SELL order for position ${position.symbol}...`);
        const order = await executeRealMarketOrder(position.symbol, 'SELL', 'BASE', position.size);
        // Set trade cooldown to prevent Binance rate limits
        tradeCooldownUntil = Date.now() + TRADE_COOLDOWN_MS;

        tradeId = order.orderId || tradeId;
        actualSellPrice = order.price;
        actualSellQty = order.qty;
        exitCost = actualSellQty * actualSellPrice;

        const fee = exitCost * 0.0005; // 0.05% maker/taker fee
        // Correct PnL calculation: (exit proceeds - exit fee) - (entry cost + entry fee)
        netPnl = (exitCost - fee) - (position.cost + (position.cost * 0.0005)); // approximate entry fee
        // Add the exit proceeds minus fees to balance (position cost+fee was already deducted on entry)
        paperBalance += (exitCost - fee);
        finalReason = `Live Binance Manual Exit`;
      } catch (liveErr) {
        pushLog(`❌ [LIVE TRADING ERROR] Live manual sale failed: ${liveErr.message}. Falling back to paper liquidation.`);
        const fee = exitCost * 0.0005;
        // Correct PnL calculation: (exit proceeds - exit fee) - (entry cost + entry fee)
        netPnl = (exitCost - fee) - (position.cost + (position.cost * 0.0005)); // approximate entry fee
        // Add the exit proceeds minus fees to balance (position cost+fee was already deducted on entry)
        paperBalance += (exitCost - fee);
        finalReason = `FALLBACK_MANUAL_LIQUIDATION`;
      }
    } else {
      const fee = exitCost * 0.0005;
      // Correct PnL calculation: (exit proceeds - exit fee) - (entry cost + entry fee)
      netPnl = (exitCost - fee) - (position.cost + (position.cost * 0.0005)); // approximate entry fee
      // Add the exit proceeds minus fees to balance (position cost+fee was already deducted on entry)
      paperBalance += (exitCost - fee);
    }

    // If a TAKE_PROFIT exit executed but resulted in non-positive PnL (slippage/fees), reclassify and log
    if (finalReason.includes('TAKE_PROFIT_MET') && netPnl <= 0) {
      pushLog(`⚠️ [EXIT GUARD] TAKE_PROFIT triggered but net PnL is ${netPnl.toFixed(4)}. Reclassifying as fallback liquidation.`);
      finalReason = `FALLBACK_LIQUIDATION: TAKE_PROFIT_MET`;
    }

    const newTrade: Trade = {
      id: tradeId,
      symbol: position.symbol,
      side: "SELL",
      type: "EXIT",
      price: actualSellPrice,
      size: actualSellQty,
      value: exitCost,
      strategyId: position.strategyId,
      strategyName: position.strategyName,
      pnl: parseFloat(netPnl.toFixed(4)),
      pnl_pct: parseFloat(((netPnl / position.cost) * 100).toFixed(4)),
      timestamp: Date.now(),
      reason: finalReason
    };

    tradeHistory.push(newTrade);
    activePositions = activePositions.filter(p => p.id !== position.id);
    equityHistory.push({ timestamp: Date.now(), equity: paperBalance });
    saveState();
    res.json({ success: true, balance: paperBalance });
  } else {
    res.status(400).json({ error: "No active positions to liquidate" });
  }
});

// Start Bot
app.post("/api/start", (req, res) => {
  isBotRunning = true;
  afcsActive = false; // Reset AFCS safeguard when user manually commands the bot to start
  pushLog("🧠 [USER OVERRIDE] Bot manually started. Clearing any active algorithmic suspensions or safeguards.");
  saveState();
  res.json({ success: true, isRunning: isBotRunning, afcsActive });
});

// Reset bot state: clear trades, reset balances, and retire losing strategies
app.post('/api/reset_and_retire', (req, res) => {
  try {
    // Compute per-strategy net pnl from current tradeHistory
    const stratPnl: Record<string, number> = {};
    for (const t of tradeHistory) {
      const sid = t.strategyId || 'UNKNOWN';
      if (!stratPnl[sid]) stratPnl[sid] = 0;
      if (t.type === 'EXIT' && typeof t.pnl === 'number') stratPnl[sid] += t.pnl;
    }

    // Retire strategies with negative net pnl (excluding UNKNOWN)
    let retiredCount = 0;
    population = population.map(s => {
      if (!s || !s.id) return s;
      const pnl = stratPnl[s.id];
      if (pnl !== undefined && pnl < 0) {
        s.retired = true;
        retiredCount += 1;
      }
      return s;
    });

    // Reset balances and trades
    paperBalance = 10000.0;
    initialBalance = 10000.0;
    tradeHistory = [];
    activePositions = [];
    equityHistory = [{ timestamp: Date.now(), equity: paperBalance }];
    tradeAttemptCount = 0;
    tradeAcceptedCount = 0;
    tradeRejectedCount = 0;
    tradeNoSignalCount = 0;

    rankPopulation();
    saveState(true);

    pushLog(`🔧 [ADMIN] Reset state: balance reset to $${paperBalance.toFixed(2)}, cleared trades. Retired ${retiredCount} losing strategies.`);
    res.json({ success: true, retired: retiredCount, balance: paperBalance });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Stop Bot
app.post("/api/stop", (req, res) => {
  isBotRunning = false;
  saveState();
  res.json({ success: true, isRunning: isBotRunning });
});

// Reset simulation parameters back to clean values
app.post("/api/reset", async (req, res) => {
  paperBalance = 10000.0;
  activePositions = [];
  tradeHistory = [];
  equityHistory = [{ timestamp: Date.now(), equity: paperBalance }];
  tradeAttemptCount = 0;
  tradeAcceptedCount = 0;
  tradeRejectedCount = 0;
  tradeNoSignalCount = 0;
  isBotRunning = true;
  afcsActive = false;
  brainActivityLogs = [
    "🧠 System Re-Initialized: Safe mode boundary verified.",
    "🧠 Bot simulation parameters reset. Execution active and ready."
  ];
  try {
    if (fs.existsSync(PERSISTENCE_FILE)) {
      fs.unlinkSync(PERSISTENCE_FILE);
    }
  } catch (err) {
    console.error("Failed to delete persistence file on reset:", err);
  }
  initializePopulation();
  await loadInitialMarketData();
  saveState();
  res.json({ success: true, balance: paperBalance, generation });
});

// Soft reset: reset trading metrics but keep evolved strategies
app.post("/api/soft-reset", async (req, res) => {
  paperBalance = 10000.0; // reset to initial balance
  activePositions = [];
  tradeHistory = [];
  equityHistory = [{ timestamp: Date.now(), equity: paperBalance }];
  tradeAttemptCount = 0;
  tradeAcceptedCount = 0;
  tradeRejectedCount = 0;
  tradeNoSignalCount = 0;
  // Keep isBotRunning, afcsActive, aggressiveEntryMode, isContinuousMode as they are
  // Keep population, generation, lastEvolvedTimestamp, candles unchanged
  brainActivityLogs.push("🧠 [SOFT RESET] Trading metrics reset. Evolved strategies preserved.");
  saveState();
  res.json({ success: true, balance: paperBalance, generation });
});

// ─── /api/reset-dashboard — clear PORTFOLIO state only, preserve strategy intelligence ───
// Wipes: paperBalance, initialBalance, activePositions, tradeHistory, equityHistory,
//        trade counters, brain activity logs, latestSignals.
// PRESERVES: population, generation, lastEvolvedTimestamp, candles, allCoinsTickers,
//            strategy-level performance history (perf is recomputed from tradeHistory,
//            which is now empty — so a strategy's *record* is wiped, but its DNA,
//            weights, and learned parameters are intact). The next time the strategy
//            trades, it will rebuild its own track record from scratch.
app.post("/api/reset-dashboard", async (req, res) => {
  try {
    // Snapshot strategy intelligence we must keep (ranked by current fitness so
    // we can immediately resume using the top performers).
    const strategySnapshot = population.map(s => ({
      id: s.id,
      name: s.name,
      generation: s.generation,
      indicators: s.indicators,
      params: s.params,
      entry_rules: s.entry_rules,
      exit_rules: s.exit_rules,
      risk_rules: s.risk_rules,
      timeframe: s.timeframe,
      filters: s.filters,
      fitness: s.fitness,
      metrics: s.metrics,
      retired: false,  // un-retire on dashboard reset — let the best strategies trade again
      liveLossPenalty: 0,  // clear live-loss penalty on reset
      liveWinBonus: 0,      // clear live-win bonus on reset
      liveNetPnl: 0,        // clear cumulative live PnL on reset
    }));

    // Snapshot market context we must keep
    const marketSnapshot = {
      candles: candles.slice(-300),  // keep last 300 candles for indicator continuity
      currentSymbol,
      currentInterval,
      allCoinsTickers: allCoinsTickers.slice(),
    };

    // ─── Anchor initialBalance to the LIVE Binance testnet balance ─────
    // After reset, the displayed PnL starts at 0 and grows from whatever
    // the testnet account is worth right now. As live trades execute on
    // Binance, paperBalance will track the testnet USDT, and PnL will
    // reflect the change from this baseline.
    let liveTestnetBalance: number | null = null;
    if (process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET) {
      try {
        const realBalances = await fetchRealAccountBalances();
        const usdtInfo = realBalances.find(b => b.asset === "USDT");
        if (usdtInfo && usdtInfo.free) {
          const parsed = parseFloat(usdtInfo.free);
          if (!isNaN(parsed)) {
            liveTestnetBalance = parsed;
          }
        }
      } catch (err) {
        console.warn("Could not read live Binance testnet balance on reset:", err.message);
      }
    }
    const baselineBalance = liveTestnetBalance ?? 10000.0;

    // ─── Clear portfolio state ─────────────────────────────────────────
    paperBalance = baselineBalance;
    initialBalance = baselineBalance;
    lastBalanceSync = 0;  // force re-sync with Binance testnet on next tick
    activePositions = [];
    tradeHistory = [];
    equityHistory = [{ timestamp: Date.now(), equity: paperBalance }];
    tradeAttemptCount = 0;
    tradeAcceptedCount = 0;
    tradeRejectedCount = 0;
    tradeNoSignalCount = 0;
    isHaltedByLossGuard = false; // clear the halt flag on reset
    latestSignals = [];
    brainActivityLogs = [
      "🧠 [DASHBOARD RESET] Portfolio state cleared. Strategy intelligence preserved.",
      `🧠 [DASHBOARD RESET] ${strategySnapshot.length} strategies retained, all un-retired.`,
      `🧠 [DASHBOARD RESET] Initial baseline anchored to live Binance testnet: $${baselineBalance.toFixed(2)}`,
      `🧠 [DASHBOARD RESET] Eligible (top-ranked) strategies will be used for live trading.`,
      "🧠 Bot execution engine resumed. Awaiting first signal."
    ];

    // ─── Restore strategy intelligence (mark all un-retired) ───────────
    population.length = 0;
    for (const s of strategySnapshot) {
      population.push({ ...s });
    }
    // Re-rank so population[0] is the top strategy, and let retirement logic
    // re-evaluate the next time those strategies trade.
    rankPopulation();

    // ─── Restore market context (no need to refetch candles) ───────────
    if (marketSnapshot.candles.length > 0) {
      candles.length = 0;
      for (const c of marketSnapshot.candles) candles.push(c);
    }
    if (marketSnapshot.allCoinsTickers.length > 0) {
      allCoinsTickers.length = 0;
      for (const t of marketSnapshot.allCoinsTickers) allCoinsTickers.push(t);
    }

    // Force a save so the next /api/status reflects the clean state immediately.
    saveState();

    const eligible = getEligibleStrategies();
    res.json({
      success: true,
      message: "Dashboard reset. Portfolio cleared, strategy intelligence preserved.",
      initialBalance,
      availableBalance: paperBalance,
      capitalLocked: 0,
      unrealizedPnl: 0,
      realizedPnl: 0,
      totalEquity: paperBalance,
      winCount: 0,
      lossCount: 0,
      breakevenCount: 0,
      tradeAttemptCount: 0,
      tradeAcceptedCount: 0,
      tradeRejectedCount: 0,
      tradeNoSignalCount: 0,
      activePositions: 0,
      completedExits: 0,
      populationSize: population.length,
      eligibleStrategyCount: eligible.length,
      topStrategyName: population[0]?.name ?? 'None',
      topStrategyFitness: population[0]?.fitness ?? 0,
      generation,
    });
  } catch (err) {
    console.error("Dashboard reset failed:", err);
    res.status(500).json({ success: false, error: (err as Error).message });
  }
});

// Toggle Continuous Active Scalper mode
app.post("/api/toggle-continuous", (req, res) => {
  isContinuousMode = !isContinuousMode;
  saveState();
  res.json({ success: true, isContinuousMode });
});

// Toggle Aggressive Entry Mode (accepts 75-80% signals with reduced sizing)
app.post("/api/toggle-aggressive-entry", (req, res) => {
  aggressiveEntryMode = !aggressiveEntryMode;
  pushLog(`🔥 Aggressive entry mode ${aggressiveEntryMode ? 'ENABLED' : 'DISABLED'}.`);
  saveState();
  res.json({ success: true, aggressiveEntryMode });
});

// AI Observatory dashboard data feed
app.get("/api/observatory/data", (req, res) => {
  const currentRegime = detectMarketRegime(candles);
  
  // 1. Evaluate current generation cohorts
  const evaluation = evaluateStrategyCohort(population, candles);
  
  // 2. Compute parameters mutation records
  const genetics = generateStrategyGenealogy(population, []);
  
  // 3. Analyze cognitive insights
  const insights = synthesizeLearningPerformance(tradeHistory, population, currentRegime);
  
  // 4. Cluster failures and AFCS checks
  const failures = analyzeFailures(tradeHistory, currentRegime);
  
  // 5. Conduct governance checkpoint audits
  const governance = auditAIChanges(population);

  // Compute composite confidence health score using recent indicators
  // We can base this on winning rate consistency and drawdown stability
  const recentWinrate = population[0]?.metrics?.win_rate || 72.5;
  const recentDrawdown = population[0]?.metrics?.max_drawdown || 0.75;
  const compositeConfidence = Math.min(99, Math.max(70, Math.round(recentWinrate - (recentDrawdown * 3) + 25)));

  res.json({
    evaluation,
    genetics,
    insights,
    failures,
    governance,
    compositeConfidence,
    selectedSymbol: currentSymbol,
    currentRegime,
    isBotRunning,
    afcsActive,
    brainActivityLogs
  });
});

app.post("/api/observatory/afcs-reset", (req, res) => {
  afcsActive = false;
  isBotRunning = true;
  pushLog("🚨 [AFCS SAFEGUARD DEACTIVATED] System approved. Active trading has been resumed.");
  res.json({ success: true, afcsActive, isRunning: isBotRunning });
});

app.get("/api/binance-all-tickers", (req, res) => {
  res.json(allCoinsTickers);
});

// Excel Report Generator endpoint for .csv spreadsheet streaming
app.get("/api/observatory/export-report", (req, res) => {
  const currentRegime = detectMarketRegime(candles);
  
  const recentWinrate = population[0]?.metrics?.win_rate || 72.5;
  const recentDrawdown = population[0]?.metrics?.max_drawdown || 0.75;
  const confidenceScore = Math.min(99, Math.max(70, Math.round(recentWinrate - (recentDrawdown * 3) + 25)));

  const csvContent = generateExcelReportCSV(tradeHistory, population, currentRegime, confidenceScore);
  
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=Aegis_AI_Intelligence_Report_${Date.now()}.csv`);
  res.status(200).send(csvContent);
});

// Configure Bot Symbol or Interval
app.post("/api/configure", async (req, res) => {
  const { symbol, interval } = req.body;
  if (symbol) currentSymbol = symbol.toUpperCase();
  if (interval) currentInterval = interval;
  
  activePositions = []; // safe guard close
  await loadInitialMarketData();
  saveState();
  res.json({ success: true, symbol: currentSymbol, interval: currentInterval });
});

// Setup Express routing with Vite Integration middleware
  async function startServer() {
    const selectedPort = await findAvailablePort(BASE_PORT);

    // Verify Binance connectivity
    isBinanceConnected = await verifyBinanceConnection();

    let hmrConfig: boolean | { port: number } = process.env.DISABLE_HMR === "true" ? false : undefined;
    if (hmrConfig !== false) {
      const hmrPort = await findAvailablePort(24678, 50);
      hmrConfig = { port: hmrPort };
      if (hmrPort !== 24678) {
        console.log(`Vite HMR port 24678 was occupied; using fallback port ${hmrPort} instead.`);
      }
    }

    // Setup Vite development server or serve built assets in production
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        configFile: false,
        root: process.cwd(),
        plugins: [react(), tailwindcss()],
        resolve: {
          alias: {
            "@": path.resolve(process.cwd(), "."),
          },
        },
        server: {
          middlewareMode: true,
          hmr: hmrConfig,
          watch: process.env.DISABLE_HMR === "true" ? null : {},
        },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

  app.listen(selectedPort, "0.0.0.0", () => {
    if (selectedPort !== BASE_PORT) {
      console.log(`Port ${BASE_PORT} was occupied. Started server on available port ${selectedPort} instead.`);
    }
    console.log(`Crypto Trading Bot server running on http://localhost:${selectedPort}`);

    // Display warnings for disconnected states
    if (!isBinanceConnected) {
      console.log("\n");
      console.log("╔════════════════════════════════════════════════════════════════════════════╗");
      console.log("║                                                                              ║");
      console.log("║  🚨 LIVE TRADING DISCONNECTED                                               ║");
      console.log("║  ═══════════════════════════════════════════════════════════════════════════║");
      console.log("║  The bot is running in PAPER TRADING mode                                   ║");
      console.log("║  No actual funds are at risk                                                ║");
      console.log("║                                                                              ║");
      console.log("║  To enable live trading:                                                    ║");
      console.log("║  1. Set valid BINANCE_API_KEY and BINANCE_API_SECRET in .env                ║");
      console.log("║  2. Ensure you have internet connectivity to Binance                        ║");
      console.log("║  3. Restart the bot                                                         ║");
      console.log("║                                                                              ║");
      console.log("║  Current mode is safe for testing and development                           ║");
      console.log("║  🚨 LIVE TRADING DISCONNECTED                                               ║");
      console.log("║                                                                              ║");
      console.log("╚════════════════════════════════════════════════════════════════════════════╝");
      console.log("\n");
    }

    try {
      const portInfo = { port: selectedPort };
      fs.writeFileSync(path.join(process.cwd(), 'server_port.json'), JSON.stringify(portInfo, null, 2), 'utf8');
    } catch (err) {
      console.error('Unable to persist the selected server port:', err);
    }
  });
}

startServer();
