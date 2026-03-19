"""Room schemas for API validation and serialization"""
from __future__ import annotations
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime


class RoomBase(BaseModel):
    """Base schema for Room"""
    name: str = Field(..., min_length=1, max_length=100, description="Room name")
    description: Optional[str] = Field(None, max_length=500, description="Room description")
    color: Optional[str] = Field("earth", description="Room color theme")


class RoomCreate(RoomBase):
    """Schema for creating a new room"""
    pass


class RoomUpdate(BaseModel):
    """Schema for updating an existing room (all fields optional)"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    color: Optional[str] = None


class RoomRead(RoomBase):
    """Schema for reading room data"""
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RoomResponse(BaseModel):
    """Simplified room response for API"""
    id: int
    name: str
    user_id: int  # Keep as user_id for API compatibility, maps to owner_id in model

    model_config = ConfigDict(from_attributes=True)


class RoomShareInfo(BaseModel):
    """Information about room sharing"""
    user_id: int
    user_email: str
    permission: str  # owner, editor, viewer
    shared_at: datetime


class RoomWithShares(RoomRead):
    """Room with sharing information"""
    owner_id: int
    is_shared: bool = False
    shares: List[RoomShareInfo] = []

    model_config = ConfigDict(from_attributes=True)
