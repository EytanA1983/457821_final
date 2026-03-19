from __future__ import annotations

import os
from celery import Celery

# ----------------------------------------------------------------------
# הגדרת Celery (Broker = Redis, Backend = Redis)
# ----------------------------------------------------------------------
BROKER_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
celery = Celery(
    "eli_maor",
    broker=BROKER_URL,
    backend=BROKER_URL,
    include=[
        # רשימת משימות **שאנו באמת משתמשים**:
        "app.workers.tasks",                    # push-notifications
        "app.workers.shopping_reminder_tasks",  # תזכורת לקניות
        "app.workers.email_tasks",              # שליחת אימיילים
        "app.workers.recurring_tasks",          # משימות חוזרות
        "app.celery_tasks.google_calendar",     # סנכרון עם Google Calendar
        # אפשר להוסיף כאן משימות חדשות בעתיד
    ],
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
)

# ----------------------------------------------------------------------
# Beat Schedule - משימות מתוזמנות
# ----------------------------------------------------------------------
celery.conf.beat_schedule = {
    # דוגמה: שליחת תזכורת קניות כל שעה
    "send-shopping-reminders": {
        "task": "app.workers.shopping_reminder_tasks.send_shopping_reminders",
        "schedule": 60 * 60,      # כל שעה
    },
    # הוסיפו משימות נוספות לפי צורך
}
