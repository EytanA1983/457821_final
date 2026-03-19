#!/usr/bin/env python3
"""
Simple script to run database migrations
Run this from the backend directory: python run-migrations-now.py
"""
import sys
import os
import subprocess

def main():
    """Run alembic migrations"""
    print("=" * 50)
    print("Running Database Migrations")
    print("=" * 50)
    print()
    
    # Check if we're in the backend directory
    if not os.path.exists("alembic.ini"):
        print("ERROR: alembic.ini not found!")
        print("Please run this script from the backend directory.")
        print(f"Current directory: {os.getcwd()}")
        sys.exit(1)
    
    # Check if .env exists
    if not os.path.exists(".env"):
        print("WARNING: .env file not found!")
        print("Migrations might fail if DATABASE_URL is not set.")
        print()
    
    # Try to run alembic
    print("Running: alembic upgrade head")
    print()
    
    try:
        # Try direct alembic command first
        result = subprocess.run(
            ["alembic", "upgrade", "head"],
            check=False,
            capture_output=True,
            text=True
        )
        
        if result.returncode == 0:
            print(result.stdout)
            print()
            print("=" * 50)
            print("✅ Migrations completed successfully!")
            print("=" * 50)
            print()
            print("Database tables created:")
            print("  ✓ users")
            print("  ✓ tasks")
            print("  ✓ rooms")
            print("  ✓ categories")
            print("  ✓ notifications")
            print("  ✓ and all other tables")
            print()
            print("You can now try registering again!")
            return 0
        else:
            # If direct command failed, try with python -m
            print("Direct alembic command failed, trying with python -m...")
            print()
            
            result = subprocess.run(
                [sys.executable, "-m", "alembic", "upgrade", "head"],
                check=False,
                capture_output=True,
                text=True
            )
            
            if result.returncode == 0:
                print(result.stdout)
                print()
                print("=" * 50)
                print("✅ Migrations completed successfully!")
                print("=" * 50)
                return 0
            else:
                print("ERROR: Migration failed!")
                print()
                print("STDOUT:")
                print(result.stdout)
                print()
                print("STDERR:")
                print(result.stderr)
                return 1
                
    except FileNotFoundError:
        print("ERROR: alembic not found!")
        print("Please install dependencies:")
        print("  pip install -r requirements.txt")
        print("  OR")
        print("  poetry install")
        return 1
    except Exception as e:
        print(f"ERROR: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())
