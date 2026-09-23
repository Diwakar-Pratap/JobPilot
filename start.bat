@echo off
echo ========================================
echo   Starting JobPilot - All 3 Services
echo ========================================
echo.

echo [1/3] Starting WhatsApp Bridge (port 8005)...
start "WhatsApp Bridge :8005" cmd /k "cd /d C:\Users\Diwakar\Desktop\Python\JobPilot\backend\whatsapp_service && node index.js"

timeout /t 3 /nobreak >nul

echo [2/3] Starting Backend API (port 8000)...
start "JobPilot Backend :8000" cmd /k "cd /d C:\Users\Diwakar\Desktop\Python\JobPilot\backend && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"

timeout /t 4 /nobreak >nul

echo [3/3] Starting Frontend (port 3000)...
start "JobPilot Frontend :3000" cmd /k "cd /d C:\Users\Diwakar\Desktop\Python\JobPilot\frontend && npm run dev"

echo.
echo ========================================
echo   All services launching!
echo   WhatsApp Bridge : http://localhost:8005
echo   Backend API     : http://localhost:8000
echo   Frontend        : http://localhost:3000
echo ========================================
echo.
echo Wait ~10 seconds then open http://localhost:3000
pause
