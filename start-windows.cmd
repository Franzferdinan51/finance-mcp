@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required but was not found in PATH. 1>&2
  exit /b 1
)

if "%FINANCE_MCP_SILENT%"=="" (
  echo [finance-mcp] Starting stdio server. This console will stay mostly idle until an MCP host connects. 1>&2
)

node "%~dp0server.js"
