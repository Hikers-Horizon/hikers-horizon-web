"""Public-facing API — no authentication required.

Exposes trek availability data that can be consumed by external websites
(e.g. hikershorizon.in) via a simple JavaScript fetch/embed widget.
"""
import datetime
import uuid as _uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Trip, TripDeparture, Organization
from app.models.enums import TripStatus

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/availability")
def get_public_availability(
    org_slug: Optional[str] = Query(None, description="Organization slug to filter by"),
    org_id: Optional[str] = Query(None, description="Organization ID to filter by"),
    trek_name: Optional[str] = Query(None, description="Filter by trek name (partial match)"),
    db: Session = Depends(get_db),
):
    """Returns upcoming trek departures with seat availability for a specific organization.
    
    This endpoint requires NO authentication and is designed to be called from
    external websites via JavaScript to render live availability widgets.
    
    Usage from hikershorizon.in:
        fetch('https://your-campflow-api.com/api/public/availability?org_slug=hikers-horizon')
    """
    # Resolve organization
    org = None
    if org_slug:
        org = db.query(Organization).filter(Organization.slug == org_slug, Organization.is_active == True).first()
    elif org_id:
        try:
            org = db.query(Organization).filter(Organization.id == _uuid.UUID(org_id), Organization.is_active == True).first()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid org_id format")
    else:
        # Default: return first active org (single-tenant / dev)
        org = db.query(Organization).filter(Organization.is_active == True).order_by(Organization.created_at.asc()).first()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # Fetch trips
    trips_q = db.query(Trip).filter(Trip.organization_id == org.id)
    if trek_name:
        trips_q = trips_q.filter(Trip.name.ilike(f"%{trek_name}%"))
    trips = trips_q.order_by(Trip.name.asc()).all()

    today = datetime.date.today()
    result = []

    for trip in trips:
        departures = (
            db.query(TripDeparture)
            .filter(
                TripDeparture.trip_id == trip.id,
                TripDeparture.organization_id == org.id,
                TripDeparture.departure_date >= today,
                TripDeparture.status.in_([TripStatus.OPEN, TripStatus.FULL]),
            )
            .order_by(TripDeparture.departure_date.asc())
            .limit(10)
            .all()
        )
        if not departures:
            continue

        dep_list = []
        for d in departures:
            dep_list.append({
                "date": d.departure_date.isoformat(),
                "day": d.departure_date.strftime("%a"),
                "return_date": d.return_date.isoformat() if d.return_date else None,
                "available_seats": d.available_seats,
                "total_capacity": d.capacity,
                "price": float(d.price_override or trip.price),
                "status": "FULL" if d.available_seats <= 0 else "OPEN",
            })

        result.append({
            "trek_name": trip.name,
            "description": trip.description or "",
            "price": float(trip.price),
            "pickup_location": trip.pickup_location or "",
            "departures": dep_list,
        })

    return {
        "organization": org.name,
        "generated_at": datetime.datetime.utcnow().isoformat(),
        "treks": result,
    }


@router.get("/availability/{trek_name}")
def get_trek_availability(
    trek_name: str,
    org_slug: Optional[str] = Query(None),
    org_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    """Returns availability for a single trek by name (URL-encoded)."""
    # Resolve org
    org = None
    if org_slug:
        org = db.query(Organization).filter(Organization.slug == org_slug, Organization.is_active == True).first()
    elif org_id:
        try:
            org = db.query(Organization).filter(Organization.id == _uuid.UUID(org_id), Organization.is_active == True).first()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid org_id format")
    else:
        org = db.query(Organization).filter(Organization.is_active == True).order_by(Organization.created_at.asc()).first()

    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    trip = db.query(Trip).filter(
        Trip.organization_id == org.id, Trip.name.ilike(f"%{trek_name}%")
    ).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trek not found")

    today = datetime.date.today()
    departures = (
        db.query(TripDeparture)
        .filter(
            TripDeparture.trip_id == trip.id,
            TripDeparture.organization_id == org.id,
            TripDeparture.departure_date >= today,
        )
        .order_by(TripDeparture.departure_date.asc())
        .limit(20)
        .all()
    )

    return {
        "trek_name": trip.name,
        "description": trip.description or "",
        "price": float(trip.price),
        "pickup_location": trip.pickup_location or "",
        "departures": [
            {
                "date": d.departure_date.isoformat(),
                "day": d.departure_date.strftime("%a"),
                "return_date": d.return_date.isoformat() if d.return_date else None,
                "available_seats": d.available_seats,
                "total_capacity": d.capacity,
                "price": float(d.price_override or trip.price),
                "status": d.status.value,
            }
            for d in departures
        ],
    }
