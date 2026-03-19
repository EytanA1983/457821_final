from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from app.db.session import get_db
from app.db.models import Task, Recurrence, User
from app.schemas.task import TaskCreate, TaskRead, TaskUpdate
from app.schemas.todo import TodoRead
from app.api.deps import get_current_user
from app.api.deps_audit import get_audit_context
from app.services.audit import audit_service, AuditAction
from app.workers.tasks import schedule_notification_for_task
from app.services.notification import send_voice_feedback
from app.services.recurring_tasks import recurring_tasks_service
import logging

logger = logging.getLogger("app")
from app.core.cache import invalidate_user_cache, cache_get, cache_set, make_cache_key, CACHE_TTL_LONG
from app.services.tasks import get_today_tasks

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

@router.get("", response_model=List[TaskRead])
def list_tasks(
    completed: Optional[bool] = None,
    category_id: Optional[int] = None,
    room_id: Optional[int] = None,
    scope: Optional[str] = None,  # "today" or "week"
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    List tasks with Redis caching (TTL: 2 minutes)
    
    Task = משימות עם due_date / scope (today/week) / room_id
    
    Scope options:
    - "today": Tasks due today (uncompleted only)
    - "week": Tasks due within the next 7 days (uncompleted only)
    - None: All tasks (respects completed filter)
    
    Filters:
    - completed: Filter by completion status
    - category_id: Filter by category
    - room_id: Filter by room
    - scope: Filter by time range (today/week)
    """
    from datetime import date, timedelta
    from sqlalchemy import func
    
    logger.info("Fetching tasks", extra={"user": user.id, "completed": completed, "category_id": category_id, "room_id": room_id, "scope": scope})
    
    # Try cache first (include scope in cache key)
    cache_key = make_cache_key("tasks", user.id, completed=completed, category_id=category_id, room_id=room_id, scope=scope)
    cached = cache_get(cache_key)
    if cached is not None:
        # Backward-compatible cache hydration:
        # older cache entries may miss required response fields (e.g. updated_at).
        cache_was_updated = False
        if isinstance(cached, list):
            for item in cached:
                if isinstance(item, dict) and "updated_at" not in item:
                    item["updated_at"] = item.get("created_at")
                    cache_was_updated = True
        if cache_was_updated:
            cache_set(cache_key, cached, CACHE_TTL_LONG)
        return cached  # Return cached list directly

    # Query database
    q = db.query(Task).filter(Task.user_id == user.id)
    
    # Apply scope filter (today or week)
    if scope == "today":
        today = date.today()
        q = q.filter(
            func.date(Task.due_date) == today,
            Task.completed.is_(False)
        )
    elif scope == "week":
        today = date.today()
        week_end = today + timedelta(days=7)
        q = q.filter(
            func.date(Task.due_date) >= today,
            func.date(Task.due_date) <= week_end,
            Task.completed.is_(False)
        )
    
    # Apply other filters (room_id and category_id work with any scope)
    if room_id:
        q = q.filter(Task.room_id == room_id)
    if category_id:
        q = q.filter(Task.category_id == category_id)
    # completed filter only applies if scope is not set (scope already filters uncompleted)
    if completed is not None and scope is None:
        q = q.filter(Task.completed == completed)

    # Order by due_date (if exists), then by position, then by created_at
    q = q.order_by(
        Task.due_date.asc().nullslast(),
        Task.position.asc(),
        Task.created_at.asc()
    )

    tasks = q.all()

    # Cache the result (serialize for JSON storage)
    cache_data = []
    for t in tasks:
        task_dict = {
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "recurrence": t.recurrence.value if t.recurrence else "none",
            "rrule_string": t.rrule_string,
            "rrule_start_date": t.rrule_start_date.isoformat() if t.rrule_start_date else None,
            "rrule_end_date": t.rrule_end_date.isoformat() if t.rrule_end_date else None,
            "completed": t.completed,
            "category_id": t.category_id,
            "assignee_user_id": t.assignee_user_id,
            "assignee_name": t.assignee_name,
            "assignee_age": t.assignee_age,
            "is_kid_task": t.is_kid_task,
            "room_id": t.room_id,
            "user_id": t.user_id,
            "position": t.position,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "updated_at": t.updated_at.isoformat() if t.updated_at else (t.created_at.isoformat() if t.created_at else None),
            "completed_at": t.completed_at.isoformat() if t.completed_at else None,
            "before_image_url": t.before_image_url,
            "after_image_url": t.after_image_url,
            "before_image_at": t.before_image_at.isoformat() if t.before_image_at else None,
            "after_image_at": t.after_image_at.isoformat() if t.after_image_at else None,
            "is_recurring_template": t.is_recurring_template,
            "parent_task_id": t.parent_task_id,
        }
        cache_data.append(task_dict)

    cache_set(cache_key, cache_data, CACHE_TTL_LONG)

    return tasks

@router.get("/today", response_model=List[TaskRead])
def read_today_tasks(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Return **daily tasks** that are due today.
    
    Daily tasks are defined as:
    - Tasks with due_date matching today (date part only), OR
    - Tasks with recurrence = "daily", OR
    - Tasks with rrule_string containing FREQ=DAILY
    
    Used by the HomePage pop‑up and daily tasks widget.
    """
    return get_today_tasks(db, user.id)

@router.get("/weekly", response_model=List[TaskRead])
def read_weekly_tasks(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """
    Return **weekly tasks** (recurring weekly tasks).
    
    Weekly tasks are defined as:
    - Tasks with recurrence = "weekly", OR
    - Tasks with rrule_string containing FREQ=WEEKLY
    
    Note: This returns recurring weekly tasks, not "tasks due in next 7 days".
    For tasks due in the next 7 days (regardless of recurrence),
    use GET /api/tasks?scope=week
    
    Used by the HomePage weekly tasks widget.
    """
    from app.services.tasks import get_weekly_tasks
    return get_weekly_tasks(db, user.id)

@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(
    request: Request,
    task_in: TaskCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    audit_context: dict = Depends(get_audit_context),
):
    """Create a new task (supports recurring tasks with RRULE)"""
    task_data = task_in.dict()

    # Check if this is a recurring task
    is_recurring = bool(task_data.get("rrule_string") and task_data.get("rrule_start_date"))

    if is_recurring:
        # Validate RRULE
        is_valid, error_msg = recurring_tasks_service.validate_rrule(task_data["rrule_string"])
        if not is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"RRULE לא תקין: {error_msg}"
            )

        # Mark as recurring template
        task_data["is_recurring_template"] = True
        # Set due_date from rrule_start_date if not provided
        if not task_data.get("due_date") and task_data.get("rrule_start_date"):
            task_data["due_date"] = task_data["rrule_start_date"]

    task = Task(**task_data, user_id=user.id)
    db.add(task)
    db.commit()
    db.refresh(task)

    # If recurring, generate initial instances
    if is_recurring:
        try:
            until_date = task_data.get("rrule_end_date") or (datetime.utcnow() + timedelta(days=30))
            instances = recurring_tasks_service.create_recurring_instances(
                db=db,
                template_task=task,
                until_date=until_date,
                max_instances=50,
            )
            logger.info(
                f"Created recurring task with {len(instances)} initial instances",
                extra={"task_id": task.id, "rrule": task.rrule_string}
            )
        except Exception as e:
            logger.error(f"Error creating recurring instances: {e}", exc_info=True)
            # Don't fail the task creation if instance generation fails

    # אם יש due_date – תזמון נוטיפיקציה
    if task.due_date:
        background_tasks.add_task(schedule_notification_for_task, task.id)

    # Invalidate tasks cache for this user
    invalidate_user_cache(user.id, ["tasks"])

    # Create audit log
    new_values = {
        "title": task.title,
        "description": task.description,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "completed": task.completed,
        "category_id": task.category_id,
        "room_id": task.room_id,
        "user_id": task.user_id,
        "position": task.position,
    }
    audit_service.create_audit_log(
        session=db,
        instance=task,
        action=AuditAction.CREATE,
        user_id=audit_context["user_id"],
        user_email=audit_context["user_email"],
        new_values=new_values,
        ip_address=audit_context["ip_address"],
        user_agent=audit_context["user_agent"],
    )
    db.commit()

    return task

@router.get("/{task_id}", response_model=TaskRead)
def get_task(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="משימה לא קיימת")
    return task

@router.put("/{task_id}", response_model=TaskRead)
def update_task(
    request: Request,
    task_id: int,
    task_in: TaskUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    audit_context: dict = Depends(get_audit_context),
):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="משימה לא קיימת")

    # Get changed fields before update
    changed_fields = audit_service.get_changed_fields(task, db)

    # Update task
    update_data = task_in.dict(exclude_unset=True)
    if "completed" in update_data:
        update_data["completed_at"] = datetime.utcnow() if update_data["completed"] else None
    if "before_image_url" in update_data:
        update_data["before_image_at"] = datetime.utcnow() if update_data["before_image_url"] else None
    if "after_image_url" in update_data:
        update_data["after_image_at"] = datetime.utcnow() if update_data["after_image_url"] else None

    for key, value in update_data.items():
        setattr(task, key, value)

    db.flush()  # Flush to get updated values

    # Get new changed fields after update
    changed_fields = audit_service.get_changed_fields(task, db)

    if changed_fields:
        # Prepare old and new values
        old_values = {field: data["old"] for field, data in changed_fields.items()}
        new_values = {field: data["new"] for field, data in changed_fields.items()}

        # Create audit log
        audit_service.create_audit_log(
            session=db,
            instance=task,
            action=AuditAction.UPDATE,
            user_id=audit_context["user_id"],
            user_email=audit_context["user_email"],
            old_values=old_values,
            new_values=new_values,
            changed_fields=changed_fields,
            ip_address=audit_context["ip_address"],
            user_agent=audit_context["user_agent"],
        )

    db.commit()
    db.refresh(task)

    # Invalidate tasks cache
    invalidate_user_cache(user.id, ["tasks"])

    return task

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_task(
    request: Request,
    task_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    audit_context: dict = Depends(get_audit_context),
):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="משימה לא קיימת")

    # Create audit log before delete
    old_values = {
        "title": task.title,
        "description": task.description,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "completed": task.completed,
        "category_id": task.category_id,
        "room_id": task.room_id,
        "user_id": task.user_id,
        "position": task.position,
    }
    audit_service.create_audit_log(
        session=db,
        instance=task,
        action=AuditAction.DELETE,
        user_id=audit_context["user_id"],
        user_email=audit_context["user_email"],
        old_values=old_values,
        ip_address=audit_context["ip_address"],
        user_agent=audit_context["user_agent"],
    )

    db.delete(task)
    db.commit()

    # Invalidate tasks cache
    invalidate_user_cache(user.id, ["tasks"])

    return None

