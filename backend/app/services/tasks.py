"""Task service functions for business logic"""
from datetime import date, datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.models.task import Task
from app.services.task_types import get_daily_tasks, get_weekly_tasks as get_weekly_tasks_by_recurrence


def get_today_tasks(db: Session, user_id: int) -> list[Task]:
    """
    Return **daily tasks** that are due today.
    
    Uses the task_types service to get tasks that:
    - Have due_date matching today (date part only), OR
    - Have recurrence = "daily", OR
    - Have rrule_string with FREQ=DAILY
    
    This is the clear model for "daily" tasks.

    Args:
        db: Database session
        user_id: User ID to filter tasks

    Returns:
        List of daily Task objects due today,
        ordered by due_date, then position, then created_at
    """
    return get_daily_tasks(db, user_id, check_date=date.today())


def get_weekly_tasks(db: Session, user_id: int) -> list[Task]:
    """
    Return **weekly tasks** (recurring weekly tasks).
    
    Uses the task_types service to get tasks that:
    - Have recurrence = "weekly", OR
    - Have rrule_string with FREQ=WEEKLY
    
    This is the clear model for "weekly" tasks.
    
    Note: This is different from "tasks due in the next 7 days".
    For tasks due in the next 7 days (regardless of recurrence),
    use GET /api/tasks?scope=week

    Args:
        db: Database session
        user_id: User ID to filter tasks

    Returns:
        List of weekly Task objects (recurring weekly),
        ordered by due_date, then position, then created_at
    """
    return get_weekly_tasks_by_recurrence(db, user_id)
