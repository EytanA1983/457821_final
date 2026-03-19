# Restart Backend Server Script
# This script stops any running uvicorn process and starts a fresh one

Write-Host "=== Restarting Backend Server ===" -ForegroundColor Cyan
Write-Host ""

# Check if port 8000 is in use
$port = 8000
$connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue

if ($connections) {
    Write-Host "Port $port is in use. Stopping process..." -ForegroundColor Yellow
    $processId = $connections[0].OwningProcess
    try {
        Stop-Process -Id $processId -Force -ErrorAction Stop
        Write-Host "✅ Process stopped (PID: $processId)" -ForegroundColor Green
        Start-Sleep -Seconds 2
    } catch {
        Write-Host "⚠️ Could not stop process. You may need to stop it manually (Ctrl+C)" -ForegroundColor Yellow
    }
} else {
    Write-Host "Port $port is free" -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting backend server..." -ForegroundColor Cyan
Write-Host ""

# Change to backend directory
Set-Location backend

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️ Warning: .env file not found!" -ForegroundColor Yellow
    Write-Host "   Make sure SECRET_KEY and DATABASE_URL are set" -ForegroundColor Yellow
    Write-Host ""
}

# Start uvicorn
Write-Host "Running: python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
