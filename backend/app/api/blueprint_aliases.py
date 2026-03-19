from __future__ import annotations

from typing import Literal, Optional

from fastapi import APIRouter, Body, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api import ai as ai_api
from app.api import daily_focus as daily_focus_api
from app.api import statistics as statistics_api
from app.api.deps import get_current_user
from app.db.models import Room, Task, User
from app.db.session import get_db
from app.schemas.daily_focus import DailyFocusCompleteIn, DailyFocusRead, DailyFocusRefreshIn
from app.schemas.statistics import HomeSummaryStatistics

router = APIRouter(prefix="/api", tags=["blueprint"])


class CoachSuggestionRead(BaseModel):
    room_id: Optional[int] = None
    room_name: Optional[str] = None
    task_id: Optional[int] = None
    task_title: str
    tip: str
    source: str


def _fallback_coach_suggestion(db: Session, user: User, room_id: Optional[int]) -> CoachSuggestionRead:
    base_query = db.query(Task).filter(Task.user_id == user.id, Task.completed.is_(False))
    if room_id is not None:
        base_query = base_query.filter(Task.room_id == room_id)

    task = (
        base_query.order_by(
            Task.due_date.is_(None),
            Task.due_date.asc(),
            Task.created_at.asc(),
        )
        .first()
    )

    room: Optional[Room] = None
    if room_id is not None:
        room = db.query(Room).filter(Room.id == room_id).first()
    elif task and task.room_id is not None:
        room = db.query(Room).filter(Room.id == task.room_id).first()

    if task:
        return CoachSuggestionRead(
            room_id=task.room_id,
            room_name=room.name if room else None,
            task_id=task.id,
            task_title=task.title,
            tip="Start with one small visible area and set a 5-minute timer.",
            source="fallback",
        )

    return CoachSuggestionRead(
        room_id=room_id,
        room_name=room.name if room else None,
        task_id=None,
        task_title="Create your first 5-minute task",
        tip="Tiny wins create momentum. Add one simple task and start now.",
        source="fallback",
    )


# NOTE: /api/daily-reset/today is now handled by app.api.routes.daily_reset
# Keeping /api/daily-reset/complete and /api/daily-reset/refresh here for backward compatibility


@router.post(
    "/daily-reset/complete",
    response_model=DailyFocusRead,
    summary="Complete daily reset task",
    description="Blueprint alias for daily focus completion. Accepts optional task_id.",
)
def complete_daily_reset(
    payload: Optional[DailyFocusCompleteIn] = Body(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    safe_payload = payload or DailyFocusCompleteIn()
    return daily_focus_api.complete_daily_focus(payload=safe_payload, db=db, user=user)


@router.post(
    "/daily-reset/refresh",
    response_model=DailyFocusRead,
    summary="Refresh daily reset task",
    description="Blueprint alias for daily focus refresh. Optionally accepts preferred_room_id.",
)
def refresh_daily_reset(
    payload: Optional[DailyFocusRefreshIn] = Body(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    safe_payload = payload or DailyFocusRefreshIn()
    return daily_focus_api.refresh_daily_focus(payload=safe_payload, db=db, user=user)


@router.get(
    "/progress",
    response_model=HomeSummaryStatistics,
    summary="Get dashboard progress KPIs",
    description="Blueprint alias for home summary statistics.",
)
def get_progress(
    range: Literal["week", "month"] = Query(default="week"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return statistics_api.get_home_summary_statistics(range=range, current_user=current_user, db=db)


@router.get(
    "/coach/suggestion",
    response_model=CoachSuggestionRead,
    summary="Get AI coach suggestion",
    description=(
        "Returns a single coach suggestion for the current user. "
        "Uses AI when available and falls back to a deterministic local suggestion."
    ),
)
def get_coach_suggestion(
    room_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        ai_result = ai_api.get_organization_suggestions(room_id=room_id, current_user=current_user, db=db)
        if room_id is not None and isinstance(ai_result, dict):
            suggestions = ai_result.get("suggestions") or []
            tips = ai_result.get("tips") or []
            if suggestions:
                first = suggestions[0]
                return CoachSuggestionRead(
                    room_id=room_id,
                    room_name=None,
                    task_id=None,
                    task_title=str(first.get("title") or "AI suggestion"),
                    tip=str((tips[0] if tips else first.get("description")) or "Take one small step."),
                    source="ai",
                )

        if room_id is None and isinstance(ai_result, dict):
            all_suggestions = ai_result.get("suggestions") or []
            if all_suggestions:
                first_group = all_suggestions[0]
                group_items = first_group.get("suggestions") or []
                group_tips = first_group.get("tips") or []
                first_item = group_items[0] if group_items else {}
                return CoachSuggestionRead(
                    room_id=first_group.get("room_id"),
                    room_name=first_group.get("room_name"),
                    task_id=None,
                    task_title=str(first_item.get("title") or "AI suggestion"),
                    tip=str((group_tips[0] if group_tips else first_item.get("description")) or "Take one small step."),
                    source="ai",
                )
    except Exception:
        # Keep this endpoint resilient even if AI is disabled/unavailable.
        pass

    return _fallback_coach_suggestion(db=db, user=current_user, room_id=room_id)
