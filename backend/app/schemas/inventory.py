from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, ConfigDict


class InventoryAreaBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    room_id: Optional[int] = None
    description: Optional[str] = Field(None, max_length=500)


class InventoryAreaCreate(InventoryAreaBase):
    pass


class InventoryAreaUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    room_id: Optional[int] = None
    description: Optional[str] = Field(None, max_length=500)


class InventoryAreaRead(InventoryAreaBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryItemBase(BaseModel):
    area_id: int
    name: str = Field(..., min_length=1, max_length=200)
    quantity: int = Field(1, ge=0, le=100000)
    category: Optional[str] = Field(None, max_length=100)
    photo_url: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=1000)
    room_id: Optional[int] = None
    is_donated: bool = False


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItemUpdate(BaseModel):
    area_id: Optional[int] = None
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    quantity: Optional[int] = Field(None, ge=0, le=100000)
    category: Optional[str] = Field(None, max_length=100)
    photo_url: Optional[str] = Field(None, max_length=500)
    notes: Optional[str] = Field(None, max_length=1000)
    room_id: Optional[int] = None
    is_donated: Optional[bool] = None


class InventoryItemRead(InventoryItemBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
