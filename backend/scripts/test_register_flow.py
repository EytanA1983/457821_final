#!/usr/bin/env python3
"""
Practical test script for Register → /api/auth/me flow
Tests that registration works server-side and tokens are valid.

Usage:
    python scripts/test_register_flow.py
    # Or with custom API URL:
    API_URL=http://localhost:8000 python scripts/test_register_flow.py
"""
import os
import sys
import requests
import time
from typing import Dict, Any

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

API_URL = os.getenv("API_URL", "http://localhost:8000")


def test_register_flow() -> bool:
    """Test complete flow: Register → GET /api/auth/me"""
    print("=" * 60)
    print("Testing Register → /api/auth/me Flow")
    print("=" * 60)
    
    # Generate unique email
    timestamp = int(time.time())
    test_email = f"test-register-{timestamp}@example.com"
    test_password = "TestPassword123!"
    
    print(f"\n📧 Test Email: {test_email}")
    print(f"🔒 Test Password: {'*' * len(test_password)}")
    
    # Step 1: Register user
    print("\n" + "-" * 60)
    print("Step 1: Registering user...")
    print("-" * 60)
    
    register_url = f"{API_URL}/api/auth/register"
    register_payload = {
        "email": test_email,
        "password": test_password,
    }
    
    try:
        register_response = requests.post(
            register_url,
            json=register_payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"Status Code: {register_response.status_code}")
        
        if register_response.status_code not in [200, 201]:
            print(f"❌ Registration failed!")
            print(f"Response: {register_response.text}")
            return False
        
        register_data = register_response.json()
        print(f"✅ Registration successful!")
        
        # Verify tokens are returned
        if "access_token" not in register_data:
            print(f"❌ No access_token in response!")
            print(f"Response keys: {list(register_data.keys())}")
            return False
        
        if "refresh_token" not in register_data:
            print(f"❌ No refresh_token in response!")
            print(f"Response keys: {list(register_data.keys())}")
            return False
        
        access_token = register_data["access_token"]
        refresh_token = register_data["refresh_token"]
        
        print(f"✅ Access Token: {access_token[:20]}... (length: {len(access_token)})")
        print(f"✅ Refresh Token: {refresh_token[:20]}... (length: {len(refresh_token)})")
        print(f"✅ Token Type: {register_data.get('token_type', 'N/A')}")
        print(f"✅ Expires In: {register_data.get('expires_in', 'N/A')} seconds")
        
        # Step 2: Verify token with /api/auth/me
        print("\n" + "-" * 60)
        print("Step 2: Verifying token with /api/auth/me...")
        print("-" * 60)
        
        me_url = f"{API_URL}/api/auth/me"
        me_headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        
        me_response = requests.get(
            me_url,
            headers=me_headers,
            timeout=10
        )
        
        print(f"Status Code: {me_response.status_code}")
        
        if me_response.status_code != 200:
            print(f"❌ /api/auth/me failed!")
            print(f"Response: {me_response.text}")
            return False
        
        me_data = me_response.json()
        print(f"✅ /api/auth/me successful!")
        
        # Verify user data
        if me_data.get("email") != test_email:
            print(f"❌ Email mismatch!")
            print(f"Expected: {test_email}")
            print(f"Got: {me_data.get('email')}")
            return False
        
        print(f"✅ User ID: {me_data.get('id')}")
        print(f"✅ Email: {me_data.get('email')}")
        print(f"✅ Is Active: {me_data.get('is_active')}")
        print(f"✅ Full Name: {me_data.get('full_name', 'N/A')}")
        print(f"✅ Created At: {me_data.get('created_at', 'N/A')}")
        
        # Verify sensitive data is not returned
        if "hashed_password" in me_data:
            print(f"⚠️  WARNING: hashed_password should not be in response!")
        if "password" in me_data:
            print(f"⚠️  WARNING: password should not be in response!")
        
        # Step 3: Summary
        print("\n" + "=" * 60)
        print("✅ ALL TESTS PASSED!")
        print("=" * 60)
        print(f"✅ User registered successfully: {test_email}")
        print(f"✅ Tokens returned: access_token + refresh_token")
        print(f"✅ Token verified with /api/auth/me")
        print(f"✅ User data correct: ID {me_data.get('id')}, Email {me_data.get('email')}")
        print("=" * 60)
        
        return True
        
    except requests.exceptions.ConnectionError:
        print(f"❌ Connection Error: Could not connect to {API_URL}")
        print(f"   Make sure the backend server is running!")
        return False
    except requests.exceptions.Timeout:
        print(f"❌ Timeout: Request took too long")
        return False
    except Exception as e:
        print(f"❌ Error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = test_register_flow()
    sys.exit(0 if success else 1)
