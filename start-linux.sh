#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required but was not found in PATH." >&2
  exit 1
fi

if [ ! -f "$SCRIPT_DIR/node_modules/@modelcontextprotocol/sdk/package.json" ]; then
  if [ ! -f "$SCRIPT_DIR/package.json" ]; then
    echo "package.json is missing, so dependencies cannot be installed automatically." >&2
    exit 1
  fi

  if [ -z "${FINANCE_MCP_SILENT:-}" ]; then
    echo "[finance-mcp] Installing local npm dependencies..." >&2
  fi

  (
    cd "$SCRIPT_DIR"
    npm install --no-fund --no-audit
  )
fi

exec node "$SCRIPT_DIR/server.js"
