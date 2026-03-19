from __future__ import annotations

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class DailyFocusTaskMini(BaseModel):
    id: int
    title: str
    room_id: Optional[int] = None
    due_date: Optional[datetime] = None
    completed: bool

    model_config = ConfigDict(from_attributes=True)


class DailyFocusRead(BaseModel):
    id: Optional[int] = None
    user_id: int
    date: date
    task_id: Optional[int] = None
    completed_at: Optional[datetime] = None
    task: Optional[DailyFocusTaskMini] = None

    model_config = ConfigDict(from_attributes=True)


class DailyFocusCompleteIn(BaseModel):
    task_id: Optional[int] = None


class DailyFocusRefreshIn(BaseModel):
    preferred_room_id: Optional[int] = None
