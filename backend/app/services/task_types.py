"""
Task Type Classification Service

Defines clear model for daily vs weekly tasks:

Daily Tasks:
- due_date matches today (date part only)
- recurrence = "daily" OR rrule_string contains FREQ=DAILY
- Can be one-time (due_date only) or recurring (recurrence/rrule)

Weekly Tasks:
- recurrence = "weekly" OR rrule_string contains FREQ=WEEKLY
- Can have specific day of week (BYDAY in rrule)
- due_date can be in the future (next occurrence)
"""
from datetime import date, datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from app.db.models.task import Task, Recurrence


def is_daily_task(task: Task, check_date: date = None) -> bool:
    """
    Check if a task is a daily task.
    
    A task is considered daily if:
    1. due_date matches the check_date (date part only), OR
    2. recurrence == "daily", OR
    3. rrule_string contains FREQ=DAILY
    
    Args:
        task: Task object to check
        check_date: Date to check against (default: today)
    
    Returns:
        True if task is daily, False otherwise
    """
    if check_date is None:
        check_date = date.today()
    
    # Check if due_date matches today
    if task.due_date:
        task_date = task.due_date.date() if isinstance(task.due_date, datetime) else task.due_date
        if task_date == check_date:
            return True
    
    # Check recurrence type
    if task.recurrence == Recurrence.daily:
        return True
    
    # Check rrule_string for FREQ=DAILY
    if task.rrule_string and "FREQ=DAILY" in task.rrule_string.upper():
        return True
    
    return False


def is_weekly_task(task: Task) -> bool:
    """
    Check if a task is a weekly task.
    
    A task is considered weekly if:
    1. recurrence == "weekly", OR
    2. rrule_string contains FREQ=WEEKLY
    
    Args:
        task: Task object to check
    
    Returns:
        True if task is weekly, False otherwise
    """
    # Check recurrence type
    if task.recurrence == Recurrence.weekly:
        return True
    
    # Check rrule_string for FREQ=WEEKLY
    if task.rrule_string and "FREQ=WEEKLY" in task.rrule_string.upper():
        return True
    
    return False


def get_weekly_task_day_of_week(task: Task) -> str | None:
    """
    Extract day of week from weekly task.
    
    For weekly tasks with BYDAY in rrule_string, returns the day.
    Examples:
    - "FREQ=WEEKLY;BYDAY=MO" -> "MO" (Monday)
    - "FREQ=WEEKLY;BYDAY=TU" -> "TU" (Tuesday)
    
    Args:
        task: Task object
    
    Returns:
        Day abbreviation (MO, TU, WE, TH, FR, SA, SU) or None
    """
    if not is_weekly_task(task):
        return None
    
    if task.rrule_string:
        rrule_upper = task.rrule_string.upper()
        if "BYDAY=" in rrule_upper:
            # Extract BYDAY value
            byday_part = rrule_upper.split("BYDAY=")[1].split(";")[0].split(",")[0]
            return byday_part.strip()
    
    return None


def get_daily_tasks(db: Session, user_id: int, check_date: date = None) -> list[Task]:
    """
    Get all daily tasks for a user.
    
    Returns tasks that:
    - Have due_date matching check_date (date part only), OR
    - Have recurrence = "daily", OR
    - Have rrule_string with FREQ=DAILY
    
    Args:
        db: Database session
        user_id: User ID
        check_date: Date to check (default: today)
    
    Returns:
        List of daily tasks, ordered by due_date, then position, then created_at
    """
    if check_date is None:
        check_date = date.today()
    
    # Query for daily tasks
    query = db.query(Task).filter(
        Task.user_id == user_id,
        Task.completed.is_(False),
        or_(
            # due_date matches check_date (date part only)
            func.date(Task.due_date) == check_date,
            # recurrence is daily
            Task.recurrence == Recurrence.daily,
            # rrule_string contains FREQ=DAILY
            Task.rrule_string.ilike("%FREQ=DAILY%")
        )
    )
    
    return query.order_by(
        Task.due_date.asc().nullslast(),
        Task.position.asc(),
        Task.created_at.asc()
    ).all()


def get_weekly_tasks(db: Session, user_id: int) -> list[Task]:
    """
    Get all weekly tasks for a user.
    
    Returns tasks that:
    - Have recurrence = "weekly", OR
    - Have rrule_string with FREQ=WEEKLY
    
    Args:
        db: Database session
        user_id: User ID
    
    Returns:
        List of weekly tasks, ordered by due_date, then position, then created_at
    """
    query = db.query(Task).filter(
        Task.user_id == user_id,
        Task.completed.is_(False),
        or_(
            # recurrence is weekly
            Task.recurrence == Recurrence.weekly,
            # rrule_string contains FREQ=WEEKLY
            Task.rrule_string.ilike("%FREQ=WEEKLY%")
        )
    )
    
    return query.order_by(
        Task.due_date.asc().nullslast(),
        Task.position.asc(),
        Task.created_at.asc()
    ).all()
