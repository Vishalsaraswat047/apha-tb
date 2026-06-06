import { StrategyDna, Candle, IndicatorParams, EntryRules, ExitRules, RiskRules, StrategyFilters } from '../types';
import { populateIndicators } from './indicators';

// Seed names to make evolved strategies sound cool and descriptive!
const namePrefixes = ['Aegis', 'Titan', 'Zephyr', 'Orion', 'Apex', 'Vector', 'Nexus', 'Helios', 'Chronos', 'Genesis'];
const nameSuffixes = ['Quantum', 'Alpha', 'Trend', 'Oscillator', 'Momentum', 'Grid', 'Breakout', 'Reversal', 'Pulse', 'Scalper'];

export function generateStrategyName(): string {
  const p = namePrefixes[Math.floor(Math.random() * namePrefixes.length)];
  const s = nameSuffixes[Math.floor(Math.random() * nameSuffixes.length)];
  const num = Math.floor(Math.random() * 900) + 100;
  return `${p} ${s} #${num}`;
}

export function createRandomStrategy(generation: number = 0): StrategyDna {
  const rsi_period = Math.floor(Math.random() * 12) + 6; // 6-18
  const ema_fast = Math.floor(Math.random() * 15) + 5;   // 5-20
  const ema_slow = ema_fast + Math.floor(Math.random() * 30) + 10; // fast + (10-40)
  const atr_period = Math.floor(Math.random() * 10) + 10; // 10-20
  const bb_period = Math.floor(Math.random() * 15) + 10;  // 10-25
  const bb_std = parseFloat((Math.random() * 1.0 + 1.5).toFixed(1)); // 1.5 - 2.5
  const adx_period = Math.floor(Math.random() * 10) + 10; // 10-20

  const params: IndicatorParams = {
    rsi_period,
    ema_fast,
    ema_slow,
    atr_period,
    bb_period,
    bb_std,
    adx_period
  };

  const entry_rules: EntryRules = {
    rsi_oversold: Math.floor(Math.random() * 8) + 20, // 20-27
    price_above_ema: Math.random() > 0.35,
    use_bb_bounce: Math.random() > 0.35,
    use_volume_filter: Math.random() > 0.55
  };

  const exit_rules: ExitRules = {
    rsi_overbought: Math.floor(Math.random() * 15) + 68, // 68-82
    trailing_stop: parseFloat((Math.random() * 0.008 + 0.003).toFixed(4)), // 0.3% - 1.1%
    use_bb_exit: Math.random() > 0.45
  };

  const risk_rules: RiskRules = {
    position_size_pct: 1.0, // 1% constant as per features
    stop_loss_pct: parseFloat((Math.random() * 1.0 + 0.5).toFixed(2)),    // 0.5% - 1.5% SL
    take_profit_pct: parseFloat((Math.random() * 8.0 + 5.0).toFixed(2)),  // 5.0% - 13.0% TP
  };

  const filters: StrategyFilters = {
    volume_spike_multiplier: parseFloat((Math.random() * 1.2 + 1.8).toFixed(2)), // 1.8x - 3.0x
    momentum_pct_threshold: parseFloat((Math.random() * 0.01 + 0.008).toFixed(4)), // 0.8% - 1.8%
  };

  const indicators = ['RSI', 'EMA'];
  if (entry_rules.use_bb_bounce || exit_rules.use_bb_exit) indicators.push('Bollinger Bands');
  if (entry_rules.use_volume_filter) indicators.push('Volume');
  if (Math.random() > 0.5) indicators.push('ADX');

  return {
    id: Math.random().toString(36).substr(2, 9),
    name: generateStrategyName(),
    generation,
    indicators,
    params,
    entry_rules,
    exit_rules,
    risk_rules,
    timeframe: Math.random() > 0.5 ? '5m' : '1m',
    filters,
    metrics: {
      profit_factor: 1.0,
      win_rate: 0.0,
      max_drawdown: 0.0,
      total_trades: 0,
      net_profit: 0
    },
    fitness: 0
  };
}

/**
 * High performance backtester simulating fees and slippage (0.05% fee)
 */
