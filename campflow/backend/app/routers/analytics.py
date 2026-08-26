from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_context, CurrentContext
from app.models import Lead, Booking, Trip
from app.models.enums import LeadStatus, BookingStatus

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview")
def overview(ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    org_id = ctx.organization.id
    total_leads = db.query(Lead).filter(Lead.organization_id == org_id).count()
    converted = db.query(Lead).filter(Lead.organization_id == org_id, Lead.status == LeadStatus.CONFIRMED).count()
    lost = db.query(Lead).filter(Lead.organization_id == org_id, Lead.status == LeadStatus.LOST).count()
    revenue = db.query(func.coalesce(func.sum(Booking.amount_paid), 0)).filter(
        Booking.organization_id == org_id, Booking.status == BookingStatus.CONFIRMED
    ).scalar()
    pending = db.query(func.coalesce(func.sum(Booking.total_amount - Booking.amount_paid), 0)).filter(
        Booking.organization_id == org_id, Booking.status == BookingStatus.CONFIRMED
    ).scalar()
    bookings_count = db.query(Booking).filter(Booking.organization_id == org_id, Booking.status == BookingStatus.CONFIRMED).count()
    avg_booking_value = float(revenue or 0) / bookings_count if bookings_count else 0
    conversion_rate = (converted / total_leads * 100) if total_leads else 0

    return {
        "total_leads": total_leads,
        "converted_leads": converted,
        "lost_leads": lost,
        "conversion_rate": round(conversion_rate, 2),
        "revenue": float(revenue or 0),
        "pending_payments": float(pending or 0),
        "average_booking_value": round(avg_booking_value, 2),
    }


@router.get("/funnel")
def funnel(ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    org_id = ctx.organization.id
    stages = [
        LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.INTERESTED,
        LeadStatus.PAYMENT_PENDING, LeadStatus.CONFIRMED,
    ]
    counts = {}
    for stage in stages:
        counts[stage.value] = db.query(Lead).filter(
            Lead.organization_id == org_id, Lead.status == stage
        ).count()
    return counts


@router.get("/leads-by-source")
def leads_by_source(ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    rows = db.query(Lead.source, func.count(Lead.id)).filter(
        Lead.organization_id == ctx.organization.id
    ).group_by(Lead.source).all()
    total = sum(c for _, c in rows) or 1
    return [{"source": s.value, "count": c, "percentage": round(c / total * 100, 1)} for s, c in rows]


@router.get("/revenue-by-trek")
def revenue_by_trek(ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    rows = db.query(Trip.name, func.coalesce(func.sum(Booking.amount_paid), 0)).join(
        Booking, Booking.trip_id == Trip.id
    ).filter(
        Trip.organization_id == ctx.organization.id, Booking.status == BookingStatus.CONFIRMED
    ).group_by(Trip.name).all()
    return [{"trek": name, "revenue": float(rev)} for name, rev in rows]
