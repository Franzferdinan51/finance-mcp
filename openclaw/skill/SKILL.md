# Finance Tools For OpenClaw

Use this skill when the user wants stock quotes, Coinbase prices, or Polymarket market data inside OpenClaw.

Fastest path:

- `node finance-tools.js quick`

## What This Skill Uses

- `finance-tools.js`
- `server.js`

## Commands

From the repo root:

```bash
node openclaw/finance-tools.js quick
node openclaw/finance-tools.js stock-quote --symbol AAPL
node openclaw/finance-tools.js stock-batch --symbols AAPL,MSFT,SPY
node openclaw/finance-tools.js coinbase-spot --pair BTC-USD
node openclaw/finance-tools.js coinbase-pair --pair BTC-USD
node openclaw/finance-tools.js polymarket-search --query bitcoin --limit 5
node openclaw/finance-tools.js polymarket-market --slug bitboy-convicted
node openclaw/finance-tools.js config
```

After installing the sample skill into OpenClaw, the same commands can be run inside the skill folder with:

```bash
node finance-tools.js quick
node finance-tools.js stock-quote --symbol AAPL
```

## Notes

- Output is JSON.
- The same upstream APIs and env settings are shared with the MCP server.
- Defaults are read from `~/.openclaw/openclaw.json` under `skills.entries["finance-mcp"]`.
- Supported env vars:
  - `FINANCE_MCP_HTTP_TIMEOUT_MS`
  - `FINANCE_MCP_CACHE_TTL_MS`