export function backtestStrategy(strategy: StrategyDna, inputCandles: Candle[]): StrategyDna {
  if (inputCandles.length < Math.max(strategy.params.ema_slow, strategy.params.rsi_period) + 10) {
    return strategy;
  }

  // Populate indicator values for this strategy configuration
  const candles = populateIndicators(inputCandles, strategy.params);
  
  let balance = 10000;
  const initialBalance = balance;
  let activePosition: { entryPrice: number; entryIndex: number; size: number; side: 'BUY' } | null = null;
  let highestPrice = 0;
  let trailingStopLevel = 0;
  
  let totalTrades = 0;
  let winningTrades = 0;
  let grossProfit = 0;
  let grossLoss = 0;
  let peakBalance = balance;
  let maxDrawdown = 0;
  
  const takerFeePct = 0.0005; // 0.05% Commission fee

  // Main backtest loop
  for (let i = 40; i < candles.length; i++) {
    const candle = candles[i];
    const prevCandle = candles[i - 1];
    
    if (!candle.rsi || !candle.ema_fast || !candle.ema_slow) continue;

    // 1. Check exit if position is open
    if (activePosition) {
      const entryPrice = activePosition.entryPrice;
      const currentPrice = candle.close;
      const profitPct = (currentPrice - entryPrice) / entryPrice;

      let exitReason = '';
      
      highestPrice = Math.max(highestPrice, currentPrice);
      trailingStopLevel = Math.max(trailingStopLevel, highestPrice * (1 - strategy.exit_rules.trailing_stop));

      // Stop Loss Check
      if (profitPct <= -strategy.risk_rules.stop_loss_pct / 100) {
        exitReason = 'STOP_LOSS';
      }
      // Trailing Stop Check
      else if (strategy.exit_rules.trailing_stop > 0 && currentPrice <= trailingStopLevel) {
        exitReason = 'TRAILING_STOP';
      }
      // Take Profit Check
      else if (profitPct >= strategy.risk_rules.take_profit_pct / 100) {
        exitReason = 'TAKE_PROFIT';
      }
      // RSI Overbought exit when profit already exists
      else if (candle.rsi >= strategy.exit_rules.rsi_overbought && profitPct > 0) {
        exitReason = 'RSI_OVERBOUGHT';
      }
      // BB upper band exit
      else if (strategy.exit_rules.use_bb_exit && candle.bb_upper && candle.close >= candle.bb_upper) {
        exitReason = 'BB_UPPER_EXIT';
      }
      
      if (exitReason) {
        // Execute Sell Order with Slippage & Fee
        const exitPrice = currentPrice * (1 - 0.0002); // 0.02% slippage on exit
        const exitCost = activePosition.size * exitPrice;
        const fee = exitCost * takerFeePct;
        
        const finalExitValue = exitCost - fee;
        const initialCost = activePosition.size * entryPrice;
        const entryFee = initialCost * takerFeePct;
        const netCost = initialCost + entryFee;
        const tradePnl = finalExitValue - netCost;
        
        balance += tradePnl;
        
        totalTrades++;
        if (tradePnl > 0) {
          winningTrades++;
          grossProfit += tradePnl;
        } else {
          grossLoss += Math.abs(tradePnl);
        }

        if (balance > peakBalance) {
          peakBalance = balance;
        } else {
          const dd = ((peakBalance - balance) / peakBalance) * 100;
          if (dd > maxDrawdown) maxDrawdown = dd;
        }

        activePosition = null;
      }
    } 
    // 2. Check entry rules
    else {
      let isEntry = false;
      let reasons: string[] = [];
      let signalCount = 0;

      const priceChange = Math.abs((candle.close - prevCandle.close) / prevCandle.close);
      const isRsiOversold = candle.rsi <= strategy.entry_rules.rsi_oversold;
      const isBullishEma = strategy.entry_rules.price_above_ema && candle.close > candle.ema_fast && candle.ema_fast > candle.ema_slow;
      const isBbBounce = strategy.entry_rules.use_bb_bounce && candle.bb_lower && (candle.low <= candle.bb_lower || prevCandle.close <= prevCandle.bb_lower) && candle.close > candle.bb_lower;
      const volumeAvg = candles.slice(i - 10, i).reduce((sum, c) => sum + c.volume, 0) / 10 || 1;
      const isVolumeSpike = strategy.entry_rules.use_volume_filter && candle.volume >= volumeAvg * strategy.filters.volume_spike_multiplier;
      const isMomentum = priceChange >= strategy.filters.momentum_pct_threshold;

      if (isRsiOversold) {
        signalCount++;
        reasons.push('RSI_OVERSOLD');
      }
      if (isBullishEma) {
        signalCount++;
        reasons.push('EMA_BULLISH');
      }
      if (isBbBounce) {
        signalCount++;
        reasons.push('BB_LOWER_BOUNCE');
      }
      if (isVolumeSpike) {
        signalCount++;
        reasons.push('VOLUME_SPIKE');
      }
      if (isMomentum) {
        signalCount++;
        reasons.push('MOMENTUM');
      }

      if (signalCount >= 2) {
        isEntry = true;
      }

      if (isEntry) {
        // Position Size: 1% of equity
        const tradeRiskCapital = balance * (strategy.risk_rules.position_size_pct / 100);
        // Execute entry order with fees/slippage
        const entryPrice = candle.close * (1 + 0.0002); // 0.02% slippage on entry
        const entryCost = tradeRiskCapital;
        const entryFee = entryCost * takerFeePct;
        const totalCost = entryCost + entryFee;
        
        if (balance >= totalCost) {
          const size = entryCost / entryPrice;
          
          activePosition = {
            entryPrice,
            entryIndex: i,
            size,
            side: 'BUY'
          };
          highestPrice = entryPrice;
          trailingStopLevel = entryPrice * (1 - strategy.exit_rules.trailing_stop);
          
          balance -= entryFee; // deduct broker entry fee
        }
      }
    }
  }

  // Force close any remaining open position at end of backtest
  if (activePosition) {
    const entryPrice = activePosition.entryPrice;
    const currentPrice = candles[candles.length - 1].close;
    const exitCost = activePosition.size * currentPrice;
    const fee = exitCost * takerFeePct;
    const finalExitValue = exitCost - fee;
    
    const initialCost = activePosition.size * entryPrice;
    const entryFee = initialCost * takerFeePct;
    const netCost = initialCost + entryFee;
    const tradePnl = finalExitValue - netCost;
    
    balance += tradePnl;
    totalTrades++;
    if (tradePnl > 0) {
      winningTrades++;
      grossProfit += tradePnl;
    } else {
      grossLoss += Math.abs(tradePnl);
    }
  }

  const net_profit = balance - initialBalance;
  const win_rate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const profit_factor = grossLoss === 0 ? (grossProfit > 0 ? 99 : 1.0) : parseFloat((grossProfit / grossLoss).toFixed(2));

  // Multi-Factor Fitness Formula: Profit * WinRate-bonus / MaxDrawdown
  // Standardised fitness score that favours high Return/Drawdown ratio combined with high winrate
  const profitScore = net_profit > 0 ? net_profit / initialBalance : 0;
  const drawdownPenalty = maxDrawdown === 0 ? 0.1 : maxDrawdown / 100;
  const baseFitness = profitScore / drawdownPenalty;
  const tradeQualityGate = totalTrades >= 5 ? 1 : 0.15;
  const winRateMultiplier = 1 + Math.pow(win_rate / 100, 2); // reward consistency at high win rate
  const profitFactorMultiplier = Math.min(3.0, Math.max(0.6, profit_factor / 1.2));
  const drawdownMultiplier = maxDrawdown <= 1.5 ? 1.3 : maxDrawdown <= 3 ? 1.0 : 0.65;
  const fitness = baseFitness * winRateMultiplier * profitFactorMultiplier * drawdownMultiplier * tradeQualityGate;

  return {
    ...strategy,
    metrics: {
      profit_factor,
      win_rate: parseFloat(win_rate.toFixed(1)),
      max_drawdown: parseFloat(maxDrawdown.toFixed(2)),
      total_trades: totalTrades,
      net_profit: parseFloat(net_profit.toFixed(2))
    },
    fitness: parseFloat((isNaN(fitness) ? 0 : fitness).toFixed(4))
  };
}

