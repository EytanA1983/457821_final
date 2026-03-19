"""
Services Package
Business logic layer for the application
"""

# Import services here for easy access
from app.services import shopping_service
from app.services.tasks import get_today_tasks

__all__ = ['shopping_service', 'get_today_tasks']
