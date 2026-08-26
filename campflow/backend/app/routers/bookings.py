import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_context, CurrentContext
from app.models import Booking, BookingParticipant, TripDeparture, Lead
from app.models.enums import BookingStatus, PaymentStatus, TripStatus, LeadStatus
from app.schemas.bookings import BookingCreate, BookingUpdate, BookingOut

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


def _generate_booking_code(db: Session, org_id) -> str:
    year = datetime.datetime.utcnow().year
    count = db.query(Booking).filter(Booking.organization_id == org_id).count() + 1
    return f"TH-{year}-{count:05d}"


def _recompute_payment_status(booking: Booking):
    if booking.amount_paid <= 0:
        booking.payment_status = PaymentStatus.UNPAID
    elif booking.amount_paid >= booking.total_amount:
        booking.payment_status = PaymentStatus.PAID
    else:
        booking.payment_status = PaymentStatus.PARTIAL


def _sync_departure_status(db: Session, departure: TripDeparture):
    if departure.available_seats <= 0 and departure.status == TripStatus.OPEN:
        departure.status = TripStatus.FULL
    elif departure.available_seats > 0 and departure.status == TripStatus.FULL:
        departure.status = TripStatus.OPEN


@router.get("", response_model=list[BookingOut])
def list_bookings(
    trip_id: uuid.UUID | None = None,
    payment_status: PaymentStatus | None = None,
    status: BookingStatus | None = None,
    ctx: CurrentContext = Depends(get_current_context),
    db: Session = Depends(get_db),
):
    query = db.query(Booking).filter(Booking.organization_id == ctx.organization.id)
    if trip_id:
        query = query.filter(Booking.trip_id == trip_id)
    if payment_status:
        query = query.filter(Booking.payment_status == payment_status)
    if status:
        query = query.filter(Booking.status == status)
    return query.order_by(Booking.created_at.desc()).all()


@router.post("", response_model=BookingOut, status_code=201)
def create_booking(payload: BookingCreate, ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    departure = db.query(TripDeparture).filter(
        TripDeparture.organization_id == ctx.organization.id, TripDeparture.id == payload.departure_id
    ).first()
    if not departure:
        raise HTTPException(status_code=404, detail="Departure not found")
    if departure.available_seats < payload.num_participants:
        raise HTTPException(status_code=400, detail=f"Only {departure.available_seats} seats available")

    booking = Booking(
        organization_id=ctx.organization.id,
        booking_code=_generate_booking_code(db, ctx.organization.id),
        customer_id=payload.customer_id,
        lead_id=payload.lead_id,
        trip_id=payload.trip_id,
        departure_id=payload.departure_id,
        num_participants=payload.num_participants,
        total_amount=payload.total_amount,
        amount_paid=payload.amount_paid,
        payment_deadline=payload.payment_deadline,
        payment_link=payload.payment_link,
        status=BookingStatus.CONFIRMED,
    )
    _recompute_payment_status(booking)
    db.add(booking)
    db.flush()

    for p in payload.participants:
        db.add(BookingParticipant(organization_id=ctx.organization.id, booking_id=booking.id, **p.model_dump()))

    db.flush()
    _sync_departure_status(db, departure)

    if payload.lead_id:
        lead = db.query(Lead).filter(Lead.id == payload.lead_id).first()
        if lead:
            lead.status = LeadStatus.CONFIRMED

    db.commit()
    db.refresh(booking)
    return booking


@router.get("/{booking_id}", response_model=BookingOut)
def get_booking(booking_id: uuid.UUID, ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    return _get_or_404(db, ctx, booking_id)


@router.patch("/{booking_id}", response_model=BookingOut)
def update_booking(booking_id: uuid.UUID, payload: BookingUpdate, ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    booking = _get_or_404(db, ctx, booking_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(booking, field, value)
    _recompute_payment_status(booking)
    db.commit()
    db.refresh(booking)
    return booking


def _get_or_404(db: Session, ctx: CurrentContext, booking_id: uuid.UUID) -> Booking:
    booking = db.query(Booking).filter(Booking.organization_id == ctx.organization.id, Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking
