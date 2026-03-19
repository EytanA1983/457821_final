@echo off
echo Building Docker containers...
docker compose build backend
if %ERRORLEVEL% EQU 0 (
    echo Backend built successfully!
    docker compose build worker
    if %ERRORLEVEL% EQU 0 (
        echo Worker built successfully!
        docker compose build beat
        if %ERRORLEVEL% EQU 0 (
            echo Beat built successfully!
            echo.
            echo All containers built successfully!
            echo.
            echo To start them, run:
            echo   docker compose up -d backend worker beat
        ) else (
            echo Failed to build beat
        )
    ) else (
        echo Failed to build worker
    )
) else (
    echo Failed to build backend
    echo.
    echo Trying with 'docker compose' (without hyphen)...
    docker compose build backend
)
