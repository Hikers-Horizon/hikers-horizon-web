import uuid
import datetime
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel, EmailStr, Field
from app.models.enums import LeadStatus, LeadSource, LeadScore, FollowUpStatus


class CustomerCreate(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    phone: str = Field(min_length=5, max_length=20)
    email: Optional[EmailStr] = None
    notes: Optional[str] = None


class CustomerOut(CustomerCreate):
    id: uuid.UUID
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class LeadCreate(BaseModel):
    # Customer (created inline for fast entry, or matched by phone)
    customer_name: str = Field(min_length=1, max_length=200)
    phone: str = Field(min_length=5, max_length=20)
    email: Optional[EmailStr] = None

    trek_name: Optional[str] = None
    trip_id: Optional[uuid.UUID] = None
    preferred_departure: Optional[datetime.date] = None
    num_people: int = Field(default=1, ge=1)
    source: LeadSource = LeadSource.OTHER
    notes: Optional[str] = None
    assigned_to: Optional[uuid.UUID] = None
    next_follow_up_at: Optional[datetime.datetime] = None
    estimated_value: Decimal = Decimal("0")


class LeadUpdate(BaseModel):
    trek_name: Optional[str] = None
    trip_id: Optional[uuid.UUID] = None
    preferred_departure: Optional[datetime.date] = None
    num_people: Optional[int] = Field(default=None, ge=1)
    source: Optional[LeadSource] = None
    status: Optional[LeadStatus] = None
    notes: Optional[str] = None
    assigned_to: Optional[uuid.UUID] = None
    next_follow_up_at: Optional[datetime.datetime] = None
    estimated_value: Optional[Decimal] = None


class LeadOut(BaseModel):
    id: uuid.UUID
    customer_id: uuid.UUID
    trip_id: Optional[uuid.UUID]
    trek_name: Optional[str]
    preferred_departure: Optional[datetime.date]
    num_people: int
    source: LeadSource
    status: LeadStatus
    estimated_value: Decimal
    assigned_to: Optional[uuid.UUID]
    last_contact_at: Optional[datetime.datetime]
    next_follow_up_at: Optional[datetime.datetime]
    score: LeadScore
    score_value: int
    score_reason: Optional[str]
    notes: Optional[str]
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class FollowUpCreate(BaseModel):
    lead_id: uuid.UUID
    due_at: datetime.datetime
    reason: Optional[str] = None
    assigned_to: Optional[uuid.UUID] = None


class FollowUpReschedule(BaseModel):
    due_at: datetime.datetime


class FollowUpOut(BaseModel):
    id: uuid.UUID
    lead_id: uuid.UUID
    assigned_to: Optional[uuid.UUID]
    due_at: datetime.datetime
    status: FollowUpStatus
    reason: Optional[str]
    outcome_notes: Optional[str]

    class Config:
        from_attributes = True
