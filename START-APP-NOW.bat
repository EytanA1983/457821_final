@echo off
chcp 65001 >nul
echo ================================================
echo   🚀 Starting Home Organization App
echo ================================================
echo.

REM Navigate to project root
cd /d "%~dp0"

echo 📂 Project directory: %CD%
echo.

REM Check if Python is available
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Python not found! Please install Python 3.12+
    pause
    exit /b 1
)

REM Check if Node is available
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ❌ Node.js not found! Please install Node.js
    pause
    exit /b 1
)

echo.
echo Step 1: Starting Backend Server (Port 8000)...
echo.
start "Backend Server" cmd /k "cd backend && python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
timeout /t 3 >nul

echo.
echo Step 2: Starting Frontend Server (Port 5178)...
echo.
start "Frontend Server" cmd /k "cd frontend && npm run dev"
timeout /t 2 >nul

echo.
echo ================================================
echo   ✅ Servers Started!
echo ================================================
echo.
echo 🔧 Backend API:  http://127.0.0.1:8000
echo    Swagger Docs: http://127.0.0.1:8000/docs
echo    Health Check: http://127.0.0.1:8000/health
echo.
echo 🎨 Frontend:     http://localhost:5178 (configured in vite.config.ts)
echo.
echo 📝 Note: Two command windows opened
echo    - Backend: Port 8000
echo    - Frontend: Port 5178
echo    - Close them to stop the servers
echo.
echo Opening browser in 5 seconds...
timeout /t 5 >nul
start http://localhost:5178

pause
