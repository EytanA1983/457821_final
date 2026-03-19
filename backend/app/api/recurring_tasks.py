"""
API endpoints for recurring tasks management
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
from app.db.session import get_db
from app.api.deps import get_current_user
from app.db.models import User, Task
from app.schemas.task import TaskRead
from app.services.recurring_tasks import recurring_tasks_service
from app.core.logging import logger, log_api_call
from pydantic import BaseModel


router = APIRouter(prefix="/recurring-tasks", tags=["recurring-tasks"])


class RRULEExamplesResponse(BaseModel):
    examples: List[dict]


class RRULEValidationResponse(BaseModel):
    is_valid: bool
    error_message: Optional[str] = None
    next_occurrence: Optional[datetime] = None


class GenerateInstancesRequest(BaseModel):
    task_id: int
    until_date: Optional[datetime] = None
    max_instances: int = 50


@router.get("/examples", response_model=RRULEExamplesResponse)
def get_rrule_examples():
    """
    קבל דוגמאות ל-RRULE patterns נפוצים
    """
    examples = recurring_tasks_service.get_rrule_examples()
    return RRULEExamplesResponse(examples=examples)


@router.post("/validate", response_model=RRULEValidationResponse)
def validate_rrule(
    rrule_string: str = Query(..., description="RRULE string to validate"),
    start_date: Optional[datetime] = Query(None, description="Start date for validation"),
):
    """
    בדוק אם RRULE string תקין
    """
    if not start_date:
        start_date = datetime.utcnow()
    
    is_valid, error_message = recurring_tasks_service.validate_rrule(rrule_string)
    
    next_occurrence = None
    if is_valid:
        next_occurrence = recurring_tasks_service.get_next_occurrence(rrule_string, start_date)
    
    return RRULEValidationResponse(
        is_valid=is_valid,
        error_message=error_message,
        next_occurrence=next_occurrence,
    )


@router.post("/generate-instances")
def generate_instances(
    request: GenerateInstancesRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    צור instances למשימה חוזרת
    """
    log_api_call("/api/recurring-tasks/generate-instances", "POST", user_id=current_user.id)
    
    # Get template task
    template = db.query(Task).filter(
        Task.id == request.task_id,
        Task.user_id == current_user.id,
        Task.is_recurring_template == True,
    ).first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="משימה חוזרת לא נמצאה"
        )
    
    # Generate instances
    instances = recurring_tasks_service.create_recurring_instances(
        db=db,
        template_task=template,
        until_date=request.until_date,
        max_instances=request.max_instances,
    )
    
    return {
        "instances_created": len(instances),
        "task_id": request.task_id,
    }


@router.get("/templates", response_model=List[TaskRead])
def get_recurring_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    קבל את כל תבניות המשימות החוזרות של המשתמש
    """
    from app.schemas.task import TaskRead
    
    templates = (
        db.query(Task)
        .filter(
            Task.user_id == current_user.id,
            Task.is_recurring_template == True,
        )
        .all()
    )
    
    return templates


@router.get("/templates/weekly", response_model=List[TaskRead])
def get_weekly_recurring_templates(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    קבל את כל תבניות המשימות החוזרות השבועיות של המשתמש.
    
    משימות שבועיות מוגדרות כ:
    - recurrence = "weekly", OR
    - rrule_string מכיל FREQ=WEEKLY
    
    משמש ל-"משימות השבוע" widget בפרונט.
    """
    from app.schemas.task import TaskRead
    from app.db.models.task import Recurrence
    from sqlalchemy import or_
    
    templates = (
        db.query(Task)
        .filter(
            Task.user_id == current_user.id,
            Task.is_recurring_template == True,
            or_(
                Task.recurrence == Recurrence.weekly,
                Task.rrule_string.ilike("%FREQ=WEEKLY%")
            )
        )
        .order_by(Task.created_at.desc())
        .all()
    )
    
    return templates


@router.get("/templates/{template_id}/instances")
def get_template_instances(
    template_id: int,
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    קבל את כל ה-instances של תבנית משימה חוזרת
    """
    from app.schemas.task import TaskRead
    
    # Verify template belongs to user
    template = db.query(Task).filter(
        Task.id == template_id,
        Task.user_id == current_user.id,
        Task.is_recurring_template == True,
    ).first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="תבנית משימה חוזרת לא נמצאה"
        )
    
    # Get instances
    instances = (
        db.query(Task)
        .filter(
            Task.parent_task_id == template_id,
        )
        .order_by(Task.due_date.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    
    return instances


@router.get("/templates/{template_id}/next-occurrences")
def get_next_occurrences(
    template_id: int,
    count: int = Query(default=10, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    קבל את התאריכים הבאים של משימה חוזרת
    """
    # Get template
    template = db.query(Task).filter(
        Task.id == template_id,
        Task.user_id == current_user.id,
        Task.is_recurring_template == True,
    ).first()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="תבנית משימה חוזרת לא נמצאה"
        )
    
    if not template.rrule_string or not template.rrule_start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="תבנית משימה חוזרת לא מוגדרת כראוי"
        )
    
    # Generate occurrences
    occurrences = recurring_tasks_service.generate_occurrences(
        rrule_string=template.rrule_string,
        start_date=template.rrule_start_date,
        end_date=template.rrule_end_date,
        count=count,
    )
    
    return {
        "template_id": template_id,
        "occurrences": [occ.isoformat() for occ in occurrences],
        "count": len(occurrences),
    }
