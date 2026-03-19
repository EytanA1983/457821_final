# Shopping List Schemas
from pydantic import BaseModel, Field, validator
from datetime import datetime
from typing import Optional


# ============================================================================
# Shopping Item Schemas
# ============================================================================

class ShoppingItemBase(BaseModel):
    """Base schema for shopping items"""
    name: str = Field(..., min_length=1, max_length=200, description="שם הפריט")
    quantity: Optional[str] = Field(None, max_length=50, description="כמות (למשל: 2 ליטר)")
    category: Optional[str] = Field(None, max_length=100, description="קטגוריה (למשל: מוצרי חלב)")
    notes: Optional[str] = Field(None, description="הערות נוספות")
    is_fixed: bool = Field(default=False, description="מוצר קבוע (מופיע תמיד בתבנית)")
    order: int = Field(default=0, description="סדר תצוגה")

    @validator('name')
    def name_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('שם הפריט לא יכול להיות ריק')
        return v.strip()


class ShoppingItemCreate(ShoppingItemBase):
    """Schema for creating a shopping item"""
    pass


class ShoppingItemUpdate(BaseModel):
    """Schema for updating a shopping item"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    quantity: Optional[str] = Field(None, max_length=50)
    category: Optional[str] = None
    notes: Optional[str] = None
    is_checked: Optional[bool] = None
    is_fixed: Optional[bool] = None
    order: Optional[int] = None


class ShoppingItemRead(ShoppingItemBase):
    """Schema for reading a shopping item"""
    id: int
    shopping_list_id: int
    is_checked: bool
    is_fixed: bool
    created_at: datetime
    checked_at: Optional[datetime]

    class Config:
        from_attributes = True


# ============================================================================
# Shopping List Schemas
# ============================================================================

class ShoppingListBase(BaseModel):
    """Base schema for shopping lists"""
    name: str = Field(..., min_length=1, max_length=200, description="שם הרשימה")
    description: Optional[str] = Field(None, description="תיאור הרשימה")
    is_template: bool = Field(default=False, description="האם זו רשימת תבנית לשימוש חוזר")
    reminder_time: Optional[datetime] = Field(None, description="תזכורת לקניות (אופציונלי)")
    room_id: Optional[int] = Field(None, description="חדר מקושר (אופציונלי)")

    @validator('name')
    def name_not_empty(cls, v):
        if not v or not v.strip():
            raise ValueError('שם הרשימה לא יכול להיות ריק')
        return v.strip()


class ShoppingListCreate(ShoppingListBase):
    """Schema for creating a shopping list"""
    items: list[ShoppingItemCreate] = Field(default=[], description="פריטים ברשימה")


class ShoppingListUpdate(BaseModel):
    """Schema for updating a shopping list"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    is_template: Optional[bool] = None
    is_active: Optional[bool] = None
    reminder_time: Optional[datetime] = None


class ShoppingListRead(ShoppingListBase):
    """Schema for reading a shopping list"""
    id: int
    user_id: int
    room_id: Optional[int]
    is_active: bool
    reminder_time: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]
    items: list[ShoppingItemRead] = []

    class Config:
        from_attributes = True


class ShoppingListSummary(BaseModel):
    """Summary schema without items (for list views)"""
    id: int
    name: str
    description: Optional[str]
    is_template: bool
    is_active: bool
    reminder_time: Optional[datetime]
    item_count: int
    checked_count: int
    created_at: datetime
    updated_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


# ============================================================================
# Special Operations
# ============================================================================

class ShoppingListClone(BaseModel):
    """Schema for cloning a shopping list"""
    source_list_id: int = Field(..., description="ID של הרשימה להעתקה")
    new_name: Optional[str] = Field(None, description="שם חדש (אופציונלי)")


class ShoppingListComplete(BaseModel):
    """Schema for marking a shopping list as complete"""
    completed: bool = Field(default=True, description="האם הקניות הושלמו")
