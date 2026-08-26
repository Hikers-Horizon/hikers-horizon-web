"""Background automation rules (kept intentionally simple for the MVP, per spec section 18).

WHEN payment pending          THEN create payment reminder follow-up
WHEN trip is 3 days away      THEN notify operator about pending payments
"""
import datetime
from app.celery_app import celery_app
from app.database import SessionLocal
from app.models import Booking, TripDeparture, Notification, FollowUp
from app.models.enums import PaymentStatus, BookingStatus, FollowUpStatus, NotificationChannel


@celery_app.task(name="app.tasks.create_payment_reminders")
def create_payment_reminders():
    db = SessionLocal()
    try:
        bookings = db.query(Booking).filter(
            Booking.status == BookingStatus.CONFIRMED,
            Booking.payment_status.in_([PaymentStatus.UNPAID, PaymentStatus.PARTIAL]),
        ).all()
        for booking in bookings:
            if booking.lead_id:
                exists = db.query(FollowUp).filter(
                    FollowUp.lead_id == booking.lead_id, FollowUp.status == FollowUpStatus.PENDING,
                    FollowUp.reason == "Payment reminder",
                ).first()
                if not exists:
                    db.add(FollowUp(
                        organization_id=booking.organization_id, lead_id=booking.lead_id,
                        due_at=datetime.datetime.utcnow() + datetime.timedelta(hours=1),
                        reason="Payment reminder",
                    ))
        db.commit()
    finally:
        db.close()


@celery_app.task(name="app.tasks.notify_upcoming_departure_balances")
def notify_upcoming_departure_balances():
    db = SessionLocal()
    try:
        target_date = (datetime.datetime.utcnow() + datetime.timedelta(days=3)).date()
        departures = db.query(TripDeparture).filter(TripDeparture.departure_date == target_date).all()
        for departure in departures:
            outstanding = sum(
                (b.total_amount - b.amount_paid) for b in departure.bookings if b.status == BookingStatus.CONFIRMED
            )
            if outstanding > 0:
                db.add(Notification(
                    organization_id=departure.organization_id,
                    channel=NotificationChannel.IN_APP,
                    title="Pending payments before departure",
                    body=f"Trip departing in 3 days has \u20b9{outstanding} in pending payments.",
                ))
        db.commit()
    finally:
        db.close()
