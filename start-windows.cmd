@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required but was not found in PATH. 1>&2
  exit /b 1
)

node "%~dp0server.js"
