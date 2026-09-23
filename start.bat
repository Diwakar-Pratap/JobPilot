@echo off
echo Starting JobPilot...
start "JobPilot Backend" cmd /k "cd /d C:\Users\Diwakar\Desktop\Python\JobPilot\backend && python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"
timeout /t 3 /nobreak >nul
start "JobPilot Frontend" cmd /k "cd /d C:\Users\Diwakar\Desktop\Python\JobPilot\frontend && npm run dev"
echo.
echo Both servers are starting!
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:3000
echo.
pause
