# Finance MCP Server

Standalone read-only MCP server for:

- stock quotes
- batch stock quotes
- Coinbase spot, buy, and sell prices
- Polymarket market search
- direct Polymarket market lookup by id or slug

This server is dependency-free and only needs Node.js 18+.

## Files

- `server.js`: MCP stdio server
- `start-windows.cmd`: Windows launcher
- `start-linux.sh`: Linux launcher
- `start-macos.sh`: macOS launcher
- `package.json`: metadata and `npm start`

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

## Start The Server

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

## LM Studio mcp.json Example

Windows:

```json
{
  "mcpServers": {
    "finance": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": [
        "C:\\Users\\franz\\OneDrive\\Desktop\\finance-mcp-server\\server.js"
      ],
      "env": {
        "FINANCE_MCP_HTTP_TIMEOUT_MS": "20000",
        "FINANCE_MCP_CACHE_TTL_MS": "10000"
      ]
    }
  }
}
```

Linux:

```json
{
  "mcpServers": {
    "finance": {
      "command": "/absolute/path/to/finance-mcp-server/start-linux.sh",
      "env": {
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
  - Increase upstream API timeout for slower responses
  - good starting value: `20000`
- `FINANCE_MCP_CACHE_TTL_MS`
  - Cache repeated requests briefly so tool calls stay responsive
  - good starting value: `10000`

These are set through the `env` block in the `finance` MCP entry.

## OpenClaw Compatibility

This repo includes an OpenClaw-friendly CLI bridge so OpenClaw can use the same finance tools without depending on MCP host support.

Files:

- `openclaw/finance-tools.js`
- `openclaw/skill/SKILL.md`
- `openclaw/install-skill-windows.cmd`
- `openclaw/install-skill-posix.sh`

### OpenClaw CLI Examples

```bash
node openclaw/finance-tools.js stock-quote --symbol AAPL
node openclaw/finance-tools.js stock-batch --symbols AAPL,MSFT,SPY
node openclaw/finance-tools.js coinbase-pair --pair BTC-USD
node openclaw/finance-tools.js polymarket-search --query bitcoin --limit 5
node openclaw/finance-tools.js polymarket-market --slug bitboy-convicted
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
The install script copies `SKILL.md`, `finance-tools.js`, and `server.js` so the skill works as a self-contained local tool bridge.

## Notes

- Stock quotes use Yahoo Finance chart data.
- Coinbase uses the public price endpoints for spot, buy, and sell prices.
- Polymarket uses the public gamma API.
- The server keeps a short in-memory cache to reduce repeated upstream requests.
- This is read-only. It does not place trades or authenticate to any exchange.
- LM Studio expects `mcp.json` to be strict JSON. Do not leave `//` comments or trailing commas in the file.
- On Windows, direct `node.exe` launch is more reliable in LM Studio than wrapping the server with `cmd /c`.
- After editing `C:\Users\franz\.lmstudio\mcp.json`, fully restart LM Studio so it reloads the MCP server list.
- OpenClaw compatibility is provided through the included CLI bridge and skill files, so the same finance actions are available even outside MCP hosts.
- On Linux or macOS, run `chmod +x start-linux.sh start-macos.sh` after copying the folder if the scripts are not executable.
