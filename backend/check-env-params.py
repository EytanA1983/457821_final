#!/usr/bin/env python3
"""
Check and verify critical environment parameters
This script verifies that all required parameters are set correctly
"""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

print("=" * 70)
print("  🔍 Checking Critical Environment Parameters")
print("=" * 70)
print()

checks_passed = []
checks_failed = []
checks_warnings = []

def check_param(name: str, value: any, required: bool = True, min_length: int = None, warning: bool = False):
    """Check a parameter value"""
    if value:
        if min_length and len(str(value)) < min_length:
            status = "⚠️" if warning else "❌"
            msg = f"{name} is too short (minimum {min_length} characters)"
            if warning:
                checks_warnings.append((name, msg))
            else:
                checks_failed.append((name, msg))
            print(f"{status} {name}: {msg}")
            print(f"   Current length: {len(str(value))} characters")
            return False
        else:
            checks_passed.append(name)
            print(f"✅ {name}: SET")
            if min_length:
                print(f"   Length: {len(str(value))} characters (minimum: {min_length})")
            return True
    else:
        if required:
            checks_failed.append((name, "Not set"))
            print(f"❌ {name}: NOT SET (required)")
            return False
        else:
            checks_warnings.append((name, "Not set (optional)"))
            print(f"⚠️  {name}: NOT SET (optional)")
            return False

# 1. Check .env file exists
print("1️⃣  Checking .env file...")
env_file = Path(__file__).parent / ".env"
if env_file.exists():
    print(f"✅ .env file exists: {env_file.absolute()}")
    env_content = env_file.read_text(encoding='utf-8')
    print(f"   File size: {len(env_content)} bytes")
else:
    print(f"❌ .env file not found: {env_file.absolute()}")
    print("   Create backend/.env with required parameters")
    checks_failed.append((".env file", "Not found"))
print()

# 2. Load settings
print("2️⃣  Loading settings from config.py...")
try:
    from app.config import settings, get_settings
    
    # Verify settings can be loaded
    settings_instance = get_settings()
    print("✅ Settings loaded successfully")
    print()
    
    # 3. Check SECRET_KEY
    print("3️⃣  Checking SECRET_KEY...")
    secret_key = settings_instance.SECRET_KEY
    check_param("SECRET_KEY", secret_key, required=True, min_length=32)
    
    if secret_key:
        # Show first and last few characters (for verification)
        if len(secret_key) > 10:
            preview = secret_key[:5] + "..." + secret_key[-5:]
            print(f"   Preview: {preview}")
        else:
            print(f"   Value: {secret_key}")
    print()
    
    # 4. Check DATABASE_URL
    print("4️⃣  Checking DATABASE_URL...")
    database_url = settings_instance.DATABASE_URL
    check_param("DATABASE_URL", database_url, required=True)
    
    if database_url:
        # Determine database type
        if database_url.startswith("sqlite"):
            db_type = "SQLite"
            db_path = database_url.replace("sqlite:///", "")
            print(f"   Database type: {db_type}")
            if db_path and not db_path.startswith(":memory:"):
                db_file = Path(db_path)
                if db_file.exists():
                    print(f"   Database file: {db_file.absolute()} (exists)")
                else:
                    print(f"   Database file: {db_file.absolute()} (will be created)")
        elif database_url.startswith("postgresql"):
            db_type = "PostgreSQL"
            print(f"   Database type: {db_type}")
            # Don't show full URL (contains password)
            print(f"   Connection: {database_url.split('@')[1] if '@' in database_url else 'configured'}")
        else:
            print(f"   Database type: Unknown")
            print(f"   URL: {database_url[:50]}...")
    print()
    
    # 5. Check DEBUG
    print("5️⃣  Checking DEBUG configuration...")
    debug = settings_instance.DEBUG
    environment = settings_instance.ENVIRONMENT
    
    print(f"   DEBUG: {debug}")
    print(f"   ENVIRONMENT: {environment}")
    
    if environment == "development" and not debug:
        checks_warnings.append(("DEBUG", "DEBUG is False but ENVIRONMENT is development"))
        print("⚠️  WARNING: DEBUG is False but ENVIRONMENT is development")
        print("   Recommendation: Set DEBUG=True for development")
    elif environment == "production" and debug:
        checks_failed.append(("DEBUG", "DEBUG is True but ENVIRONMENT is production - SECURITY RISK!"))
        print("❌ ERROR: DEBUG is True but ENVIRONMENT is production - SECURITY RISK!")
        print("   Recommendation: Set DEBUG=False for production")
    else:
        checks_passed.append("DEBUG configuration")
        print("✅ DEBUG configuration is correct")
    print()
    
    # 6. Check if DEBUG allows empty SECRET_KEY
    print("6️⃣  Checking SECRET_KEY validation with DEBUG...")
    if debug and not secret_key:
        print("⚠️  WARNING: SECRET_KEY is empty but DEBUG=True")
        print("   In DEBUG mode, a default dev key will be used")
        print("   This is OK for development but NOT for production!")
    elif not debug and not secret_key:
        checks_failed.append(("SECRET_KEY", "SECRET_KEY is required when DEBUG=False"))
        print("❌ ERROR: SECRET_KEY is required when DEBUG=False")
    else:
        print("✅ SECRET_KEY validation is correct")
    print()
    
except Exception as e:
    print(f"❌ ERROR: Failed to load settings: {e}")
    import traceback
    traceback.print_exc()
    checks_failed.append(("Settings loading", str(e)))
    sys.exit(1)

# Summary
print("=" * 70)
print("  📊 Summary")
print("=" * 70)
print(f"✅ Passed: {len(checks_passed)}")
print(f"❌ Failed: {len(checks_failed)}")
print(f"⚠️  Warnings: {len(checks_warnings)}")
print()

if checks_failed:
    print("❌ Failed checks:")
    for name, error in checks_failed:
        print(f"   - {name}: {error}")
    print()

if checks_warnings:
    print("⚠️  Warnings:")
    for name, error in checks_warnings:
        print(f"   - {name}: {error}")
    print()

if not checks_failed:
    print("✅ All critical parameters are configured correctly!")
    print()
    print("Next steps:")
    print("  1. Run: alembic upgrade head (if not done)")
    print("  2. Start the server: python run-server-debug.py")
    sys.exit(0)
else:
    print("❌ Some critical parameters are missing or incorrect.")
    print()
    print("Quick fixes:")
    print("  1. Create/update backend/.env file:")
    print("     SECRET_KEY=your-secret-key-here-min-32-chars")
    print("     DATABASE_URL=sqlite:///./eli_maor_dev.db")
    print("     DEBUG=True")
    print("     ENVIRONMENT=development")
    print("  2. Restart the server")
    sys.exit(1)
