@echo off
cd /d "%~dp0"
docker compose build backend worker beat
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ Build completed successfully!
    echo.
    docker compose up -d backend worker beat
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo ✅ Services started successfully!
        echo.
        echo To view logs, run:
        echo   docker compose logs -f worker beat
    ) else (
        echo.
        echo ❌ Failed to start services
    )
) else (
    echo.
    echo ❌ Build failed
)
