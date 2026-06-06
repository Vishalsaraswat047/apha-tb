import { Candle, Trade, StrategyDna } from '../types';

const isFiniteNumber = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n);

function validateCandle(raw: unknown, index: number, source: string): Candle | null {
  if (raw === null || typeof raw !== 'object') {
    console.warn(`[safeData] Dropping ${source}[${index}]: not an object`, raw);
    return null;
  }
  const c = raw as Record<string, unknown>;
  const requiredNumberKeys: (keyof Candle)[] = ['time', 'open', 'high', 'low', 'close', 'volume'];
  for (const key of requiredNumberKeys) {
    if (!isFiniteNumber(c[key])) {
      console.warn(
        `[safeData] Dropping ${source}[${index}]: invalid ${String(key)}`,
        c[key],
      );
      return null;
    }
  }
  return {
    time: c.time as number,
    open: c.open as number,
    high: c.high as number,
    low: c.low as number,
    close: c.close as number,
    volume: c.volume as number,
    rsi: isFiniteNumber(c.rsi) ? (c.rsi as number) : undefined,
    ema_fast: isFiniteNumber(c.ema_fast) ? (c.ema_fast as number) : undefined,
    ema_slow: isFiniteNumber(c.ema_slow) ? (c.ema_slow as number) : undefined,
  };
}

export function safeCandles(data: unknown, source = 'candles'): Candle[] {
  if (data === null || data === undefined) return [];
  if (!Array.isArray(data)) {
    console.warn(`[safeData] ${source} expected array, got ${typeof data}; defaulting to []`);
    return [];
  }
  const out: Candle[] = [];
  for (let i = 0; i < data.length; i++) {
    const c = validateCandle(data[i], i, source);
    if (c) out.push(c);
  }
  return out;
}

function validateTrade(raw: unknown, index: number, source: string): Trade | null {
  if (raw === null || typeof raw !== 'object') {
    console.warn(`[safeData] Dropping ${source}[${index}]: not an object`, raw);
    return null;
  }
  const t = raw as Record<string, unknown>;
  if (!isFiniteNumber(t.timestamp) || typeof t.symbol !== 'string') {
    console.warn(`[safeData] Dropping ${source}[${index}]: missing timestamp/symbol`, t);
    return null;
  }
  return t as unknown as Trade;
}

export function safeTrades(data: unknown, source = 'trades'): Trade[] {
  if (!Array.isArray(data)) {
    console.warn(`[safeData] ${source} expected array, got ${typeof data}; defaulting to []`);
    return [];
  }
  const out: Trade[] = [];
  for (let i = 0; i < data.length; i++) {
    const t = validateTrade(data[i], i, source);
    if (t) out.push(t);
  }
  return out;
}

export function safeEquity(
  data: unknown,
  source = 'equity',
): { timestamp: number; equity: number }[] {
  if (!Array.isArray(data)) {
    console.warn(`[safeData] ${source} expected array, got ${typeof data}; defaulting to []`);
    return [];
  }
  const out: { timestamp: number; equity: number }[] = [];
  for (let i = 0; i < data.length; i++) {
    const item = data[i] as Record<string, unknown> | null;
    if (
      item === null ||
      typeof item !== 'object' ||
      !isFiniteNumber(item.timestamp) ||
      !isFiniteNumber(item.equity)
    ) {
      console.warn(`[safeData] Dropping ${source}[${i}]`, data[i]);
      continue;
    }
    out.push({ timestamp: item.timestamp as number, equity: item.equity as number });
  }
  return out;
}

export function safeStrategies(data: unknown, source = 'strategies'): StrategyDna[] {
  if (!Array.isArray(data)) {
    console.warn(`[safeData] ${source} expected array, got ${typeof data}; defaulting to []`);
    return [];
  }
  return data as StrategyDna[];
}

export function safePositions<T = unknown>(data: unknown, source = 'positions'): T[] {
  if (!Array.isArray(data)) {
    console.warn(`[safeData] ${source} expected array, got ${typeof data}; defaulting to []`);
    return [];
  }
  return data as T[];
}
