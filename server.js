"use strict";

const { URL } = require("node:url");

const SERVER_NAME = "finance-mcp-server";
const SERVER_VERSION = "0.1.0";
const DEFAULT_PROTOCOL_VERSION = "2024-11-05";

const TOOLS = [
  {
    name: "get_stock_quote",
    description:
      "Get a read-only stock quote using Yahoo Finance chart data. Use common tickers like AAPL, MSFT, TSLA, SPY, or BTC-USD.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Ticker or Yahoo-compatible symbol, for example AAPL or BTC-USD.",
        },
      },
      required: ["symbol"],
      additionalProperties: false,
    },
  },
  {
    name: "get_coinbase_spot_price",
    description:
      "Get a read-only Coinbase spot price for a product pair like BTC-USD, ETH-USD, or SOL-USD.",
    inputSchema: {
      type: "object",
      properties: {
        pair: {
          type: "string",
          description: "Coinbase product pair, for example BTC-USD.",
        },
      },
      required: ["pair"],
      additionalProperties: false,
    },
  },
  {
    name: "search_polymarket_markets",
    description:
      "Search public Polymarket markets. Query filtering is done locally against the returned market list.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Optional text filter matched against the market question and slug.",
        },
        limit: {
          type: "integer",
          description: "Maximum number of results to return. Defaults to 10, capped at 20.",
          minimum: 1,
          maximum: 20,
        },
        closed: {
          type: "boolean",
          description: "Include closed markets. Defaults to false.",
        },
      },
      additionalProperties: false,
    },
  },
];

let protocolVersion = DEFAULT_PROTOCOL_VERSION;
let buffer = Buffer.alloc(0);

process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);
  drainMessages();
});

process.stdin.on("error", (error) => {
  logError("stdin", error);
});

process.stdout.on("error", (error) => {
  logError("stdout", error);
});

process.on("uncaughtException", (error) => {
  logError("uncaughtException", error);
});

process.on("unhandledRejection", (error) => {
  logError("unhandledRejection", error);
});

function drainMessages() {
  while (true) {
    const headerEnd = buffer.indexOf("\r\n\r\n");
    if (headerEnd === -1) {
      return;
    }

    const headerText = buffer.slice(0, headerEnd).toString("utf8");
    const headers = parseHeaders(headerText);
    const contentLength = Number.parseInt(headers["content-length"] || "", 10);

    if (!Number.isFinite(contentLength) || contentLength < 0) {
      logError("protocol", new Error("Missing or invalid Content-Length header"));
      buffer = Buffer.alloc(0);
      return;
    }

    const messageStart = headerEnd + 4;
    const messageEnd = messageStart + contentLength;
    if (buffer.length < messageEnd) {
      return;
    }

    const payload = buffer.slice(messageStart, messageEnd).toString("utf8");
    buffer = buffer.slice(messageEnd);

    let message;
    try {
      message = JSON.parse(payload);
    } catch (error) {
      logError("parse", error);
      continue;
    }

    void handleMessage(message);
  }
}

function parseHeaders(headerText) {
  const headers = {};
  const lines = headerText.split("\r\n");
  for (const line of lines) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    headers[key] = value;
  }
  return headers;
}

async function handleMessage(message) {
  if (!message || typeof message !== "object") {
    return;
  }

  const { id, method, params } = message;
  if (!method) {
    if (id !== undefined) {
      sendError(id, -32600, "Invalid request: missing method");
    }
    return;
  }

  try {
    switch (method) {
      case "initialize":
        protocolVersion = sanitizeProtocolVersion(params && params.protocolVersion);
        sendResult(id, {
          protocolVersion,
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
          serverInfo: {
            name: SERVER_NAME,
            version: SERVER_VERSION,
          },
        });
        return;
      case "notifications/initialized":
      case "notifications/cancelled":
        return;
      case "ping":
        sendResult(id, {});
        return;
      case "tools/list":
        sendResult(id, {
          tools: TOOLS,
        });
        return;
      case "tools/call":
        await handleToolCall(id, params);
        return;
      default:
        if (id !== undefined) {
          sendError(id, -32601, `Method not found: ${method}`);
        }
    }
  } catch (error) {
    if (id !== undefined) {
      sendError(id, -32000, error instanceof Error ? error.message : String(error));
    }
  }
}

