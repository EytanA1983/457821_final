# Fix Database - Complete Solution
# Run this from the backend directory

Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host "  Database Fix - Complete Solution" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

# Step 1: Check if we're in the right directory
if (-not (Test-Path "alembic.ini")) {
    Write-Host "ERROR: alembic.ini not found!" -ForegroundColor Red
    Write-Host "Please run this script from the backend directory." -ForegroundColor Yellow
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Found backend directory" -ForegroundColor Green
Write-Host ""

# Step 2: Check if server is running
Write-Host "Checking if server is running..." -ForegroundColor Yellow
$serverRunning = $false
try {
    $response = Invoke-WebRequest -Uri "http://localhost:8000/health" -TimeoutSec 2 -ErrorAction SilentlyContinue
    if ($response.StatusCode -eq 200) {
        $serverRunning = $true
        Write-Host "⚠️  WARNING: Server is running!" -ForegroundColor Yellow
        Write-Host "   Please stop the server (Ctrl+C) before continuing." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Press any key after stopping the server..." -ForegroundColor Cyan
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }
} catch {
    Write-Host "✓ Server is not running (good)" -ForegroundColor Green
}
Write-Host ""

# Step 3: Create .env file
Write-Host "Creating .env file..." -ForegroundColor Yellow
$envContent = @"
DEBUG=True
SECRET_KEY=homeorganizationelimaorapplication
DATABASE_URL=sqlite:///./eli_maor_dev.db
REDIS_URL=redis://localhost:6379/0
"@

if (Test-Path .env) {
    Write-Host "⚠️  .env file already exists" -ForegroundColor Yellow
    Write-Host "   Updating it..." -ForegroundColor Gray
} else {
    Write-Host "   Creating new .env file..." -ForegroundColor Gray
}

$envContent | Out-File -FilePath .env -Encoding utf8
Write-Host "✓ .env file created/updated" -ForegroundColor Green
Write-Host ""

# Step 4: Delete old database files
Write-Host "Cleaning up old database files..." -ForegroundColor Yellow
Remove-Item "app.db" -ErrorAction SilentlyContinue
Remove-Item "eli_maor_dev.db" -ErrorAction SilentlyContinue
Write-Host "✓ Old database files removed" -ForegroundColor Green
Write-Host ""

# Step 5: Run the fix script
Write-Host "Running database fix script..." -ForegroundColor Yellow
Write-Host ""

if (Test-Path "fix-database-now.py") {
    python fix-database-now.py
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=" * 60 -ForegroundColor Green
        Write-Host "  ✅ SUCCESS!" -ForegroundColor Green
        Write-Host "=" * 60 -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "  1. Start the server:" -ForegroundColor Yellow
        Write-Host "     uvicorn app.main:app --reload --host 127.0.0.1 --port 8000" -ForegroundColor Gray
        Write-Host ""
        Write-Host "  2. Try registering at:" -ForegroundColor Yellow
        Write-Host "     http://localhost:5179/register" -ForegroundColor Gray
        Write-Host ""
    } else {
        Write-Host ""
        Write-Host "=" * 60 -ForegroundColor Red
        Write-Host "  ❌ FAILED!" -ForegroundColor Red
        Write-Host "=" * 60 -ForegroundColor Red
        Write-Host ""
        Write-Host "Please check the error messages above." -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "ERROR: fix-database-now.py not found!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
