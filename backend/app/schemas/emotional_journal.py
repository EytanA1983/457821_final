from __future__ import annotations

from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class EmotionalJournalCreate(BaseModel):
    item_name: str = Field(..., min_length=1, max_length=200)
    why_keep: str = Field("", max_length=2000)
    spark_joy: bool = False


class EmotionalJournalRead(BaseModel):
    id: int
    user_id: int
    item_name: str
    why_keep: str
    spark_joy: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
