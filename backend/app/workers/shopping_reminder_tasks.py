"""
Celery tasks for shopping list reminders
"""
from datetime import datetime, timedelta
from app.workers.celery_app import celery
from app.db.session import SessionLocal
from app.db.models import User
from app.db.models.shopping_list import ShoppingList, ShoppingItem
from app.services.email import email_service
from app.services import shopping_service
from app.core.logging import logger
from typing import List, Dict, Any
import asyncio


@celery.task(name="app.workers.shopping_reminder_tasks.send_shopping_reminder_for_list")
def send_shopping_reminder_for_list(list_id: int):
    """
    Send reminder for a specific shopping list
    Called via Celery with ETA when list is created with reminder_time
    """
    db = SessionLocal()
    try:
        # Get list
        shopping_list = db.query(ShoppingList).filter(ShoppingList.id == list_id).first()
        if not shopping_list:
            logger.warning(f"Shopping list {list_id} not found for reminder")
            return {"error": "List not found"}

        # Get user
        user = db.query(User).filter(User.id == shopping_list.user_id).first()
        if not user:
            logger.warning(f"User {shopping_list.user_id} not found for reminder")
            return {"error": "User not found"}

        # Get list statistics
        stats = shopping_service.get_list_statistics(
            db=db,
            list_id=list_id,
            user_id=user.id
        )

        if not stats:
            logger.warning(f"No stats for list {list_id}")
            return {"error": "No stats"}

        # Prepare reminder data
        reminder_data = {
            "list_name": shopping_list.name,
            "description": shopping_list.description,
            "total_items": stats["total_items"],
            "checked_items": stats["checked_items"],
            "remaining_items": stats["total_items"] - stats["checked_items"],
            "progress_percentage": stats["progress_percentage"],
        }

        # Get unchecked items by category
        unchecked_by_category = {}
        for item in shopping_list.items:
            if not item.is_checked:
                category = item.category or "ללא קטגוריה"
                if category not in unchecked_by_category:
                    unchecked_by_category[category] = []

                unchecked_by_category[category].append({
                    "name": item.name,
                    "quantity": item.quantity,
                    "is_fixed": item.is_fixed,
                })

        reminder_data["unchecked_by_category"] = unchecked_by_category

        # Send email reminder
        try:
            loop = asyncio.get_event_loop()
            if loop.is_closed():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

            success = loop.run_until_complete(
                email_service.send_shopping_reminder(
                    user_email=user.email,
                    user_name=getattr(user, "full_name", None),
                    reminder_data=reminder_data,
                )
            )

            if success:
                logger.info(
                    f"Sent shopping reminder for list {list_id}",
                    extra={
                        "user_id": user.id,
                        "list_id": list_id,
                        "list_name": shopping_list.name,
                    },
                )
                return {"success": True, "list_id": list_id}
            else:
                logger.warning(
                    f"Failed to send reminder for list {list_id}",
                    extra={"user_id": user.id, "list_id": list_id},
                )
                return {"success": False, "list_id": list_id}

        except Exception as e:
            logger.error(
                f"Error sending reminder for list {list_id}: {e}",
                exc_info=True,
            )
            return {"error": str(e)}

    finally:
        db.close()


@celery.task(name="app.workers.shopping_reminder_tasks.send_shopping_reminders")
def send_shopping_reminders():
    """
    שולח תזכורות למשתמשים עם רשימות קניות שהתזכורת שלהן הגיעה
    רצה כל שעה על ידי Celery Beat
    """
    db = SessionLocal()
    try:
        now = datetime.utcnow()

        # מצא רשימות עם תזכורת שהגיעה (עד 30 דקות בעתיד)
        reminder_window_end = now + timedelta(minutes=30)

        lists_to_remind = (
            db.query(ShoppingList)
            .filter(
                ShoppingList.reminder_time.isnot(None),
                ShoppingList.reminder_time <= reminder_window_end,
                ShoppingList.reminder_time > now - timedelta(hours=1),  # לא לשלוח פעמיים
                ShoppingList.is_active == True,
                ShoppingList.completed_at.is_(None)
            )
            .all()
        )

        reminders_sent = 0

        for shopping_list in lists_to_remind:
            try:
                # Get user
                user = db.query(User).filter(User.id == shopping_list.user_id).first()
                if not user:
                    logger.warning(f"User {shopping_list.user_id} not found for shopping reminder")
                    continue

                # Get list statistics
                stats = shopping_service.get_list_statistics(
                    db=db,
                    list_id=shopping_list.id,
                    user_id=user.id
                )

                if not stats:
                    continue

                # Prepare reminder data
                reminder_data = {
                    "list_name": shopping_list.name,
                    "description": shopping_list.description,
                    "total_items": stats["total_items"],
                    "checked_items": stats["checked_items"],
                    "remaining_items": stats["total_items"] - stats["checked_items"],
                    "progress_percentage": stats["progress_percentage"],
                    "reminder_time": shopping_list.reminder_time.strftime("%d/%m/%Y %H:%M"),
                }

                # Get unchecked items by category
                unchecked_by_category = {}
                for item in shopping_list.items:
                    if not item.is_checked:
                        category = item.category or "ללא קטגוריה"
                        if category not in unchecked_by_category:
                            unchecked_by_category[category] = []

                        unchecked_by_category[category].append({
                            "name": item.name,
                            "quantity": item.quantity,
                            "is_fixed": item.is_fixed,
                        })

                reminder_data["unchecked_by_category"] = unchecked_by_category

                # Send email reminder
                try:
                    loop = asyncio.get_event_loop()
                    if loop.is_closed():
                        loop = asyncio.new_event_loop()
                        asyncio.set_event_loop(loop)

                    success = loop.run_until_complete(
                        email_service.send_shopping_reminder(
                            user_email=user.email,
                            user_name=getattr(user, "full_name", None),
                            reminder_data=reminder_data,
                        )
                    )

                    if success:
                        reminders_sent += 1
                        logger.info(
                            f"Sent shopping reminder to {user.email}",
                            extra={
                                "user_id": user.id,
                                "list_id": shopping_list.id,
                                "list_name": shopping_list.name,
                                "items_remaining": reminder_data["remaining_items"],
                            },
                        )
                    else:
                        logger.warning(
                            f"Failed to send shopping reminder to {user.email}",
                            extra={"user_id": user.id, "list_id": shopping_list.id},
                        )

                except Exception as e:
                    logger.error(
                        f"Error sending shopping reminder to {user.email}: {e}",
                        extra={"user_id": user.id, "list_id": shopping_list.id},
                        exc_info=True,
                    )

            except Exception as e:
                logger.error(
                    f"Error processing shopping list {shopping_list.id}: {e}",
                    exc_info=True,
                )

        logger.info(
            f"Sent {reminders_sent} shopping reminders",
            extra={"total_lists": len(lists_to_remind)},
        )

        return {
            "reminders_sent": reminders_sent,
            "lists_processed": len(lists_to_remind),
        }

    except Exception as e:
        logger.error(f"Error in send_shopping_reminders: {e}", exc_info=True)
        return {"error": str(e)}
    finally:
        db.close()


