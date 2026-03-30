"""Celery application configuration."""
from celery import Celery
from celery.schedules import crontab

from app.core.config import settings

celery_app = Celery(
    "clinic_tasks",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.notification_tasks",
        "app.tasks.appointment_tasks",
        "app.tasks.billing_tasks",
        "app.tasks.report_tasks",
        "app.tasks.maintenance_tasks",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_reject_on_worker_lost=True,
    task_soft_time_limit=300,   # 5 minutes
    task_time_limit=600,         # 10 minutes hard limit
    result_expires=86400,        # Results kept for 24 hours
)

# ── Periodic Tasks (Beat Scheduler) ──────────────────────────────
celery_app.conf.beat_schedule = {
    # Send appointment reminders every 5 minutes
    "appointment-reminders": {
        "task": "app.tasks.notification_tasks.send_pending_reminders",
        "schedule": crontab(minute="*/5"),
    },
    # Check for expired prescriptions daily at midnight
    "expire-prescriptions": {
        "task": "app.tasks.maintenance_tasks.expire_old_prescriptions",
        "schedule": crontab(hour=0, minute=0),
    },
    # Mark no-shows (appointments 30 min past start time)
    "mark-no-shows": {
        "task": "app.tasks.appointment_tasks.auto_mark_no_shows",
        "schedule": crontab(minute="*/15"),
    },
    # Generate daily analytics reports at 1 AM
    "daily-analytics": {
        "task": "app.tasks.report_tasks.generate_daily_analytics",
        "schedule": crontab(hour=1, minute=0),
    },
    # Stock reorder alerts daily at 8 AM
    "stock-alerts": {
        "task": "app.tasks.maintenance_tasks.check_low_stock",
        "schedule": crontab(hour=8, minute=0),
    },
    # Expire insurance policy warnings weekly
    "insurance-expiry-warnings": {
        "task": "app.tasks.notification_tasks.notify_expiring_insurance",
        "schedule": crontab(day_of_week=1, hour=9, minute=0),
    },
    # Clean up old audit logs (> 7 years, per HIPAA)
    "cleanup-old-logs": {
        "task": "app.tasks.maintenance_tasks.cleanup_expired_audit_logs",
        "schedule": crontab(day_of_month=1, hour=2, minute=0),
    },
    # DB connection health check
    "health-check": {
        "task": "app.tasks.maintenance_tasks.health_check",
        "schedule": crontab(minute="*/1"),
    },
}
