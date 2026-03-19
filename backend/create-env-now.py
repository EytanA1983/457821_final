#!/usr/bin/env python3
"""Create .env file in backend directory"""
from pathlib import Path

# Get backend directory (where this script is located)
backend_dir = Path(__file__).parent
env_file = backend_dir / ".env"

# Content for .env file
env_content = """DEBUG=True
SECRET_KEY=dev-secret-key-this-is-a-very-long-key-32-chars-min
DATABASE_URL=sqlite:///./eli_maor_dev.db
REDIS_URL=redis://localhost:6379/0
ENVIRONMENT=development
"""

# Create .env file
if env_file.exists():
    print(f"⚠️  .env file already exists at: {env_file}")
    print("Overwriting...")

env_file.write_text(env_content, encoding='utf-8')
print(f"✅ Created/Updated .env file at: {env_file}")
print(f"\nContents:")
print(env_content)
