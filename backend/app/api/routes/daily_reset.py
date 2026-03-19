"""
Daily Reset — public surface under /api/daily-reset (GET today).
POST /complete and /refresh are registered on blueprint_aliases (same paths).
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.daily_focus import get_daily_focus_today
from app.api.deps import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.daily_focus import DailyFocusRead

router = APIRouter(prefix="/api/daily-reset", tags=["daily-reset"])


@router.get("/today", response_model=DailyFocusRead)
def get_today_reset(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Today's daily reset: one row per user per day; same logic as /api/daily-focus/today."""
    return get_daily_focus_today(preferred_room_id=None, db=db, user=user)
