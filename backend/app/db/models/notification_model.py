"""Notification model for user notifications"""
from __future__ import annotations
from datetime import datetime
from typing import TYPE_CHECKING, Optional
import enum
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Enum, func
from sqlalchemy.orm import relationship, Mapped, mapped_column
from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.user import User
    from app.db.models.task import Task


class NotificationType(str, enum.Enum):
    """Notification types"""
    TASK_DUE = "task_due"
    TASK_COMPLETED = "task_completed"
    REMINDER = "reminder"
    SYSTEM = "system"


class Notification(Base):
    """User notification model"""
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    type: Mapped[NotificationType] = mapped_column(
        Enum(NotificationType), 
        default=NotificationType.SYSTEM
    )
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    user_id: Mapped[int] = mapped_column(
        Integer, 
        ForeignKey("users.id", ondelete="CASCADE"), 
        nullable=False
    )
    related_task_id: Mapped[Optional[int]] = mapped_column(
        Integer, 
        ForeignKey("tasks.id", ondelete="SET NULL"), 
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        server_default=func.now()
    )

    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="notifications")
    related_task: Mapped[Optional["Task"]] = relationship("Task")
    
    def __repr__(self) -> str:
        return f"<Notification(id={self.id}, title='{self.title}', user_id={self.user_id})>"
