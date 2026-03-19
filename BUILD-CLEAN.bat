@echo off
echo Building Docker containers with --no-cache...
echo.

docker compose build --no-cache backend
if %ERRORLEVEL% EQU 0 (
    echo Backend built successfully!
    docker compose build --no-cache worker
    if %ERRORLEVEL% EQU 0 (
        echo Worker built successfully!
        docker compose build --no-cache beat
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
