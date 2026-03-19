# Run Alembic Migrations
# This script upgrades the database to the latest schema

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Running Alembic Migrations" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to backend directory
Set-Location -Path "backend"

Write-Host "Step 1: Check current migration status" -ForegroundColor Yellow
Write-Host "Running: alembic current" -ForegroundColor Gray
alembic current
Write-Host ""

Write-Host "Step 2: Show available migrations" -ForegroundColor Yellow
Write-Host "Running: alembic history" -ForegroundColor Gray
alembic history
Write-Host ""

Write-Host "Step 3: Upgrade to latest migration (head)" -ForegroundColor Yellow
Write-Host "Running: alembic upgrade head" -ForegroundColor Gray
alembic upgrade head
Write-Host ""

if ($LASTEXITCODE -eq 0) {
    Write-Host "================================" -ForegroundColor Green
    Write-Host "✅ Migrations completed successfully!" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Database schema updated with:" -ForegroundColor Cyan
    Write-Host "  ✓ shopping_lists table" -ForegroundColor Green
    Write-Host "  ✓ shopping_items table" -ForegroundColor Green
    Write-Host "  ✓ room_id column in shopping_lists" -ForegroundColor Green
} else {
    Write-Host "================================" -ForegroundColor Red
    Write-Host "❌ Migration failed!" -ForegroundColor Red
    Write-Host "================================" -ForegroundColor Red
    Write-Host "Please check the error messages above." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Return to project root
Set-Location -Path ".."
