@echo off
setlocal
cd /d "%~dp0"

set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not exist "%NODE_EXE%" set "NODE_EXE="

if not defined NODE_EXE (
  where node >nul 2>nul
  if errorlevel 1 (
    echo Node.js is required but was not found in PATH. 1>&2
    exit /b 1
  )
)

if not exist "%~dp0node_modules\@modelcontextprotocol\sdk\package.json" (
  if not exist "%~dp0package.json" (
    echo package.json is missing, so dependencies cannot be installed automatically. 1>&2
    exit /b 1
  )

  if "%FINANCE_MCP_SILENT%"=="" (
    echo [finance-mcp] Installing local npm dependencies... 1>&2
  )

  if exist "%ProgramFiles%\nodejs\npm.cmd" (
    call "%ProgramFiles%\nodejs\npm.cmd" install --no-fund --no-audit
  ) else (
    call npm install --no-fund --no-audit
  )

  if errorlevel 1 exit /b 1
)

if "%FINANCE_MCP_SILENT%"=="" (
  echo [finance-mcp] Starting stdio server. This console will stay mostly idle until an MCP host connects. 1>&2
)

if defined NODE_EXE (
  "%NODE_EXE%" "%~dp0server.js"
) else (
  node "%~dp0server.js"
)
