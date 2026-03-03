"use strict";

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const z = require("zod");

const {
  SERVER_NAME,
  SERVER_VERSION,
  MAX_BATCH_SYMBOLS,
  getStockQuote,
  getStockQuotesBatch,
  getCoinbaseSpotPrice,
  getCoinbasePairPrices,
  searchPolymarketMarkets,
  getPolymarketMarket,
  logError,
} = require("./finance-core.js");

function buildServer() {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  server.registerTool(
    "get_stock_quote",
    {
      description:
        "Get a read-only stock quote using Yahoo Finance chart data. Use common tickers like AAPL, MSFT, TSLA, SPY, or BTC-USD.",
      inputSchema: {
        symbol: z.string().min(1).describe(
          "Ticker or Yahoo-compatible symbol, for example AAPL or BTC-USD.",
        ),
      },
    },
    async ({ symbol }) => runTool(() => getStockQuote({ symbol })),
  );

  server.registerTool(
    "get_stock_quotes_batch",
    {
      description:
        "Get multiple stock or Yahoo-compatible quotes in one call. Returns per-symbol errors instead of failing the full request.",
      inputSchema: {
        symbols: z.array(z.string().min(1)).min(1).max(MAX_BATCH_SYMBOLS).describe(
          "1 to 10 ticker symbols, for example [\"AAPL\", \"MSFT\", \"SPY\"].",
        ),
      },
    },
    async ({ symbols }) => runTool(() => getStockQuotesBatch({ symbols })),
  );

  server.registerTool(
    "get_coinbase_spot_price",
    {
      description:
        "Get a read-only Coinbase spot price for a product pair like BTC-USD, ETH-USD, or SOL-USD.",
      inputSchema: {
        pair: z.string().min(1).describe("Coinbase product pair, for example BTC-USD."),
      },
    },
    async ({ pair }) => runTool(() => getCoinbaseSpotPrice({ pair })),
  );

  server.registerTool(
    "get_coinbase_pair_prices",
    {
      description:
        "Get read-only Coinbase spot, buy, and sell prices for a product pair and include the current spread.",
      inputSchema: {
        pair: z.string().min(1).describe("Coinbase product pair, for example BTC-USD."),
      },
    },
    async ({ pair }) => runTool(() => getCoinbasePairPrices({ pair })),
  );

  server.registerTool(
    "search_polymarket_markets",
    {
      description:
        "Search public Polymarket markets. Query filtering is done locally against the returned market list.",
      inputSchema: {
        query: z.string().optional().describe(
          "Optional text filter matched against the market question and slug.",
        ),
        limit: z.number().int().min(1).max(20).optional().describe(
          "Maximum number of results to return. Defaults to 10, capped at 20.",
        ),
        closed: z.boolean().optional().describe("Include closed markets. Defaults to false."),
      },
    },
    async ({ query, limit, closed }) =>
      runTool(() => searchPolymarketMarkets({ query, limit, closed })),
  );

  server.registerTool(
    "get_polymarket_market",
    {
      description: "Get detailed read-only Polymarket market data by market id or slug.",
      inputSchema: {
        marketId: z.string().min(1).optional().describe(
          "The Polymarket market id, for example \"531202\".",
        ),
        slug: z.string().min(1).optional().describe(
          "The Polymarket market slug, for example \"bitboy-convicted\".",
        ),
      },
    },
    async ({ marketId, slug }) => runTool(() => getPolymarketMarket({ marketId, slug })),
  );

  return server;
}

async function runTool(handler) {
  try {
    const result = await handler();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: error instanceof Error ? error.message : String(error),
        },
      ],
      isError: true,
    };
  }
}

async function startServer() {
  installErrorHandlers();

  const server = buildServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  if (!readBooleanEnv("FINANCE_MCP_SILENT")) {
    process.stderr.write(`${SERVER_NAME} ${SERVER_VERSION} running on stdio\n`);
  }

  return server;
}

function installErrorHandlers() {
  process.on("uncaughtException", (error) => {
    logError("uncaughtException", error);
  });

  process.on("unhandledRejection", (error) => {
    logError("unhandledRejection", error);
  });
}

function readBooleanEnv(name) {
  const raw = process.env[name];
  if (!raw) {
    return false;
  }

  const normalized = String(raw).trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

module.exports = {
  buildServer,
  startServer,
  getStockQuote,
  getStockQuotesBatch,
  getCoinbaseSpotPrice,
  getCoinbasePairPrices,
  searchPolymarketMarkets,
  getPolymarketMarket,
};

if (require.main === module) {
  startServer().catch((error) => {
    logError("startup", error);
    process.exit(1);
  });
}
