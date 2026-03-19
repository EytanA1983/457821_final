# PowerShell script to start both backend and frontend servers
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "  Starting Both Servers (Backend + Frontend)" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Check if we're in the project root
if (-not (Test-Path "backend") -or -not (Test-Path "frontend")) {
    Write-Host "❌ ERROR: backend or frontend directory not found!" -ForegroundColor Red
    Write-Host "   Run this script from the project root directory" -ForegroundColor Red
    exit 1
}

Write-Host "This will start:" -ForegroundColor Green
Write-Host "  1. Backend server on http://localhost:8000" -ForegroundColor Gray
Write-Host "  2. Frontend server on http://localhost:5179" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  Note: This will open two separate terminal windows" -ForegroundColor Yellow
Write-Host "   Close both windows to stop the servers" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to continue or Ctrl+C to cancel..." -ForegroundColor Cyan
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Start backend in new window
Write-Host ""
Write-Host "Starting backend server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\backend'; python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"

# Wait a bit for backend to start
Start-Sleep -Seconds 2

# Start frontend in new window
Write-Host "Starting frontend server..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD\frontend'; npm run dev"

Write-Host ""
Write-Host "✅ Both servers started!" -ForegroundColor Green
Write-Host ""
Write-Host "Backend: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:5179" -ForegroundColor Cyan
Write-Host ""
Write-Host "API Docs: http://localhost:8000/docs" -ForegroundColor Gray
Write-Host ""
