import crypto from 'crypto';

function getBinanceBaseUrl(): string {
  // Check if BINANCE_TESTNET is explicitly set to true (case-insensitive)
  const isTestnet = process.env.BINANCE_TESTNET?.toString().toLowerCase() === 'true';
  return isTestnet ? 'https://testnet.binance.vision' : 'https://api.binance.com';
}

const symbolInfoCache: Record<string, any> = {};

function getDecimalPlaces(stepSize: number): number {
  const stepString = stepSize.toString();
  if (!stepString.includes('.')) return 0;
  return stepString.split('.')[1].replace(/0+$/, '').length;
}

function roundDownToStep(value: number, stepSize: number): number {
  return Math.floor(value / stepSize) * stepSize;
}

async function getSymbolExchangeInfo(symbol: string): Promise<any> {
  const normalized = symbol.toUpperCase();
  if (symbolInfoCache[normalized]) {
    return symbolInfoCache[normalized];
  }

  // Use unsigned request for public endpoint (exchangeInfo does not require authentication)
  const baseUrl = getBinanceBaseUrl();
  const response = await fetch(`${baseUrl}/api/v3/exchangeInfo?symbol=${normalized}`);
  if (!response.ok) {
    throw new Error(`Binance exchangeInfo error: ${response.statusText}`);
  }
  const info = await response.json();
  if (info && info.symbols && info.symbols.length > 0) {
    symbolInfoCache[normalized] = info.symbols[0];
    return symbolInfoCache[normalized];
  }

  throw new Error(`Unable to fetch exchange information for symbol ${normalized}`);
}

function getSymbolFilterValues(filters: any[]) {
  const lotSize = filters.find((item: any) => item.filterType === 'LOT_SIZE') || {};
  const minNotionalFilter = filters.find((item: any) => item.filterType === 'MIN_NOTIONAL') || {};
  return {
    minQty: parseFloat(lotSize.minQty || '0'),
    stepSize: parseFloat(lotSize.stepSize || '0.000001'),
    minNotional: parseFloat(minNotionalFilter.minNotional || '0')
  };
}

async function getSymbolPrice(symbol: string): Promise<number> {
  // Use unsigned request for public endpoint (ticker/price does not require authentication)
  const baseUrl = getBinanceBaseUrl();
  const response = await fetch(`${baseUrl}/api/v3/ticker/price?symbol=${symbol.toUpperCase()}`);
  if (!response.ok) {
    throw new Error(`Binance ticker/price error: ${response.statusText}`);
  }
  const ticker = await response.json();
  return parseFloat(ticker.price || '0');
}

/**
 * Creates signature and sends signed HTTP requests to Binance Spot API
 */
