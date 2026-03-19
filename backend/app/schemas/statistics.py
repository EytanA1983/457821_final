"""
Pydantic schemas for statistics API responses
"""
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from datetime import datetime


class CompletionStats(BaseModel):
    """סטטיסטיקות סיום"""
    total: int
    completed: int
    pending: int
    completion_rate: float
    completion_percentage: float


class RoomStatistics(BaseModel):
    """סטטיסטיקות לפי חדר"""
    total: int
    completed: int
    pending: int
    completion_rate: float
    completion_percentage: float
    avg_tasks_per_room: float
    std_tasks_per_room: float
    median_tasks_per_room: float
    rooms_count: int


class CategoryStatistics(BaseModel):
    """סטטיסטיקות לפי קטגוריה"""
    total: int
    completed: int
    pending: int
    completion_rate: float
    completion_percentage: float
    avg_tasks_per_category: float
    std_tasks_per_category: float
    median_tasks_per_category: float
    categories_count: int


class TimeBasedStatistics(BaseModel):
    """סטטיסטיקות לפי זמן"""
    period_days: int
    period_start: str
    period_end: str
    tasks_created: int
    tasks_completed: int
    tasks_due: int
    avg_created_per_day: float
    avg_completed_per_day: float
    completion_rate_in_period: float


class DistributionItem(BaseModel):
    """פריט בהתפלגות"""
    room_id: Optional[int] = None
    room_name: Optional[str] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    task_count: int
    completed_count: int
    pending_count: int
    completion_rate: float


class TaskDurationStatistics(BaseModel):
    """סטטיסטיקות משך זמן ביצוע משימות"""
    total_completed: int
    avg_duration_hours: float
    avg_duration_days: float
    median_duration_hours: float
    median_duration_days: float
    std_duration_hours: float
    min_duration_hours: float
    max_duration_hours: float


class OverallStatistics(BaseModel):
    """סטטיסטיקות כלליות - סיכום"""
    overall: CompletionStats
    by_room: RoomStatistics
    by_category: CategoryStatistics
    by_time: TimeBasedStatistics
    distributions: Dict[str, List[DistributionItem]]
    averages: Dict[str, float]


class HomeSummaryStatistics(BaseModel):
    """Simple KPI stats for the home dashboard."""
    completed_tasks: int
    organized_rooms: int
    donated_items: int