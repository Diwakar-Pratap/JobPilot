@echo off
echo ============================================================
echo   JobPilot - Headless Mode (No Browser Window)
echo ============================================================
echo.

:: ── Step 1: Kill ALL stale processes ────────────────────────
echo [1/4] Cleaning up stale processes...

:: Kill old Node/frontend processes
taskkill /F /IM node.exe /T >nul 2>&1

:: Kill old Python/backend processes running uvicorn or scraper daemons
for /f "tokens=2" %%P in ('tasklist /FI "IMAGENAME eq python.exe" /NH 2^>nul ^| findstr /i "python"') do (
    taskkill /F /PID %%P >nul 2>&1
)

:: Remove Next.js dev lock file so port 3000 is always used
if exist "%~dp0frontend\.next\dev\server.lock" del /F /Q "%~dp0frontend\.next\dev\server.lock"
if exist "%~dp0frontend\.next\dev\logs\next-development.log" del /F /Q "%~dp0frontend\.next\dev\logs\next-development.log"

:: Small pause to let ports free
timeout /t 2 /nobreak >nul
echo    Done.

:: ── Step 2: Start Backend ────────────────────────────────────
echo [2/4] Starting FastAPI Backend (headless)...
start "JobPilot Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"
timeout /t 4 /nobreak >nul

:: ── Step 3: Start WhatsApp Service ──────────────────────────
echo [3/4] Starting WhatsApp Bot Service...
start "JobPilot WhatsApp" cmd /k "cd /d %~dp0backend\whatsapp_service && npm install --silent && npm start"
timeout /t 3 /nobreak >nul

:: ── Step 4: Start Frontend ───────────────────────────────────
echo [4/4] Starting Next.js Frontend...
start "JobPilot Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"
timeout /t 4 /nobreak >nul

echo.
echo ============================================================
echo   JobPilot is running in HEADLESS mode!
echo ============================================================
echo.
echo   Frontend : http://localhost:3000
echo   Backend  : http://localhost:8000
echo   API Docs : http://localhost:8000/docs
echo.
echo   NOTE: Scrapers run silently in the background.
echo         No Chrome window will open automatically.
echo         Use the Jobs page to manually trigger scrapers.
echo.
echo   Press any key to open the dashboard in browser...
pause >nul
start http://localhost:3000/dashboard
