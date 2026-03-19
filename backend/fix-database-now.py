#!/usr/bin/env python3
"""
Fix database - create tables and verify
Run this from the backend directory: python fix-database-now.py
"""
import sys
import os

# Add current directory to path
sys.path.insert(0, os.path.dirname(__file__))

try:
    print("=" * 60)
    print("  Database Fix Script")
    print("=" * 60)
    print()
    
    # Import settings first to see what database we're using
    from app.config import settings
    
    print(f"DEBUG mode: {settings.DEBUG}")
    print(f"Database URL: {settings.DATABASE_URL}")
    print()
    
    # Check if database file exists and delete it if it's corrupted
    db_url = settings.DATABASE_URL
    if db_url.startswith("sqlite:///"):
        db_file = db_url.replace("sqlite:///", "")
        if os.path.exists(db_file):
            print(f"⚠ Database file exists: {db_file}")
            print(f"   Deleting it to start fresh...")
            try:
                os.remove(db_file)
                print(f"✓ Database file deleted")
            except Exception as e:
                print(f"⚠ Could not delete database file: {e}")
                print(f"   Continuing anyway...")
        else:
            print(f"✓ Database file will be created: {db_file}")
    print()
    
    # Import all models to ensure they're registered
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
    print(f"Database file: {engine.url}")
    print()
    
    # Create all tables
    Base.metadata.create_all(bind=engine)
    
    print("✓ Tables creation command executed")
    print()
    
    # Verify tables were created
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    print("=" * 60)
    if tables:
        print(f"✅ SUCCESS! Found {len(tables)} tables:")
        print()
        for table in sorted(tables):
            print(f"   ✓ {table}")
        
        # Check for critical tables
        critical_tables = ['users', 'tasks', 'rooms', 'categories']
        missing = [t for t in critical_tables if t not in tables]
        
        if missing:
            print()
            print("⚠️  WARNING: Missing critical tables:")
            for table in missing:
                print(f"   ✗ {table}")
            print()
            print("This should not happen. Please check the error messages above.")
            sys.exit(1)
        else:
            print()
            print("✅ All critical tables exist!")
            print()
            print("=" * 60)
            print("  NEXT STEPS:")
            print("=" * 60)
            print()
            print("1. Restart the backend server:")
            print("   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000")
            print()
            print("2. Try registering again at:")
            print("   http://localhost:5179/register")
            print()
    else:
        print("❌ ERROR: No tables found!")
        print()
        print("Possible causes:")
        print("  - Database file is locked (server is running)")
        print("  - Wrong database file path")
        print("  - Permission issues")
        print()
        print("Try:")
        print("  1. Stop the server (Ctrl+C)")
        print("  2. Run this script again")
        sys.exit(1)
    
except Exception as e:
    print()
    print("=" * 60)
    print("  ERROR")
    print("=" * 60)
    print()
    print(f"❌ {type(e).__name__}: {e}")
    print()
    print("Full traceback:")
    import traceback
    traceback.print_exc()
    print()
    print("=" * 60)
    print("  TROUBLESHOOTING")
    print("=" * 60)
    print()
    print("1. Make sure you're in the backend directory:")
    print("   cd backend")
    print()
    print("2. Make sure .env file exists:")
    print("   Test-Path .env")
    print()
    print("3. Check DATABASE_URL in .env:")
    print("   Get-Content .env | Select-String DATABASE_URL")
    print()
    print("4. If server is running, stop it first (Ctrl+C)")
    print()
    sys.exit(1)