function sanitizeProtocolVersion(value) {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return DEFAULT_PROTOCOL_VERSION;
}

async function handleToolCall(id, params) {
  const toolName = params && params.name;
  const args = (params && params.arguments) || {};

  if (typeof toolName !== "string" || !toolName) {
    sendError(id, -32602, "Invalid tool call: missing tool name");
    return;
  }

  try {
    let result;
    if (toolName === "get_stock_quote") {
      result = await getStockQuote(args);
    } else if (toolName === "get_coinbase_spot_price") {
      result = await getCoinbaseSpotPrice(args);
    } else if (toolName === "search_polymarket_markets") {
      result = await searchPolymarketMarkets(args);
    } else {
      sendResult(id, toolError(`Unknown tool: ${toolName}`));
      return;
    }

    sendResult(id, {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    });
  } catch (error) {
    sendResult(
      id,
      toolError(error instanceof Error ? error.message : String(error)),
    );
  }
}

function toolError(message) {
  return {
    content: [
      {
        type: "text",
        text: message,
      },
    ],
    isError: true,
  };
}

async function getStockQuote(args) {
  const symbol = readRequiredString(args.symbol, "symbol").toUpperCase();
  const url = new URL(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
  );
  url.searchParams.set("interval", "1d");
  url.searchParams.set("range", "1d");

  const payload = await fetchJson(url);
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
    source: "Yahoo Finance chart API",
    symbol: meta.symbol || symbol,
    name: meta.longName || meta.shortName || null,
    exchange: meta.fullExchangeName || meta.exchangeName || null,
    currency: meta.currency || null,
    price: meta.regularMarketPrice ?? null,
    previousClose: meta.chartPreviousClose ?? null,
    dayHigh: meta.regularMarketDayHigh ?? null,
    dayLow: meta.regularMarketDayLow ?? null,
    volume: meta.regularMarketVolume ?? null,
    marketTime: epochToIso(meta.regularMarketTime),
  };
}

async function getCoinbaseSpotPrice(args) {
  const pair = readRequiredString(args.pair, "pair").toUpperCase();
  const url = new URL(
    `https://api.coinbase.com/v2/prices/${encodeURIComponent(pair)}/spot`,
  );

  const payload = await fetchJson(url);
  const data = payload && payload.data ? payload.data : null;
  if (!data) {
    throw new Error(`No Coinbase price data returned for pair ${pair}`);
  }

  return {
    source: "Coinbase spot price API",
    pair,
    base: data.base || null,
    currency: data.currency || null,
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

  const payload = await fetchJson(url);
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

  const items = filtered.slice(0, limit).map((market) => ({
    id: market.id ?? null,
    question: market.question ?? null,
    slug: market.slug ?? null,
    active: Boolean(market.active),
    closed: Boolean(market.closed),
    endDate: market.endDate ?? null,
    liquidity: toNumberIfPossible(market.liquidity),
    volume24hr: toNumberIfPossible(market.volume24hr),
    lastTradePrice: toNumberIfPossible(market.lastTradePrice),
    bestBid: toNumberIfPossible(market.bestBid),
    bestAsk: toNumberIfPossible(market.bestAsk),
    outcomes: zipOutcomes(market.outcomes, market.outcomePrices),
  }));

  return {
    source: "Polymarket gamma API",
    query: query || null,
    closed,
    returned: items.length,
    items,
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

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": `${SERVER_NAME}/${SERVER_VERSION}`,
      accept: "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    const snippet = body.trim().slice(0, 300);
    throw new Error(`HTTP ${response.status} from ${url}: ${snippet}`);
  }

  return response.json();
}

function sendResult(id, result) {
  if (id === undefined) {
    return;
  }
  writeMessage({
    jsonrpc: "2.0",
    id,
    result,
  });
}

function sendError(id, code, message) {
  if (id === undefined) {
    return;
  }
  writeMessage({
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
    },
  });
}

function writeMessage(message) {
  const body = JSON.stringify(message);
  const payload = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n${body}`;
  process.stdout.write(payload);
}

function readRequiredString(value, fieldName) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Expected a non-empty string for ${fieldName}`);
  }
  return value.trim();
}

function clampInteger(value, fallback, min, max) {
  const numeric = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(Math.max(numeric, min), max);
}

function epochToIso(value) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return new Date(value * 1000).toISOString();
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
