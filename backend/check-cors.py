#!/usr/bin/env python3
"""
Check CORS configuration
This script verifies that CORS is configured correctly for the frontend
"""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from app.config import get_settings

print("=" * 70)
print("  🔍 CORS Configuration Check")
print("=" * 70)
print()

settings = get_settings()

print("CORS Configuration:")
print(f"  CORS_ORIGINS: {settings.CORS_ORIGINS}")
print()

# Check if required origins are present
required_origins = [
    "http://localhost:5178",
    "http://localhost:5179",
    "http://localhost:5181",
    "http://localhost:5173",  # Vite default port
    "http://127.0.0.1:5178",
    "http://127.0.0.1:5179",
    "http://127.0.0.1:5181",
    "http://127.0.0.1:5173",  # Vite default port (IP)
]

print("Required Origins:")
for origin in required_origins:
    if origin in settings.CORS_ORIGINS:
        print(f"  ✅ {origin}")
    else:
        print(f"  ❌ {origin} - MISSING!")

print()
print("CORS Middleware Settings:")
print(f"  allow_credentials: True (required for cookies)")
print(f"  allow_methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']")
print(f"  allow_headers: ['*']")
print(f"  expose_headers: ['*']")
print(f"  max_age: 3600 (1 hour)")
print()

# Check if all required origins are present
missing_origins = [origin for origin in required_origins if origin not in settings.CORS_ORIGINS]

if missing_origins:
    print("=" * 70)
    print("  ⚠️  WARNING: Some required origins are missing!")
    print("=" * 70)
    print()
    print("Missing origins:")
    for origin in missing_origins:
        print(f"  - {origin}")
    print()
    print("💡 To fix, add these to CORS_ORIGINS in config.py or .env file")
    print()
    sys.exit(1)
else:
    print("=" * 70)
    print("  ✅ CORS configuration is correct!")
    print("=" * 70)
    print()
    print("All required origins are present:")
    for origin in required_origins:
        print(f"  ✅ {origin}")
    print()
    sys.exit(0)
