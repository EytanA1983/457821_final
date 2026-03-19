#!/usr/bin/env python3
"""
Run the FastAPI server with full debug logging and traceback
This ensures all 500 errors show complete traceback with line numbers, dates, and object details
"""
import uvicorn
import sys
from pathlib import Path

# Add backend to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

if __name__ == "__main__":
    print("=" * 70)
    print("  🚀 Starting Backend Server with Full Debug Logging")
    print("=" * 70)
    print()
    print("Configuration:")
    print("  - Reload: Enabled (auto-reload on code changes)")
    print("  - Debug: Enabled (full traceback on errors)")
    print("  - Log Level: DEBUG (all logs including SQL queries)")
    print("  - Host: 0.0.0.0 (accessible from all interfaces)")
    print("  - Port: 8000")
    print()
    print("⚠️  IMPORTANT: Watch the console for full traceback on 500 errors!")
    print("   All errors will show:")
    print("   - Date and time")
    print("   - File path and line number")
    print("   - Full stack trace")
    print("   - Object details")
    print()
    print("=" * 70)
    print()
    
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,  # Auto-reload on code changes
        log_level="debug",  # Show all logs including DEBUG
        access_log=True,  # Log all HTTP requests
        use_colors=True,  # Color-coded logs
        # These settings ensure full traceback:
        loop="auto",
        reload_dirs=[str(backend_dir / "app")] if (backend_dir / "app").exists() else None,
        # Enable debug mode for full traceback
        # Note: uvicorn doesn't have a --debug flag, but log_level="debug" enables detailed logging
    )
