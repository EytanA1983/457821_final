#!/usr/bin/env python3
"""
Simple script to run the FastAPI server for development
Supports both HTTP and HTTPS modes
"""
import uvicorn
import os
from pathlib import Path

if __name__ == "__main__":
    # Check if HTTPS is enabled via environment variable
    use_https = os.getenv("USE_HTTPS", "false").lower() == "true"
    
    if use_https:
        cert_path = Path("certs/cert.pem")
        key_path = Path("certs/key.pem")
        
        if not cert_path.exists() or not key_path.exists():
            print("❌ SSL certificates not found!")
            print("Please generate certificates first:")
            print("  .\\generate-ssl-certs.ps1")
            print("Or set USE_HTTPS=false to use HTTP")
            exit(1)
        
        print("Starting server with HTTPS on https://127.0.0.1:8000")
        print("⚠️  Browser will show security warning (self-signed cert)")
        uvicorn.run(
            "app.main:app",
            host="127.0.0.1",
            port=8000,
            reload=True,
            log_level="info",
            ssl_keyfile=str(key_path),
            ssl_certfile=str(cert_path)
        )
    else:
        print("Starting server with HTTP on http://127.0.0.1:8000")
        uvicorn.run(
            "app.main:app",
            host="127.0.0.1",
            port=8000,
            reload=True,
            log_level="info"
        )