@celery.task(name="app.workers.shopping_reminder_tasks.cleanup_old_shopping_lists")
def cleanup_old_shopping_lists(days_old: int = 90):
    """
    מנקה רשימות קניות ישנות שהושלמו (אפציונלי)
    רצה פעם בשבוע על ידי Celery Beat
    """
    db = SessionLocal()
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=days_old)

        # Find old completed lists
        old_lists = (
            db.query(ShoppingList)
            .filter(
                ShoppingList.completed_at.isnot(None),
                ShoppingList.completed_at < cutoff_date,
                ShoppingList.is_template == False  # Don't delete templates!
            )
            .all()
        )

        deleted_count = 0
        for shopping_list in old_lists:
            try:
                db.delete(shopping_list)
                deleted_count += 1
            except Exception as e:
                logger.error(
                    f"Error deleting shopping list {shopping_list.id}: {e}",
                    exc_info=True,
                )

        db.commit()

        logger.info(
            f"Cleaned up {deleted_count} old shopping lists",
            extra={"days_old": days_old, "total_found": len(old_lists)},
        )

        return {
            "deleted_count": deleted_count,
            "lists_found": len(old_lists),
            "cutoff_date": cutoff_date.isoformat(),
        }

    except Exception as e:
        logger.error(f"Error in cleanup_old_shopping_lists: {e}", exc_info=True)
        db.rollback()
        return {"error": str(e)}
    finally:
        db.close()


@celery.task(name="app.workers.shopping_reminder_tasks.auto_clone_weekly_templates")
def auto_clone_weekly_templates():
    """
    משכפל אוטומטית תבניות שבועיות ברגע שהרשימה הקודמת הושלמה
    רצה פעם ביום על ידי Celery Beat
    """
    db = SessionLocal()
    try:
        # Find templates marked for weekly use
        # (This would require adding a 'auto_clone_weekly' field to ShoppingList model)
        # For now, we'll just document this as a future feature

        logger.info("Auto-clone weekly templates task ran (feature not yet implemented)")

        return {"message": "Feature not yet implemented"}

    except Exception as e:
        logger.error(f"Error in auto_clone_weekly_templates: {e}", exc_info=True)
        return {"error": str(e)}
    finally:
        db.close()


@celery.task(name="app.workers.shopping_reminder_tasks.send_shopping_summary")
def send_shopping_summary(user_id: int, list_id: int):
    """
    שולח סיכום של רשימת קניות (כשהיא מסומנת כהושלמה)
    נקרא ישירות מה-API כשמסיימים רשימה
    """
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            logger.warning(f"User {user_id} not found for shopping summary")
            return {"error": "User not found"}

        shopping_list = shopping_service.get_shopping_list(
            db=db,
            list_id=list_id,
            user_id=user_id
        )

        if not shopping_list:
            logger.warning(f"Shopping list {list_id} not found")
            return {"error": "Shopping list not found"}

        # Get statistics
        stats = shopping_service.get_list_statistics(
            db=db,
            list_id=list_id,
            user_id=user_id
        )

        if not stats:
            return {"error": "Could not calculate statistics"}

        # Prepare summary data
        summary_data = {
            "list_name": shopping_list.name,
            "completed_at": shopping_list.completed_at.strftime("%d/%m/%Y %H:%M") if shopping_list.completed_at else None,
            "total_items": stats["total_items"],
            "checked_items": stats["checked_items"],
            "categories": stats["categories"],
        }

        # Send email
        try:
            loop = asyncio.get_event_loop()
            if loop.is_closed():
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

            success = loop.run_until_complete(
                email_service.send_shopping_summary(
                    user_email=user.email,
                    user_name=getattr(user, "full_name", None),
                    summary_data=summary_data,
                )
            )

            if success:
                logger.info(
                    f"Sent shopping summary to {user.email}",
                    extra={"user_id": user_id, "list_id": list_id},
                )

            return {"success": success, "user_id": user_id, "list_id": list_id}

        except Exception as e:
            logger.error(f"Error sending shopping summary email: {e}", exc_info=True)
            return {"error": str(e)}

    except Exception as e:
        logger.error(f"Error in send_shopping_summary: {e}", exc_info=True)
        return {"error": str(e)}
    finally:
        db.close()
