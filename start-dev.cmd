@echo off
setlocal

cd /d "%~dp0"

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm.cmd not found in PATH.
  echo Install Node.js first, then retry.
  pause
  exit /b 1
)

where cargo-tauri.exe >nul 2>nul
if errorlevel 1 (
  echo [ERROR] cargo-tauri.exe not found in PATH.
  echo Run "cargo install tauri-cli" first, then retry.
  pause
  exit /b 1
)

if not exist "package.json" (
  echo [ERROR] package.json not found in "%cd%".
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [ERROR] node_modules not found.
  echo Run "npm install" first, then retry.
  pause
  exit /b 1
)

start "MD Editor Frontend" /D "%~dp0" cmd /k npm.cmd run dev
start "MD Editor Tauri" /D "%~dp0" cmd /k cargo tauri dev

echo Frontend and Tauri windows have been started.
exit /b 0
