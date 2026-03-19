"""
API endpoints for statistics
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from app.db.session import get_db
from app.api.deps import get_current_user
from app.db.models import User
from app.services.statistics import statistics_service
from app.schemas.statistics import (
    CompletionStats,
    RoomStatistics,
    CategoryStatistics,
    TimeBasedStatistics,
    DistributionItem,
    TaskDurationStatistics,
    OverallStatistics,
    HomeSummaryStatistics,
)
from app.core.logging import logger, log_api_call
from app.db.models import Task, InventoryItem
from datetime import datetime, timedelta
from sqlalchemy import func

router = APIRouter(prefix="/statistics", tags=["statistics"])


@router.get("/home-summary", response_model=HomeSummaryStatistics)
def get_home_summary_statistics(
    range: str = Query(default="week", pattern="^(week|month)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Lightweight summary cards for dashboard:
    - completed tasks in period
    - rooms with at least one completed task in period
    - donated inventory items in period
    """
    now = datetime.utcnow()
    period_start = now - timedelta(days=7 if range == "week" else 30)

    completed_tasks = (
        db.query(func.count(Task.id))
        .filter(
            Task.user_id == current_user.id,
            Task.completed.is_(True),
            Task.completed_at.isnot(None),
            Task.completed_at >= period_start,
        )
        .scalar()
        or 0
    )

    organized_rooms = (
        db.query(func.count(func.distinct(Task.room_id)))
        .filter(
            Task.user_id == current_user.id,
            Task.completed.is_(True),
            Task.completed_at.isnot(None),
            Task.completed_at >= period_start,
            Task.room_id.isnot(None),
        )
        .scalar()
        or 0
    )

    donated_items = (
        db.query(func.count(InventoryItem.id))
        .filter(
            InventoryItem.user_id == current_user.id,
            InventoryItem.is_donated.is_(True),
            InventoryItem.updated_at >= period_start,
        )
        .scalar()
        or 0
    )

    return HomeSummaryStatistics(
        completed_tasks=int(completed_tasks),
        organized_rooms=int(organized_rooms),
        donated_items=int(donated_items),
    )


@router.get("/overall", response_model=OverallStatistics)
def get_overall_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    קבל סטטיסטיקות כלליות - סיכום כל המדדים
    """
    log_api_call("/api/statistics/overall", "GET", user_id=current_user.id)
    
    stats = statistics_service.calculate_overall_statistics(db, current_user.id)
    return OverallStatistics(**stats)


@router.get("/completion", response_model=CompletionStats)
def get_completion_statistics(
    room_id: Optional[int] = Query(None, description="Filter by room ID"),
    category_id: Optional[int] = Query(None, description="Filter by category ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    קבל אחוזי סיום משימות
    """
    from app.db.models import Task
    
    query = db.query(Task).filter(Task.user_id == current_user.id)
    
    if room_id:
        query = query.filter(Task.room_id == room_id)
    if category_id:
        query = query.filter(Task.category_id == category_id)
    
    tasks = query.all()
    stats = statistics_service.calculate_completion_rate(tasks)
    
    return CompletionStats(**stats)


@router.get("/by-room", response_model=RoomStatistics)
def get_room_statistics(
    room_id: Optional[int] = Query(None, description="Filter by specific room ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    קבל סטטיסטיקות לפי חדרים
    """
    log_api_call("/api/statistics/by-room", "GET", user_id=current_user.id)
    
    stats = statistics_service.calculate_task_statistics_by_room(
        db, current_user.id, room_id
    )
    return RoomStatistics(**stats)


@router.get("/by-category", response_model=CategoryStatistics)
def get_category_statistics(
    category_id: Optional[int] = Query(None, description="Filter by specific category ID"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    קבל סטטיסטיקות לפי קטגוריות
    """
    log_api_call("/api/statistics/by-category", "GET", user_id=current_user.id)
    
    stats = statistics_service.calculate_task_statistics_by_category(
        db, current_user.id, category_id
    )
    return CategoryStatistics(**stats)


@router.get("/by-time", response_model=TimeBasedStatistics)
def get_time_based_statistics(
    days: int = Query(default=30, ge=1, le=365, description="Number of days to analyze"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    קבל סטטיסטיקות לפי זמן (משימות שנוצרו/הושלמו בתקופה)
    """
    log_api_call("/api/statistics/by-time", "GET", user_id=current_user.id, days=days)
    
    stats = statistics_service.calculate_time_based_statistics(
        db, current_user.id, days
    )
    return TimeBasedStatistics(**stats)


@router.get("/room-distribution", response_model=List[DistributionItem])
def get_room_distribution(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    קבל התפלגות משימות לפי חדרים
    """
    log_api_call("/api/statistics/room-distribution", "GET", user_id=current_user.id)
    
    distribution = statistics_service.calculate_room_distribution(db, current_user.id)
    return [DistributionItem(**item) for item in distribution]


@router.get("/category-distribution", response_model=List[DistributionItem])
def get_category_distribution(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    קבל התפלגות משימות לפי קטגוריות
    """
    log_api_call("/api/statistics/category-distribution", "GET", user_id=current_user.id)
    
    distribution = statistics_service.calculate_category_distribution(db, current_user.id)
    return [DistributionItem(**item) for item in distribution]


@router.get("/task-duration", response_model=TaskDurationStatistics)
def get_task_duration_statistics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    קבל סטטיסטיקות על משך זמן ביצוע משימות
    (ממוצע, חציון, סטיית תקן של זמן מ-created עד completed)
    """
    log_api_call("/api/statistics/task-duration", "GET", user_id=current_user.id)
    
    stats = statistics_service.calculate_task_duration_statistics(db, current_user.id)
    return TaskDurationStatistics(**stats)
