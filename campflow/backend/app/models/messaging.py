from sqlalchemy import Column, String, Boolean, ForeignKey, Enum, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base
from app.models.base import TimestampMixin, gen_uuid
from app.models.enums import MessageDirection, NotificationChannel


class MessageTemplate(Base, TimestampMixin):
    """WhatsApp-approved message templates (per Meta template requirements)."""
    __tablename__ = "message_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)  # internal name
    whatsapp_template_name = Column(String, nullable=True)  # name registered with Meta
    category = Column(String, nullable=False)  # ENQUIRY, FOLLOW_UP, PAYMENT_REMINDER, BOOKING_CONFIRMATION
    body = Column(Text, nullable=False)  # e.g. "Hi {{name}}, thanks for your interest in {{trek}}..."
    variables = Column(JSON, nullable=True)  # list of variable names
    is_active = Column(Boolean, default=True, nullable=False)


class Message(Base, TimestampMixin):
    """Log of WhatsApp (and future channel) messages sent/received."""
    __tablename__ = "messages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=True, index=True)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True)
    template_id = Column(UUID(as_uuid=True), ForeignKey("message_templates.id"), nullable=True)

    direction = Column(Enum(MessageDirection), nullable=False)
    channel = Column(String, default="whatsapp", nullable=False)
    body = Column(Text, nullable=False)
    whatsapp_message_id = Column(String, nullable=True, index=True)
    status = Column(String, nullable=True)  # sent, delivered, read, failed


class Notification(Base, TimestampMixin):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)

    channel = Column(Enum(NotificationChannel), default=NotificationChannel.IN_APP, nullable=False)
    title = Column(String, nullable=False)
    body = Column(Text, nullable=True)
    is_read = Column(Boolean, default=False, nullable=False)
    link = Column(String, nullable=True)


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=gen_uuid)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    actor_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action = Column(String, nullable=False)  # e.g. "lead.status_changed"
    entity_type = Column(String, nullable=True)
    entity_id = Column(String, nullable=True)
    metadata_json = Column(JSON, nullable=True)
    ip_address = Column(String, nullable=True)
