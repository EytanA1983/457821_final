@echo off
echo Getting detailed error message...
echo.

echo Trying docker-compose config with full output:
docker-compose config 2>&1
echo.
echo Error code: %ERRORLEVEL%
echo.

echo Trying docker compose config with full output:
docker compose config 2>&1
echo.
echo Error code: %ERRORLEVEL%
