@echo off
echo Building with minimal docker-compose file...
echo.

docker compose -f docker-compose.minimal.yml build backend
if %ERRORLEVEL% EQU 0 (
    echo Backend built successfully!
    docker compose -f docker-compose.minimal.yml build worker
    if %ERRORLEVEL% EQU 0 (
        echo Worker built successfully!
        docker compose -f docker-compose.minimal.yml build beat
        if %ERRORLEVEL% EQU 0 (
            echo Beat built successfully!
            echo.
            echo All containers built successfully!
        ) else (
            echo Failed to build beat
        )
    ) else (
        echo Failed to build worker
    )
) else (
    echo Failed to build backend
)
