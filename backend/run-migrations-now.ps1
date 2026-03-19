# Run Alembic migrations
# This script runs: alembic upgrade head

Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 69) -ForegroundColor Cyan
Write-Host "  🔄 Running Database Migrations" -ForegroundColor Cyan
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 69) -ForegroundColor Cyan
Write-Host ""

# Check if we're in the backend directory
if (-not (Test-Path "alembic.ini")) {
    Write-Host "❌ ERROR: alembic.ini not found!" -ForegroundColor Red
    Write-Host "   Current directory: $(Get-Location)" -ForegroundColor Yellow
    Write-Host "   Run this script from the backend directory" -ForegroundColor Yellow
    exit 1
}

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  WARNING: .env file not found!" -ForegroundColor Yellow
    Write-Host "   Migrations may fail if DATABASE_URL is not set" -ForegroundColor Yellow
    Write-Host ""
}

# Check DATABASE_URL
Write-Host "🔍 Checking DATABASE_URL..." -ForegroundColor Cyan
try {
    $envContent = Get-Content ".env" -ErrorAction SilentlyContinue
    if ($envContent -match "DATABASE_URL=") {
        $dbUrl = ($envContent | Select-String "DATABASE_URL=").ToString().Split("=", 2)[1]
        Write-Host "✅ DATABASE_URL is set" -ForegroundColor Green
        if ($dbUrl -like "sqlite*") {
            Write-Host "   Database type: SQLite" -ForegroundColor Cyan
        } elseif ($dbUrl -like "postgresql*") {
            Write-Host "   Database type: PostgreSQL" -ForegroundColor Cyan
        }
    } else {
        Write-Host "❌ ERROR: DATABASE_URL is not set in .env!" -ForegroundColor Red
        Write-Host "   Set DATABASE_URL in backend/.env before running migrations" -ForegroundColor Yellow
        exit 1
    }
} catch {
    Write-Host "⚠️  WARNING: Could not read .env file: $_" -ForegroundColor Yellow
    Write-Host "   Continuing anyway..." -ForegroundColor Yellow
}
Write-Host ""

# Run alembic upgrade head
Write-Host "Running: alembic upgrade head" -ForegroundColor Cyan
Write-Host ("-" * 70) -ForegroundColor Cyan
Write-Host ""

try {
    python -m alembic upgrade head
    $exitCode = $LASTEXITCODE
    
    if ($exitCode -eq 0) {
        Write-Host ""
        Write-Host ("-" * 70) -ForegroundColor Cyan
        Write-Host ""
        Write-Host "✅ Migrations completed successfully!" -ForegroundColor Green
        Write-Host ""
        
        # Verify tables
        Write-Host "🔍 Verifying database tables..." -ForegroundColor Cyan
        python -c "from sqlalchemy import inspect; from app.db.session import engine; inspector = inspect(engine); tables = inspector.get_table_names(); print(f'Total tables: {len(tables)}'); critical = ['users', 'tasks', 'rooms', 'categories']; missing = [t for t in critical if t not in tables]; print('✅ All critical tables exist' if not missing else f'⚠️  Missing: {missing}'); [print(f'   ✓ {t}') for t in sorted(tables)]"
        
        Write-Host ""
        Write-Host "=" -NoNewline -ForegroundColor Cyan
        Write-Host ("=" * 69) -ForegroundColor Cyan
        Write-Host "  ✅ Migration process completed!" -ForegroundColor Green
        Write-Host "=" -NoNewline -ForegroundColor Cyan
        Write-Host ("=" * 69) -ForegroundColor Cyan
    } else {
        Write-Host ""
        Write-Host "❌ Migrations failed with exit code: $exitCode" -ForegroundColor Red
        Write-Host "   Check the error messages above" -ForegroundColor Yellow
        exit $exitCode
    }
} catch {
    Write-Host ""
    Write-Host "❌ ERROR: Failed to run migrations: $_" -ForegroundColor Red
    exit 1
}
