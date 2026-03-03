@echo off
setlocal

set "TARGET=%USERPROFILE%\.openclaw\skills\finance-mcp"
if not exist "%TARGET%" mkdir "%TARGET%"

copy /Y "%~dp0skill\SKILL.md" "%TARGET%\SKILL.md" >nul
copy /Y "%~dp0finance-tools.js" "%TARGET%\finance-tools.js" >nul
copy /Y "%~dp0..\server.js" "%TARGET%\server.js" >nul
copy /Y "%~dp0..\start-windows.cmd" "%TARGET%\start-windows.cmd" >nul
copy /Y "%~dp0..\start-linux.sh" "%TARGET%\start-linux.sh" >nul
copy /Y "%~dp0..\start-macos.sh" "%TARGET%\start-macos.sh" >nul
copy /Y "%~dp0openclaw-config-snippet.json" "%TARGET%\openclaw-config-snippet.json" >nul

echo Installed OpenClaw skill to %TARGET%
