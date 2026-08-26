from sqlalchemy import Column, String, Integer, Numeric, Date, ForeignKey, Enum, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin, gen_uuid
from app.models.enums import TripStatus


class Trip(Base, TimestampMixin):
    """A trek product, e.g. 'Kudremukha Trek'. Departures are concrete scheduled runs."""
    __tablename__ = "trips"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    pickup_location = Column(String, nullable=True)
    price = Column(Numeric(12, 2), nullable=False, default=0)

    leads = relationship("Lead", back_populates="trip")
    departures = relationship("TripDeparture", back_populates="trip", cascade="all, delete-orphan")


class TripDeparture(Base, TimestampMixin):
    """A specific scheduled departure date for a trip, with its own capacity."""
    __tablename__ = "trip_departures"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True)

    departure_date = Column(Date, nullable=False, index=True)
    return_date = Column(Date, nullable=True)
    capacity = Column(Integer, nullable=False, default=0)
    price_override = Column(Numeric(12, 2), nullable=True)
    status = Column(Enum(TripStatus), default=TripStatus.DRAFT, nullable=False, index=True)

    trip = relationship("Trip", back_populates="departures")
    bookings = relationship("Booking", back_populates="departure")

    @property
    def confirmed_participants(self) -> int:
        from app.models.enums import BookingStatus
        return sum(
            b.num_participants for b in self.bookings if b.status == BookingStatus.CONFIRMED
        )

    @property
    def available_seats(self) -> int:
        return max(self.capacity - self.confirmed_participants, 0)
