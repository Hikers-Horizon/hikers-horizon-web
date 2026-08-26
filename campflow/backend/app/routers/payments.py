import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_context, CurrentContext
from app.models import Payment, Booking
from app.schemas.bookings import PaymentCreate, PaymentOut
from app.routers.bookings import _recompute_payment_status

router = APIRouter(prefix="/api/bookings/{booking_id}/payments", tags=["payments"])


@router.get("", response_model=list[PaymentOut])
def list_payments(booking_id: uuid.UUID, ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    _get_booking_or_404(db, ctx, booking_id)
    return db.query(Payment).filter(Payment.organization_id == ctx.organization.id, Payment.booking_id == booking_id).order_by(Payment.created_at.desc()).all()


@router.post("", response_model=PaymentOut, status_code=201)
def record_payment(booking_id: uuid.UUID, payload: PaymentCreate, ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    booking = _get_booking_or_404(db, ctx, booking_id)
    payment = Payment(organization_id=ctx.organization.id, booking_id=booking_id, **payload.model_dump())
    db.add(payment)

    booking.amount_paid = booking.amount_paid + payload.amount
    _recompute_payment_status(booking)

    db.commit()
    db.refresh(payment)
    return payment


def _get_booking_or_404(db: Session, ctx: CurrentContext, booking_id: uuid.UUID) -> Booking:
    booking = db.query(Booking).filter(Booking.organization_id == ctx.organization.id, Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    return booking
