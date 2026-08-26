import uuid
import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, Field
from app.models.enums import BookingStatus, PaymentStatus


class BookingParticipantIn(BaseModel):
    full_name: str
    phone: Optional[str] = None
    age: Optional[int] = None


class BookingCreate(BaseModel):
    customer_id: uuid.UUID
    lead_id: Optional[uuid.UUID] = None
    trip_id: uuid.UUID
    departure_id: uuid.UUID
    num_participants: int = Field(ge=1)
    total_amount: Decimal
    amount_paid: Decimal = Decimal("0")
    payment_deadline: Optional[datetime.date] = None
    payment_link: Optional[str] = None
    participants: list[BookingParticipantIn] = []


class BookingUpdate(BaseModel):
    status: Optional[BookingStatus] = None
    total_amount: Optional[Decimal] = None
    payment_deadline: Optional[datetime.date] = None
    payment_link: Optional[str] = None


class BookingOut(BaseModel):
    id: uuid.UUID
    booking_code: str
    customer_id: uuid.UUID
    trip_id: Optional[uuid.UUID]
    departure_id: Optional[uuid.UUID]
    num_participants: int
    total_amount: Decimal
    amount_paid: Decimal
    balance: Decimal
    payment_deadline: Optional[datetime.date]
    status: BookingStatus
    payment_status: PaymentStatus
    payment_link: Optional[str]

    class Config:
        from_attributes = True


class PaymentCreate(BaseModel):
    amount: Decimal = Field(gt=0)
    method: Optional[str] = None
    notes: Optional[str] = None


class PaymentOut(BaseModel):
    id: uuid.UUID
    booking_id: uuid.UUID
    amount: Decimal
    method: Optional[str]
    provider: Optional[str]
    provider_reference: Optional[str]
    created_at: datetime.datetime

    class Config:
        from_attributes = True
