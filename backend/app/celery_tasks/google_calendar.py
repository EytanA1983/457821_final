from celery import Task
from sqlalchemy.orm import Session
from datetime import datetime
from app.workers.celery_app import celery
from app.db.session import SessionLocal
from app.db.models.user import User
from app.db.models.task import Task as TaskModel
from app.services.google_calendar import GoogleCalendarService
from app.services.redis_pubsub import redis_pubsub

@celery.task(bind=True, name="app.celery_tasks.google_calendar.sync_all_calendars")
def sync_all_calendars(self: Task) -> dict:
    """Sync all user tasks with Google Calendar"""
    db: Session = SessionLocal()
    try:
        calendar_service = GoogleCalendarService()
        
        users = db.query(User).filter(
            User.google_calendar_token.isnot(None),
            User.is_active == True
        ).all()
        
        synced_count = 0
        errors = []
        
        for user in users:
            try:
                # Get tasks without calendar event ID
                tasks_to_sync = db.query(TaskModel).filter(
                    TaskModel.owner_id == user.id,
                    TaskModel.google_calendar_event_id.is_(None),
                    TaskModel.due_date.isnot(None),
                    TaskModel.is_completed == False
                ).all()
                
                for task in tasks_to_sync:
                    try:
                        room_name = task.room.name if task.room else None
                        event_id = calendar_service.sync_task_to_calendar(
                            token=user.google_calendar_token,
                            refresh_token=user.google_calendar_refresh_token,
                            task_title=task.title,
                            task_description=task.description or "",
                            due_date=task.due_date,
                            task_id=task.id,
                            room_name=room_name,
                            priority=task.priority.value if task.priority else None
                        )
                        if event_id:
                            task.google_calendar_event_id = event_id
                            synced_count += 1
                            
                            # Publish task update via Redis Pub/Sub
                            task_dict = {
                                "id": task.id,
                                "title": task.title,
                                "google_calendar_event_id": event_id,
                                "synced": True,
                            }
                            redis_pubsub.publish_task_update(user.id, task_dict)
                    except Exception as e:
                        errors.append(f"Task {task.id}: {str(e)}")
                
                db.commit()
            except Exception as e:
                errors.append(f"User {user.id}: {str(e)}")
                db.rollback()
        
        return {
            "status": "success",
            "synced_count": synced_count,
            "errors": errors,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        db.rollback()
        raise self.retry(exc=e, countdown=300, max_retries=3)
    finally:
        db.close()


@celery.task(bind=True, name="app.celery_tasks.google_calendar.sync_user_calendar")
def sync_user_calendar(self: Task, user_id: int) -> dict:
    """Sync a specific user's tasks with Google Calendar"""
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.google_calendar_token:
            return {"status": "error", "message": "User not found or calendar not connected"}
        
        calendar_service = GoogleCalendarService()
        
        tasks_to_sync = db.query(TaskModel).filter(
            TaskModel.owner_id == user_id,
            TaskModel.google_calendar_event_id.is_(None),
            TaskModel.due_date.isnot(None),
            TaskModel.is_completed == False
        ).all()
        
        synced_count = 0
        for task in tasks_to_sync:
            try:
                room_name = task.room.name if task.room else None
                event_id = calendar_service.sync_task_to_calendar(
                    token=user.google_calendar_token,
                    refresh_token=user.google_calendar_refresh_token,
                    task_title=task.title,
                    task_description=task.description or "",
                    due_date=task.due_date,
                    task_id=task.id,
                    room_name=room_name,
                    priority=task.priority.value if task.priority else None
                )
                if event_id:
                    task.google_calendar_event_id = event_id
                    synced_count += 1
                    
                    # Publish task update via Redis Pub/Sub
                    task_dict = {
                        "id": task.id,
                        "title": task.title,
                        "google_calendar_event_id": event_id,
                        "synced": True,
                    }
                    redis_pubsub.publish_task_update(user_id, task_dict)
            except Exception as e:
                continue
        
        db.commit()
        
        return {
            "status": "success",
            "user_id": user_id,
            "synced_count": synced_count,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        db.rollback()
        raise self.retry(exc=e, countdown=60, max_retries=3)
    finally:
        db.close()
