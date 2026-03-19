"""Progress / streak API (dashboard)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import User
from app.db.session import get_db
from app.schemas.progress import ProgressSummaryRead
from app.services.progress import compute_progress_summary

router = APIRouter(prefix="/progress", tags=["progress"])


@router.get("/summary", response_model=ProgressSummaryRead)
def get_progress_summary(
    time_range: str = Query(
        default="week",
        alias="range",
        description="week = current ISO week (Mon–Sun, UTC). month = trailing 30 days for task/room counts.",
        pattern="^(week|month)$",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Weekly (or monthly) progress and streak from `tasks` completion data.

    See `app.services.progress` for timestamp precedence and streak rules.
    """
    return compute_progress_summary(db, current_user.id, time_range)
