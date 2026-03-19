from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.models import DailyFocus, Task, User
from app.db.session import get_db
from app.schemas.daily_focus import (
    DailyFocusCompleteIn,
    DailyFocusRead,
    DailyFocusRefreshIn,
    DailyFocusTaskMini,
)

router = APIRouter(prefix="/api/daily-focus", tags=["daily-focus"])


def _focus_to_read(db: Session, user_id: int, focus: DailyFocus) -> DailyFocusRead:
    task_mini: Optional[DailyFocusTaskMini] = None
    if focus.task_id is not None:
        task = db.query(Task).filter(Task.id == focus.task_id, Task.user_id == user_id).first()
        if task is not None:
            task_mini = DailyFocusTaskMini(
                id=task.id,
                title=task.title,
                room_id=task.room_id,
                due_date=task.due_date,
                completed=bool(task.completed),
            )
    return DailyFocusRead(
        id=focus.id,
        user_id=focus.user_id,
        date=focus.date,
        task_id=focus.task_id,
        completed_at=focus.completed_at,
        task=task_mini,
    )


def _pick_task_id(
    db: Session,
    user_id: int,
    preferred_room_id: Optional[int] = None,
    exclude_task_id: Optional[int] = None,
) -> Optional[int]:
    open_q = db.query(Task).filter(Task.user_id == user_id, Task.completed.is_(False))
    open_tasks = open_q.all()
    if not open_tasks:
        return None

    if preferred_room_id is not None:
        preferred = [t for t in open_tasks if t.room_id == preferred_room_id and t.id != exclude_task_id]
        if preferred:
            preferred.sort(key=lambda t: (t.due_date is None, t.due_date or datetime.max, t.created_at))
            return preferred[0].id

    crowded_room_id = (
        db.query(Task.room_id, func.count(Task.id).label("cnt"))
        .filter(Task.user_id == user_id, Task.completed.is_(False), Task.room_id.isnot(None))
        .group_by(Task.room_id)
        .order_by(func.count(Task.id).desc())
        .first()
    )
    if crowded_room_id and crowded_room_id[0] is not None:
        crowded = [t for t in open_tasks if t.room_id == crowded_room_id[0] and t.id != exclude_task_id]
        if crowded:
            crowded.sort(key=lambda t: (t.due_date is None, t.due_date or datetime.max, t.created_at))
            return crowded[0].id

    fallback = [t for t in open_tasks if t.id != exclude_task_id]
    if not fallback:
        return None
    fallback.sort(key=lambda t: (t.due_date is None, t.due_date or datetime.max, t.created_at))
    return fallback[0].id


@router.get("/today", response_model=DailyFocusRead)
def get_daily_focus_today(
    preferred_room_id: Optional[int] = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = date.today()
    focus = db.query(DailyFocus).filter(DailyFocus.user_id == user.id, DailyFocus.date == today).first()

    if not focus:
        focus = DailyFocus(user_id=user.id, date=today, task_id=None)
        db.add(focus)
        db.commit()
        db.refresh(focus)

    if focus.completed_at is not None:
        return _focus_to_read(db, user.id, focus)

    if focus.task_id is not None:
        task = db.query(Task).filter(Task.id == focus.task_id, Task.user_id == user.id).first()
        if not task or task.completed:
            focus.task_id = None
            db.commit()
            db.refresh(focus)

    if focus.task_id is None:
        focus.task_id = _pick_task_id(db, user.id, preferred_room_id=preferred_room_id)
        db.commit()
        db.refresh(focus)

    return _focus_to_read(db, user.id, focus)


@router.post("/refresh", response_model=DailyFocusRead)
def refresh_daily_focus(
    payload: DailyFocusRefreshIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = date.today()
    focus = db.query(DailyFocus).filter(DailyFocus.user_id == user.id, DailyFocus.date == today).first()
    if not focus:
        focus = DailyFocus(user_id=user.id, date=today, task_id=None)
        db.add(focus)
        db.commit()
        db.refresh(focus)

    focus.completed_at = None
    next_task_id = _pick_task_id(
        db,
        user.id,
        preferred_room_id=payload.preferred_room_id,
        exclude_task_id=focus.task_id,
    )
    focus.task_id = next_task_id
    db.commit()
    db.refresh(focus)
    return _focus_to_read(db, user.id, focus)


@router.post("/complete", response_model=DailyFocusRead)
def complete_daily_focus(
    payload: DailyFocusCompleteIn,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    today = date.today()
    focus = db.query(DailyFocus).filter(DailyFocus.user_id == user.id, DailyFocus.date == today).first()
    if not focus:
        focus = DailyFocus(user_id=user.id, date=today, task_id=None)
        db.add(focus)
        db.commit()
        db.refresh(focus)

    task_id = payload.task_id or focus.task_id
    if not task_id:
        return _focus_to_read(db, user.id, focus)

    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user.id).first()
    if not task:
        return _focus_to_read(db, user.id, focus)

    task.completed = True
    task.completed_at = datetime.now(timezone.utc)
    focus.task_id = task_id
    focus.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(focus)
    return _focus_to_read(db, user.id, focus)
