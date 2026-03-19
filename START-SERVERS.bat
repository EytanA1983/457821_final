@echo off
chcp 65001 >nul
echo ================================================
echo   🚀 Starting Backend + Frontend Servers
echo ================================================
echo.

REM Navigate to project root
cd /d "C:\Users\maore\git\סידור וארגון הבית - אלי מאור"

echo 📂 Project directory: %CD%
echo.

REM Start Backend in new window
echo ▶️ Starting Backend Server (Port 8000)...
start "Backend Server" cmd /k "cd backend && python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
timeout /t 3 >nul

REM Start Frontend in new window
echo ▶️ Starting Frontend Server (Port 5173)...
start "Frontend Server" cmd /k "cd frontend && npm run dev"
timeout /t 2 >nul

echo.
echo ================================================
echo   ✅ Servers Started!
echo ================================================
echo.
echo 🔧 Backend:  http://127.0.0.1:8000
echo    Swagger:  http://127.0.0.1:8000/docs
echo.
echo 🎨 Frontend: http://localhost:5173
echo.
echo 📝 Note: Two new command windows opened
echo    - Close them to stop the servers
echo.

pause
