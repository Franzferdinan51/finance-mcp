#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const openClawSettings = loadOpenClawSettings();
applyRuntimeDefaults(openClawSettings);

const serverModulePath = resolveServerModulePath();

const {
  getStockQuote,
  getStockQuotesBatch,
  getCoinbaseSpotPrice,
  getCoinbasePairPrices,
  searchPolymarketMarkets,
  getPolymarketMarket,
} = require(serverModulePath);

const HELP_TEXT = `
Finance OpenClaw Tool Bridge

Usage:
  node openclaw/finance-tools.js <command> [options]

Fast path:
  node openclaw/finance-tools.js quick

Commands:
  quick
  stock-quote [--symbol AAPL]
  stock-batch [--symbols AAPL,MSFT,SPY]
  coinbase-spot [--pair BTC-USD]
  coinbase-pair [--pair BTC-USD]
  polymarket-search [--query bitcoin] [--limit 5] [--closed]
  polymarket-market [--market-id 531202]
  polymarket-market [--slug bitboy-convicted]
  config

Options:
  --json      Pretty-print JSON output (default)
  --help      Show this help text

Defaults can be set in:
  ${getOpenClawConfigPath()}
under:
  skills.entries["finance-mcp"]
`;

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "--help" || command === "-h") {
    process.stdout.write(`${HELP_TEXT.trim()}\n`);
    return;
  }

  const options = parseArgs(args.slice(1));
  if (options.help) {
    process.stdout.write(`${HELP_TEXT.trim()}\n`);
    return;
  }

  let result;

  switch (command) {
    case "quick":
      result = await buildQuickSnapshot();
      break;
    case "config":
      result = {
        openClawConfigPath: getOpenClawConfigPath(),
        settings: normalizeSettingsForOutput(openClawSettings),
      };
      break;
    case "stock-quote":
    case "stock":
      result = await getStockQuote({
        symbol: readOptionalOption(options, "symbol") || getDefaultStockSymbols()[0],
      });
      break;
    case "stock-batch":
    case "stocks":
      result = await getStockQuotesBatch({
        symbols: readOptionalCsvOption(options, "symbols") || getDefaultStockSymbols(),
      });
      break;
    case "coinbase-spot":
      result = await getCoinbaseSpotPrice({
        pair: readOptionalOption(options, "pair") || getDefaultCoinbasePair(),
      });
      break;
    case "coinbase-pair":
    case "coinbase":
      result = await getCoinbasePairPrices({
        pair: readOptionalOption(options, "pair") || getDefaultCoinbasePair(),
      });
      break;
    case "polymarket-search":
    case "markets":
      result = await searchPolymarketMarkets({
        query: readOptionalOption(options, "query") || getDefaultPolymarketQuery(),
        limit: readOptionalInteger(options, "limit") ?? getDefaultPolymarketLimit(),
        closed: Boolean(options.closed),
      });
      break;
    case "polymarket-market":
    case "market":
      result = await getPolymarketMarket({
        marketId: readOptionalOption(options, "market-id"),
        slug: readOptionalOption(options, "slug") || getDefaultPolymarketSlug(),
      });
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function resolveServerModulePath() {
  const repoPath = path.join(__dirname, "..", "server.js");
  const installedSkillPath = path.join(__dirname, "server.js");

  try {
    require.resolve(repoPath);
    return repoPath;
  } catch {
    return installedSkillPath;
  }
}

function getOpenClawConfigPath() {
  return process.env.OPENCLAW_CONFIG_PATH || path.join(os.homedir(), ".openclaw", "openclaw.json");
}

function loadOpenClawSettings() {
  const configPath = getOpenClawConfigPath();

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    const parsed = JSON.parse(raw);
    const entries =
      parsed &&
      parsed.skills &&
      parsed.skills.entries &&
      typeof parsed.skills.entries === "object"
        ? parsed.skills.entries
        : {};
    const skillSettings =
      entries["finance-mcp"] && typeof entries["finance-mcp"] === "object"
        ? entries["finance-mcp"]
        : {};
    return skillSettings;
  } catch {
    return {};
  }
}

