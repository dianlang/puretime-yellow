@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 20 or newer: https://nodejs.org/
  pause
  exit /b 1
)
node scripts/build.mjs
if errorlevel 1 (
  pause
  exit /b 1
)
node scripts/serve.mjs
pause
