#!/usr/bin/env python3
"""
Check if the API server is running and healthy
This script tests the health endpoints to verify the API is working correctly
"""
import sys
import requests
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

print("=" * 70)
print("  🔍 API Health Check")
print("=" * 70)
print()

base_url = "http://localhost:8000"
endpoints = [
    ("/health", "Basic health check"),
    ("/live", "Liveness probe"),
    ("/ready", "Readiness probe"),
    ("/health/detailed", "Detailed health check"),
    ("/health/db", "Database health check"),
]

all_healthy = True

for endpoint, description in endpoints:
    url = f"{base_url}{endpoint}"
    print(f"🔍 Testing: {description}")
    print(f"   URL: {url}")
    
    try:
        response = requests.get(url, timeout=5)
        
        if response.status_code == 200:
            print(f"   ✅ Status: {response.status_code} OK")
            try:
                data = response.json()
                if isinstance(data, dict):
                    if 'status' in data:
                        print(f"   Status: {data['status']}")
                    if 'uptime_seconds' in data:
                        print(f"   Uptime: {data['uptime_seconds']:.2f} seconds")
                    if 'components' in data:
                        print(f"   Components:")
                        for name, comp in data['components'].items():
                            status = comp.get('status', 'unknown')
                            latency = comp.get('latency_ms', 0)
                            message = comp.get('message', '')
                            print(f"      - {name}: {status} ({latency}ms) - {message}")
            except Exception as e:
                print(f"   Response: {response.text[:100]}")
        elif response.status_code == 503:
            print(f"   ⚠️  Status: {response.status_code} Service Unavailable")
            all_healthy = False
            try:
                data = response.json()
                print(f"   Status: {data.get('status', 'unknown')}")
            except:
                pass
        else:
            print(f"   ❌ Status: {response.status_code}")
            all_healthy = False
            print(f"   Response: {response.text[:200]}")
    except requests.exceptions.ConnectionError:
        print(f"   ❌ ERROR: Cannot connect to {base_url}")
        print(f"   The server is not running!")
        print(f"   💡 Start the server with: python run-server-debug.py")
        all_healthy = False
    except requests.exceptions.Timeout:
        print(f"   ❌ ERROR: Request timed out")
        all_healthy = False
    except Exception as e:
        print(f"   ❌ ERROR: {type(e).__name__}: {e}")
        all_healthy = False
    
    print()

print("=" * 70)
if all_healthy:
    print("  ✅ API is healthy and running correctly!")
else:
    print("  ⚠️  API has some issues - check the details above")
print("=" * 70)

sys.exit(0 if all_healthy else 1)
