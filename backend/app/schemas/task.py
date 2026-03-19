"""Task schemas for API validation and serialization"""
from __future__ import annotations
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime
from app.schemas.todo import TodoRead
from app.schemas.category import CategoryRead
from app.schemas.room import RoomRead


class TaskBase(BaseModel):
    """Base schema for Task"""
    title: str = Field(..., max_length=120, description="Task title")
    description: Optional[str] = Field(None, description="Task description")
    due_date: Optional[datetime] = Field(None, description="Due date for the task")
    recurrence: Optional[str] = Field("none", description="Recurrence type: none, daily, weekly, monthly")
    # Advanced recurrence (RRULE)
    rrule_string: Optional[str] = Field(
        None, 
        description="RRULE string (RFC 5545), e.g., 'FREQ=DAILY;INTERVAL=3'"
    )
    rrule_start_date: Optional[datetime] = Field(None, description="RRULE start date")
    rrule_end_date: Optional[datetime] = Field(None, description="RRULE end date (optional)")
    category_id: Optional[int] = Field(None, description="Category ID")
    room_id: Optional[int] = Field(None, description="Room ID")
    assignee_user_id: Optional[int] = Field(None, description="Assigned user id for family mode")
    assignee_name: Optional[str] = Field(None, max_length=120, description="Assignee display name")
    assignee_age: Optional[int] = Field(None, ge=1, le=120, description="Assignee age")
    is_kid_task: bool = Field(False, description="Whether this task is for a child")
    before_image_url: Optional[str] = Field(None, description="Before image URL")
    after_image_url: Optional[str] = Field(None, description="After image URL")


class TaskCreate(TaskBase):
    """Schema for creating a new task"""
    pass


class TaskUpdate(BaseModel):
    """Schema for updating an existing task (all fields optional)"""
    title: Optional[str] = Field(None, max_length=120)
    description: Optional[str] = None
    due_date: Optional[datetime] = None
    recurrence: Optional[str] = None
    completed: Optional[bool] = None
    category_id: Optional[int] = None
    room_id: Optional[int] = None
    assignee_user_id: Optional[int] = None
    assignee_name: Optional[str] = Field(None, max_length=120)
    assignee_age: Optional[int] = Field(None, ge=1, le=120)
    is_kid_task: Optional[bool] = None
    position: Optional[int] = Field(None, description="Display order for drag & drop")
    before_image_url: Optional[str] = None
    after_image_url: Optional[str] = None


class TaskRead(TaskBase):
    """Schema for reading task data"""
    id: int
    user_id: int
    completed: bool
    position: int = 0
    created_at: datetime
    updated_at: datetime  # Required - model has server_default=func.now() and nullable=False
    completed_at: Optional[datetime] = None
    before_image_at: Optional[datetime] = None
    after_image_at: Optional[datetime] = None
    is_recurring_template: bool = False
    parent_task_id: Optional[int] = None
    # Related objects
    category: Optional[CategoryRead] = None
    room: Optional[RoomRead] = None
    todos: List[TodoRead] = []

    model_config = ConfigDict(from_attributes=True)


class TaskList(BaseModel):
    """Schema for list of tasks with pagination info"""
    items: List[TaskRead]
    total: int
    skip: int
    limit: int
