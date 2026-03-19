#!/usr/bin/env python3
"""
Comprehensive setup verification script
Checks all critical configuration and setup steps
"""
import sys
import os
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

print("=" * 70)
print("  🔍 Comprehensive Setup Verification")
print("=" * 70)
print()

# Track all checks
checks_passed = []
checks_failed = []
checks_warnings = []

def check(name: str, condition: bool, error_msg: str = "", warning: bool = False):
    """Record a check result"""
    if condition:
        checks_passed.append(name)
        print(f"✅ {name}")
    else:
        if warning:
            checks_warnings.append((name, error_msg))
            print(f"⚠️  {name}: {error_msg}")
        else:
            checks_failed.append((name, error_msg))
            print(f"❌ {name}: {error_msg}")

# 1. Check SECRET_KEY
print("1️⃣  Checking SECRET_KEY...")
try:
    from app.config import settings
    if settings.SECRET_KEY and len(settings.SECRET_KEY) >= 32:
        check("SECRET_KEY is set", True)
        print(f"   SECRET_KEY length: {len(settings.SECRET_KEY)} chars")
    elif settings.SECRET_KEY:
        check("SECRET_KEY is set", False, f"SECRET_KEY is too short ({len(settings.SECRET_KEY)} chars, minimum 32)", warning=True)
    else:
        check("SECRET_KEY is set", False, "SECRET_KEY is not set in .env file or environment variables")
except Exception as e:
    check("SECRET_KEY is set", False, f"Error loading settings: {e}")

print()

# 2. Check DATABASE_URL
print("2️⃣  Checking DATABASE_URL...")
try:
    from app.config import settings
    if settings.DATABASE_URL:
        check("DATABASE_URL is set", True)
        db_type = "SQLite" if settings.DATABASE_URL.startswith("sqlite") else "PostgreSQL" if settings.DATABASE_URL.startswith("postgresql") else "Unknown"
        print(f"   Database type: {db_type}")
        print(f"   DATABASE_URL: {settings.DATABASE_URL[:50]}...")
        
        # Check if SQLite file exists or can be created
        if settings.DATABASE_URL.startswith("sqlite"):
            db_path = settings.DATABASE_URL.replace("sqlite:///", "")
            if db_path and not db_path.startswith(":memory:"):
                db_file = Path(db_path)
                if db_file.exists():
                    print(f"   SQLite file exists: {db_file.absolute()}")
                else:
                    print(f"   SQLite file will be created at: {db_file.absolute()}")
    else:
        check("DATABASE_URL is set", False, "DATABASE_URL is not set in .env file or environment variables")
except Exception as e:
    check("DATABASE_URL is set", False, f"Error loading settings: {e}")

print()

# 3. Check database connection
print("3️⃣  Testing database connection...")
try:
    from app.db.session import engine
    from sqlalchemy import text
    
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        result.fetchone()
    check("Database connection", True)
except Exception as e:
    check("Database connection", False, f"Failed to connect: {e}")

print()

# 4. Check database tables (migrations)
print("4️⃣  Checking database tables (migrations)...")
try:
    from sqlalchemy import inspect
    from app.db.session import engine
    
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    critical_tables = ['users', 'refresh_tokens', 'token_blocklist']
    missing_tables = [t for t in critical_tables if t not in tables]
    
    if not missing_tables:
        check("Critical tables exist", True)
        print(f"   Found {len(tables)} tables total")
        print(f"   Critical tables: {', '.join(critical_tables)}")
    else:
        check("Critical tables exist", False, f"Missing tables: {', '.join(missing_tables)}. Run: alembic upgrade head")
        print(f"   Available tables: {', '.join(tables) if tables else 'None'}")
except Exception as e:
    check("Critical tables exist", False, f"Error checking tables: {e}")

print()

# 5. Check DEBUG configuration
print("5️⃣  Checking DEBUG configuration...")
try:
    from app.config import settings
    debug_status = settings.DEBUG
    environment = settings.ENVIRONMENT
    
    print(f"   DEBUG: {debug_status}")
    print(f"   ENVIRONMENT: {environment}")
    
    if environment == "development" and not debug_status:
        check("DEBUG configuration", False, "DEBUG is False but ENVIRONMENT is development", warning=True)
    elif environment == "production" and debug_status:
        check("DEBUG configuration", False, "DEBUG is True but ENVIRONMENT is production - SECURITY RISK!", warning=True)
    else:
        check("DEBUG configuration", True)
except Exception as e:
    check("DEBUG configuration", False, f"Error checking DEBUG: {e}")

print()

# 6. Check Alembic migrations
print("6️⃣  Checking Alembic migrations...")
try:
    alembic_dir = Path(__file__).parent / "alembic"
    versions_dir = alembic_dir / "versions"
    
    if alembic_dir.exists() and versions_dir.exists():
        migration_files = list(versions_dir.glob("*.py"))
        if migration_files:
            check("Alembic migrations exist", True)
            print(f"   Found {len(migration_files)} migration files")
        else:
            check("Alembic migrations exist", False, "No migration files found in alembic/versions/")
    else:
        check("Alembic migrations exist", False, "Alembic directory not found")
except Exception as e:
    check("Alembic migrations exist", False, f"Error checking migrations: {e}")

print()

# 7. Check .env file
print("7️⃣  Checking .env file...")
try:
    env_file = Path(__file__).parent / ".env"
    if env_file.exists():
        check(".env file exists", True)
        env_content = env_file.read_text(encoding='utf-8')
        
        required_vars = ['SECRET_KEY', 'DATABASE_URL', 'DEBUG']
        for var in required_vars:
            if f"{var}=" in env_content:
                print(f"   ✅ {var} is defined")
            else:
                print(f"   ⚠️  {var} is not defined")
    else:
        check(".env file exists", False, ".env file not found in backend directory")
except Exception as e:
    check(".env file exists", False, f"Error checking .env file: {e}")

print()

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
    print("✅ All critical checks passed! The application should work correctly.")
    sys.exit(0)
else:
    print("❌ Some critical checks failed. Please fix the issues above.")
    print()
    print("Quick fixes:")
    print("  1. Create/update backend/.env file with SECRET_KEY and DATABASE_URL")
    print("  2. Run: cd backend && alembic upgrade head")
    print("  3. Restart the backend server")
    sys.exit(1)
