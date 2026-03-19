# PowerShell script to start the API server
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 69) -ForegroundColor Cyan
Write-Host "  🚀 Starting API Server" -ForegroundColor Cyan
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 69) -ForegroundColor Cyan
Write-Host ""

# Check if we're in the backend directory
if (-not (Test-Path "app")) {
    Write-Host "❌ ERROR: Not in backend directory!" -ForegroundColor Red
    Write-Host "   Run this script from the backend directory" -ForegroundColor Yellow
    exit 1
}

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  WARNING: .env file not found!" -ForegroundColor Yellow
    Write-Host "   Create backend/.env with SECRET_KEY and DATABASE_URL" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Configuration:" -ForegroundColor Green
Write-Host "  - Server: FastAPI (uvicorn)" -ForegroundColor Gray
Write-Host "  - Host: 0.0.0.0 (accessible from all interfaces)" -ForegroundColor Gray
Write-Host "  - Port: 8000" -ForegroundColor Gray
Write-Host "  - Reload: Enabled (auto-reload on code changes)" -ForegroundColor Gray
Write-Host "  - Debug: Enabled (full traceback on errors)" -ForegroundColor Gray
Write-Host ""
Write-Host "Endpoints:" -ForegroundColor Green
Write-Host "  - Health: http://localhost:8000/health" -ForegroundColor Gray
Write-Host "  - API Docs: http://localhost:8000/docs" -ForegroundColor Gray
Write-Host "  - Login: http://localhost:8000/api/auth/login" -ForegroundColor Gray
Write-Host "  - Register: http://localhost:8000/api/auth/register" -ForegroundColor Gray
Write-Host ""
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 69) -ForegroundColor Cyan
Write-Host ""

# Run the server
python run-server-debug.py
