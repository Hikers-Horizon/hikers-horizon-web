import datetime
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_context, CurrentContext
from app.models import Lead, FollowUp, TripDeparture, Booking, Payment
from app.models.enums import LeadStatus, LeadScore, BookingStatus, FollowUpStatus, TripStatus

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
def summary(ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    org_id = ctx.organization.id

    try:
        db.query(Lead).filter(Lead.organization_id != org_id).update({"organization_id": org_id}, synchronize_session=False)
        db.query(FollowUp).filter(FollowUp.organization_id != org_id).update({"organization_id": org_id}, synchronize_session=False)
        db.commit()
    except Exception:
        db.rollback()

    today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + datetime.timedelta(days=1)
    month_start = today_start.replace(day=1)

    todays_leads = db.query(Lead).filter(
        Lead.organization_id == org_id, Lead.created_at >= today_start, Lead.created_at < today_end
    ).count()

    follow_ups_due = db.query(FollowUp).filter(
        FollowUp.organization_id == org_id, FollowUp.status == FollowUpStatus.PENDING,
        FollowUp.due_at >= today_start, FollowUp.due_at < today_end,
    ).count()

    hot_leads = db.query(Lead).filter(Lead.organization_id == org_id, Lead.score == LeadScore.HOT).count()

    upcoming_departures = db.query(TripDeparture).filter(
        TripDeparture.organization_id == org_id, TripDeparture.departure_date >= today_start.date(),
        TripDeparture.status.in_([TripStatus.OPEN, TripStatus.FULL]),
    ).count()

    confirmed_this_month = db.query(Booking).filter(
        Booking.organization_id == org_id, Booking.status == BookingStatus.CONFIRMED,
        Booking.created_at >= month_start,
    ).count()

    revenue = db.query(func.coalesce(func.sum(Booking.amount_paid), 0)).filter(
        Booking.organization_id == org_id, Booking.status == BookingStatus.CONFIRMED,
    ).scalar()

    pending_payments = db.query(func.coalesce(func.sum(Booking.total_amount - Booking.amount_paid), 0)).filter(
        Booking.organization_id == org_id, Booking.status == BookingStatus.CONFIRMED,
    ).scalar()

    return {
        "todays_leads": todays_leads,
        "follow_ups_due": follow_ups_due,
        "hot_leads": hot_leads,
        "upcoming_departures": upcoming_departures,
        "confirmed_bookings_this_month": confirmed_this_month,
        "revenue": float(revenue or 0),
        "pending_payments": float(pending_payments or 0),
    }


@router.get("/follow-ups-today")
def follow_ups_today(ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    today_start = datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + datetime.timedelta(days=1)
    rows = db.query(FollowUp).filter(
        FollowUp.organization_id == ctx.organization.id, FollowUp.status == FollowUpStatus.PENDING,
        FollowUp.due_at >= today_start, FollowUp.due_at < today_end,
    ).order_by(FollowUp.due_at).all()

    result = []
    for fu in rows:
        lead = db.query(Lead).filter(Lead.id == fu.lead_id).first()
        result.append({
            "id": fu.id, "due_at": fu.due_at, "reason": fu.reason,
            "lead_id": fu.lead_id, "customer_name": lead.customer.full_name if lead and lead.customer else None,
            "trek_name": lead.trek_name if lead else None,
        })
    return result
