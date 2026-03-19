"""
Database models package.

All models are exported here for convenient importing:
    from app.db.models import User, Task, Room, ...
"""

# User-related models
from app.db.models.user import User, Role, UserRole

# OAuth
from app.db.models.oauth import OAuthAccount

# Category
from app.db.models.category import Category

# Room-related models
from app.db.models.room import Room, RoomShare

# Task-related models
from app.db.models.task import Task, Recurrence

# Inventory
from app.db.models.inventory import InventoryArea, InventoryItem

# Emotional journal
from app.db.models.emotional_journal import EmotionalJournalEntry

# Daily focus
from app.db.models.daily_focus import DailyFocus

# Todo (sub-tasks)
from app.db.models.todo import Todo

# Notification subscription
from app.db.models.notification import NotificationSubscription
# Notification model
from app.db.models.notification_model import Notification, NotificationType

# Audit logging
from app.db.models.audit import AuditLog, AuditAction

# Refresh tokens
from app.db.models.refresh_token import RefreshToken

# Token blocklist
from app.db.models.token_blocklist import TokenBlocklist

# Re-export Base for convenience
from app.db.base import Base

__all__ = [
    # Base
    "Base",
    # User
    "User",
    "Role",
    "UserRole",
    # OAuth
    "OAuthAccount",
    # Category
    "Category",
    # Room
    "Room",
    "RoomShare",
    # Task
    "Task",
    "Recurrence",
    # Inventory
    "InventoryArea",
    "InventoryItem",
    # Emotional journal
    "EmotionalJournalEntry",
    # Daily focus
    "DailyFocus",
    # Todo
    "Todo",
    # Notification
    "NotificationSubscription",
    "Notification",
    "NotificationType",
    # Audit
    "AuditLog",
    "AuditAction",
    # Refresh Token
    "RefreshToken",
    # Token Blocklist
    "TokenBlocklist",
]
