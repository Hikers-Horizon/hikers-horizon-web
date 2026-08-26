from celery import Celery
from celery.schedules import crontab
from app.config import settings

celery_app = Celery("campflow", broker=settings.CELERY_BROKER_URL, backend=settings.CELERY_RESULT_BACKEND)
celery_app.autodiscover_tasks(["app"])

celery_app.conf.beat_schedule = {
    "create-payment-reminders-every-morning": {
        "task": "app.tasks.create_payment_reminders",
        "schedule": crontab(hour=8, minute=0),
    },
    "notify-upcoming-departure-balances": {
        "task": "app.tasks.notify_upcoming_departure_balances",
        "schedule": crontab(hour=8, minute=30),
    },
}
