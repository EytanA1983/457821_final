#!/usr/bin/env python3
"""
Check database connection and status.
This script verifies that the database is accessible and running.
"""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

try:
    from app.config import settings
    from app.db.session import engine
    from sqlalchemy import text, inspect
    from sqlalchemy.exc import SQLAlchemyError, OperationalError
    
    print("=" * 70)
    print("  🔍 Database Connection Check")
    print("=" * 70)
    print()
    
    # Check DATABASE_URL
    if not settings.DATABASE_URL:
        print("❌ ERROR: DATABASE_URL is not set!")
        print("   Please set DATABASE_URL in backend/.env")
        print("   Example: DATABASE_URL=sqlite:///./eli_maor_dev.db")
        sys.exit(1)
    
    print(f"✅ DATABASE_URL is set")
    print(f"   Type: {'SQLite' if 'sqlite' in settings.DATABASE_URL.lower() else 'PostgreSQL' if 'postgres' in settings.DATABASE_URL.lower() else 'Unknown'}")
    print(f"   URL: {settings.DATABASE_URL[:60] + '...' if len(settings.DATABASE_URL) > 60 else settings.DATABASE_URL}")
    print()
    
    # Test connection
    print("🔍 Testing database connection...")
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            result.fetchone()
        print("✅ Database connection successful!")
        print()
    except OperationalError as e:
        error_msg = str(e)
        print(f"❌ Database connection failed!")
        print(f"   Error: {error_msg}")
        print()
        
        if 'postgres' in settings.DATABASE_URL.lower():
            print("💡 For PostgreSQL:")
            print("   1. Make sure PostgreSQL is running:")
            print("      docker-compose up -d db")
            print("   2. Or start PostgreSQL manually")
            print("   3. Check that DATABASE_URL is correct")
        elif 'sqlite' in settings.DATABASE_URL.lower():
            print("💡 For SQLite:")
            print("   1. Check file permissions")
            print("   2. Check that the directory exists")
            print("   3. SQLite should work automatically")
        
        sys.exit(1)
    except SQLAlchemyError as e:
        print(f"❌ Database error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    
    # Check tables
    print("🔍 Checking database tables...")
    try:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        print(f"✅ Found {len(tables)} tables")
        
        critical_tables = ['users', 'tasks', 'rooms', 'categories']
        missing_tables = [t for t in critical_tables if t not in tables]
        
        if missing_tables:
            print(f"⚠️  Missing critical tables: {missing_tables}")
            print("   Run migrations: alembic upgrade head")
        else:
            print("✅ All critical tables exist")
        
        if tables:
            print("\n📋 Available tables:")
            for table in sorted(tables):
                print(f"   ✓ {table}")
    except Exception as e:
        print(f"⚠️  Could not inspect tables: {e}")
        print("   This might be OK if the database is empty")
    
    print()
    print("=" * 70)
    print("  ✅ Database check completed successfully!")
    print("=" * 70)
    
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("   Make sure you're running from the backend directory")
    sys.exit(1)
except Exception as e:
    print(f"❌ Unexpected error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
