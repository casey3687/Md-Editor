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

if not exist "src-tauri\tauri.conf.json" (
  echo [ERROR] src-tauri\tauri.conf.json not found in "%cd%".
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

echo [INFO] Building Markdown Editor release installer...
call cargo tauri build --bundles nsis
if errorlevel 1 (
  echo [ERROR] Release packaging failed.
  pause
  exit /b 1
)

echo.
echo [OK] Release packaging finished.
echo [EXE] "%cd%\src-tauri\target\release\md-editor.exe"
echo [INSTALLER] "%cd%\src-tauri\target\release\bundle\nsis\Markdown Editor_0.1.0_x64-setup.exe"
echo.
exit /b 0
