from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.db.models import Notification, NotificationType
from app.db.models.task import Task
from app.db.models.user import User
from app.services.redis_pubsub import redis_pubsub
from app.api.ws import manager
import asyncio


class NotificationService:
    @staticmethod
    def create_notification(
        db: Session,
        user_id: int,
        title: str,
        message: str,
        notification_type: NotificationType,
        related_task_id: int = None,
        send_push: bool = True
    ) -> Notification:
        """Create a new notification"""
        notification = Notification(
            user_id=user_id,
            title=title,
            message=message,
            type=notification_type,
            related_task_id=related_task_id
        )
        db.add(notification)
        db.commit()
        db.refresh(notification)
        
        # Publish to Redis Pub/Sub for real-time updates
        notification_dict = {
            "id": notification.id,
            "title": notification.title,
            "message": notification.message,
            "type": notification.type.value,
            "is_read": notification.is_read,
            "related_task_id": notification.related_task_id,
            "created_at": notification.created_at.isoformat(),
        }
        redis_pubsub.publish_notification(user_id, notification_dict)
        
        # Also broadcast via WebSocket
        asyncio.create_task(manager.broadcast_to_user({
            "type": "notification",
            "data": notification_dict
        }, user_id))
        
        return notification

    @staticmethod
    def create_task_due_notification(
        db: Session,
        task: Task,
        send_push: bool = True
    ) -> Notification:
        """Create notification for task due date"""
        return NotificationService.create_notification(
            db=db,
            user_id=task.owner_id,
            title="משימה מתקרבת",
            message=f"המשימה '{task.title}' אמורה להתבצע ב-{task.due_date.strftime('%d/%m/%Y %H:%M')}",
            notification_type=NotificationType.TASK_DUE,
            related_task_id=task.id,
            send_push=send_push
        )

    @staticmethod
    def create_task_completed_notification(
        db: Session,
        task: Task,
        send_push: bool = True
    ) -> Notification:
        """Create notification when task is completed"""
        return NotificationService.create_notification(
            db=db,
            user_id=task.owner_id,
            title="משימה הושלמה",
            message=f"המשימה '{task.title}' הושלמה בהצלחה!",
            notification_type=NotificationType.TASK_COMPLETED,
            related_task_id=task.id,
            send_push=send_push
        )

    @staticmethod
    def check_due_tasks(db: Session) -> list[Notification]:
        """Check for tasks due soon and create notifications"""
        now = datetime.utcnow()
        one_hour_from_now = now + timedelta(hours=1)
        one_day_from_now = now + timedelta(days=1)

        # Tasks due in the next hour
        urgent_tasks = db.query(Task).filter(
            Task.due_date.between(now, one_hour_from_now),
            Task.is_completed == False
        ).all()

        # Tasks due in the next day
        upcoming_tasks = db.query(Task).filter(
            Task.due_date.between(one_hour_from_now, one_day_from_now),
            Task.is_completed == False
        ).all()

        notifications = []
        for task in urgent_tasks:
            # Check if notification already exists
            existing = db.query(Notification).filter(
                Notification.related_task_id == task.id,
                Notification.type == NotificationType.TASK_DUE,
                Notification.is_read == False
            ).first()
            if not existing:
                notifications.append(
                    NotificationService.create_task_due_notification(db, task)
                )

        return notifications
