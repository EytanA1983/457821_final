# PowerShell script to start both backend and frontend servers
# Final E2E check - ready to run!

Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "  🚀 Starting Application - Final E2E Check" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

# Check backend .env
Write-Host "📋 Checking Backend Configuration..." -ForegroundColor Yellow
if (Test-Path "backend\.env") {
    Write-Host "  ✅ .env file exists" -ForegroundColor Green
    $hasSecretKey = Select-String -Path "backend\.env" -Pattern "SECRET_KEY" -Quiet
    $hasDatabaseUrl = Select-String -Path "backend\.env" -Pattern "DATABASE_URL" -Quiet
    if ($hasSecretKey) {
        Write-Host "  ✅ SECRET_KEY is set" -ForegroundColor Green
    } else {
        Write-Host "  ❌ SECRET_KEY is missing!" -ForegroundColor Red
    }
    if ($hasDatabaseUrl) {
        Write-Host "  ✅ DATABASE_URL is set" -ForegroundColor Green
    } else {
        Write-Host "  ❌ DATABASE_URL is missing!" -ForegroundColor Red
    }
} else {
    Write-Host "  ❌ .env file not found!" -ForegroundColor Red
    Write-Host "  💡 Create backend/.env with SECRET_KEY and DATABASE_URL" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "📋 Checking Frontend Configuration..." -ForegroundColor Yellow
if (Test-Path "frontend\vite.config.ts") {
    Write-Host "  ✅ vite.config.ts exists" -ForegroundColor Green
} else {
    Write-Host "  ❌ vite.config.ts not found!" -ForegroundColor Red
}

Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "  Starting Servers..." -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️  IMPORTANT: You need to run these commands in separate terminals:" -ForegroundColor Yellow
Write-Host ""
Write-Host "Terminal 1 (Backend):" -ForegroundColor Green
Write-Host "  cd backend" -ForegroundColor Gray
Write-Host "  python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000" -ForegroundColor Gray
Write-Host ""
Write-Host "Terminal 2 (Frontend):" -ForegroundColor Green
Write-Host "  cd frontend" -ForegroundColor Gray
Write-Host "  npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "Then open:" -ForegroundColor Yellow
Write-Host "  http://localhost:5179" -ForegroundColor Cyan
Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
