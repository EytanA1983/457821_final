"""Pydantic schemas for vision journal (inspiration board) entries."""

from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator


class VisionJournalEntryCreate(BaseModel):
    entry_type: Literal["text", "image"]
    text_content: Optional[str] = None
    image_url: Optional[str] = Field(None, max_length=2048)
    caption: Optional[str] = Field(None, max_length=500)
    position: Optional[int] = None

    @field_validator("text_content")
    @classmethod
    def strip_text(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = v.strip()
        return s if s else None

    @field_validator("caption")
    @classmethod
    def strip_caption(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        s = v.strip()
        return s if s else None


class VisionJournalEntryRead(BaseModel):
    id: int
    user_id: int
    entry_type: Literal["text", "image"]
    text_content: Optional[str] = None
    image_url: Optional[str] = None
    caption: Optional[str] = None
    position: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class VisionJournalImageUploadResponse(BaseModel):
    url: str
