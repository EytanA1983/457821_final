# Run Alembic migrations
# This script runs: alembic upgrade head

Write-Host "=" -NoNewline
Write-Host ("=" * 69)
Write-Host "  🔄 Running Database Migrations"
Write-Host "=" -NoNewline
Write-Host ("=" * 69)
Write-Host ""

# Check if we're in the backend directory
if (-not (Test-Path "alembic.ini")) {
    Write-Host "❌ ERROR: alembic.ini not found!" -ForegroundColor Red
    Write-Host "   Run this script from the backend directory"
    exit 1
}

# Check if .env exists
if (-not (Test-Path ".env")) {
    Write-Host "⚠️  WARNING: .env file not found!" -ForegroundColor Yellow
    Write-Host "   Migrations may fail if DATABASE_URL is not set"
    Write-Host ""
}

Write-Host "Running: alembic upgrade head"
Write-Host ("-" * 70)
Write-Host ""

# Run alembic upgrade head
python -m alembic upgrade head

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host ("-" * 70)
    Write-Host ""
    Write-Host "✅ Migrations completed successfully!" -ForegroundColor Green
    Write-Host ""
    
    # Verify tables
    Write-Host "Verifying database tables..."
    python -c "from sqlalchemy import inspect; from app.db.session import engine; inspector = inspect(engine); tables = inspector.get_table_names(); print(f'✅ Found {len(tables)} tables:'); [print(f'   ✓ {t}') for t in sorted(tables)]"
    
    Write-Host ""
    Write-Host "=" -NoNewline
    Write-Host ("=" * 69)
    Write-Host "  ✅ Migration check completed!"
    Write-Host "=" -NoNewline
    Write-Host ("=" * 69)
} else {
    Write-Host ""
    Write-Host "❌ Migrations failed!" -ForegroundColor Red
    Write-Host "   Check the error messages above"
    exit 1
}
