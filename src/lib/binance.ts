import { Candle } from '../types';

/**
 * Fetches real historical candles from Binance public REST endpoints (no API Key required for public data!)
 * It supports standard symbols like BTCUSDT, ETHUSDT, SOLUSDT, and standard intervals like 1m, 5m, 15m.
 */
export async function fetchBinanceCandles(symbol: string = 'BTCUSDT', interval: string = '5m', limit: number = 200): Promise<Candle[]> {
  try {
    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout for fast response

    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Binance API response error: ${response.statusText}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      throw new Error('Invalid candle data type returned from Binance API');
    }

    // Parse Binance format into standard Candle format
    // Item format: [Open time, Open, High, Low, Close, Volume, Close time, Quote asset volume, Number of trades...]
    const candles: Candle[] = data.map((item: any) => ({
      time: Number(item[0]),
      open: parseFloat(item[1]),
      high: parseFloat(item[2]),
      low: parseFloat(item[3]),
      close: parseFloat(item[4]),
      volume: parseFloat(item[5]),
    }));

    return candles;
  } catch (error) {
    console.warn(`Binance public fetch failed (${error instanceof Error ? error.message : String(error)}). Falling back on robust simulation engine.`);
    return generateSimulatedCandles(symbol, interval, limit);
  }
}

/**
 * Generates super realistic price histories using a geometric Brownian motion random walk + harmonic patterns
 */
export function generateSimulatedCandles(symbol: string = 'BTCUSDT', interval: string = '5m', limit: number = 200): Promise<Candle[]> {
  let basePrice = 65000;
  if (symbol.toUpperCase().includes('ETH')) basePrice = 3300;
  else if (symbol.toUpperCase().includes('SOL')) basePrice = 160;
  else if (symbol.toUpperCase().includes('DOGE')) basePrice = 0.15;

  const intervalMin = interval === '1m' ? 1 : interval === '15m' ? 15 : 5;
  const timeStep = intervalMin * 60 * 1000;
  let currTime = Date.now() - limit * timeStep;
  
  const candles: Candle[] = [];
  let price = basePrice;
  let trendPhase = Math.random() * Math.PI * 2;

  for (let i = 0; i < limit; i++) {
    // Combine random walk with sine wave trends
    const trend = Math.sin(trendPhase) * 0.003; // medium-amplitude cycles
    const randomShift = (Math.random() - 0.495) * 0.006; // positive bias
    const dailyCycle = Math.sin((i / 40) * Math.PI) * 0.001; // subtle intraday trend shifts
    
    const pctChange = trend + randomShift + dailyCycle;
    const open = price;
    const close = price * (1 + pctChange);
    
    // Volatility standard
    const high = Math.max(open, close) * (1 + Math.random() * 0.0035 + 0.0005);
    const low = Math.min(open, close) * (1 - Math.random() * 0.0035 - 0.0005);
    
    const volume = Math.floor(Math.random() * 500) + 120 + (Math.random() > 0.95 ? 1000 : 0); // volume spike randomly

    candles.push({
      time: currTime,
      open: parseFloat(open.toFixed(4)),
      high: parseFloat(high.toFixed(4)),
      low: parseFloat(low.toFixed(4)),
      close: parseFloat(close.toFixed(4)),
      volume: parseFloat(volume.toFixed(2)),
    });

    price = close;
    currTime += timeStep;
    trendPhase += 0.04;
  }

  return Promise.resolve(candles);
}
