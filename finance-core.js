"use strict";

const { URL } = require("node:url");

const SERVER_NAME = "finance-mcp-server";
const SERVER_VERSION = "0.5.0";
const MAX_BATCH_SYMBOLS = 10;
const HTTP_TIMEOUT_MS = readIntegerEnv("FINANCE_MCP_HTTP_TIMEOUT_MS", 15000, 1000, 60000);
const CACHE_TTL_MS = readIntegerEnv("FINANCE_MCP_CACHE_TTL_MS", 5000, 0, 300000);

const responseCache = new Map();

async function getStockQuote(args) {
  const symbol = normalizeSymbol(readRequiredString(args.symbol, "symbol"));
  const quote = await getStockQuoteBySymbol(symbol);

  return {
    source: "Yahoo Finance chart API",
    requestedSymbol: symbol,
    ...quote,
  };
}

async function getStockQuotesBatch(args) {
  const symbols = readStringArray(args.symbols, "symbols", 1, MAX_BATCH_SYMBOLS).map(
    normalizeSymbol,
  );
  const uniqueSymbols = Array.from(new Set(symbols));

  const items = await Promise.all(
    uniqueSymbols.map(async (symbol) => {
      try {
        const quote = await getStockQuoteBySymbol(symbol);
        return {
          ok: true,
          requestedSymbol: symbol,
          ...quote,
        };
      } catch (error) {
        return {
          ok: false,
          requestedSymbol: symbol,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  const successful = items.filter((item) => item.ok).length;

  return {
    source: "Yahoo Finance chart API",
    requested: symbols.length,
    uniqueRequested: uniqueSymbols.length,
    successful,
    failed: items.length - successful,
    items,
  };
}

async function getStockQuoteBySymbol(symbol) {
  const url = new URL(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
  );
  url.searchParams.set("interval", "1d");
  url.searchParams.set("range", "1d");

  const payload = await fetchJson(url, {
    cacheKey: `stock:${symbol}`,
  });
  const result = payload && payload.chart && Array.isArray(payload.chart.result)
    ? payload.chart.result[0]
    : null;
  const meta = result && result.meta ? result.meta : null;

  if (!meta) {
    const description =
      payload &&
      payload.chart &&
      payload.chart.error &&
      payload.chart.error.description;
    throw new Error(description || `No quote data returned for symbol ${symbol}`);
  }

  return {
    symbol: meta.symbol || symbol,
    name: meta.longName || meta.shortName || null,
    exchange: meta.fullExchangeName || meta.exchangeName || null,
    currency: meta.currency || null,
    price: meta.regularMarketPrice ?? null,
    previousClose: meta.chartPreviousClose ?? null,
    change: computeNumericDelta(meta.regularMarketPrice, meta.chartPreviousClose),
    dayHigh: meta.regularMarketDayHigh ?? null,
    dayLow: meta.regularMarketDayLow ?? null,
    volume: meta.regularMarketVolume ?? null,
    marketTime: epochToIso(meta.regularMarketTime),
  };
}

async function getCoinbaseSpotPrice(args) {
  const pair = normalizePair(readRequiredString(args.pair, "pair"));
  const spot = await getCoinbasePriceByKind(pair, "spot");

  return {
    source: "Coinbase price API",
    ...spot,
  };
}

async function getCoinbasePairPrices(args) {
  const pair = normalizePair(readRequiredString(args.pair, "pair"));
  const [spot, buy, sell] = await Promise.all([
    getCoinbasePriceByKind(pair, "spot"),
    getCoinbasePriceByKind(pair, "buy"),
    getCoinbasePriceByKind(pair, "sell"),
  ]);

  const buyAmount = buy.amount;
  const sellAmount = sell.amount;

  return {
    source: "Coinbase price API",
    pair,
    base: spot.base,
    currency: spot.currency,
    spot: spot.amount,
    buy: buyAmount,
    sell: sellAmount,
    spread: computeNumericDelta(buyAmount, sellAmount),
    observedAt: new Date().toISOString(),
  };
}

async function getCoinbasePriceByKind(pair, kind) {
  const url = new URL(
    `https://api.coinbase.com/v2/prices/${encodeURIComponent(pair)}/${kind}`,
  );
  const payload = await fetchJson(url, {
    cacheKey: `coinbase:${pair}:${kind}`,
  });
  const data = payload && payload.data ? payload.data : null;
  if (!data) {
    throw new Error(`No Coinbase ${kind} price data returned for pair ${pair}`);
  }

  return {
    pair,
    base: data.base || null,
    currency: data.currency || null,
    kind,
    amount: toNumberIfPossible(data.amount),
    rawAmount: data.amount ?? null,
    observedAt: new Date().toISOString(),
  };
}

async function searchPolymarketMarkets(args) {
  const query =
    typeof args.query === "string" && args.query.trim()
      ? args.query.trim().toLowerCase()
      : "";
  const closed = Boolean(args.closed);
  const limit = clampInteger(args.limit, 10, 1, 20);

  const fetchSize = query ? Math.max(limit * 5, 50) : limit;
  const url = new URL("https://gamma-api.polymarket.com/markets");
  url.searchParams.set("limit", String(fetchSize));
  url.searchParams.set("closed", String(closed));

  const payload = await fetchJson(url, {
    cacheKey: `polymarket:search:${closed}:${fetchSize}`,
  });
  if (!Array.isArray(payload)) {
    throw new Error("Unexpected Polymarket response");
  }

  const filtered = query
    ? payload.filter((market) => {
        const question =
          typeof market.question === "string" ? market.question.toLowerCase() : "";
        const slug = typeof market.slug === "string" ? market.slug.toLowerCase() : "";
        return question.includes(query) || slug.includes(query);
      })
    : payload;

  const items = filtered
    .slice(0, limit)
    .map((market) => normalizePolymarketMarket(market, false));

  return {
    source: "Polymarket gamma API",
    query: query || null,
    closed,
    returned: items.length,
    items,
  };
}

async function getPolymarketMarket(args) {
  const marketId = readOptionalString(args.marketId);
  const slug = readOptionalString(args.slug);

  if (!marketId && !slug) {
    throw new Error("Expected marketId or slug");
  }

  let market;
  if (marketId) {
    const url = new URL(
      `https://gamma-api.polymarket.com/markets/${encodeURIComponent(marketId)}`,
    );
    market = await fetchJson(url, {
      cacheKey: `polymarket:market-id:${marketId}`,
    });
  } else {
    const url = new URL("https://gamma-api.polymarket.com/markets");
    url.searchParams.set("slug", slug);
    const payload = await fetchJson(url, {
      cacheKey: `polymarket:market-slug:${slug}`,
    });
    market = Array.isArray(payload) ? payload[0] : null;
  }

  if (!market || typeof market !== "object") {
    throw new Error(`Polymarket market not found for ${marketId || slug}`);
  }

  return {
    source: "Polymarket gamma API",
    lookup: {
      marketId: marketId || null,
      slug: slug || null,
    },
    market: normalizePolymarketMarket(market, true),
  };
}

function normalizePolymarketMarket(market, includeDescription) {
  return {
    id: market.id ?? null,
    question: market.question ?? null,
    slug: market.slug ?? null,
    active: Boolean(market.active),
    closed: Boolean(market.closed),
    endDate: market.endDate ?? null,
    createdAt: market.createdAt ?? null,
    updatedAt: market.updatedAt ?? null,
    liquidity: toNumberIfPossible(market.liquidity),
    volume24hr: toNumberIfPossible(market.volume24hr),
    volume: toNumberIfPossible(market.volume),
    lastTradePrice: toNumberIfPossible(market.lastTradePrice),
    bestBid: toNumberIfPossible(market.bestBid),
    bestAsk: toNumberIfPossible(market.bestAsk),
    spread: toNumberIfPossible(market.spread),
    oneHourPriceChange: toNumberIfPossible(market.oneHourPriceChange),
    oneDayPriceChange: toNumberIfPossible(market.oneDayPriceChange),
    oneWeekPriceChange: toNumberIfPossible(market.oneWeekPriceChange),
    image: market.image ?? null,
    outcomes: zipOutcomes(market.outcomes, market.outcomePrices),
    description: includeDescription ? market.description ?? null : undefined,
  };
}

function zipOutcomes(outcomesRaw, pricesRaw) {
  const outcomes = parseJsonArray(outcomesRaw);
  const prices = parseJsonArray(pricesRaw);

  if (!Array.isArray(outcomes) || !Array.isArray(prices) || outcomes.length === 0) {
    return [];
  }

  return outcomes.map((name, index) => ({
    name,
    price: toNumberIfPossible(prices[index]),
  }));
}

function parseJsonArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function fetchJson(url, options = {}) {
  pruneExpiredCache();

  const cacheKey = options.cacheKey || url.toString();
  if (CACHE_TTL_MS > 0) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cloneJson(cached.value);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Request timed out after ${HTTP_TIMEOUT_MS}ms`));
  }, HTTP_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": `${SERVER_NAME}/${SERVER_VERSION}`,
        accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      const snippet = body.trim().slice(0, 300);
      throw new Error(`HTTP ${response.status} from ${url}: ${snippet}`);
    }

    const payload = await response.json();
    if (CACHE_TTL_MS > 0) {
      responseCache.set(cacheKey, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        value: cloneJson(payload),
      });
    }
    return payload;
  } catch (error) {
    if (error && error.name === "AbortError") {
      throw new Error(`Request timed out after ${HTTP_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function pruneExpiredCache() {
  if (responseCache.size === 0) {
    return;
  }

  const now = Date.now();
  for (const [cacheKey, entry] of responseCache.entries()) {
    if (!entry || entry.expiresAt <= now) {
      responseCache.delete(cacheKey);
    }
  }
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function readRequiredString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Expected a non-empty string for ${fieldName}`);
  }
  return value.trim();
}

function readOptionalString(value) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }
  return value.trim();
}

function readStringArray(value, fieldName, minItems, maxItems) {
  if (!Array.isArray(value)) {
    throw new Error(`Expected ${fieldName} to be an array`);
  }

  const normalized = value
    .filter((item) => typeof item === "string" && item.trim())
    .map((item) => item.trim());

  if (normalized.length < minItems) {
    throw new Error(`Expected at least ${minItems} item(s) in ${fieldName}`);
  }

  if (normalized.length > maxItems) {
    throw new Error(`Expected at most ${maxItems} item(s) in ${fieldName}`);
  }

  return normalized;
}

function clampInteger(value, fallback, min, max) {
  const numeric = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(Math.max(numeric, min), max);
}

function readIntegerEnv(name, fallback, min, max) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  return clampInteger(raw, fallback, min, max);
}

function normalizeSymbol(value) {
  return value.toUpperCase();
}

function normalizePair(value) {
  return value.toUpperCase();
}

function epochToIso(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return new Date(value * 1000).toISOString();
}

function computeNumericDelta(current, reference) {
  if (!Number.isFinite(current) || !Number.isFinite(reference)) {
    return null;
  }
  return current - reference;
}

function toNumberIfPossible(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function logError(scope, error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`[${SERVER_NAME}] ${scope}: ${message}\n`);
}

module.exports = {
  SERVER_NAME,
  SERVER_VERSION,
  MAX_BATCH_SYMBOLS,
  HTTP_TIMEOUT_MS,
  CACHE_TTL_MS,
  getStockQuote,
  getStockQuotesBatch,
  getCoinbaseSpotPrice,
  getCoinbasePairPrices,
  searchPolymarketMarkets,
  getPolymarketMarket,
  logError,
};
