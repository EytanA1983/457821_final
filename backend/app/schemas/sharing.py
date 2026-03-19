"""
Pydantic schemas for room sharing
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from app.services.permissions import Permission


class RoomShareCreate(BaseModel):
    """Schema for sharing a room"""
    user_id: int = Field(..., description="ID of user to share with")
    permission: Permission = Field(
        default=Permission.VIEWER,
        description="Permission level (owner, editor, viewer)",
    )


class RoomShareByEmailCreate(BaseModel):
    """Schema for sharing a room by target user email"""
    email: str = Field(..., description="Email of user to share with")
    permission: Permission = Field(
        default=Permission.VIEWER,
        description="Permission level (owner, editor, viewer)",
    )


class RoomShareResponse(BaseModel):
    """Schema for room share response"""
    id: int
    room_id: int
    user_id: int
    user_email: Optional[str] = None
    user_name: Optional[str] = None
    permission: str
    shared_by: int
    created_at: datetime

    class Config:
        from_attributes = True


class RoomShareUpdate(BaseModel):
    """Schema for updating room share permission"""
    permission: Permission = Field(..., description="New permission level")


class RoomWithShares(BaseModel):
    """Room with sharing information"""
    id: int
    name: str
    user_id: int
    is_shared: bool
    owner_email: Optional[str] = None
    owner_name: Optional[str] = None
    shares: List[RoomShareResponse] = []

    class Config:
        from_attributes = True
