# PowerShell script to restart backend and frontend servers

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Restarting Backend and Frontend" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Stop existing processes
Write-Host "Stopping existing servers..." -ForegroundColor Yellow

# Stop backend (port 8000)
$backendProcess = Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($backendProcess) {
    Write-Host "Stopping backend (PID: $backendProcess)..." -ForegroundColor Gray
    Stop-Process -Id $backendProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Stop frontend (port 5179)
$frontendProcess = Get-NetTCPConnection -LocalPort 5179 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
if ($frontendProcess) {
    Write-Host "Stopping frontend (PID: $frontendProcess)..." -ForegroundColor Gray
    Stop-Process -Id $frontendProcess -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "Starting servers..." -ForegroundColor Green
Write-Host ""

# Start backend
Write-Host "Starting Backend (http://localhost:8000)..." -ForegroundColor Cyan
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    cd backend
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
}
Write-Host "  Backend started (Job ID: $($backendJob.Id))" -ForegroundColor Gray

# Wait a bit for backend to start
Start-Sleep -Seconds 3

# Start frontend
Write-Host "Starting Frontend (http://localhost:5179)..." -ForegroundColor Cyan
$frontendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    cd frontend
    npm run dev
}
Write-Host "  Frontend started (Job ID: $($frontendJob.Id))" -ForegroundColor Gray

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Servers Restarted!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "Frontend: http://localhost:5179" -ForegroundColor White
Write-Host ""
Write-Host "To view logs:" -ForegroundColor Yellow
Write-Host "  Get-Job | Receive-Job" -ForegroundColor Gray
Write-Host ""
Write-Host "To stop servers:" -ForegroundColor Yellow
Write-Host "  Get-Job | Stop-Job" -ForegroundColor Gray
Write-Host "  Get-Job | Remove-Job" -ForegroundColor Gray
Write-Host ""
