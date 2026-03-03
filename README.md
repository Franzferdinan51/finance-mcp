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
      "command": "cmd",
      "args": [
        "/c",
        "C:\\Users\\franz\\OneDrive\\Desktop\\finance-mcp-server\\start-windows.cmd"
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
      "command": "/absolute/path/to/finance-mcp-server/start-linux.sh"
    }
  }
}
```

macOS:

```json
{
  "mcpServers": {
    "finance": {
      "command": "/absolute/path/to/finance-mcp-server/start-macos.sh"
    }
  }
}
```

## Notes

- Stock quotes use Yahoo Finance chart data.
- Coinbase uses the public price endpoints for spot, buy, and sell prices.
- Polymarket uses the public gamma API.
- The server keeps a short in-memory cache to reduce repeated upstream requests.
- This is read-only. It does not place trades or authenticate to any exchange.
- On Linux or macOS, run `chmod +x start-linux.sh start-macos.sh` after copying the folder if the scripts are not executable.
