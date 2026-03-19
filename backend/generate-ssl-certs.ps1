# Generate SSL Certificates for HTTPS Development
# This script creates self-signed certificates for local development

Write-Host "=== Generating SSL Certificates for HTTPS ===" -ForegroundColor Green
Write-Host ""

# Create certs directory if it doesn't exist
$certsDir = "certs"
if (-not (Test-Path $certsDir)) {
    New-Item -ItemType Directory -Path $certsDir | Out-Null
    Write-Host "✓ Created certs directory" -ForegroundColor Green
}

# Check if OpenSSL is available
$opensslAvailable = $false
if (Get-Command openssl -ErrorAction SilentlyContinue) {
    $opensslAvailable = $true
} elseif (Test-Path "C:\Program Files\Git\usr\bin\openssl.exe") {
    $opensslPath = "C:\Program Files\Git\usr\bin\openssl.exe"
    $opensslAvailable = $true
} elseif (Test-Path "C:\Program Files\OpenSSL-Win64\bin\openssl.exe") {
    $opensslPath = "C:\Program Files\OpenSSL-Win64\bin\openssl.exe"
    $opensslAvailable = $true
}

if (-not $opensslAvailable) {
    Write-Host "❌ OpenSSL not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install OpenSSL:" -ForegroundColor Yellow
    Write-Host "  1. Download from: https://slproweb.com/products/Win32OpenSSL.html" -ForegroundColor Cyan
    Write-Host "  2. Or install Git for Windows (includes OpenSSL)" -ForegroundColor Cyan
    Write-Host "  3. Or use: choco install openssl" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

# Use openssl command
if ($opensslPath) {
    $opensslCmd = $opensslPath
} else {
    $opensslCmd = "openssl"
}

Write-Host "Using OpenSSL: $opensslCmd" -ForegroundColor Cyan
Write-Host ""

# Generate private key
Write-Host "Generating private key..." -ForegroundColor Yellow
& $opensslCmd req -x509 -newkey rsa:4096 -keyout "$certsDir/key.pem" -out "$certsDir/cert.pem" -days 365 -nodes -subj "/CN=localhost" 2>&1 | Out-Null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ SSL certificates generated successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Files created:" -ForegroundColor Cyan
    Write-Host "  - $certsDir/cert.pem (certificate)" -ForegroundColor Gray
    Write-Host "  - $certsDir/key.pem (private key)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "⚠️  WARNING: These are self-signed certificates for development only!" -ForegroundColor Yellow
    Write-Host "   Your browser will show a security warning. Click 'Advanced' and 'Proceed'." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Cyan
    Write-Host "  1. Update CORS_ORIGINS in .env to include https://localhost:8000" -ForegroundColor Yellow
    Write-Host "  2. Start server with HTTPS: .\start-api-server-https.ps1" -ForegroundColor Yellow
} else {
    Write-Host "❌ Failed to generate certificates!" -ForegroundColor Red
    exit 1
}
