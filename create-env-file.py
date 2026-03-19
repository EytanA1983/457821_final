#!/usr/bin/env python3
"""Create .env file in backend directory"""
from pathlib import Path
import os

# Get current working directory
workspace = Path.cwd()
backend_dir = workspace / "backend"
env_file = backend_dir / ".env"

# Content for .env file
content = """DEBUG=True
SECRET_KEY=dev-secret-key-this-is-a-very-long-key-32-chars-min
DATABASE_URL=sqlite:///./eli_maor_dev.db
REDIS_URL=redis://localhost:6379/0
ENVIRONMENT=development
"""

print(f"Current directory: {workspace}")
print(f"Backend directory: {backend_dir}")
print(f"Env file path: {env_file}")

if env_file.exists():
    print(f"⚠️  .env file already exists, overwriting...")
else:
    print(f"Creating .env file...")

env_file.write_text(content, encoding='utf-8')
print(f"✅ Created/Updated .env file at: {env_file.absolute()}")
print(f"\nContents:")
print(env_file.read_text(encoding='utf-8'))
