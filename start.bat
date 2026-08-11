@echo off
echo ========================================
echo   JobPilot - Starting All Services
echo ========================================
echo.

:: Start Docker services
echo [1/4] Starting PostgreSQL + Redis (Docker)...
docker-compose up -d
timeout /t 3 /nobreak >nul

:: Start Backend
echo [2/4] Starting FastAPI Backend...
start "JobPilot Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"
timeout /t 3 /nobreak >nul

:: Start WhatsApp Bot Service
echo [3/4] Starting WhatsApp Bot Service...
start "JobPilot WhatsApp Service" cmd /k "cd /d %~dp0backend\whatsapp_service && npm install && npm start"
timeout /t 5 /nobreak >nul

:: Start Frontend
echo [4/4] Starting Next.js Frontend...
start "JobPilot Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ========================================
echo   JobPilot is starting up!
echo ========================================
echo.
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:8000
echo   API Docs: http://localhost:8000/docs
echo.
echo   Press any key to open in browser...
pause >nul
start http://localhost:3000
