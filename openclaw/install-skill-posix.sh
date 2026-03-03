#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${HOME}/.openclaw/skills/finance-mcp"

mkdir -p "$TARGET"
cp "$SCRIPT_DIR/skill/SKILL.md" "$TARGET/SKILL.md"
cp "$SCRIPT_DIR/finance-tools.js" "$TARGET/finance-tools.js"
cp "$SCRIPT_DIR/../finance-core.js" "$TARGET/finance-core.js"
cp "$SCRIPT_DIR/../server.js" "$TARGET/server.js"
cp "$SCRIPT_DIR/../package.json" "$TARGET/package.json"
cp "$SCRIPT_DIR/../package-lock.json" "$TARGET/package-lock.json"
cp "$SCRIPT_DIR/../start-windows.cmd" "$TARGET/start-windows.cmd"
cp "$SCRIPT_DIR/../start-linux.sh" "$TARGET/start-linux.sh"
cp "$SCRIPT_DIR/../start-macos.sh" "$TARGET/start-macos.sh"
cp "$SCRIPT_DIR/openclaw-config-snippet.json" "$TARGET/openclaw-config-snippet.json"

echo "Installed OpenClaw skill to $TARGET"
