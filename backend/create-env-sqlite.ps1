# Create .env file for backend with SQLite
$envContent = @"
DEBUG=True
SECRET_KEY=homeorganizationelimaorapplication
DATABASE_URL=sqlite:///./app.db
REDIS_URL=redis://localhost:6379/0
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET
VAPID_PUBLIC_KEY=YOUR_PUBLIC_KEY
VAPID_PRIVATE_KEY=YOUR_PRIVATE_KEY
"@

if (Test-Path .env) {
    Write-Host ".env file already exists" -ForegroundColor Yellow
    Write-Host "Do you want to overwrite it? (y/n)" -ForegroundColor Cyan
    $response = Read-Host
    if ($response -eq "y" -or $response -eq "Y") {
        $envContent | Out-File -FilePath .env -Encoding utf8
        Write-Host ".env file updated successfully!" -ForegroundColor Green
    } else {
        Write-Host "Cancelled" -ForegroundColor Yellow
    }
} else {
    $envContent | Out-File -FilePath .env -Encoding utf8
    Write-Host ".env file created successfully!" -ForegroundColor Green
}

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Run migrations: alembic upgrade head" -ForegroundColor Yellow
Write-Host "  2. Restart the server" -ForegroundColor Yellow
