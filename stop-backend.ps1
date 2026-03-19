# Stop Backend Server
# Usage: .\stop-backend.ps1

Write-Host "Stopping Backend Server..." -ForegroundColor Yellow

# Find all processes using port 8000
$processes = netstat -ano | findstr :8000 | ForEach-Object { 
    $parts = $_ -split '\s+'
    $parts[-1]
} | Select-Object -Unique

if ($processes) {
    foreach ($pid in $processes) {
        if ($pid -match '^\d+$') {
            try {
                Stop-Process -Id $pid -Force -ErrorAction Stop
                Write-Host "Stopped process $pid" -ForegroundColor Green
            } catch {
                Write-Host "Could not stop process $pid: $_" -ForegroundColor Red
            }
        }
    }
    Start-Sleep -Seconds 1
    
    # Verify
    $stillRunning = netstat -ano | findstr :8000
    if ($stillRunning) {
        Write-Host "Warning: Some processes may still be running" -ForegroundColor Yellow
    } else {
        Write-Host "Port 8000 is now free!" -ForegroundColor Green
    }
} else {
    Write-Host "No processes found on port 8000" -ForegroundColor Cyan
}
