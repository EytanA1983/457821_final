#!/usr/bin/env python3
"""Fix and setup backend - creates .env, runs migrations, verifies setup"""
import os
import sys
from pathlib import Path
import subprocess

# Get backend directory (where this script is located)
backend_dir = Path(__file__).parent
os.chdir(backend_dir)

print("=" * 60)
print("Backend Setup and Fix Script")
print("=" * 60)
print(f"Working directory: {backend_dir.absolute()}\n")

# Step 1: Create .env file
print("Step 1: Creating .env file...")
env_file = backend_dir / ".env"
env_content = """DEBUG=True
SECRET_KEY=dev-secret-key-this-is-a-very-long-key-32-chars-min
DATABASE_URL=sqlite:///./eli_maor_dev.db
REDIS_URL=redis://localhost:6379/0
ENVIRONMENT=development
"""

if env_file.exists():
    print(f"⚠️  .env file already exists, overwriting...")
else:
    print(f"Creating .env file...")

env_file.write_text(env_content, encoding='utf-8')
print(f"✅ Created/Updated .env file at: {env_file.absolute()}")

# Verify .env content
content = env_file.read_text(encoding='utf-8')
has_secret_key = 'SECRET_KEY=' in content
has_database_url = 'DATABASE_URL=' in content
print(f"   SECRET_KEY present: {has_secret_key}")
print(f"   DATABASE_URL present: {has_database_url}")

if not has_secret_key or not has_database_url:
    print("❌ ERROR: .env file is missing required variables!")
    sys.exit(1)

# Step 2: Install passlib[bcrypt]
print("\nStep 2: Installing passlib[bcrypt]...")
try:
    subprocess.run([sys.executable, "-m", "pip", "install", "passlib[bcrypt]", "--quiet"], 
                   check=True, capture_output=True)
    print("✅ passlib[bcrypt] installed/verified")
except subprocess.CalledProcessError as e:
    print(f"⚠️  Warning: Could not install passlib[bcrypt]: {e}")
    print("   Continuing anyway...")

# Step 3: Run alembic migrations
print("\nStep 3: Running alembic migrations...")
if not (backend_dir / "alembic.ini").exists():
    print("❌ ERROR: alembic.ini not found!")
    print(f"   Expected at: {(backend_dir / 'alembic.ini').absolute()}")
    sys.exit(1)

try:
    result = subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], 
                           cwd=backend_dir, capture_output=True, text=True)
    if result.returncode == 0:
        print("✅ Alembic migrations completed successfully")
        if result.stdout:
            print("   Output:", result.stdout.strip())
    else:
        print("⚠️  Warning: Alembic migrations had issues:")
        print(result.stderr)
except Exception as e:
    print(f"⚠️  Warning: Could not run alembic: {e}")
    print("   You may need to run it manually: cd backend && python -m alembic upgrade head")

# Step 4: Verify settings can be loaded
print("\nStep 4: Verifying settings can be loaded...")
try:
    # Add backend to path
    sys.path.insert(0, str(backend_dir))
    from app.config import settings
    
    print(f"   SECRET_KEY: {'SET (' + str(len(settings.SECRET_KEY)) + ' chars)' if settings.SECRET_KEY else 'NOT SET'}")
    print(f"   DATABASE_URL: {settings.DATABASE_URL[:50] + '...' if settings.DATABASE_URL else 'NOT SET'}")
    print(f"   DEBUG: {settings.DEBUG}")
    
    if not settings.SECRET_KEY:
        print("❌ ERROR: SECRET_KEY is not set!")
        sys.exit(1)
    if not settings.DATABASE_URL:
        print("❌ ERROR: DATABASE_URL is not set!")
        sys.exit(1)
    
    print("✅ Settings loaded successfully")
except Exception as e:
    print(f"❌ ERROR: Could not load settings: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\n" + "=" * 60)
print("✅ Setup completed successfully!")
print("=" * 60)
print("\nNext steps:")
print("1. Restart the backend server:")
print("   cd backend")
print("   python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000")
print("\n2. Try registering a user again")
