@echo off
echo ============================================================
echo   JobPilot - Starting All Services
echo ============================================================
echo.

:: ── Step 1: Kill stale processes ────────────────────────────
echo [1/4] Cleaning up stale processes...
taskkill /F /IM node.exe /T >nul 2>&1
for /f "tokens=2" %%P in ('tasklist /FI "IMAGENAME eq python.exe" /NH 2^>nul ^| findstr /i "python"') do (
    taskkill /F /PID %%P >nul 2>&1
)
if exist "%~dp0frontend\.next\dev\server.lock" del /F /Q "%~dp0frontend\.next\dev\server.lock"
if exist "%~dp0frontend\.next\dev\logs\next-development.log" del /F /Q "%~dp0frontend\.next\dev\logs\next-development.log"
timeout /t 2 /nobreak >nul
echo    Done.


:: ── Step 2: Backend ─────────────────────────────────────────
echo [2/4] Starting FastAPI Backend...
start "JobPilot Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"
timeout /t 4 /nobreak >nul

:: ── Step 3: WhatsApp Bot ─────────────────────────────────────
echo [3/4] Starting WhatsApp Bot Service...
start "JobPilot WhatsApp Service" cmd /k "cd /d %~dp0backend\whatsapp_service && npm install --silent && npm start"
timeout /t 5 /nobreak >nul

:: ── Step 4: Frontend ─────────────────────────────────────────
echo [4/4] Starting Next.js Frontend...
start "JobPilot Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ============================================================
echo   JobPilot is starting up!
echo ============================================================
echo.
echo   Frontend : http://localhost:3000
echo   Backend  : http://localhost:8000
echo   API Docs : http://localhost:8000/docs
echo.
echo   Press any key to open in browser...
pause >nul
start http://localhost:3000
