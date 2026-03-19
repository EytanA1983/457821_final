# Test CORS Configuration
# Run this after the backend server is running

Write-Host "=== Testing CORS Configuration ===" -ForegroundColor Cyan
Write-Host ""

$origin = "http://localhost:5178"
$baseUrl = "http://localhost:8000"

Write-Host "Testing CORS for origin: $origin" -ForegroundColor Yellow
Write-Host ""

# Test 1: OPTIONS (preflight request)
Write-Host "1. Testing OPTIONS (preflight request)..." -ForegroundColor Cyan
Write-Host "   Command: curl -v -H `"Origin: $origin`" -X OPTIONS $baseUrl/api/auth/login" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/auth/login" `
        -Method OPTIONS `
        -Headers @{"Origin" = $origin} `
        -UseBasicParsing `
        -ErrorAction Stop
    
    Write-Host "✅ OPTIONS request successful!" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor White
    Write-Host ""
    Write-Host "CORS Headers:" -ForegroundColor Yellow
    
    if ($response.Headers['Access-Control-Allow-Origin']) {
        Write-Host "   ✅ Access-Control-Allow-Origin: $($response.Headers['Access-Control-Allow-Origin'])" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Missing Access-Control-Allow-Origin!" -ForegroundColor Red
    }
    
    if ($response.Headers['Access-Control-Allow-Credentials']) {
        Write-Host "   ✅ Access-Control-Allow-Credentials: $($response.Headers['Access-Control-Allow-Credentials'])" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️ Missing Access-Control-Allow-Credentials" -ForegroundColor Yellow
    }
    
    if ($response.Headers['Access-Control-Allow-Methods']) {
        Write-Host "   ✅ Access-Control-Allow-Methods: $($response.Headers['Access-Control-Allow-Methods'])" -ForegroundColor Green
    }
    
    if ($response.Headers['Access-Control-Allow-Headers']) {
        Write-Host "   ✅ Access-Control-Allow-Headers: $($response.Headers['Access-Control-Allow-Headers'])" -ForegroundColor Green
    }
    
} catch {
    Write-Host "❌ OPTIONS request failed!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Yellow
    if ($_.Exception.Response) {
        Write-Host "   Status: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "2. Testing actual POST request..." -ForegroundColor Cyan
Write-Host "   Command: curl -v -H `"Origin: $origin`" -X POST $baseUrl/api/auth/login -d `"username=test&password=test`"" -ForegroundColor Gray
Write-Host ""

try {
    $body = "username=test@example.com&password=test123"
    $response = Invoke-WebRequest -Uri "$baseUrl/api/auth/login" `
        -Method POST `
        -Headers @{
            "Origin" = $origin
            "Content-Type" = "application/x-www-form-urlencoded"
        } `
        -Body $body `
        -UseBasicParsing `
        -ErrorAction Stop
    
    Write-Host "✅ POST request successful!" -ForegroundColor Green
    Write-Host "   Status: $($response.StatusCode)" -ForegroundColor White
    
    if ($response.Headers['Access-Control-Allow-Origin']) {
        Write-Host "   ✅ CORS headers present: $($response.Headers['Access-Control-Allow-Origin'])" -ForegroundColor Green
    }
    
} catch {
    # Expected to fail (401/400) but should have CORS headers
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   Status: $statusCode (expected for invalid credentials)" -ForegroundColor Yellow
        
        # Check CORS headers even on error
        $headers = $_.Exception.Response.Headers
        if ($headers['Access-Control-Allow-Origin']) {
            Write-Host "   ✅ CORS headers present even on error!" -ForegroundColor Green
            Write-Host "      Access-Control-Allow-Origin: $($headers['Access-Control-Allow-Origin'])" -ForegroundColor White
        } else {
            Write-Host "   ❌ Missing CORS headers on error response!" -ForegroundColor Red
        }
    } else {
        Write-Host "   ⚠️ Request failed: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "If you see ✅ for CORS headers, the configuration is working!" -ForegroundColor Green