@router.patch("/{task_id}", response_model=TaskRead)
def patch_task(
    request: Request,
    task_id: int,
    task_in: TaskUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    audit_context: dict = Depends(get_audit_context),
):
    """PATCH endpoint for partial task updates (optimistic updates)"""
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="משימה לא קיימת")

    # Update only provided fields
    update_data = task_in.dict(exclude_unset=True)
    if "completed" in update_data:
        update_data["completed_at"] = datetime.utcnow() if update_data["completed"] else None
    if "before_image_url" in update_data:
        update_data["before_image_at"] = datetime.utcnow() if update_data["before_image_url"] else None
    if "after_image_url" in update_data:
        update_data["after_image_at"] = datetime.utcnow() if update_data["after_image_url"] else None

    for key, value in update_data.items():
        setattr(task, key, value)

    db.commit()
    db.refresh(task)

    # Invalidate tasks cache
    invalidate_user_cache(user.id, ["tasks"])

    return task

@router.put("/{task_id}/complete", response_model=TaskRead)
def complete_task(
    request: Request,
    task_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    audit_context: dict = Depends(get_audit_context),
):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="משימה לא קיימת")

    # Get old value before update
    old_completed = task.completed
    task.completed = True
    task.completed_at = datetime.utcnow()

    # פידבק קולי (ב‑frontend) – נשלח אירוע WebSocket, אבל כאן רק דוגמה:
    send_voice_feedback(
        text="המשימה הסתיימה בהצלחה! כל הכבוד!",
        language="he-IL"
    )

    # Create audit log for completion change
    audit_service.create_audit_log(
        session=db,
        instance=task,
        action=AuditAction.UPDATE,
        user_id=audit_context["user_id"],
        user_email=audit_context["user_email"],
        old_values={"completed": old_completed},
        new_values={"completed": True},
        changed_fields={"completed": {"old": old_completed, "new": True}},
        ip_address=audit_context["ip_address"],
        user_agent=audit_context["user_agent"],
    )

    db.commit()
    db.refresh(task)

    # Invalidate tasks cache
    invalidate_user_cache(user.id, ["tasks"])

    return task


