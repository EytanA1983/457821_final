"""Google Calendar schemas for API validation and serialization"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class CalendarEvent(BaseModel):
    """Schema for Google Calendar event"""
    id: str = Field(..., description="Event ID from Google Calendar")
    summary: Optional[str] = Field(None, description="Event title/summary")
    description: Optional[str] = Field(None, description="Event description")
    start: str = Field(..., description="Event start time (ISO format)")
    end: str = Field(..., description="Event end time (ISO format)")
    location: Optional[str] = Field(None, description="Event location")
    htmlLink: Optional[str] = Field(None, description="Link to event in Google Calendar")

    model_config = {"from_attributes": True}