/**
 * Crossovers two parents and returns a new strategy DNA.
 *
 * Winner-biased: the FIRST parent should be the higher-fitness one
 * (the caller is responsible for ordering). We then:
 *   - Copy risk_rules verbatim from the winner (proven risk management)
 *   - Copy exit_rules verbatim from the winner (proven exit timing)
 *   - Only MIX entry_rules and indicator params (these are the search space)
 *   - Inherit filters from the winner 70% of the time
 *
 * This preserves winning DNA while still exploring new entry conditions.
 */
export function crossover(parentA: StrategyDna, parentB: StrategyDna, generation: number): StrategyDna {
  const mix = (valA: number, valB: number) => (Math.random() > 0.5 ? valA : valB);
  const mixBool = (valA: boolean, valB: boolean) => (Math.random() > 0.5 ? valA : valB);

  // Indicator parameters — the search space
  const params: IndicatorParams = {
    rsi_period: mix(parentA.params.rsi_period, parentB.params.rsi_period),
    ema_fast: mix(parentA.params.ema_fast, parentB.params.ema_fast),
    ema_slow: mix(parentA.params.ema_slow, parentB.params.ema_slow),
    atr_period: mix(parentA.params.atr_period, parentB.params.atr_period),
    bb_period: mix(parentA.params.bb_period, parentB.params.bb_period),
    bb_std: mix(parentA.params.bb_std, parentB.params.bb_std),
    adx_period: mix(parentA.params.adx_period, parentB.params.adx_period),
  };

  // Adjust fast/slow constraints post mix
  if (params.ema_fast >= params.ema_slow) {
    params.ema_slow = params.ema_fast + 15;
  }

  // Entry rules — mixed (the search space for new entries)
  const entry_rules: EntryRules = {
    rsi_oversold: mix(parentA.entry_rules.rsi_oversold, parentB.entry_rules.rsi_oversold),
    price_above_ema: mixBool(parentA.entry_rules.price_above_ema, parentB.entry_rules.price_above_ema),
    use_bb_bounce: mixBool(parentA.entry_rules.use_bb_bounce, parentB.entry_rules.use_bb_bounce),
    use_volume_filter: mixBool(parentA.entry_rules.use_volume_filter, parentB.entry_rules.use_volume_filter)
  };

  // Exit rules — COPIED FROM WINNER (parentA) — don't risk breaking
  // a proven exit with a random mix.
  const exit_rules: ExitRules = {
    rsi_overbought: parentA.exit_rules.rsi_overbought,
    trailing_stop: parentA.exit_rules.trailing_stop,
    use_bb_exit: parentA.exit_rules.use_bb_exit
  };

  // Filters — 70% from winner, 30% mixed (small exploration)
  const filters: StrategyFilters = Math.random() < 0.7
    ? { ...parentA.filters }
    : {
        volume_spike_multiplier: mix(parentA.filters.volume_spike_multiplier, parentB.filters.volume_spike_multiplier),
        momentum_pct_threshold: mix(parentA.filters.momentum_pct_threshold, parentB.filters.momentum_pct_threshold)
      };

  const indicators = Array.from(new Set([...parentA.indicators, ...parentB.indicators])).slice(0, 4);

  return {
    id: Math.random().toString(36).substr(2, 9),
    name: generateStrategyName(),
    generation,
    indicators,
    params,
    entry_rules,
    exit_rules,
    // Risk rules — COPIED FROM WINNER (parentA) — proven risk management
    risk_rules: { ...parentA.risk_rules },
    timeframe: Math.random() > 0.5 ? parentA.timeframe : parentB.timeframe,
    filters,
    fitness: 0,
    metrics: {
      profit_factor: 1.0,
      win_rate: 0,
      max_drawdown: 0,
      total_trades: 0,
      net_profit: 0
    }
  };
}

