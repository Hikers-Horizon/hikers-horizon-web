import uuid
import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field
from app.models.enums import TripStatus


class TripCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    pickup_location: Optional[str] = None
    price: Decimal = Decimal("0")


class TripOut(TripCreate):
    id: uuid.UUID

    class Config:
        from_attributes = True


class DepartureCreate(BaseModel):
    departure_date: datetime.date
    return_date: Optional[datetime.date] = None
    capacity: int = Field(ge=0)
    price_override: Optional[Decimal] = None


class DepartureUpdate(BaseModel):
    departure_date: Optional[datetime.date] = None
    return_date: Optional[datetime.date] = None
    capacity: Optional[int] = Field(default=None, ge=0)
    price_override: Optional[Decimal] = None
    status: Optional[TripStatus] = None


class DepartureOut(BaseModel):
    id: uuid.UUID
    trip_id: uuid.UUID
    departure_date: datetime.date
    return_date: Optional[datetime.date]
    capacity: int
    price_override: Optional[Decimal]
    status: TripStatus
    confirmed_participants: int
    available_seats: int

    class Config:
        from_attributes = True
