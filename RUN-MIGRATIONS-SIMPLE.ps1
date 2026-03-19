# Simple script to run migrations
# Run this from the project root directory

Write-Host "=== Running Database Migrations ===" -ForegroundColor Green
Write-Host ""

# Get the backend directory path
$backendPath = Join-Path $PSScriptRoot "backend"

if (-not (Test-Path $backendPath)) {
    Write-Host "ERROR: backend directory not found!" -ForegroundColor Red
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
    exit 1
}

Write-Host "Navigating to: $backendPath" -ForegroundColor Cyan
Set-Location $backendPath

Write-Host ""
Write-Host "Checking for alembic.ini..." -ForegroundColor Yellow
if (-not (Test-Path "alembic.ini")) {
    Write-Host "ERROR: alembic.ini not found in backend directory!" -ForegroundColor Red
    exit 1
}

Write-Host "Checking for .env file..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    Write-Host "WARNING: .env file not found!" -ForegroundColor Yellow
    Write-Host "The migrations might fail if DATABASE_URL is not set." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Running: alembic upgrade head" -ForegroundColor Cyan
Write-Host ""

# Try to run alembic
try {
    if (Get-Command alembic -ErrorAction SilentlyContinue) {
        alembic upgrade head
    } elseif (Get-Command poetry -ErrorAction SilentlyContinue) {
        Write-Host "Using Poetry..." -ForegroundColor Cyan
        poetry run alembic upgrade head
    } else {
        Write-Host "Using Python directly..." -ForegroundColor Cyan
        python -m alembic upgrade head
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "=== ✅ Migrations completed successfully! ===" -ForegroundColor Green
        Write-Host ""
        Write-Host "Database tables created:" -ForegroundColor Cyan
        Write-Host "  ✓ users" -ForegroundColor Green
        Write-Host "  ✓ tasks" -ForegroundColor Green
        Write-Host "  ✓ rooms" -ForegroundColor Green
        Write-Host "  ✓ categories" -ForegroundColor Green
        Write-Host "  ✓ notifications" -ForegroundColor Green
        Write-Host "  ✓ and all other tables" -ForegroundColor Green
        Write-Host ""
        Write-Host "You can now try registering again!" -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "=== ❌ Migration failed! ===" -ForegroundColor Red
        Write-Host "Please check the error messages above." -ForegroundColor Yellow
    }
} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to run migrations" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Return to original directory
Set-Location $PSScriptRoot
