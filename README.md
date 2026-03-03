# Finance MCP Server

Standalone read-only MCP server for:

- stock quotes
- batch stock quotes
- Coinbase spot, buy, and sell prices
- Polymarket market search
- direct Polymarket market lookup by id or slug

This server uses the official Node MCP SDK and needs Node.js 18+.
Run `npm install` once in the folder, or use the included start scripts and they will bootstrap dependencies automatically.

## Files

- `finance-core.js`: shared read-only finance logic used by both MCP and OpenClaw
- `server.js`: MCP stdio server built on the official MCP SDK
- `start-windows.cmd`: Windows launcher
- `start-linux.sh`: Linux launcher
- `start-macos.sh`: macOS launcher
- `mcp.json`: portable LM Studio example config
- `package.json`: metadata and runtime dependencies
- `package-lock.json`: pinned dependency versions for consistent installs
- `openclaw/`: OpenClaw CLI bridge, install scripts, and config snippet

## Exposed Tools

- `get_stock_quote`
  - input: `{ "symbol": "AAPL" }`
- `get_stock_quotes_batch`
  - input: `{ "symbols": ["AAPL", "MSFT", "SPY"] }`
- `get_coinbase_spot_price`
  - input: `{ "pair": "BTC-USD" }`
- `get_coinbase_pair_prices`
  - input: `{ "pair": "BTC-USD" }`
- `search_polymarket_markets`
  - input: `{ "query": "fed", "limit": 5, "closed": false }`
- `get_polymarket_market`
  - input: `{ "marketId": "531202" }` or `{ "slug": "bitboy-convicted" }`

## Runtime Controls

Optional environment variables:

- `FINANCE_MCP_HTTP_TIMEOUT_MS`
  - HTTP timeout in milliseconds
  - default: `15000`
  - clamp: `1000` to `60000`
- `FINANCE_MCP_CACHE_TTL_MS`
  - in-memory response cache TTL in milliseconds
  - default: `5000`
  - set to `0` to disable caching
  - clamp: `0` to `300000`
- `FINANCE_MCP_SILENT`
  - suppress the startup banner in tool-host logs
  - recommended for LM Studio: `1`

## Start The Server

Install dependencies first:

```bash
npm install
```

Directly with Node:

```bash
node server.js
```

With npm:

```bash
npm start
```

With the included launchers:

- Windows: `start-windows.cmd`
- Linux: `./start-linux.sh`
- macOS: `./start-macos.sh`

The launchers check for local dependencies and run `npm install --no-fund --no-audit` automatically if needed.

### Windows launcher behavior

`start-windows.cmd` starts a stdio MCP server. If you run it manually, it will stay open and look mostly idle until LM Studio or another MCP host connects.

That is expected. It is waiting for MCP traffic, not serving an HTTP page.

## LM Studio Compatibility

LM Studio's MCP bridge expects newline-delimited JSON over stdio, which is the transport used by the official Node MCP SDK.
This repo now uses that same SDK transport, which is why it connects cleanly in LM Studio.

## LM Studio mcp.json Example

Windows:

```json
{
  "mcpServers": {
    "finance": {
      "command": "C:\\path\\to\\node.exe",
      "args": [
        "C:\\path\\to\\finance-mcp-server\\server.js"
      ],
      "env": {
        "FINANCE_MCP_SILENT": "1",
        "FINANCE_MCP_HTTP_TIMEOUT_MS": "20000",
        "FINANCE_MCP_CACHE_TTL_MS": "10000"
      }
    }
  }
}
```

Replace both Windows paths with your actual `node.exe` location and your local `finance-mcp-server\\server.js` path.

Linux:

```json
{
  "mcpServers": {
    "finance": {
      "command": "/absolute/path/to/finance-mcp-server/start-linux.sh",
      "env": {
        "FINANCE_MCP_SILENT": "1",
        "FINANCE_MCP_HTTP_TIMEOUT_MS": "20000",
        "FINANCE_MCP_CACHE_TTL_MS": "10000"
      }
    }
  }
}
```

macOS:

```json
{
  "mcpServers": {
    "finance": {
      "command": "/absolute/path/to/finance-mcp-server/start-macos.sh",
      "env": {
        "FINANCE_MCP_SILENT": "1",
        "FINANCE_MCP_HTTP_TIMEOUT_MS": "20000",
        "FINANCE_MCP_CACHE_TTL_MS": "10000"
      }
    }
  }
}
```

