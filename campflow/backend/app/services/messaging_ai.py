"""Shared AI auto-reply orchestration used by both WhatsApp and Instagram routers.

Keeping this logic in one place avoids duplicating the "build context ->
generate reply -> send -> log" flow across channels.

When AI_SALES_AGENT_ENABLED is True, delegates to the full sales agent with
function-calling for booking capabilities. Otherwise falls back to the simpler
ai_reply module for basic auto-responses.
"""
import logging
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Message, Organization, Customer, Lead, LeadActivity
from app.models.enums import MessageDirection
from app.services.whatsapp import WhatsAppClient
from app.services.instagram import InstagramClient

logger = logging.getLogger("campflow.messaging_ai")


def send_ai_reply(db: Session, *, org: Organization, customer: Customer, lead: Lead, channel: str):
    """Generates an AI reply grounded in recent conversation history and sends it
    over the given channel ("whatsapp" or "instagram"), logging the result.
    """
    recent = db.query(Message).filter(
        Message.organization_id == org.id, Message.customer_id == customer.id, Message.channel == channel,
    ).order_by(Message.created_at.desc()).limit(10).all()
    recent = list(reversed(recent))

    recent_messages = [{"direction": m.direction.value, "body": m.body} for m in recent]
    last_inbound = recent[-1].body if recent else ""

    # Choose sales agent or simple reply based on config
    if settings.AI_SALES_AGENT_ENABLED:
        from app.services.ai_sales_agent import run_sales_agent
        reply_text = run_sales_agent(
            db,
            org=org,
            customer=customer,
            lead=lead,
            inbound_text=last_inbound,
            recent_messages=recent_messages,
        )
    else:
        from app.services.ai_reply import build_context, generate_reply
        context = build_context(
            organization_name=org.name, trek_name=lead.trek_name, lead_status=lead.status.value if lead.status else None,
            estimated_value=lead.estimated_value, num_people=lead.num_people, customer_name=customer.full_name,
            recent_messages=recent_messages,
        )
        reply_text = generate_reply(inbound_text=last_inbound, context=context, system_prompt=org.ai_system_prompt)

    outbound = Message(
        organization_id=org.id, customer_id=customer.id, lead_id=lead.id,
        direction=MessageDirection.OUTBOUND, channel=channel, body=reply_text, status="queued",
    )
    db.add(outbound)

    whatsapp_token = org.whatsapp_access_token or settings.WHATSAPP_ACCESS_TOKEN
    instagram_token = org.instagram_access_token or settings.INSTAGRAM_ACCESS_TOKEN

    if channel == "whatsapp" and whatsapp_token and (org.whatsapp_phone_number_id or settings.WHATSAPP_PHONE_NUMBER_ID):
        try:
            client = WhatsAppClient(phone_number_id=org.whatsapp_phone_number_id, access_token=whatsapp_token)
            result = client.send_text_message(customer.phone, reply_text)
            outbound.whatsapp_message_id = result.get("messages", [{}])[0].get("id")
            outbound.status = "sent"
        except Exception:  # noqa: BLE001
            outbound.status = "failed"
            logger.exception("Failed to send AI-generated WhatsApp reply")
    elif channel == "instagram" and instagram_token and customer.instagram_id and (org.instagram_page_id or settings.INSTAGRAM_PAGE_ID):
        try:
            client = InstagramClient(page_id=org.instagram_page_id, access_token=instagram_token)
            client.send_text_message(customer.instagram_id, reply_text)
            outbound.status = "sent"
        except Exception:  # noqa: BLE001
            outbound.status = "failed"
            logger.exception("Failed to send AI-generated Instagram reply")
    else:
        outbound.status = "not_configured"

    db.add(LeadActivity(
        organization_id=org.id, lead_id=lead.id, activity_type="AI_REPLY_SENT",
        description=f"AI auto-reply ({channel}): {reply_text[:200]}",
    ))
    db.commit()
    return outbound
