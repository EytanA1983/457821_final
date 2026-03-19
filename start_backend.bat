@echo off
chcp 65001 >nul
echo Starting backend from correct project directory...
cd /d "%~dp0backend"
echo Working directory: %CD%
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
pause
