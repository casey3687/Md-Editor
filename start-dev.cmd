@echo off
setlocal

cd /d "%~dp0"
set "CHECK_ONLY=0"
if /i "%~1"=="--check" set "CHECK_ONLY=1"

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [ERROR] npm.cmd not found in PATH.
  echo Install Node.js first, then retry.
  pause
  exit /b 1
)

where cargo.exe >nul 2>nul
if errorlevel 1 (
  echo [ERROR] cargo.exe not found in PATH.
  echo Install Rust first, then retry.
  pause
  exit /b 1
)

cargo tauri --version >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Tauri CLI not found for cargo.
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
  echo [INFO] node_modules not found, running npm install...
  call npm.cmd install
  if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
  )
)

if "%CHECK_ONLY%"=="1" (
  echo [OK] Environment check passed.
  exit /b 0
)

start "MD Editor Frontend" /D "%~dp0" cmd /k "npm.cmd run dev"
start "MD Editor Tauri" /D "%~dp0" cmd /k "timeout /t 3 >nul && npm.cmd run tauri dev"

echo [OK] Frontend and Tauri windows have been started.
exit /b 0
