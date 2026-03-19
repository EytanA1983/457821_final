# PowerShell script to start backend and frontend servers

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Starting Backend and Frontend" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get the project root directory
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $projectRoot) {
    $projectRoot = Get-Location
}

# Check if we're in the right directory
if (-not (Test-Path (Join-Path $projectRoot "backend"))) {
    Write-Host "❌ ERROR: Cannot find 'backend' directory!" -ForegroundColor Red
    Write-Host "   Current directory: $projectRoot" -ForegroundColor Gray
    Write-Host "   Please run this script from the project root" -ForegroundColor Gray
    exit 1
}

# Start Backend
Write-Host "Starting Backend (http://localhost:8000)..." -ForegroundColor Cyan
$backendPath = Join-Path $projectRoot "backend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$backendPath'; Write-Host 'Starting Backend Server...' -ForegroundColor Green; python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
Start-Sleep -Seconds 2

# Start Frontend
Write-Host "Starting Frontend (http://localhost:5179)..." -ForegroundColor Cyan
$frontendPath = Join-Path $projectRoot "frontend"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$frontendPath'; Write-Host 'Starting Frontend Server...' -ForegroundColor Green; npm run dev"
Start-Sleep -Seconds 2

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Servers Starting!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "Frontend: http://localhost:5179" -ForegroundColor White
Write-Host ""
Write-Host "Check the new PowerShell windows for logs." -ForegroundColor Yellow
Write-Host ""
Write-Host "To verify servers are running:" -ForegroundColor Yellow
Write-Host "  curl.exe http://localhost:8000/health" -ForegroundColor Gray
Write-Host "  curl.exe http://localhost:5179" -ForegroundColor Gray
Write-Host ""
