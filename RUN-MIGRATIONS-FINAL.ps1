# Run Database Migrations - Final Version
# This script will run migrations from the project root

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Running Database Migrations" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get the script directory (project root)
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Join-Path $scriptDir "backend"

Write-Host "Project root: $scriptDir" -ForegroundColor Gray
Write-Host "Backend directory: $backendDir" -ForegroundColor Gray
Write-Host ""

# Check if backend directory exists
if (-not (Test-Path $backendDir)) {
    Write-Host "ERROR: backend directory not found!" -ForegroundColor Red
    Write-Host "Expected: $backendDir" -ForegroundColor Yellow
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Yellow
    exit 1
}

# Navigate to backend
Write-Host "Navigating to backend directory..." -ForegroundColor Cyan
Push-Location $backendDir

try {
    Write-Host "Current directory: $(Get-Location)" -ForegroundColor Green
    Write-Host ""
    
    # Check for alembic.ini
    if (-not (Test-Path "alembic.ini")) {
        Write-Host "ERROR: alembic.ini not found!" -ForegroundColor Red
        Write-Host "Are you sure you're in the backend directory?" -ForegroundColor Yellow
        exit 1
    }
    
    Write-Host "✓ Found alembic.ini" -ForegroundColor Green
    
    # Check for .env
    if (-not (Test-Path ".env")) {
        Write-Host "⚠ WARNING: .env file not found!" -ForegroundColor Yellow
        Write-Host "Migrations might fail if DATABASE_URL is not set." -ForegroundColor Yellow
    } else {
        Write-Host "✓ Found .env file" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "Running migrations..." -ForegroundColor Cyan
    Write-Host "Command: alembic upgrade head" -ForegroundColor Gray
    Write-Host ""
    
    # Try to run alembic
    $success = $false
    
    # Try 1: Direct alembic command
    if (Get-Command alembic -ErrorAction SilentlyContinue) {
        Write-Host "Using: alembic upgrade head" -ForegroundColor Cyan
        & alembic upgrade head
        if ($LASTEXITCODE -eq 0) {
            $success = $true
        }
    }
    
    # Try 2: Python -m alembic
    if (-not $success) {
        Write-Host ""
        Write-Host "Trying: python -m alembic upgrade head" -ForegroundColor Cyan
        & python -m alembic upgrade head
        if ($LASTEXITCODE -eq 0) {
            $success = $true
        }
    }
    
    # Try 3: Poetry
    if (-not $success) {
        if (Get-Command poetry -ErrorAction SilentlyContinue) {
            Write-Host ""
            Write-Host "Trying: poetry run alembic upgrade head" -ForegroundColor Cyan
            & poetry run alembic upgrade head
            if ($LASTEXITCODE -eq 0) {
                $success = $true
            }
        }
    }
    
    Write-Host ""
    
    if ($success) {
        Write-Host "========================================" -ForegroundColor Green
        Write-Host "  ✅ Migrations completed successfully!" -ForegroundColor Green
        Write-Host "========================================" -ForegroundColor Green
        Write-Host ""
        Write-Host "Database tables created:" -ForegroundColor Cyan
        Write-Host "  ✓ users" -ForegroundColor Green
        Write-Host "  ✓ tasks" -ForegroundColor Green
        Write-Host "  ✓ rooms" -ForegroundColor Green
        Write-Host "  ✓ categories" -ForegroundColor Green
        Write-Host "  ✓ notifications" -ForegroundColor Green
        Write-Host "  ✓ and all other tables" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "  1. Restart the backend server (if running)" -ForegroundColor Yellow
        Write-Host "  2. Try registering again at http://localhost:5179/register" -ForegroundColor Yellow
    } else {
        Write-Host "========================================" -ForegroundColor Red
        Write-Host "  ❌ Migration failed!" -ForegroundColor Red
        Write-Host "========================================" -ForegroundColor Red
        Write-Host ""
        Write-Host "Please check the error messages above." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Common issues:" -ForegroundColor Cyan
        Write-Host "  - alembic not installed: pip install alembic" -ForegroundColor Yellow
        Write-Host "  - Wrong directory: Make sure you're in the backend folder" -ForegroundColor Yellow
        Write-Host "  - DATABASE_URL not set: Check .env file" -ForegroundColor Yellow
        exit 1
    }
    
} finally {
    # Return to original directory
    Pop-Location
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
