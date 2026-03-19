#!/usr/bin/env python3
"""
Check if database tables exist
Run this from the backend directory: python check-db-tables.py
"""
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

try:
    from app.db.session import engine
    from sqlalchemy import inspect
    
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    print("=" * 50)
    print("Database Tables Check")
    print("=" * 50)
    print()
    print(f"Database URL: {engine.url}")
    print()
    
    if tables:
        print(f"✅ Found {len(tables)} tables:")
        for table in sorted(tables):
            print(f"   ✓ {table}")
        
        # Check for critical tables
        critical_tables = ['users', 'tasks', 'rooms', 'categories']
        missing = [t for t in critical_tables if t not in tables]
        
        if missing:
            print()
            print("⚠️  Missing critical tables:")
            for table in missing:
                print(f"   ✗ {table}")
            print()
            print("Run migrations:")
            print("  alembic upgrade head")
        else:
            print()
            print("✅ All critical tables exist!")
    else:
        print("❌ No tables found!")
        print()
        print("Run migrations:")
        print("  alembic upgrade head")
    
    print()
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