export async function binanceSignedRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'DELETE' = 'GET',
  params: Record<string, any> = {}
): Promise<any> {
  const apiKey = process.env.BINANCE_API_KEY;
  const apiSecret = process.env.BINANCE_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('Binance credentials missing. Set BINANCE_API_KEY and BINANCE_API_SECRET first.');
  }

  const baseUrl = getBinanceBaseUrl();
  const queryParams = { ...params, timestamp: Date.now() };
  
  // Construct query string
  const queryString = Object.entries(queryParams)
    .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`)
    .join('&');

  // Sign query string via HMAC-SHA256
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(queryString)
    .digest('hex');

  const finalUrl = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

  const response = await fetch(finalUrl, {
    method,
    headers: {
      'X-MBX-APIKEY': apiKey,
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });

  const textOutput = await response.text();
  let jsonOutput: any;
  try {
    jsonOutput = JSON.parse(textOutput);
  } catch (err) {
    throw new Error(`Binance raw response parsing failed. Raw response: ${textOutput}`);
  }

  if (!response.ok) {
    throw new Error(
      `Binance API Error Status ${response.status}: Code ${jsonOutput.code || 'UNKNOWN'} - ${jsonOutput.msg || textOutput}`
    );
  }

  return jsonOutput;
}

/**
 * Fetches real account spot balances from Binance exchange (live or testnet)
 */
export async function fetchRealAccountBalances(): Promise<Array<{ asset: string; free: string; locked: string }>> {
  try {
    const accountInfo = await binanceSignedRequest('/api/v3/account', 'GET');
    if (accountInfo && Array.isArray(accountInfo.balances)) {
      return accountInfo.balances;
    }
    return [];
  } catch (error) {
    console.error('Failed to fetch real binance balances:', error);
    throw error;
  }
}

/**
 * Executes a live SPOT market order on Binance exchange
 * 
 * @param symbol The pair (e.g. BTCUSDT, ETHUSDT)
 * @param side BUY or SELL
 * @param amountType QUOTE (to buy a specific USDT value) or BASE (to sell a specific coin quantity)
 * @param amountValue The transaction monetary budget or units
 */
export async function executeRealMarketOrder(
  symbol: string,
  side: 'BUY' | 'SELL',
  amountType: 'QUOTE' | 'BASE',
  amountValue: number
): Promise<{ orderId: string; price: number; qty: number; clientOrderId: string }> {
  try {
    const params: Record<string, any> = {
      symbol: symbol.toUpperCase(),
      side: side.toUpperCase(),
      type: 'MARKET',
    };

    const symbolInfo = await getSymbolExchangeInfo(symbol);
    const filters = symbolInfo.filters || [];
    const { minQty, stepSize, minNotional } = getSymbolFilterValues(filters);
    const decimalPlaces = getDecimalPlaces(stepSize || 0.000001);

    const normalizeQuantity = (quantity: number) => {
      const rounded = roundDownToStep(quantity, stepSize || 0.000001);
      return parseFloat(rounded.toFixed(decimalPlaces));
    };

    if (side === 'BUY') {
      if (amountType === 'QUOTE') {
        // When buying by quote amount, use Binance's `quoteOrderQty` parameter
        // Validate against MIN_NOTIONAL by amountValue (USDT) and estimate resulting qty vs minQty
        const marketPrice = await getSymbolPrice(symbol);
        if (amountValue < minNotional) {
          throw new Error(`Order notional ${amountValue.toFixed(2)} is below the minimum allowed notional ${minNotional.toFixed(2)} for ${symbol.toUpperCase()}`);
        }

        // Estimate quantity to ensure compliance with LOT_SIZE
        const estimatedQty = amountValue / marketPrice;
        const roundedEstQty = normalizeQuantity(estimatedQty);
        if (roundedEstQty < minQty) {
          throw new Error(`Estimated BUY quantity ${roundedEstQty} is below the minimum quantity ${minQty} for ${symbol.toUpperCase()}`);
        }

        // Round quoteOrderQty to the symbol's quote asset precision to avoid precision errors
        const quotePrecision = typeof symbolInfo.quoteAssetPrecision === 'number' ? symbolInfo.quoteAssetPrecision : 2;
        params.quoteOrderQty = parseFloat(amountValue.toFixed(quotePrecision)); // let Binance execute by quote amount
      } else {
        const normalizedQty = normalizeQuantity(amountValue);
        if (normalizedQty < minQty) {
          throw new Error(`BUY quantity ${normalizedQty} is below the minimum quantity ${minQty} for ${symbol.toUpperCase()}`);
        }
        const marketPrice = await getSymbolPrice(symbol);
        if (normalizedQty * marketPrice < minNotional) {
          throw new Error(`BUY quantity ${normalizedQty} results in notional ${(normalizedQty * marketPrice).toFixed(2)} below minimum ${minNotional.toFixed(2)} for ${symbol.toUpperCase()}`);
        }

        params.quantity = normalizedQty;
      }
    } else {
      const normalizedQty = normalizeQuantity(amountValue);
      if (normalizedQty < minQty) {
        throw new Error(`SELL quantity ${normalizedQty} is below the minimum quantity ${minQty} for ${symbol.toUpperCase()}`);
      }
      const marketPrice = await getSymbolPrice(symbol);
      if (normalizedQty * marketPrice < minNotional) {
        throw new Error(`SELL quantity ${normalizedQty} results in notional ${(normalizedQty * marketPrice).toFixed(2)} below minimum ${minNotional.toFixed(2)} for ${symbol.toUpperCase()}`);
      }

      params.quantity = normalizedQty;
    }

    let orderResponse: any;
    try {
      console.debug('[binance] placing order', params);
      orderResponse = await binanceSignedRequest('/api/v3/order', 'POST', params);
    } catch (err: any) {
      console.error('[binance] order error, params:', params, 'err:', err && err.message ? err.message : err);
      // Retry with reduced quote precision if Binance complains about precision
      const msg = err && err.message ? err.message : String(err);
      if (msg.includes('quoteOrderQty') || msg.includes("too much precision") || msg.includes('-1111')) {
        const tryPrecisions = [2, 1, 0];
        for (const p of tryPrecisions) {
          try {
            if (params.quoteOrderQty !== undefined) params.quoteOrderQty = parseFloat(Number(params.quoteOrderQty).toFixed(p));
            orderResponse = await binanceSignedRequest('/api/v3/order', 'POST', params);
            break;
          } catch (innerErr) {
            orderResponse = null;
          }
        }
        if (!orderResponse) throw err; // rethrow original if retries failed
      } else {
        throw err;
      }
    }

    // Compute executing average price and executed quantity robustly
    let execPrice = 0;
    let execQty = 0;

    if (Array.isArray(orderResponse.fills) && orderResponse.fills.length > 0) {
      let sumCost = 0;
      let sumQty = 0;
      for (const fill of orderResponse.fills) {
        const fillPrice = parseFloat(fill.price || '0');
        const fillQty = parseFloat(fill.qty || '0');
        sumCost += fillPrice * fillQty;
        sumQty += fillQty;
      }
      execQty = sumQty;
      execPrice = sumQty > 0 ? (sumCost / sumQty) : 0;
    } else {
      execQty = parseFloat(orderResponse.executedQty || '0');
      const cummulative = parseFloat(orderResponse.cummulativeQuoteQty || '0');
      if (execQty > 0 && cummulative > 0) {
        execPrice = cummulative / execQty;
      } else if (parseFloat(orderResponse.price || '0') > 0) {
        execPrice = parseFloat(orderResponse.price || '0');
      } else {
        // No fills and no executed quantity — treat as failed execution
        throw new Error(`Order executed with zero quantity: ${JSON.stringify(orderResponse)}`);
      }
    }

    return {
      orderId: String(orderResponse.orderId || ''),
      price: execPrice,
      qty: execQty,
      clientOrderId: String(orderResponse.clientOrderId || '')
    };
  } catch (error) {
    console.error('Failed to execute real order on binance:', error);
    throw error;
  }
}