## LM Studio Custom Settings

Recommended settings for LM Studio:

- `FINANCE_MCP_HTTP_TIMEOUT_MS`
  - increase upstream API timeout for slower responses
  - good starting value: `20000`
- `FINANCE_MCP_CACHE_TTL_MS`
  - cache repeated requests briefly so tool calls stay responsive
  - good starting value: `10000`
- `FINANCE_MCP_SILENT`
  - suppress the startup banner in LM Studio plugin logs
  - recommended value: `1`

These are set through the `env` block in the `finance` MCP entry.

## OpenClaw Compatibility

This repo includes an OpenClaw-friendly CLI bridge so OpenClaw can use the same finance tools without depending on MCP host support.
The fastest no-setup usage path after install is:

```bash
node finance-tools.js quick
```

From the repo itself, you can also run:

```bash
npm run openclaw:quick
```

Files:

- `openclaw/finance-tools.js`
- `openclaw/skill/SKILL.md`
- `openclaw/install-skill-windows.cmd`
- `openclaw/install-skill-posix.sh`
- `openclaw/openclaw-config-snippet.json`

### OpenClaw CLI Examples

```bash
node openclaw/finance-tools.js quick
node openclaw/finance-tools.js stock-quote --symbol AAPL
node openclaw/finance-tools.js stock-batch --symbols AAPL,MSFT,SPY
node openclaw/finance-tools.js coinbase-pair --pair BTC-USD
node openclaw/finance-tools.js polymarket-search --query bitcoin --limit 5
node openclaw/finance-tools.js polymarket-market --slug bitboy-convicted
node openclaw/finance-tools.js config
```

### OpenClaw Skill Install

Windows:

```bat
openclaw\install-skill-windows.cmd
```

Linux or macOS:

```bash
./openclaw/install-skill-posix.sh
```

This installs the sample skill to `~/.openclaw/skills/finance-mcp`.
The install script copies `SKILL.md`, `finance-tools.js`, `finance-core.js`, `server.js`, the start scripts, and the npm metadata so the skill folder can run the MCP server locally if needed.

### OpenClaw Config Defaults

To make the tool easy for OpenClaw agents to use, add defaults in `~/.openclaw/openclaw.json` under `skills.entries["finance-mcp"]`.

Example:

```json
{
  "skills": {
    "entries": {
      "finance-mcp": {
        "defaultStockSymbols": ["AAPL", "MSFT", "SPY"],
        "defaultCoinbasePair": "BTC-USD",
        "defaultPolymarketQuery": "bitcoin",
        "defaultPolymarketSlug": "bitboy-convicted",
        "defaultPolymarketLimit": 3,
        "httpTimeoutMs": 20000,
        "cacheTtlMs": 10000
      }
    }
  }
}
```

Once that is set:

- `node finance-tools.js quick` uses those defaults automatically
- `node finance-tools.js stock-batch` uses `defaultStockSymbols`
- `node finance-tools.js coinbase-pair` uses `defaultCoinbasePair`
- `node finance-tools.js polymarket-search` uses `defaultPolymarketQuery`
- `node finance-tools.js polymarket-market` can fall back to `defaultPolymarketSlug`

## Notes

- Stock quotes use Yahoo Finance chart data.
- Coinbase uses the public price endpoints for spot, buy, and sell prices.
- Polymarket uses the public gamma API.
- The server keeps a short in-memory cache to reduce repeated upstream requests.
- This is read-only. It does not place trades or authenticate to any exchange.
- LM Studio expects `mcp.json` to be strict JSON. Do not leave `//` comments or trailing commas in the file.
- On Windows, direct `node.exe` launch is more reliable in LM Studio than wrapping the server with `cmd /c`.
- If you copy this folder somewhere else, run `npm install` in that folder once before pointing LM Studio at `server.js`, unless you plan to use the included start scripts for first-run bootstrap.
- After editing `C:\Users\franz\.lmstudio\mcp.json`, fully restart LM Studio so it reloads the MCP server list.
- OpenClaw compatibility is provided through the included CLI bridge and skill files, so the same finance actions are available even outside MCP hosts.
- `start-windows.cmd` is a stdio launcher. When started manually, it will stay mostly idle until an MCP host connects.
- On Linux or macOS, run `chmod +x start-linux.sh start-macos.sh` after copying the folder if the scripts are not executable.
