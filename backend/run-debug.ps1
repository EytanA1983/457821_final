# PowerShell script to run backend server with full debug logging
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "  Starting Backend Server with Full Debug Logging" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Check if .env exists
if (-not (Test-Path .env)) {
    Write-Host "⚠️  WARNING: .env file not found!" -ForegroundColor Yellow
    Write-Host "   Create backend/.env with SECRET_KEY and DATABASE_URL" -ForegroundColor Yellow
    Write-Host ""
}

# Check if we're in the backend directory
if (-not (Test-Path "app")) {
    Write-Host "❌ ERROR: Not in backend directory!" -ForegroundColor Red
    Write-Host "   Run this script from the backend directory" -ForegroundColor Red
    exit 1
}

Write-Host "Configuration:" -ForegroundColor Green
Write-Host "  - Reload: Enabled (auto-reload on code changes)" -ForegroundColor Gray
Write-Host "  - Debug: Enabled (full traceback on errors)" -ForegroundColor Gray
Write-Host "  - Log Level: DEBUG (all logs including SQL queries)" -ForegroundColor Gray
Write-Host "  - Host: 0.0.0.0 (accessible from all interfaces)" -ForegroundColor Gray
Write-Host "  - Port: 8000" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  IMPORTANT: Watch the console for full traceback on 500 errors!" -ForegroundColor Yellow
Write-Host "   All errors will show:" -ForegroundColor Yellow
Write-Host "   - Date and time" -ForegroundColor Gray
Write-Host "   - File path and line number" -ForegroundColor Gray
Write-Host "   - Full stack trace" -ForegroundColor Gray
Write-Host "   - Object details" -ForegroundColor Gray
Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Run the server
python run-server-debug.py
