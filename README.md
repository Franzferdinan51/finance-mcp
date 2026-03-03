# Finance MCP Server

Standalone read-only MCP server for:

- stock quotes
- Coinbase spot prices
- Polymarket market search

This server is dependency-free and only needs Node.js 18+.

## Files

- `server.js`: MCP stdio server
- `start-windows.cmd`: Windows launcher
- `start-linux.sh`: Linux launcher
- `start-macos.sh`: macOS launcher

## Exposed Tools

- `get_stock_quote`
  - input: `{ "symbol": "AAPL" }`
- `get_coinbase_spot_price`
  - input: `{ "pair": "BTC-USD" }`
- `search_polymarket_markets`
  - input: `{ "query": "fed", "limit": 5, "closed": false }`

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
- Coinbase uses the public spot price endpoint.
- Polymarket uses the public gamma API.
- This is read-only. It does not place trades or authenticate to any exchange.
- On Linux or macOS, run `chmod +x start-linux.sh start-macos.sh` after copying the folder if the scripts are not executable.
