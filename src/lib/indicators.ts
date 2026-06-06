import { Candle, IndicatorParams } from '../types';

/**
 * Calculates Simple Moving Average (SMA)
 */
export function calculateSMA(prices: number[], period: number): number[] {
  const sma: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      sma.push(NaN);
    } else {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
  }
  return sma;
}

/**
 * Calculates Exponential Moving Average (EMA) — seeded with SMA for accuracy
 */
export function calculateEMA(prices: number[], period: number): number[] {
  const ema: number[] = [];
  if (prices.length === 0) return [];
  if (prices.length < period) return Array(prices.length).fill(NaN);

  const k = 2 / (period + 1);

  // Seed with SMA of first `period` prices for accuracy
  const seed = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;

  // Fill NaN for warmup period
  for (let i = 0; i < period - 1; i++) ema.push(NaN);

  let currentEma = seed;
  ema.push(currentEma);

  for (let i = period; i < prices.length; i++) {
    currentEma = prices[i] * k + currentEma * (1 - k);
    ema.push(currentEma);
  }
  return ema;
}

/**
 * Calculates Relative Strength Index (RSI) — fixed off-by-one alignment
 */
export function calculateRSI(prices: number[], period: number): number[] {
  if (prices.length <= period) {
    return Array(prices.length).fill(NaN);
  }

  const rsi: number[] = [];

  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  // Fill NaN for warmup (indices 0..period-1 have no RSI)
  for (let i = 0; i < period; i++) {
    rsi.push(NaN);
  }

  // First RSI value at index `period`
  let avgGain = gains.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((sum, val) => sum + val, 0) / period;
  let rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs));

  // Subsequent RSI values
  for (let i = period + 1; i < prices.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i - 1]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i - 1]) / period;
    rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + rs));
  }

  return rsi;
}

/**
 * Calculates Average True Range (ATR)
 */
export function calculateATR(candles: Candle[], period: number): number[] {
  const atr: number[] = [];
  if (candles.length === 0) return [];

  const tr: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const hl = candles[i].high - candles[i].low;
    const hcy = Math.abs(candles[i].high - candles[i - 1].close);
    const lcy = Math.abs(candles[i].low - candles[i - 1].close);
    tr.push(Math.max(hl, hcy, lcy));
  }

  if (tr.length < period) {
    return Array(candles.length).fill(NaN);
  }

  // First ATR is simple average of TRs
  let currentAtr = tr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  
  for (let i = 0; i < period; i++) {
    atr.push(NaN);
  }
  atr[period - 1] = currentAtr;

  for (let i = period; i < candles.length; i++) {
    currentAtr = (currentAtr * (period - 1) + tr[i]) / period;
    atr.push(currentAtr);
  }

  return atr;
}

/**
 * Calculates Bollinger Bands
 */
export function calculateBB(prices: number[], period: number, stdDevMultiplier: number) {
  const upper: number[] = [];
  const middle: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      middle.push(NaN);
      lower.push(NaN);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      const sum = slice.reduce((a, b) => a + b, 0);
      const mean = sum / period;
      
      const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period;
      const stdDev = Math.sqrt(variance);

      upper.push(mean + stdDevMultiplier * stdDev);
      middle.push(mean);
      lower.push(mean - stdDevMultiplier * stdDev);
    }
  }

  return { upper, middle, lower };
}

/**
 * Calculates Average Directional Index (ADX)
 */
