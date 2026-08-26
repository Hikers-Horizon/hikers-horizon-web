from sqlalchemy import Column, String, Integer, Numeric, Boolean, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from app.models.base import TimestampMixin, gen_uuid


class Plan(Base, TimestampMixin):
    """Subscription plans - configurable from the admin panel."""
    __tablename__ = "plans"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)  # Starter, Growth, Pro
    slug = Column(String, unique=True, nullable=False)
    price_monthly = Column(Numeric(12, 2), nullable=False)
    max_users = Column(Integer, nullable=True)  # null = unlimited
    max_leads = Column(Integer, nullable=True)
    max_active_trips = Column(Integer, nullable=True)
    features = Column(JSON, nullable=True)  # e.g. ["whatsapp", "analytics", "lead_scoring"]
    is_active = Column(Boolean, default=True, nullable=False)


class Subscription(Base, TimestampMixin):
    """Active subscription for an organization; payment gateway abstracted via PaymentProvider."""
    __tablename__ = "subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id"), nullable=False)
    provider = Column(String, nullable=True)  # razorpay | cashfree | stripe
    provider_subscription_id = Column(String, nullable=True)
    current_period_end = Column(String, nullable=True)
