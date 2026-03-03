#!/usr/bin/env node
"use strict";

const path = require("node:path");

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

Commands:
  stock-quote --symbol AAPL
  stock-batch --symbols AAPL,MSFT,SPY
  coinbase-spot --pair BTC-USD
  coinbase-pair --pair BTC-USD
  polymarket-search --query bitcoin --limit 5 [--closed]
  polymarket-market --market-id 531202
  polymarket-market --slug bitboy-convicted

Options:
  --json      Pretty-print JSON output (default)
  --help      Show this help text
`;

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
    case "stock-quote":
      result = await getStockQuote({
        symbol: readRequiredOption(options, "symbol"),
      });
      break;
    case "stock-batch":
      result = await getStockQuotesBatch({
        symbols: readCsvOption(options, "symbols"),
      });
      break;
    case "coinbase-spot":
      result = await getCoinbaseSpotPrice({
        pair: readRequiredOption(options, "pair"),
      });
      break;
    case "coinbase-pair":
      result = await getCoinbasePairPrices({
        pair: readRequiredOption(options, "pair"),
      });
      break;
    case "polymarket-search":
      result = await searchPolymarketMarkets({
        query: readOptionalOption(options, "query"),
        limit: readOptionalInteger(options, "limit"),
        closed: Boolean(options.closed),
      });
      break;
    case "polymarket-market":
      result = await getPolymarketMarket({
        marketId: readOptionalOption(options, "market-id"),
        slug: readOptionalOption(options, "slug"),
      });
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
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

function readRequiredOption(options, key) {
  const value = readOptionalOption(options, key);
  if (!value) {
    throw new Error(`Missing required option --${key}`);
  }
  return value;
}

function readOptionalOption(options, key) {
  const value = options[key];
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }
  return value.trim();
}

function readCsvOption(options, key) {
  const raw = readRequiredOption(options, key);
  const items = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (items.length === 0) {
    throw new Error(`Expected at least one value in --${key}`);
  }

  return items;
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

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
