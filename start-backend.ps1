# PowerShell script to start the backend server
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "  Starting Backend Server" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Check if we're in the project root
if (-not (Test-Path "backend")) {
    Write-Host "❌ ERROR: backend directory not found!" -ForegroundColor Red
    Write-Host "   Run this script from the project root directory" -ForegroundColor Red
    exit 1
}

# Change to backend directory
Set-Location backend

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  WARNING: .env file not found!" -ForegroundColor Yellow
    Write-Host "   Create backend/.env with SECRET_KEY and DATABASE_URL" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Starting backend server..." -ForegroundColor Green
Write-Host "  - Server: uvicorn app.main:app" -ForegroundColor Gray
Write-Host "  - Reload: Enabled (auto-reload on code changes)" -ForegroundColor Gray
Write-Host "  - Port: 8000" -ForegroundColor Gray
Write-Host "  - URL: http://localhost:8000" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host ""

# Run uvicorn
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
