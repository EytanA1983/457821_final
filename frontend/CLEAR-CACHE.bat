@echo off
echo Clearing Vite cache...
cd /d "%~dp0"
if exist "node_modules\.vite" (
    rmdir /s /q "node_modules\.vite"
    echo Vite cache cleared!
) else (
    echo No Vite cache found.
)
echo.
echo Done! Now restart the dev server with: npm run dev
