#!/usr/bin/env python3
"""
Run Alembic migrations to create database tables
This script runs: alembic upgrade head
"""
import sys
import subprocess
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

print("=" * 70)
print("  🔄 Running Database Migrations")
print("=" * 70)
print()

# Check if we're in the backend directory
if not (backend_dir / "alembic.ini").exists():
    print("❌ ERROR: alembic.ini not found!")
    print(f"   Current directory: {Path.cwd()}")
    print(f"   Expected: {backend_dir}")
    print("   Run this script from the backend directory")
    sys.exit(1)

# Check if .env exists
env_file = backend_dir / ".env"
if not env_file.exists():
    print("⚠️  WARNING: .env file not found!")
    print("   Migrations may fail if DATABASE_URL is not set")
    print()

# Check DATABASE_URL before running migrations
try:
    from app.config import settings
    if settings.DATABASE_URL:
        print(f"✅ DATABASE_URL is set")
        db_type = "SQLite" if settings.DATABASE_URL.startswith("sqlite") else "PostgreSQL"
        print(f"   Database type: {db_type}")
        if db_type == "SQLite":
            db_path = settings.DATABASE_URL.replace("sqlite:///", "")
            if db_path and not db_path.startswith(":memory:"):
                db_file = Path(db_path)
                print(f"   Database file: {db_file.absolute()}")
    else:
        print("❌ ERROR: DATABASE_URL is not set!")
        print("   Set DATABASE_URL in backend/.env before running migrations")
        sys.exit(1)
except Exception as e:
    print(f"⚠️  WARNING: Could not load settings: {e}")
    print("   Continuing anyway...")
    print()

# Check if users table exists (required for migrations)
print("Checking if base tables exist...")
try:
    from sqlalchemy import inspect
    from app.db.session import engine
    
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()
    
    if "users" not in existing_tables:
        print("⚠️  WARNING: 'users' table does not exist!")
        print("   The migrations assume 'users' table already exists.")
        print("   Creating base tables from models first...")
        print()
        
        # Create base tables from models
        from app.db.base import Base
        from app.db.models import (
            User, Category, Room, Task, Todo,
            NotificationSubscription, RefreshToken, TokenBlocklist, Notification
        )
        
        print("Creating base tables (users, tasks, rooms, categories, etc.)...")
        Base.metadata.create_all(bind=engine)
        
        # Verify users table was created
        inspector = inspect(engine)
        new_tables = inspector.get_table_names()
        if "users" in new_tables:
            print("✅ Base tables created successfully!")
            print(f"   Created tables: {', '.join([t for t in new_tables if t not in existing_tables])}")
        else:
            print("❌ ERROR: Failed to create users table!")
            sys.exit(1)
        print()
    else:
        print("✅ Base tables already exist")
        print(f"   Found {len(existing_tables)} tables")
    print()
except Exception as e:
    print(f"⚠️  WARNING: Could not check/create base tables: {e}")
    print("   Continuing with migrations anyway...")
    print()

print()
print("Running: alembic upgrade head")
print("-" * 70)

# Run alembic upgrade head
try:
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=str(backend_dir),
        capture_output=False,  # Show output in real-time
        text=True,
    )
    
    if result.returncode == 0:
        print("-" * 70)
        print()
        print("✅ Migrations completed successfully!")
        print()
        
        # Verify tables were created
        try:
            from sqlalchemy import inspect
            from app.db.session import engine
            
            inspector = inspect(engine)
            tables = inspector.get_table_names()
            
            print("=" * 70)
            print("  📊 Database Tables Check")
            print("=" * 70)
            print(f"Total tables: {len(tables)}")
            print()
            
            critical_tables = ['users', 'refresh_tokens', 'token_blocklist']
            missing_tables = [t for t in critical_tables if t not in tables]
            
            if not missing_tables:
                print("✅ All critical tables exist:")
                for table in critical_tables:
                    print(f"   ✓ {table}")
            else:
                print("⚠️  Missing critical tables:")
                for table in missing_tables:
                    print(f"   ✗ {table}")
            
            if tables:
                print()
                print("All tables in database:")
                for table in sorted(tables):
                    marker = "✓" if table in critical_tables else " "
                    print(f"   {marker} {table}")
            
            print()
            print("=" * 70)
            
        except Exception as e:
            print(f"⚠️  Could not verify tables: {e}")
            print("   But migrations completed successfully")
        
        sys.exit(0)
    else:
        print("-" * 70)
        print()
        print(f"❌ Migrations failed with exit code {result.returncode}")
        print("   Check the error messages above")
        sys.exit(1)
        
except FileNotFoundError:
    print("❌ ERROR: alembic not found!")
    print("   Install alembic: pip install alembic")
    sys.exit(1)
except Exception as e:
    print(f"❌ ERROR: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