/**
 * Mutates a strategy's DNA based on a mutation rate
 */
export function mutate(strategy: StrategyDna, mutationRate: number = 0.2): StrategyDna {
  const mutateVal = (val: number, range: number) => {
    if (Math.random() > mutationRate) return val;
    const change = (Math.random() * 2 - 1) * range;
    return Math.max(2, Math.round(val + change));
  };

  const mutateFloat = (val: number, range: number, min: number = 0.001) => {
    if (Math.random() > mutationRate) return val;
    const change = (Math.random() * 2 - 1) * range;
    return parseFloat(Math.max(min, val + change).toFixed(4));
  };

  const mutateBool = (val: boolean) => {
    return Math.random() < mutationRate ? !val : val;
  };

  const mutatedParams: IndicatorParams = {
    rsi_period: Math.min(30, Math.max(4, mutateVal(strategy.params.rsi_period, 4))),
    ema_fast: Math.min(30, Math.max(3, mutateVal(strategy.params.ema_fast, 3))),
    ema_slow: Math.min(100, Math.max(15, mutateVal(strategy.params.ema_slow, 8))),
    atr_period: Math.min(30, Math.max(5, mutateVal(strategy.params.atr_period, 4))),
    bb_period: Math.min(40, Math.max(5, mutateVal(strategy.params.bb_period, 4))),
    bb_std: Math.min(3.5, Math.max(1.0, mutateFloat(strategy.params.bb_std, 0.3, 1.0))),
    adx_period: Math.min(30, Math.max(5, mutateVal(strategy.params.adx_period, 4))),
  };

  if (mutatedParams.ema_fast >= mutatedParams.ema_slow) {
    mutatedParams.ema_slow = mutatedParams.ema_fast + 15;
  }

  const mutatedEntry: EntryRules = {
    rsi_oversold: Math.min(45, Math.max(10, mutateVal(strategy.entry_rules.rsi_oversold, 5))),
    price_above_ema: mutateBool(strategy.entry_rules.price_above_ema),
    use_bb_bounce: mutateBool(strategy.entry_rules.use_bb_bounce),
    use_volume_filter: mutateBool(strategy.entry_rules.use_volume_filter)
  };

  const mutatedExit: ExitRules = {
    rsi_overbought: Math.min(90, Math.max(55, mutateVal(strategy.exit_rules.rsi_overbought, 5))),
    trailing_stop: mutateFloat(strategy.exit_rules.trailing_stop, 0.002, 0.001),
    use_bb_exit: mutateBool(strategy.exit_rules.use_bb_exit)
  };

  const mutatedFilters: StrategyFilters = {
    volume_spike_multiplier: mutateFloat(strategy.filters.volume_spike_multiplier, 0.3, 1.1),
    momentum_pct_threshold: mutateFloat(strategy.filters.momentum_pct_threshold, 0.005, 0.001)
  };

  // Rebuild indicators array
  const indicators = ['RSI', 'EMA'];
  if (mutatedEntry.use_bb_bounce || mutatedExit.use_bb_exit) indicators.push('Bollinger Bands');
  if (mutatedEntry.use_volume_filter) indicators.push('Volume');
  if (Math.random() > 0.5) indicators.push('ADX');

  const mutatedRisk: RiskRules = {
    position_size_pct: strategy.risk_rules.position_size_pct || 1.0,
    stop_loss_pct: Math.min(1.5, Math.max(0.4, mutateFloat(strategy.risk_rules.stop_loss_pct || 0.8, 0.2, 0.4))),
    take_profit_pct: Math.min(20.0, Math.max(5.0, mutateFloat(strategy.risk_rules.take_profit_pct || 10.0, 4.0, 5.0)))
  };

  return {
    ...strategy,
    indicators,
    params: mutatedParams,
    entry_rules: mutatedEntry,
    exit_rules: mutatedExit,
    risk_rules: mutatedRisk,
    filters: mutatedFilters,
  };
}

