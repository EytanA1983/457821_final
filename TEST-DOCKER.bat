@echo off
echo Testing Docker Compose...
echo.

echo Checking docker-compose version...
docker-compose --version
if %ERRORLEVEL% NEQ 0 (
    echo docker-compose failed, trying docker compose...
    docker compose version
)

echo.
echo Testing docker-compose config...
docker-compose config >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo docker-compose config: SUCCESS
) else (
    echo docker-compose config: FAILED
    echo Trying docker compose config...
    docker compose config >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo docker compose config: SUCCESS
    ) else (
        echo docker compose config: FAILED
    )
)

echo.
echo Testing build command...
docker-compose build backend >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo docker-compose build: SUCCESS
) else (
    echo docker-compose build: FAILED - trying docker compose...
    docker compose build backend >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo docker compose build: SUCCESS
    ) else (
        echo docker compose build: FAILED
    )
)

echo.
echo Done!
