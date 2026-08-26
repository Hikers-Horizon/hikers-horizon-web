from sqlalchemy import Column, String, Integer, Numeric, Date, ForeignKey, Enum, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin, gen_uuid
from app.models.enums import BookingStatus, PaymentStatus


class Booking(Base, TimestampMixin):
    __tablename__ = "bookings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    booking_code = Column(String, unique=True, nullable=False, index=True)  # e.g. TH-2026-00142

    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="SET NULL"), nullable=True, index=True)
    departure_id = Column(UUID(as_uuid=True), ForeignKey("trip_departures.id", ondelete="SET NULL"), nullable=True, index=True)

    num_participants = Column(Integer, nullable=False, default=1)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0)
    amount_paid = Column(Numeric(12, 2), nullable=False, default=0)
    payment_deadline = Column(Date, nullable=True)

    status = Column(Enum(BookingStatus), default=BookingStatus.PENDING, nullable=False, index=True)
    payment_status = Column(Enum(PaymentStatus), default=PaymentStatus.UNPAID, nullable=False, index=True)
    payment_link = Column(String, nullable=True)

    customer = relationship("Customer", back_populates="bookings")
    departure = relationship("TripDeparture", back_populates="bookings")
    participants = relationship("BookingParticipant", back_populates="booking", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="booking", cascade="all, delete-orphan")

    @property
    def balance(self):
        return self.total_amount - self.amount_paid


class BookingParticipant(Base, TimestampMixin):
    __tablename__ = "booking_participants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)

    full_name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)

    booking = relationship("Booking", back_populates="participants")


class Payment(Base, TimestampMixin):
    __tablename__ = "payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    booking_id = Column(UUID(as_uuid=True), ForeignKey("bookings.id", ondelete="CASCADE"), nullable=False, index=True)

    amount = Column(Numeric(12, 2), nullable=False)
    method = Column(String, nullable=True)  # cash, upi, bank_transfer, razorpay, cashfree
    provider = Column(String, nullable=True)  # PaymentProvider name if via gateway
    provider_reference = Column(String, nullable=True)  # gateway transaction id
    notes = Column(Text, nullable=True)

    booking = relationship("Booking", back_populates="payments")
