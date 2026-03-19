# Frontend Setup Verification Script
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "  Frontend Setup Verification" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host ""

$checksPassed = 0
$checksFailed = 0

# Check if frontend directory exists
if (Test-Path "frontend") {
    Write-Host "✅ Frontend directory exists" -ForegroundColor Green
    $checksPassed++
    
    Set-Location frontend
    
    # Check for .env file
    if (Test-Path ".env") {
        Write-Host "✅ .env file exists" -ForegroundColor Green
        $checksPassed++
        
        $envContent = Get-Content .env -Raw
        if ($envContent -match "VITE_API_URL") {
            Write-Host "✅ VITE_API_URL is defined in .env" -ForegroundColor Green
            $envContent -split "`n" | Where-Object { $_ -match "VITE_API_URL" } | ForEach-Object {
                Write-Host "   $_" -ForegroundColor Gray
            }
            $checksPassed++
        } else {
            Write-Host "⚠️  VITE_API_URL is not defined in .env" -ForegroundColor Yellow
            Write-Host "   Add: VITE_API_URL=http://localhost:8000" -ForegroundColor Yellow
            $checksFailed++
        }
    } else {
        Write-Host "⚠️  .env file not found" -ForegroundColor Yellow
        Write-Host "   Create frontend/.env with: VITE_API_URL=http://localhost:8000" -ForegroundColor Yellow
        $checksFailed++
    }
    
    # Check vite.config.ts for proxy
    if (Test-Path "vite.config.ts") {
        $viteConfig = Get-Content vite.config.ts -Raw
        if ($viteConfig -match "proxy") {
            Write-Host "✅ Vite proxy is configured" -ForegroundColor Green
            $checksPassed++
        } else {
            Write-Host "⚠️  Vite proxy not found in vite.config.ts" -ForegroundColor Yellow
            $checksFailed++
        }
    }
    
    # Check if node_modules exists
    if (Test-Path "node_modules") {
        Write-Host "✅ node_modules exists (dependencies installed)" -ForegroundColor Green
        $checksPassed++
    } else {
        Write-Host "⚠️  node_modules not found - run: npm install" -ForegroundColor Yellow
        $checksFailed++
    }
    
    Set-Location ..
} else {
    Write-Host "❌ Frontend directory not found" -ForegroundColor Red
    $checksFailed++
}

Write-Host ""
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "  Summary" -ForegroundColor Cyan
Write-Host "=" * 70 -ForegroundColor Cyan
Write-Host "✅ Passed: $checksPassed" -ForegroundColor Green
Write-Host "❌ Failed: $checksFailed" -ForegroundColor $(if ($checksFailed -eq 0) { "Green" } else { "Red" })
Write-Host ""

if ($checksFailed -eq 0) {
    Write-Host "✅ Frontend setup looks good!" -ForegroundColor Green
} else {
    Write-Host "⚠️  Some checks failed. Please fix the issues above." -ForegroundColor Yellow
}