/**
 * Directs the population evolution step — strongly biased toward winners.
 *
 *   1. Backtest everyone on the latest candle window
 *   2. Apply a LIVE-LOSS PENALTY: any strategy that recently lost trades
 *      (recorded via `liveLossPenalty`) is demoted in the ranking
 *   3. Keep top 20 (was 12) as elite survivors — stronger elitism
 *   4. Fill the remaining 27 slots via crossover of winners (tournament
 *      selection with strong pressure on win_rate + profit_factor)
 *   5. Add 3 fresh random immigrants (was 5) for exploration
 *
 * The crossover function (`crossover` below) is also winner-biased: it
 * preserves the higher-fitness parent's risk_rules and exit_rules verbatim
 * and only mixes the entry signal parameters. This keeps proven risk
 * management intact while exploring new entry conditions.
 */
export function evolvePopulation(population: StrategyDna[], candles: Candle[], currentGen: number): StrategyDna[] {
  // 1. Backtest everyone to refresh fitness on the latest candle window
  const backtestedPop = population.map(strat => backtestStrategy(strat, candles));

  // 2. Apply LIVE-LOSS PENALTY: if a strategy has a recorded loss count from
  //    the live trading loop, multiply its fitness down so losing strategies
  //    are demoted in the next generation. Winners are unaffected.
  for (const strat of backtestedPop) {
    const liveLosses = (strat as any).liveLossPenalty as number | undefined;
    if (typeof liveLosses === 'number' && liveLosses > 0) {
      // Each live loss reduces fitness by 25%, capped at 95% reduction
      const penalty = Math.min(0.95, liveLosses * 0.25);
      strat.fitness = parseFloat(((strat.fitness || 0) * (1 - penalty)).toFixed(4));
    }
    // Winning strategies get a small live-win bonus (capped at +50%)
    const liveWins = (strat as any).liveWinBonus as number | undefined;
    if (typeof liveWins === 'number' && liveWins > 0) {
      const bonus = Math.min(0.5, liveWins * 0.10);
      strat.fitness = parseFloat(((strat.fitness || 0) * (1 + bonus)).toFixed(4));
    }
  }

  // 3. Sort by fitness descending
  backtestedPop.sort((a, b) => (b.fitness || 0) - (a.fitness || 0));

  // 4. Keep top 20 as survivors/elite parents (was 12 — stronger elitism)
  const survivors = backtestedPop.slice(0, 20);

  // 5. Tournament selection: pick a small random subset and return the
  //    best. With 5-way tournaments and high win-rate weighting, the
  //    fittest parent wins ~80% of selections.
  const tournamentSelect = (pool: StrategyDna[]): StrategyDna => {
    const k = 5;
    let best: StrategyDna = pool[Math.floor(Math.random() * pool.length)];
    let bestScore = -Infinity;
    for (let i = 0; i < k; i++) {
      const candidate = pool[Math.floor(Math.random() * pool.length)];
      const wr = (candidate.metrics?.win_rate || 0) / 100;
      const pf = Math.min(3, candidate.metrics?.profit_factor || 1);
      // Score: heavily weighted toward win rate
      const score = wr * 2.0 + pf * 0.6 + (candidate.fitness || 0) * 0.1;
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return best;
  };

  const nextGen: StrategyDna[] = [...survivors];

  // 6. Fill remaining 27 slots with crossover and mutation. Lower mutation
  //    rate (0.18, was 0.30) preserves winning DNA better.
  while (nextGen.length < 47) {
    const parentA = tournamentSelect(survivors);
    const parentB = tournamentSelect(survivors);

    // Always pass the higher-fitness parent as `parentA` so the
    // winner-biased crossover preserves its traits.
    const [strong, weak] = (parentA.fitness || 0) >= (parentB.fitness || 0)
      ? [parentA, parentB]
      : [parentB, parentA];

    let child = crossover(strong, weak, currentGen + 1);
    child = mutate(child, 0.18); // gentler mutation — don't shred winners

    // Backtest the newly bred child
    const evaluatedChild = backtestStrategy(child, candles);
    nextGen.push(evaluatedChild);
  }

  // 7. Add 3 fresh random immigrants (was 5) — small exploration budget
  for (let i = 47; i < 50; i++) {
    nextGen[i] = backtestStrategy(createRandomStrategy(currentGen + 1), candles);
  }

  return nextGen;
}

/**
 * Suggests an optimised strategy based on Gemini analysis
 * We use Gemini 3.5-flash for analyzing trading failure patterns and outputting mutated DNA profiles.
 */
export async function generateGeminiStrategyRecommendation(
  recentTrades: any[], 
  currentRegime: string, 
  apiKey: string | undefined
): Promise<{ explanation: string; recommendedDna: Partial<StrategyDna> }> {
  const defaultRecommendation = {
    explanation: `Based on the current ${currentRegime} market regime, a conservative momentum trading strategy with narrow RSI levels works best. Keep trailing stop tight to protect capital during volatility.`,
    recommendedDna: {
      name: "Gemini AI Evolved Quantum",
      params: { rsi_period: 14, ema_fast: 12, ema_slow: 26, atr_period: 14, bb_period: 20, bb_std: 2, adx_period: 14 },
      entry_rules: { rsi_oversold: 30, price_above_ema: true, use_bb_bounce: false, use_volume_filter: true },
      exit_rules: { rsi_overbought: 70, trailing_stop: 0.005, use_bb_exit: true }
    }
  };

  if (!apiKey) {
    return defaultRecommendation;
  }

  try {
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    const recentTradesExcerpt = JSON.stringify(recentTrades.slice(-10), null, 2);
    const systemInstruction = 
      "You are a quantitative cryptocurrency expert. Analyze recent trading feedback and return a recommended technical strategy mutation " +
      "optimized for the current market regime. Respond strictly with a JSON object. " +
      "The JSON object must have keys: 'explanation' (string describing the strategy rationale) and 'recommendedDna' " +
      "(matching the properties of the IndicatorParams, EntryRules, and ExitRules interfaces). Avoid markdown wrappers in your text property.";

    const prompt = `Current Market Regime: ${currentRegime}\n\nRecent Trade Logs: ${recentTradesExcerpt}\n\nGenerate recommended strategy settings.`;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
      }
    });

    if (response.text) {
      const parsed = JSON.parse(response.text.trim());
      if (parsed.explanation && parsed.recommendedDna) {
        return parsed;
      }
    }
    return defaultRecommendation;
  } catch (err) {
    console.error("Gemini strategy recommendation generation failed:", err);
    return defaultRecommendation;
  }
}
