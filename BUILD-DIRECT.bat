@echo off
echo Building directly without config check...
echo.

cd backend
docker build -t eli-maor-backend .
if %ERRORLEVEL% EQU 0 (
    echo Backend built successfully!
    cd ..
    echo.
    echo To use with docker-compose, you can now run:
    echo   docker compose up -d
) else (
    echo Failed to build backend
    cd ..
)
