# Start Backend Server with HTTPS
Write-Host "=== Starting Backend Server with HTTPS ===" -ForegroundColor Green
Write-Host ""

# Check if certificates exist
$certPath = "certs\cert.pem"
$keyPath = "certs\key.pem"

if (-not (Test-Path $certPath) -or -not (Test-Path $keyPath)) {
    Write-Host "❌ SSL certificates not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please generate certificates first:" -ForegroundColor Yellow
    Write-Host "  .\generate-ssl-certs.ps1" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host "✓ SSL certificates found" -ForegroundColor Green
Write-Host ""

# Check if .env exists
if (-not (Test-Path .env)) {
    Write-Host "WARNING: .env file not found!" -ForegroundColor Yellow
    Write-Host "Run: .\create-env.ps1 to create it" -ForegroundColor Cyan
    Write-Host ""
}

# Check if Poetry is available
if (Get-Command poetry -ErrorAction SilentlyContinue) {
    Write-Host "Using Poetry..." -ForegroundColor Cyan
    Write-Host "Starting server on https://localhost:8000" -ForegroundColor Green
    Write-Host "⚠️  Browser will show security warning (self-signed cert)" -ForegroundColor Yellow
    Write-Host "`nPress Ctrl+C to stop`n" -ForegroundColor Gray
    poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --ssl-keyfile "$keyPath" --ssl-certfile "$certPath"
} else {
    Write-Host "Using Python directly..." -ForegroundColor Cyan
    Write-Host "Starting server on https://localhost:8000" -ForegroundColor Green
    Write-Host "⚠️  Browser will show security warning (self-signed cert)" -ForegroundColor Yellow
    Write-Host "`nPress Ctrl+C to stop`n" -ForegroundColor Gray
    python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --ssl-keyfile "$keyPath" --ssl-certfile "$certPath"
}