@router.get("/progress-timeline")
def progress_timeline(
    limit: int = 20,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Timeline feed based on task before/after images and completion."""
    safe_limit = max(1, min(limit, 100))
    tasks = (
        db.query(Task)
        .filter(
            Task.user_id == user.id,
            Task.before_image_url.isnot(None),
            Task.after_image_url.isnot(None),
        )
        .order_by(Task.after_image_at.desc().nullslast(), Task.updated_at.desc())
        .limit(safe_limit)
        .all()
    )

    timeline = []
    for task in tasks:
        timeline.append(
            {
                "task_id": task.id,
                "task_title": task.title,
                "room_id": task.room_id,
                "before_image_url": task.before_image_url,
                "after_image_url": task.after_image_url,
                "before_image_at": task.before_image_at.isoformat() if task.before_image_at else None,
                "after_image_at": task.after_image_at.isoformat() if task.after_image_at else None,
                "completed": task.completed,
                "completed_at": task.completed_at.isoformat() if task.completed_at else None,
            }
        )
    return timeline

# Endpoint עבור ה‑todos המשויכים למשימה
@router.get("/{task_id}/todos", response_model=List[TodoRead])
def get_task_todos(task_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == user.id).first()
    if not task:
        raise HTTPException(status_code=404, detail="משימה לא קיימת")
    return task.todos

# אפשר להוסיף endpoint לשינוי עקביות (recurrence) וכו׳…
