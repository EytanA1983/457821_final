@echo off
REM Batch script to run backend server with full debug logging
echo ======================================================================
echo   Starting Backend Server with Full Debug Logging
echo ======================================================================
echo.

REM Check if .env exists
if not exist .env (
    echo WARNING: .env file not found!
    echo    Create backend/.env with SECRET_KEY and DATABASE_URL
    echo.
)

REM Check if we're in the backend directory
if not exist app (
    echo ERROR: Not in backend directory!
    echo    Run this script from the backend directory
    exit /b 1
)

echo Configuration:
echo   - Reload: Enabled (auto-reload on code changes)
echo   - Debug: Enabled (full traceback on errors)
echo   - Log Level: DEBUG (all logs including SQL queries)
echo   - Host: 0.0.0.0 (accessible from all interfaces)
echo   - Port: 8000
echo.
echo IMPORTANT: Watch the console for full traceback on 500 errors!
echo    All errors will show:
echo    - Date and time
echo    - File path and line number
echo    - Full stack trace
echo    - Object details
echo.
echo ======================================================================
echo.

REM Run the server
python run-server-debug.py
