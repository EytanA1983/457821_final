from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import google.auth
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
import googleapiclient
from app.db.session import get_db
from app.db.models import User, Task
from app.api.deps import get_current_user
from app.config import settings
from app.schemas.google_calendar import CalendarEvent

router = APIRouter(prefix="/google-calendar", tags=["google-calendar"])

def get_google_service(user: User) -> "googleapiclient.discovery.Resource":
    """מחזיר Google Calendar service בעזרת ה‑refresh token השמור."""
    if not user.google_refresh_token:
        raise HTTPException(status_code=400, detail="חשבון Google לא מקושר")
    credentials = Credentials(
        None,
        refresh_token=user.google_refresh_token,
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        token_uri="https://oauth2.googleapis.com/token",
    )
    # refresh automatically
    credentials.refresh(google.auth.transport.requests.Request())
    service = build("calendar", "v3", credentials=credentials)
    return service

@router.get("/events", response_model=List[CalendarEvent])
def get_upcoming_events(
    limit: int = 5,
    range: Optional[str] = None,  # "today", "week", or None (default: 30 days)
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    """
    מחזיר את האירועים הקרובים מ‑Google Calendar.
    משמש ל‑GoogleCalendarHeader component.
    
    Args:
        limit: מספר מקסימלי של אירועים להחזיר (default: 5)
        range: טווח זמן - "today" (היום), "week" (7 ימים), או None (30 ימים)
        db: Database session
        user: Current authenticated user
    
    Returns:
        List of CalendarEvent objects with upcoming events from Google Calendar
    """
    try:
        service = get_google_service(user)
    except HTTPException:
        # User not connected to Google Calendar
        return []
    
    # Get events based on range
    now = datetime.utcnow()
    time_min = now.isoformat() + 'Z'
    
    if range == "today":
        time_max = (now + timedelta(days=1)).isoformat() + 'Z'
    elif range == "week":
        time_max = (now + timedelta(days=7)).isoformat() + 'Z'
    else:
        # Default: 30 days ahead
        time_max = (now + timedelta(days=30)).isoformat() + 'Z'
    
    try:
        events_result = (
            service.events()
            .list(
                calendarId='primary',
                timeMin=time_min,
                timeMax=time_max,
                maxResults=limit,
                singleEvents=True,
                orderBy='startTime'
            )
            .execute()
        )
        
        events = events_result.get('items', [])
        
        # Format events for frontend
        formatted_events = []
        for event in events:
            start = event.get('start', {})
            end = event.get('end', {})
            
            # Handle both dateTime and date formats
            start_time = start.get('dateTime') or start.get('date')
            end_time = end.get('dateTime') or end.get('date')
            
            formatted_events.append({
                'id': event.get('id'),
                'summary': event.get('summary'),  # Optional - can be None
                'description': event.get('description', ''),
                'start': start_time,
                'end': end_time,
                'location': event.get('location', ''),
                'htmlLink': event.get('htmlLink', ''),
            })
        
        return formatted_events
    except Exception as e:
        # Log error but don't crash - return empty list
        from app.core.logging import logger
        logger.warning(f"Failed to fetch Google Calendar events: {e}", extra={"user_id": user.id})
        return []

@router.post("/sync-tasks")
def sync_tasks_to_google(
    task_id: Optional[int] = None,  # Optional: sync specific task only (query parameter)
    db: Session = Depends(get_db), 
    user: User = Depends(get_current_user)
):
    """
    מכניס משימות ל‑Google Calendar.
    
    Args:
        task_id: Optional - אם מוגדר, יוצר event רק למשימה הספציפית הזו
                 אחרת, יוצר events לכל המשימות הלא-גמורות עם due_date
    """
    try:
        service = get_google_service(user)
    except HTTPException:
        raise HTTPException(status_code=400, detail="חשבון Google לא מקושר")
    
    if task_id:
        # Create event for specific task only
        task = db.query(Task).filter(
            Task.id == task_id,
            Task.user_id == user.id,
            Task.due_date != None,
            Task.completed == False
        ).first()
        
        if not task:
            raise HTTPException(status_code=404, detail="משימה לא נמצאה")
        
        event = {
            "summary": task.title,
            "description": task.description or "",
            "start": {"dateTime": task.due_date.isoformat(), "timeZone": "Asia/Jerusalem"},
            "end": {
                "dateTime": (task.due_date + timedelta(hours=1)).isoformat(),
                "timeZone": "Asia/Jerusalem",
            },
            "reminders": {"useDefault": True},
        }
        created_event = service.events().insert(calendarId="primary", body=event).execute()
        return {
            "detail": f"אירוע נוצר ב-Google Calendar מהמשימה '{task.title}'",
            "event_id": created_event.get("id"),
            "event_link": created_event.get("htmlLink")
        }
    else:
        # Sync all tasks
        tasks = (
            db.query(Task)
            .filter(Task.user_id == user.id, Task.due_date != None, Task.completed == False)
            .all()
        )
        created_count = 0
        for t in tasks:
            try:
                event = {
                    "summary": t.title,
                    "description": t.description or "",
                    "start": {"dateTime": t.due_date.isoformat(), "timeZone": "Asia/Jerusalem"},
                    "end": {
                        "dateTime": (t.due_date + timedelta(hours=1)).isoformat(),
                        "timeZone": "Asia/Jerusalem",
                    },
                    "reminders": {"useDefault": True},
                }
                service.events().insert(calendarId="primary", body=event).execute()
                created_count += 1
            except Exception as e:
                from app.core.logging import logger
                logger.warning(f"Failed to create event for task {t.id}: {e}", extra={"user_id": user.id, "task_id": t.id})
        
        return {"detail": f"סונכרנו {created_count} משימות ל‑Google Calendar"}
