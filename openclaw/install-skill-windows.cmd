@echo off
setlocal

set "TARGET=%USERPROFILE%\.openclaw\skills\finance-mcp"
if not exist "%TARGET%" mkdir "%TARGET%"

copy /Y "%~dp0skill\SKILL.md" "%TARGET%\SKILL.md" >nul
copy /Y "%~dp0finance-tools.js" "%TARGET%\finance-tools.js" >nul
copy /Y "%~dp0..\server.js" "%TARGET%\server.js" >nul

echo Installed OpenClaw skill to %TARGET%
