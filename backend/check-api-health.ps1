# PowerShell script to check API health
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 69) -ForegroundColor Cyan
Write-Host "  🔍 API Health Check" -ForegroundColor Cyan
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 69) -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:8000"
$endpoints = @(
    @{Path="/health"; Description="Basic health check"},
    @{Path="/live"; Description="Liveness probe"},
    @{Path="/ready"; Description="Readiness probe"},
    @{Path="/health/detailed"; Description="Detailed health check"},
    @{Path="/health/db"; Description="Database health check"}
)

$allHealthy = $true

foreach ($endpoint in $endpoints) {
    $url = $baseUrl + $endpoint.Path
    Write-Host "🔍 Testing: $($endpoint.Description)" -ForegroundColor Cyan
    Write-Host "   URL: $url" -ForegroundColor Gray
    
    try {
        $response = Invoke-WebRequest -Uri $url -Method GET -TimeoutSec 5 -ErrorAction Stop
        
        if ($response.StatusCode -eq 200) {
            Write-Host "   ✅ Status: $($response.StatusCode) OK" -ForegroundColor Green
            try {
                $data = $response.Content | ConvertFrom-Json
                if ($data.status) {
                    Write-Host "   Status: $($data.status)" -ForegroundColor Gray
                }
                if ($data.uptime_seconds) {
                    Write-Host "   Uptime: $([math]::Round($data.uptime_seconds, 2)) seconds" -ForegroundColor Gray
                }
                if ($data.components) {
                    Write-Host "   Components:" -ForegroundColor Gray
                    $data.components.PSObject.Properties | ForEach-Object {
                        $comp = $_.Value
                        $status = $comp.status
                        $latency = if ($comp.latency_ms) { "$($comp.latency_ms)ms" } else { "N/A" }
                        $message = if ($comp.message) { $comp.message } else { "" }
                        Write-Host "      - $($_.Name): $status ($latency) - $message" -ForegroundColor Gray
                    }
                }
            } catch {
                Write-Host "   Response: $($response.Content.Substring(0, [Math]::Min(100, $response.Content.Length)))" -ForegroundColor Gray
            }
        } elseif ($response.StatusCode -eq 503) {
            Write-Host "   ⚠️  Status: $($response.StatusCode) Service Unavailable" -ForegroundColor Yellow
            $allHealthy = $false
        } else {
            Write-Host "   ❌ Status: $($response.StatusCode)" -ForegroundColor Red
            $allHealthy = $false
        }
    } catch {
        $errorMsg = $_.Exception.Message
        if ($errorMsg -like "*connection*" -or $errorMsg -like "*refused*") {
            Write-Host "   ❌ ERROR: Cannot connect to $baseUrl" -ForegroundColor Red
            Write-Host "   The server is not running!" -ForegroundColor Yellow
            Write-Host "   💡 Start the server with: python run-server-debug.py" -ForegroundColor Yellow
        } else {
            Write-Host "   ❌ ERROR: $errorMsg" -ForegroundColor Red
        }
        $allHealthy = $false
    }
    
    Write-Host ""
}

Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 69) -ForegroundColor Cyan
if ($allHealthy) {
    Write-Host "  ✅ API is healthy and running correctly!" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  API has some issues - check the details above" -ForegroundColor Yellow
}
Write-Host "=" -NoNewline -ForegroundColor Cyan
Write-Host ("=" * 69) -ForegroundColor Cyan

if (-not $allHealthy) {
    exit 1
}
