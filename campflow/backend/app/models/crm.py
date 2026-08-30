from sqlalchemy import Column, String, Integer, Numeric, Date, DateTime, ForeignKey, Enum, Text, Boolean
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin, gen_uuid
from app.models.enums import LeadStatus, LeadSource, LeadScore, FollowUpStatus


class Customer(Base, TimestampMixin):
    __tablename__ = "customers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    full_name = Column(String, nullable=False)
    phone = Column(String, nullable=False, index=True)
    email = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    instagram_id = Column(String, nullable=True, index=True)  # Instagram-scoped user ID (IGSID)
    ai_disabled = Column(Boolean, default=False, nullable=False)  # When True, AI auto-reply is paused for human takeover

    leads = relationship("Lead", back_populates="customer")
    bookings = relationship("Booking", back_populates="customer")


class Lead(Base, TimestampMixin):
    __tablename__ = "leads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="SET NULL"), nullable=True, index=True)

    trek_name = Column(String, nullable=True)
    preferred_departure = Column(Date, nullable=True)
    num_people = Column(Integer, default=1, nullable=False)
    source = Column(Enum(LeadSource), default=LeadSource.OTHER, nullable=False)
    status = Column(Enum(LeadStatus), default=LeadStatus.NEW, nullable=False, index=True)
    estimated_value = Column(Numeric(12, 2), default=0, nullable=False)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    ai_disabled = Column(Boolean, default=False, nullable=False)  # When True, AI auto-reply is paused for this lead

    last_contact_at = Column(DateTime, nullable=True)
    next_follow_up_at = Column(DateTime, nullable=True, index=True)

    score = Column(Enum(LeadScore), default=LeadScore.COLD, nullable=False)
    score_value = Column(Integer, default=0, nullable=False)
    score_reason = Column(Text, nullable=True)

    notes = Column(Text, nullable=True)

    customer = relationship("Customer", back_populates="leads")
    trip = relationship("Trip", back_populates="leads")
    follow_ups = relationship("FollowUp", back_populates="lead", cascade="all, delete-orphan")
    activities = relationship("LeadActivity", back_populates="lead", cascade="all, delete-orphan")


class LeadNote(Base, TimestampMixin):
    __tablename__ = "lead_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    body = Column(Text, nullable=False)


class LeadActivity(Base, TimestampMixin):
    """Audit trail of status changes, calls, messages etc. for a lead."""
    __tablename__ = "lead_activities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    activity_type = Column(String, nullable=False)  # e.g. STATUS_CHANGE, CALL, WHATSAPP_SENT, NOTE
    description = Column(Text, nullable=True)

    lead = relationship("Lead", back_populates="activities")


class FollowUp(Base, TimestampMixin):
    __tablename__ = "follow_ups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_to = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)

    due_at = Column(DateTime, nullable=False, index=True)
    status = Column(Enum(FollowUpStatus), default=FollowUpStatus.PENDING, nullable=False, index=True)
    reason = Column(String, nullable=True)  # e.g. "Payment pending", "Asked for itinerary"
    outcome_notes = Column(Text, nullable=True)

    lead = relationship("Lead", back_populates="follow_ups")
