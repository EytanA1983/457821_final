"""
Daily Focus Model
Simple model for tracking daily reset tasks
"""
from __future__ import annotations

from datetime import date
from typing import Optional

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer

from app.db.base import Base


class DailyFocus(Base):
    """Daily Focus model - tracks which task is selected for today's reset"""

    __tablename__ = "daily_focus"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    date = Column(Date, nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