function applyRuntimeDefaults(settings) {
  if (!process.env.FINANCE_MCP_HTTP_TIMEOUT_MS && Number.isFinite(settings.httpTimeoutMs)) {
    process.env.FINANCE_MCP_HTTP_TIMEOUT_MS = String(settings.httpTimeoutMs);
  }

  if (!process.env.FINANCE_MCP_CACHE_TTL_MS && Number.isFinite(settings.cacheTtlMs)) {
    process.env.FINANCE_MCP_CACHE_TTL_MS = String(settings.cacheTtlMs);
  }
}

async function buildQuickSnapshot() {
  const stockSymbols = getDefaultStockSymbols();
  const coinbasePair = getDefaultCoinbasePair();
  const polymarketQuery = getDefaultPolymarketQuery();
  const polymarketLimit = getDefaultPolymarketLimit();

  const [stocks, coinbase, polymarket] = await Promise.all([
    getStockQuotesBatch({ symbols: stockSymbols }),
    getCoinbasePairPrices({ pair: coinbasePair }),
    searchPolymarketMarkets({
      query: polymarketQuery,
      limit: polymarketLimit,
      closed: false,
    }),
  ]);

  return {
    source: "finance-openclaw-quick",
    defaultsUsed: {
      stockSymbols,
      coinbasePair,
      polymarketQuery,
      polymarketLimit,
    },
    stocks,
    coinbase,
    polymarket,
  };
}

function getDefaultStockSymbols() {
  const configured = Array.isArray(openClawSettings.defaultStockSymbols)
    ? openClawSettings.defaultStockSymbols
    : [];
  const normalized = configured
    .filter((value) => typeof value === "string" && value.trim())
    .map((value) => value.trim().toUpperCase());

  return normalized.length > 0 ? normalized : ["AAPL", "MSFT", "SPY"];
}

function getDefaultCoinbasePair() {
  const value =
    typeof openClawSettings.defaultCoinbasePair === "string"
      ? openClawSettings.defaultCoinbasePair.trim().toUpperCase()
      : "";
  return value || "BTC-USD";
}

function getDefaultPolymarketQuery() {
  const value =
    typeof openClawSettings.defaultPolymarketQuery === "string"
      ? openClawSettings.defaultPolymarketQuery.trim()
      : "";
  return value || "bitcoin";
}

function getDefaultPolymarketSlug() {
  const value =
    typeof openClawSettings.defaultPolymarketSlug === "string"
      ? openClawSettings.defaultPolymarketSlug.trim()
      : "";
  return value;
}

function getDefaultPolymarketLimit() {
  return clampInteger(openClawSettings.defaultPolymarketLimit, 3, 1, 20);
}

function normalizeSettingsForOutput(settings) {
  return {
    defaultStockSymbols: getDefaultStockSymbols(),
    defaultCoinbasePair: getDefaultCoinbasePair(),
    defaultPolymarketQuery: getDefaultPolymarketQuery(),
    defaultPolymarketSlug: getDefaultPolymarketSlug() || null,
    defaultPolymarketLimit: getDefaultPolymarketLimit(),
    httpTimeoutMs: Number.isFinite(settings.httpTimeoutMs)
      ? settings.httpTimeoutMs
      : null,
    cacheTtlMs: Number.isFinite(settings.cacheTtlMs) ? settings.cacheTtlMs : null,
  };
}

function parseArgs(args) {
  const options = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];

    if (token === "--help" || token === "-h") {
      options.help = true;
      continue;
    }

    if (token === "--json") {
      options.json = true;
      continue;
    }

    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = args[index + 1];
    if (next && !next.startsWith("--")) {
      options[key] = next;
      index += 1;
    } else {
      options[key] = true;
    }
  }

  return options;
}

function readOptionalOption(options, key) {
  const value = options[key];
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }
  return value.trim();
}

function readOptionalCsvOption(options, key) {
  const raw = readOptionalOption(options, key);
  if (!raw) {
    return null;
  }

  const items = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : null;
}

function readOptionalInteger(options, key) {
  const value = readOptionalOption(options, key);
  if (!value) {
    return undefined;
  }

  const numeric = Number.parseInt(value, 10);
  if (!Number.isFinite(numeric)) {
    throw new Error(`Expected an integer for --${key}`);
  }

  return numeric;
}

function clampInteger(value, fallback, min, max) {
  const numeric = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }
  return Math.min(Math.max(numeric, min), max);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
