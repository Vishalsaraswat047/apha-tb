import { Candle, MarketRegime } from '../types';
import { populateIndicators } from './indicators';

// Cache regime detection to avoid re-running populateIndicators on every call
let _regimeCache: { key: number; regime: MarketRegime } | null = null;

/**
 * Automatically classifies market regime based on technical indicators:
 * - ADX for trend strength (>25 is trending, <=25 is ranging)
 * - EMA fast vs EMA slow for trend direction (bullish/bearish)
 * - Bollinger Bands width for volatility level
 */
export function detectMarketRegime(candles: Candle[]): MarketRegime {
  if (candles.length < 30) {
    return 'Ranging Dynamic';
  }

  // Use last candle timestamp as cache key — skip recompute if candles haven't changed
  const cacheKey = candles[candles.length - 1].time;
  if (_regimeCache && _regimeCache.key === cacheKey) {
    return _regimeCache.regime;
  }

  // Pre-calculate using standard parameters: ADX(14), EMA(12/26), BB(20, 2)
  const populated = populateIndicators(candles, {
    rsi_period: 14,
    ema_fast: 12,
    ema_slow: 26,
    atr_period: 14,
    bb_period: 20,
    bb_std: 2.0,
    adx_period: 14
  });

  const latest = populated[populated.length - 1];
  if (!latest || latest.adx === undefined || latest.ema_fast === undefined || latest.ema_slow === undefined || latest.bb_upper === undefined || latest.bb_lower === undefined) {
    return 'Ranging Dynamic';
  }

  // Calculate BB Band Width as proxy for volatility
  const bbWidth = (latest.bb_upper - latest.bb_lower) / latest.close;
  const isHighVolatility = bbWidth > 0.035; // BB width > 3.5%
  const isLowVolatility = bbWidth < 0.012;  // BB width < 1.2%

  let regime: MarketRegime;

  if (isHighVolatility) {
    regime = 'High Volatility';
  } else if (latest.adx > 25) {
    // Standard ADX trending threshold (was incorrectly 18)
    regime = latest.ema_fast > latest.ema_slow ? 'Trending Bullish' : 'Trending Bearish';
  } else if (isLowVolatility) {
    regime = 'Low Volatility';
  } else {
    regime = 'Ranging Dynamic';
  }

  _regimeCache = { key: cacheKey, regime };
  return regime;
}

/**
 * Returns ensemble weights configured dynamically for the active regime
 */
export function getRegimeAwareWeights(regime: MarketRegime, strategies: any[]): { [strategyId: string]: number } {
  const weights: { [strategyId: string]: number } = {};
  if (strategies.length === 0) return weights;

  // Assign base weights based on fitness ranking (harmonic distribution)
  strategies.forEach((strat, idx) => {
    let weight = 1 / (idx + 1); // 1, 0.5, 0.33, 0.25...
    
    // Add regime-specific bonuses to strategies matching the condition
    if (regime === 'Trending Bullish') {
      // Reward strategies with active EMA filters
      if (strat.entry_rules.price_above_ema) {
        weight *= 1.5;
      }
    } else if (regime === 'Trending Bearish') {
      // In bear market, tight stop losses and RSI bounds help
      if (strat.exit_rules.rsi_overbought <= 70) {
        weight *= 1.3;
      }
    } else if (regime === 'Ranging Dynamic') {
      // Reward BB lower bounds/bounce styles
      if (strat.entry_rules.use_bb_bounce) {
        weight *= 1.6;
      }
    } else if (regime === 'Low Volatility') {
      // Narrow thresholds
      if (strat.entry_rules.rsi_oversold > 25) {
        weight *= 1.4;
      }
    } else if (regime === 'High Volatility') {
      // Reward protective stop loss sizes
      if (strat.exit_rules.trailing_stop < 0.005) {
        weight *= 1.5;
      }
    }

    weights[strat.id] = parseFloat(weight.toFixed(3));
  });

  // Normalize weights to sum up to 1
  const sum = Object.values(weights).reduce((a, b) => a + b, 0);
  if (sum > 0) {
    for (const key in weights) {
      weights[key] = parseFloat((weights[key] / sum).toFixed(3));
    }
  }

  return weights;
}
