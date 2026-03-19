@echo off
echo ========================================
echo   Starting Home Organization App
echo ========================================
echo.

echo Step 1: Starting Docker services...
docker compose up -d db redis
if %ERRORLEVEL% NEQ 0 (
    echo Failed to start db/redis
    pause
    exit /b 1
)

echo.
echo Step 2: Waiting for database to be ready...
timeout /t 5 /nobreak >nul

echo.
echo Step 3: Starting backend...
docker compose up -d backend
if %ERRORLEVEL% NEQ 0 (
    echo Failed to start backend
    pause
    exit /b 1
)

echo.
echo Step 4: Starting frontend...
echo Note: Frontend should be started manually with: cd frontend ^&^& npm run dev
echo.

echo ========================================
echo   Services Status:
echo ========================================
docker compose ps

echo.
echo ========================================
echo   URLs:
echo ========================================
echo Backend API:  http://localhost:8000
echo Backend Docs: http://localhost:8000/docs
echo Frontend:     http://localhost:5178
echo.
echo To view logs:
echo   docker compose logs -f backend
echo.
echo To start frontend manually:
echo   cd frontend
echo   npm run dev
echo.

pause
