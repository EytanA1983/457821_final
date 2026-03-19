"""Schemas for GET /api/progress/summary."""

from __future__ import annotations

from datetime import date
from typing import List, Literal

from pydantic import BaseModel, Field


class DailyCompletedCount(BaseModel):
    """Task completions attributed to a calendar day (UTC)."""

    date: date
    count: int = Field(ge=0)


class ProgressSummaryRead(BaseModel):
    """
    Dashboard progress KPIs derived from Task rows (no separate progress table).

    When query param range=month, *completed_tasks_this_week* and *rooms_progressed_this_week*
    count the trailing 30 days (names kept for a stable API contract).
    """

    completed_tasks_this_week: int = Field(ge=0)
    rooms_progressed_this_week: int = Field(ge=0)
    streak_days: int = Field(ge=0)
    daily_completed_counts: List[DailyCompletedCount]
    range: Literal["week", "month"] = Field(
        default="week",
        description="Echo of the requested range; affects how the two *_this_week* fields are computed.",
    )
