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

    logger.info("AI sales agent generated reply: %s", reply_text)

    outbound = Message(
        organization_id=org.id, customer_id=customer.id, lead_id=lead.id,
        direction=MessageDirection.OUTBOUND, channel=channel, body=reply_text, status="queued",
    )
    db.add(outbound)
    db.commit()
    db.refresh(outbound)

    whatsapp_token = org.whatsapp_access_token or settings.WHATSAPP_ACCESS_TOKEN
    instagram_token = org.instagram_access_token or settings.INSTAGRAM_ACCESS_TOKEN

    if channel == "whatsapp" and whatsapp_token and (org.whatsapp_phone_number_id or settings.WHATSAPP_PHONE_NUMBER_ID):
        try:
            phone_id = org.whatsapp_phone_number_id or settings.WHATSAPP_PHONE_NUMBER_ID
            logger.info("Dispatching WhatsApp message to %s using phone_id %s", customer.phone, phone_id)
            client = WhatsAppClient(phone_number_id=phone_id, access_token=whatsapp_token)
            result = client.send_text_message(customer.phone, reply_text)
            outbound.whatsapp_message_id = result.get("messages", [{}])[0].get("id")
            outbound.status = "sent"
            logger.info("Successfully sent WhatsApp reply to %s: %s", customer.phone, result)
        except Exception as exc:  # noqa: BLE001
            outbound.status = "failed"
            logger.exception("Failed to send AI-generated WhatsApp reply: %s", exc)
    elif channel == "instagram" and instagram_token and customer.instagram_id:
        try:
            page_id = org.instagram_page_id or settings.INSTAGRAM_PAGE_ID
            logger.info("Dispatching Instagram message to recipient %s", customer.instagram_id)
            client = InstagramClient(page_id=page_id, access_token=instagram_token)
            result = client.send_text_message(customer.instagram_id, reply_text)
            outbound.status = "sent"
            logger.info("Successfully sent Instagram reply to %s: %s", customer.instagram_id, result)
        except Exception as exc:  # noqa: BLE001
            outbound.status = "failed"
            logger.exception("Failed to send AI-generated Instagram reply to %s: %s", customer.instagram_id, exc)
    else:
        logger.warning("Channel %s not configured with token or credentials (org.whatsapp_phone_number_id=%s)", channel, org.whatsapp_phone_number_id)
        outbound.status = "not_configured"

    db.add(LeadActivity(
        organization_id=org.id, lead_id=lead.id, activity_type="AI_REPLY_SENT",
        description=f"AI auto-reply ({channel}): {reply_text[:200]}",
    ))
    db.commit()

    # Dispatch alert to Admin's personal WhatsApp phone
    _dispatch_admin_phone_alert(org=org, customer=customer, inbound_body=last_inbound, reply_text=reply_text)

    return outbound


def _dispatch_admin_phone_alert(*, org: Organization, customer: Customer, inbound_body: str, reply_text: str):
    """Sends a real-time WhatsApp alert to the admin's personal mobile phone."""
    admin_phone = settings.ADMIN_NOTIFICATION_PHONE
    if not admin_phone:
        return
    admin_clean = "".join(filter(str.isdigit, admin_phone))
    cust_clean = "".join(filter(str.isdigit, customer.phone or ""))
    if admin_clean == cust_clean:
        return  # Don't notify if the message is from the admin's own number

    whatsapp_token = org.whatsapp_access_token or settings.WHATSAPP_ACCESS_TOKEN
    phone_id = org.whatsapp_phone_number_id or settings.WHATSAPP_PHONE_NUMBER_ID
    if not (whatsapp_token and phone_id):
        return

    admin_msg = (
        f"🔔 *New Lead Message Alert!*\n\n"
        f"👤 *Customer:* {customer.full_name or 'New Trekker'}\n"
        f"📱 *Phone:* +{customer.phone}\n"
        f"💬 *Customer Asked:* \"{inbound_body}\"\n\n"
        f"🤖 *AI Replied:*\n\"{reply_text[:180]}...\"\n\n"
        f"👉 *Open CampFlow Dashboard:*\nhttps://hikershorizon.in/campflow/"
    )
    try:
        client = WhatsAppClient(phone_number_id=phone_id, access_token=whatsapp_token)
        client.send_text_message(admin_clean, admin_msg)
        logger.info("Dispatched WhatsApp admin alert to %s", admin_clean)
    except Exception as exc:
        logger.warning("Failed to dispatch WhatsApp admin alert to %s: %s", admin_clean, exc)
