#!/usr/bin/env python3
"""
Create database tables directly (bypass migrations)
Run this from the backend directory: python create-tables-directly.py
"""
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

try:
    print("=" * 50)
    print("Creating Database Tables Directly")
    print("=" * 50)
    print()
    
    # Import all models to ensure they're registered
    from app.db.base import Base
    from app.db.models import (
        User, Category, Room, Task, Todo, 
        NotificationSubscription, RefreshToken, TokenBlocklist, Notification
    )
    from app.db.session import engine
    
    print(f"Database URL: {engine.url}")
    print()
    print("Creating all tables...")
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    print()
    print("=" * 50)
    print("✅ Tables created successfully!")
    print("=" * 50)
    print()
    
    # Verify tables were created
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    print(f"Found {len(tables)} tables:")
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
        sys.exit(1)
    else:
        print()
        print("✅ All critical tables exist!")
        print()
        print("Next steps:")
        print("  1. Restart the backend server")
        print("  2. Try registering again")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
