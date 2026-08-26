import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_context, CurrentContext
from app.models import Trip, TripDeparture
from app.models.enums import TripStatus
from app.schemas.trips import TripCreate, TripOut, DepartureCreate, DepartureUpdate, DepartureOut

router = APIRouter(prefix="/api/trips", tags=["trips"])


def _departure_out(d: TripDeparture) -> DepartureOut:
    return DepartureOut(
        id=d.id, trip_id=d.trip_id, departure_date=d.departure_date, return_date=d.return_date,
        capacity=d.capacity, price_override=d.price_override, status=d.status,
        confirmed_participants=d.confirmed_participants, available_seats=d.available_seats,
    )


@router.get("", response_model=list[TripOut])
def list_trips(ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    return db.query(Trip).filter(Trip.organization_id == ctx.organization.id).order_by(Trip.name).all()


@router.post("", response_model=TripOut, status_code=201)
def create_trip(payload: TripCreate, ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    trip = Trip(organization_id=ctx.organization.id, **payload.model_dump())
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return trip


@router.get("/{trip_id}", response_model=TripOut)
def get_trip(trip_id: uuid.UUID, ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    return _get_trip_or_404(db, ctx, trip_id)


@router.get("/{trip_id}/departures", response_model=list[DepartureOut])
def list_departures(trip_id: uuid.UUID, ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    _get_trip_or_404(db, ctx, trip_id)
    departures = db.query(TripDeparture).filter(
        TripDeparture.organization_id == ctx.organization.id, TripDeparture.trip_id == trip_id
    ).order_by(TripDeparture.departure_date).all()
    return [_departure_out(d) for d in departures]


@router.post("/{trip_id}/departures", response_model=DepartureOut, status_code=201)
def create_departure(trip_id: uuid.UUID, payload: DepartureCreate, ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    _get_trip_or_404(db, ctx, trip_id)
    departure = TripDeparture(
        organization_id=ctx.organization.id, trip_id=trip_id, status=TripStatus.OPEN,
        **payload.model_dump(),
    )
    db.add(departure)
    db.commit()
    db.refresh(departure)
    return _departure_out(departure)


@router.patch("/departures/{departure_id}", response_model=DepartureOut)
def update_departure(departure_id: uuid.UUID, payload: DepartureUpdate, ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    departure = _get_departure_or_404(db, ctx, departure_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(departure, field, value)
    db.commit()
    db.refresh(departure)
    return _departure_out(departure)


@router.get("/departures/{departure_id}/passengers")
def passenger_list(departure_id: uuid.UUID, ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    """Printable / CSV-exportable passenger list for a departure."""
    departure = _get_departure_or_404(db, ctx, departure_id)
    rows = []
    for booking in departure.bookings:
        for p in booking.participants:
            rows.append({
                "name": p.full_name, "phone": p.phone or booking.customer.phone if booking.customer else p.phone,
                "people": booking.num_participants, "payment_status": booking.payment_status,
                "status": booking.status, "booking_code": booking.booking_code,
            })
        if not booking.participants:
            rows.append({
                "name": booking.customer.full_name if booking.customer else "Unknown",
                "phone": booking.customer.phone if booking.customer else None,
                "people": booking.num_participants, "payment_status": booking.payment_status,
                "status": booking.status, "booking_code": booking.booking_code,
            })
    return {"departure_id": departure_id, "passengers": rows}


def _get_trip_or_404(db: Session, ctx: CurrentContext, trip_id: uuid.UUID) -> Trip:
    trip = db.query(Trip).filter(Trip.organization_id == ctx.organization.id, Trip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    return trip


def _get_departure_or_404(db: Session, ctx: CurrentContext, departure_id: uuid.UUID) -> TripDeparture:
    departure = db.query(TripDeparture).filter(
        TripDeparture.organization_id == ctx.organization.id, TripDeparture.id == departure_id
    ).first()
    if not departure:
        raise HTTPException(status_code=404, detail="Departure not found")
    return departure
