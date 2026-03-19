#!/usr/bin/env python3
"""
Create database tables - simple version
Run this from the backend directory: python create-tables-now.py
"""
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

try:
    print("=" * 60)
    print("  Creating Database Tables")
    print("=" * 60)
    print()
    
    # Import settings
    from app.config import settings
    print(f"DEBUG mode: {settings.DEBUG}")
    print(f"Database URL: {settings.DATABASE_URL}")
    print()
    
    # Import all models
    print("Importing models...")
    from app.db.base import Base
    from app.db.models import (
        User, Category, Room, Task, Todo, 
        NotificationSubscription, RefreshToken, TokenBlocklist, Notification
    )
    print("✓ Models imported")
    print()
    
    # Get engine
    from app.db.session import engine
    
    print("Creating all tables...")
    print(f"Database: {engine.url}")
    print()
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    print("✓ Tables created!")
    print()
    
    # Verify tables
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    print("=" * 60)
    if tables:
        print(f"✅ SUCCESS! Found {len(tables)} tables:")
        print()
        for table in sorted(tables):
            print(f"   ✓ {table}")
        
        # Check critical tables
        critical_tables = ['users', 'tasks', 'rooms', 'categories']
        missing = [t for t in critical_tables if t not in tables]
        
        if missing:
            print()
            print("⚠️  WARNING: Missing critical tables:")
            for table in missing:
                print(f"   ✗ {table}")
            sys.exit(1)
        else:
            print()
            print("✅ All critical tables exist!")
            print()
            print("=" * 60)
            print("  NEXT: Restart the server and try registering!")
            print("=" * 60)
    else:
        print("❌ ERROR: No tables found!")
        sys.exit(1)
    
except Exception as e:
    print()
    print("=" * 60)
    print("  ERROR")
    print("=" * 60)
    print()
    print(f"❌ {type(e).__name__}: {e}")
    print()
    import traceback
    traceback.print_exc()
    sys.exit(1)
