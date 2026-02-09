# Clean Start Script - Start both servers from scratch
# This script will:
# 1. Kill any existing Python/Node processes
# 2. Start Backend server
# 3. Start Frontend server

$ErrorActionPreference = "Stop"

Write-Host "=== Clean Start - Stopping existing servers ===" -ForegroundColor Cyan

# Kill existing Python processes (backend)
Write-Host "Stopping existing Python processes..." -ForegroundColor Yellow
Get-Process python -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*Python*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Kill existing Node processes (frontend)
Write-Host "Stopping existing Node processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Get project root
$projectRoot = $PSScriptRoot
$backendPath = Join-Path $projectRoot "backend"
$frontendPath = Join-Path $projectRoot "frontend"

Write-Host "`n=== Starting Backend Server ===" -ForegroundColor Green
Write-Host "Backend path: $backendPath" -ForegroundColor Gray

# Check backend directory
if (-not (Test-Path $backendPath)) {
    Write-Host "ERROR: Backend directory not found!" -ForegroundColor Red
    exit 1
}

# Create .env if missing
Set-Location $backendPath
if (-not (Test-Path ".env")) {
    Write-Host "Creating .env file..." -ForegroundColor Yellow
    $envContent = @"
SECRET_KEY=dev-secret-key-change-in-production-minimum-32-characters-long
DATABASE_URL=sqlite:///./app.db
DEBUG=True
ENVIRONMENT=development
"@
    $envContent | Out-File -FilePath ".env" -Encoding utf8 -NoNewline
    Write-Host "✅ Created .env file" -ForegroundColor Green
}

# Start Backend
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$backendPath'; Write-Host '=== Backend Server (Port 8000) ===' -ForegroundColor Green; Write-Host 'Starting uvicorn...' -ForegroundColor Cyan; Write-Host ''; python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000"
) -WindowStyle Normal

Write-Host "✅ Backend server window opened" -ForegroundColor Green

# Wait for backend to start
Write-Host "`nWaiting 5 seconds for backend to start..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

Write-Host "`n=== Starting Frontend Server ===" -ForegroundColor Green
Write-Host "Frontend path: $frontendPath" -ForegroundColor Gray

# Check frontend directory
if (-not (Test-Path $frontendPath)) {
    Write-Host "ERROR: Frontend directory not found!" -ForegroundColor Red
    exit 1
}

# Start Frontend
Set-Location $frontendPath
Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "cd '$frontendPath'; Write-Host '=== Frontend Server (Port 5178) ===' -ForegroundColor Green; Write-Host 'Starting Vite...' -ForegroundColor Cyan; Write-Host ''; npm run dev"
) -WindowStyle Normal

Write-Host "✅ Frontend server window opened" -ForegroundColor Green

# Wait for servers
Write-Host "`nWaiting 10 seconds for servers to start..." -ForegroundColor Cyan
Start-Sleep -Seconds 10

# Check servers
Write-Host "`n=== Checking Servers ===" -ForegroundColor Cyan

# Check Backend
try {
    $backendResponse = Invoke-WebRequest -Uri "http://127.0.0.1:8000/docs" -TimeoutSec 5 -UseBasicParsing
    Write-Host "✅ Backend is running! http://127.0.0.1:8000/docs" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Backend might still be starting..." -ForegroundColor Yellow
}

# Check Frontend
try {
    $frontendResponse = Invoke-WebRequest -Uri "http://localhost:5178" -TimeoutSec 5 -UseBasicParsing
    Write-Host "✅ Frontend is running! http://localhost:5178" -ForegroundColor Green
} catch {
    Write-Host "⚠️ Frontend might still be starting..." -ForegroundColor Yellow
}

Write-Host "`n=== Done! ===" -ForegroundColor Green
Write-Host "Backend: http://127.0.0.1:8000/docs" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5178" -ForegroundColor Cyan
Write-Host "`nOpen these URLs in your browser!" -ForegroundColor Yellow
