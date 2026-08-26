from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_context, CurrentContext
from app.models import Customer, Booking, Trip

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
def global_search(q: str, ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    like = f"%{q}%"
    org_id = ctx.organization.id

    customers = db.query(Customer).filter(
        Customer.organization_id == org_id,
        (Customer.full_name.ilike(like)) | (Customer.phone.ilike(like)),
    ).limit(10).all()

    bookings = db.query(Booking).filter(
        Booking.organization_id == org_id, Booking.booking_code.ilike(like)
    ).limit(10).all()

    trips = db.query(Trip).filter(Trip.organization_id == org_id, Trip.name.ilike(like)).limit(10).all()

    return {
        "customers": [{"id": c.id, "name": c.full_name, "phone": c.phone} for c in customers],
        "bookings": [{"id": b.id, "code": b.booking_code, "balance": float(b.balance)} for b in bookings],
        "trips": [{"id": t.id, "name": t.name} for t in trips],
    }
