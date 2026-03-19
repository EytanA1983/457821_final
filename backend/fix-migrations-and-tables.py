#!/usr/bin/env python3
"""
Fix migrations by creating missing base tables first, then running migrations.
This script handles the case where migrations expect tables to exist.
"""
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

print("=" * 70)
print("  🔧 Fixing Database: Create Tables + Run Migrations")
print("=" * 70)
print()

try:
    from sqlalchemy import inspect, text
    from app.db.session import engine
    from app.db.base import Base
    
    # Check existing tables
    print("🔍 Checking existing tables...")
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    print(f"   Found {len(existing_tables)} existing tables")
    if existing_tables:
        print(f"   Tables: {', '.join(sorted(existing_tables))}")
    print()
    
    # Critical tables that must exist
    critical_tables = ['users', 'tasks', 'rooms', 'categories']
    missing_tables = [t for t in critical_tables if t not in existing_tables]
    
    if missing_tables:
        print(f"⚠️  Missing critical tables: {missing_tables}")
        print("   Creating base tables from models...")
        print()
        
        # Import all models to register them
        from app.db.models import (
            User, Category, Room, Task, Todo,
            NotificationSubscription, RefreshToken, TokenBlocklist, Notification
        )
        
        # Create only missing tables (checkfirst=True)
        print("   Creating missing tables...")
        Base.metadata.create_all(bind=engine, checkfirst=True)
        
        # Verify
        inspector = inspect(engine)
        new_tables = inspector.get_table_names()
        still_missing = [t for t in critical_tables if t not in new_tables]
        
        if still_missing:
            print(f"   ❌ Still missing: {still_missing}")
            sys.exit(1)
        else:
            print(f"   ✅ All critical tables created!")
            print(f"   Total tables now: {len(new_tables)}")
    else:
        print("✅ All critical tables already exist")
    print()
    
    # Now run migrations
    print("🔄 Running Alembic migrations...")
    print("-" * 70)
    
    import subprocess
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=str(Path(__file__).parent),
        capture_output=False,
        text=True,
    )
    
    if result.returncode == 0:
        print("-" * 70)
        print()
        print("✅ Migrations completed successfully!")
        print()
        
        # Final verification
        inspector = inspect(engine)
        final_tables = inspector.get_table_names()
        print("=" * 70)
        print("  📊 Final Database Status")
        print("=" * 70)
        print(f"Total tables: {len(final_tables)}")
        print()
        print("Tables:")
        for table in sorted(final_tables):
            print(f"   ✓ {table}")
        
        critical = ['users', 'tasks', 'rooms', 'categories']
        missing = [t for t in critical if t not in final_tables]
        if missing:
            print()
            print(f"⚠️  Missing critical tables: {missing}")
            sys.exit(1)
        else:
            print()
            print("✅ All critical tables exist!")
            print()
            print("=" * 70)
            print("  ✅ Database setup completed successfully!")
            print("=" * 70)
    else:
        print()
        print(f"❌ Migrations failed with exit code: {result.returncode}")
        sys.exit(result.returncode)
        
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