export function calculateADX(candles: Candle[], period: number): number[] {
  const adx: number[] = [];
  const length = candles.length;
  if (length < period * 2) {
    return Array(length).fill(NaN);
  }

  const tr: number[] = [];
  const plusDM: number[] = [];
  const minusDM: number[] = [];

  for (let i = 1; i < length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const cy = candles[i - 1].close;
    const hy = candles[i - 1].high;
    const ly = candles[i - 1].low;

    // True Range
    const trVal = Math.max(h - l, Math.abs(h - cy), Math.abs(l - cy));
    tr.push(trVal);

    // Directional Movement
    const upMove = h - hy;
    const downMove = ly - l;

    if (upMove > downMove && upMove > 0) {
      plusDM.push(upMove);
    } else {
      plusDM.push(0);
    }

    if (downMove > upMove && downMove > 0) {
      minusDM.push(downMove);
    } else {
      minusDM.push(0);
    }
  }

  // Smooth DM and TR
  const smoothedTR: number[] = [];
  const smoothedPlusDM: number[] = [];
  const smoothedMinusDM: number[] = [];

  let sumTR = tr.slice(0, period).reduce((a, b) => a + b, 0);
  let sumPlusDM = plusDM.slice(0, period).reduce((a, b) => a + b, 0);
  let sumMinusDM = minusDM.slice(0, period).reduce((a, b) => a + b, 0);

  smoothedTR.push(sumTR);
  smoothedPlusDM.push(sumPlusDM);
  smoothedMinusDM.push(sumMinusDM);

  for (let i = period; i < tr.length; i++) {
    sumTR = sumTR - sumTR / period + tr[i];
    sumPlusDM = sumPlusDM - sumPlusDM / period + plusDM[i];
    sumMinusDM = sumMinusDM - sumMinusDM / period + minusDM[i];

    smoothedTR.push(sumTR);
    smoothedPlusDM.push(sumPlusDM);
    smoothedMinusDM.push(sumMinusDM);
  }

  // Dynamic Index (DI)
  const plusDI: number[] = [];
  const minusDI: number[] = [];
  const dx: number[] = [];

  for (let i = 0; i < smoothedTR.length; i++) {
    const trVal = smoothedTR[i];
    const pDI = trVal === 0 ? 0 : 100 * (smoothedPlusDM[i] / trVal);
    const mDI = trVal === 0 ? 0 : 100 * (smoothedMinusDM[i] / trVal);
    plusDI.push(pDI);
    minusDI.push(mDI);

    const diff = Math.abs(pDI - mDI);
    const sum = pDI + mDI;
    const dxVal = sum === 0 ? 0 : 100 * (diff / sum);
    dx.push(dxVal);
  }

  // ADX smoothing
  for (let i = 0; i < period; i++) {
    adx.push(NaN);
  }

  let sumDX = dx.slice(0, period).reduce((a, b) => a + b, 0);
  adx.push(sumDX / period);

  for (let i = period; i < dx.length; i++) {
    sumDX = sumDX - sumDX / period + dx[i];
    adx.push(sumDX / period);
  }

  // Shift to align index back with candles length
  const finalAdx: number[] = Array(length).fill(NaN);
  for (let i = 0; i < adx.length; i++) {
    const candleIdx = i + 1; // offset due to index 1 starting on TR
    if (candleIdx < length) {
      finalAdx[candleIdx] = adx[i];
    }
  }

  return finalAdx;
}

/**
 * Mutates all candles with precalculated technical indicators
 */
export function populateIndicators(candles: Candle[], params: IndicatorParams): Candle[] {
  const prices = candles.map(c => c.close);

  const rsi = calculateRSI(prices, params.rsi_period);
  const emaFast = calculateEMA(prices, params.ema_fast);
  const emaSlow = calculateEMA(prices, params.ema_slow);
  const atr = calculateATR(candles, params.atr_period);
  const bb = calculateBB(prices, params.bb_period, params.bb_std);
  const adx = calculateADX(candles, params.adx_period);

  return candles.map((c, i) => {
    // Validate indicator values to prevent NaN from breaking strategies
    const rsiVal = isNaN(rsi[i]) ? undefined : rsi[i];
    const emaFastVal = isNaN(emaFast[i]) ? undefined : emaFast[i];
    const emaSlowVal = isNaN(emaSlow[i]) ? undefined : emaSlow[i];
    const atrVal = isNaN(atr[i]) ? undefined : atr[i];
    const bbUpperVal = isNaN(bb.upper[i]) ? undefined : bb.upper[i];
    const bbMiddleVal = isNaN(bb.middle[i]) ? undefined : bb.middle[i];
    const bbLowerVal = isNaN(bb.lower[i]) ? undefined : bb.lower[i];
    const adxVal = isNaN(adx[i]) ? undefined : adx[i];

    return {
      ...c,
      rsi: rsiVal,
      ema_fast: emaFastVal,
      ema_slow: emaSlowVal,
      atr: atrVal,
      bb_upper: bbUpperVal,
      bb_middle: bbMiddleVal,
      bb_lower: bbLowerVal,
      adx: adxVal,
    };
  });
}
