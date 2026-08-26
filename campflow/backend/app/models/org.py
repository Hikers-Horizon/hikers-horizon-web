import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base
from app.models.base import TimestampMixin, gen_uuid
from app.models.enums import UserRole, SubscriptionStatus


class Organization(Base, TimestampMixin):
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Subscription (Phase 7 architecture, minimal for MVP)
    plan_id = Column(UUID(as_uuid=True), ForeignKey("plans.id"), nullable=True)
    subscription_status = Column(Enum(SubscriptionStatus), default=SubscriptionStatus.TRIALING, nullable=False)

    # AI auto-reply: when enabled, inbound WhatsApp/Instagram messages are answered automatically.
    ai_auto_reply_enabled = Column(Boolean, default=True, nullable=False)
    ai_system_prompt = Column(String, nullable=True)  # optional per-org customization of the assistant persona

    # Per-org channel identifiers used to route inbound webhook events to the right tenant
    # when multiple organizations share the platform's WhatsApp/Instagram app configuration.
    whatsapp_phone_number_id = Column(String, nullable=True, index=True)
    whatsapp_business_account_id = Column(String, nullable=True)
    whatsapp_webhook_verify_token = Column(String, nullable=True)
    instagram_page_id = Column(String, nullable=True, index=True)

    # Per-org access tokens: lets each business connect their own WhatsApp/Instagram
    # account by simply pasting their number/page ID + access token in Settings,
    # instead of relying on one shared platform-level token for every tenant.
    whatsapp_access_token = Column(String, nullable=True)
    instagram_access_token = Column(String, nullable=True)

    members = relationship("OrganizationMember", back_populates="organization", cascade="all, delete-orphan")


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_email_verified = Column(Boolean, default=False, nullable=False)
    is_platform_admin = Column(Boolean, default=False, nullable=False)

    memberships = relationship("OrganizationMember", back_populates="user", cascade="all, delete-orphan")


class OrganizationMember(Base, TimestampMixin):
    __tablename__ = "organization_members"
    __table_args__ = (UniqueConstraint("organization_id", "user_id", name="uq_org_user"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(Enum(UserRole), default=UserRole.STAFF, nullable=False)

    organization = relationship("Organization", back_populates="members")
    user = relationship("User", back_populates="memberships")


class EmailVerificationToken(Base, TimestampMixin):
    __tablename__ = "email_verification_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String, unique=True, nullable=False, index=True)
    used = Column(Boolean, default=False, nullable=False)


class PasswordResetToken(Base, TimestampMixin):
    __tablename__ = "password_reset_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token = Column(String, unique=True, nullable=False, index=True)
    used = Column(Boolean, default=False, nullable=False)
