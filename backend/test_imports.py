#!/usr/bin/env python3
"""Test script to verify all imports work correctly after fixes"""
import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def test_imports():
    """Test all critical imports"""
    errors = []
    
    print("🔍 Testing imports...")
    print()
    
    # Test 1: Notification models
    try:
        from app.db.models import Notification, NotificationType
        print("✅ app.db.models.Notification, NotificationType")
    except Exception as e:
        print(f"❌ app.db.models.Notification, NotificationType: {e}")
        errors.append(f"Notification models: {e}")
    
    # Test 2: NotificationService
    try:
        from app.services.notification_service import NotificationService
        print("✅ app.services.notification_service.NotificationService")
    except Exception as e:
        print(f"❌ app.services.notification_service.NotificationService: {e}")
        errors.append(f"NotificationService: {e}")
    
    # Test 3: Celery tasks - notifications
    try:
        from app.celery_tasks.notifications import send_daily_notifications
        print("✅ app.celery_tasks.notifications.send_daily_notifications")
    except Exception as e:
        print(f"❌ app.celery_tasks.notifications.send_daily_notifications: {e}")
        errors.append(f"send_daily_notifications: {e}")
    
    # Test 4: Celery tasks - maintenance
    try:
        from app.celery_tasks.maintenance import cleanup_old_notifications
        print("✅ app.celery_tasks.maintenance.cleanup_old_notifications")
    except Exception as e:
        print(f"❌ app.celery_tasks.maintenance.cleanup_old_notifications: {e}")
        errors.append(f"cleanup_old_notifications: {e}")
    
    # Test 5: Main app
    try:
        from app.main import app
        print("✅ app.main.app")
    except Exception as e:
        print(f"❌ app.main.app: {e}")
        errors.append(f"Main app: {e}")
    
    # Test 6: Middleware
    try:
        from app.api.middleware import MetricsMiddleware
        print("✅ app.api.middleware.MetricsMiddleware")
    except Exception as e:
        print(f"❌ app.api.middleware.MetricsMiddleware: {e}")
        errors.append(f"MetricsMiddleware: {e}")
    
    print()
    if errors:
        print(f"❌ Found {len(errors)} error(s):")
        for error in errors:
            print(f"   - {error}")
        return False
    else:
        print("✅ All imports successful!")
        return True

if __name__ == "__main__":
    success = test_imports()
    sys.exit(0 if success else 1)
