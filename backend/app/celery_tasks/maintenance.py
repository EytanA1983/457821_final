from celery import Task
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from app.workers.celery_app import celery
from app.db.session import SessionLocal
from app.db.models import TokenBlocklist, RefreshToken
from app.db.models import Notification
from app.core.logging import logger

@celery.task(bind=True, name="app.celery_tasks.maintenance.cleanup_old_notifications")
def cleanup_old_notifications(self: Task, days: int = 30) -> dict:
    """Clean up old read notifications"""
    db: Session = SessionLocal()
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        deleted_count = db.query(Notification).filter(
            Notification.is_read == True,
            Notification.created_at < cutoff_date
        ).delete()

        db.commit()

        return {
            "status": "success",
            "deleted_count": deleted_count,
            "cutoff_date": cutoff_date.isoformat(),
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        db.rollback()
        raise self.retry(exc=e, countdown=60, max_retries=3)
    finally:
        db.close()


@celery.task(bind=True, name="app.celery_tasks.maintenance.cleanup_expired_tokens")
def cleanup_expired_tokens(self: Task) -> dict:
    """
    Clean up expired tokens from blocklist and refresh_tokens table.

    This task should run daily to prevent unbounded growth of token tables.
    """
    db: Session = SessionLocal()
    try:
        now = datetime.utcnow()

        # Clean up expired blocklist entries
        blocklist_deleted = db.query(TokenBlocklist).filter(
            TokenBlocklist.expires_at < now
        ).delete()

        # Clean up expired refresh tokens (keep revoked ones for audit, but can clean old ones)
        # Keep revoked tokens for 7 days for audit purposes
        audit_cutoff = now - timedelta(days=7)
        refresh_deleted = db.query(RefreshToken).filter(
            RefreshToken.expires_at < audit_cutoff,
            RefreshToken.revoked == True
        ).delete()

        db.commit()

        logger.info(
            "Token cleanup completed",
            extra={
                "blocklist_deleted": blocklist_deleted,
                "refresh_tokens_deleted": refresh_deleted,
                "timestamp": now.isoformat()
            }
        )

        return {
            "status": "success",
            "blocklist_deleted": blocklist_deleted,
            "refresh_tokens_deleted": refresh_deleted,
            "timestamp": now.isoformat()
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Token cleanup failed: {e}")
        raise self.retry(exc=e, countdown=300, max_retries=3)
    finally:
        db.close()
