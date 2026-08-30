import uuid
import datetime
import hashlib
import hmac
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_context, CurrentContext
from app.config import settings
from app.models import Message, MessageTemplate, Lead, Customer, Organization, LeadActivity
from app.models.enums import MessageDirection, LeadSource, LeadStatus
from app.services.whatsapp import WhatsAppClient, render_template
from app.services.messaging_ai import send_ai_reply

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])
logger = logging.getLogger("campflow.whatsapp")


@router.get("/templates")
def list_templates(ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    return db.query(MessageTemplate).filter(MessageTemplate.organization_id == ctx.organization.id).all()


@router.post("/send/{lead_id}")
def send_message(
    lead_id: uuid.UUID,
    template_id: uuid.UUID,
    variables: dict,
    ctx: CurrentContext = Depends(get_current_context),
    db: Session = Depends(get_db),
):
    lead = db.query(Lead).filter(Lead.organization_id == ctx.organization.id, Lead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    template = db.query(MessageTemplate).filter(
        MessageTemplate.organization_id == ctx.organization.id, MessageTemplate.id == template_id
    ).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    customer = db.query(Customer).filter(Customer.id == lead.customer_id).first()
    body = render_template(template.body, variables)

    message = Message(
        organization_id=ctx.organization.id, customer_id=lead.customer_id, lead_id=lead.id,
        template_id=template.id, direction=MessageDirection.OUTBOUND, body=body, status="queued",
    )
    db.add(message)

    whatsapp_token = ctx.organization.whatsapp_access_token or settings.WHATSAPP_ACCESS_TOKEN
    if whatsapp_token and customer:
        try:
            client = WhatsAppClient(phone_number_id=ctx.organization.whatsapp_phone_number_id, access_token=whatsapp_token)
            result = client.send_text_message(customer.phone, body)
            message.whatsapp_message_id = result.get("messages", [{}])[0].get("id")
            message.status = "sent"
        except Exception as e:  # noqa: BLE001
            message.status = "failed"
            db.commit()
            raise HTTPException(status_code=502, detail=f"WhatsApp send failed: {e}")
    else:
        message.status = "not_configured"

    db.commit()
    db.refresh(message)
    return {"message_id": message.id, "status": message.status, "body": body}


from fastapi.responses import PlainTextResponse

@router.get("/webhook")
def verify_webhook(request: Request, db: Session = Depends(get_db)):
    """Meta webhook verification handshake (hub.challenge)."""
    params = request.query_params
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")
    if not token or not challenge:
        raise HTTPException(status_code=400, detail="Missing parameters")

    # If configured in .env, verify match
    if settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN and token != settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN:
        # Also check if any org has this verify token
        org = db.query(Organization).filter(Organization.whatsapp_webhook_verify_token == token).first()
        if not org:
            raise HTTPException(status_code=403, detail="Invalid verify token")

    return PlainTextResponse(content=challenge)


def _verify_signature(app_secret: str, raw_body: bytes, signature_header: str | None) -> bool:
    if not app_secret:
        return True  # not configured locally; skip verification
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(app_secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header.split("=", 1)[1])


@router.post("/webhook")
async def receive_webhook(request: Request, db: Session = Depends(get_db)):
    """Receives inbound WhatsApp messages/status updates from Meta and, when enabled,
    automatically drafts and sends an AI-generated reply back to the customer.
    """
    raw_body = await request.body()
    if not _verify_signature(settings.WHATSAPP_APP_SECRET, raw_body, request.headers.get("X-Hub-Signature-256")):
        logger.warning("Invalid webhook signature on WhatsApp webhook")
        raise HTTPException(status_code=403, detail="Invalid webhook signature")

    payload = await request.json()
    logger.info("Received WhatsApp webhook event: %s", payload)

    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            phone_number_id = value.get("metadata", {}).get("phone_number_id")
            contacts = {c.get("wa_id"): c.get("profile", {}).get("name") for c in value.get("contacts", [])}
            for msg in value.get("messages", []):
                if msg.get("type") != "text":
                    continue
                from_phone = msg.get("from")
                body = msg.get("text", {}).get("body", "")
                whatsapp_message_id = msg.get("id")
                logger.info("Processing inbound WhatsApp msg from %s (name: %s): %s", from_phone, contacts.get(from_phone), body)
                try:
                    _process_inbound_whatsapp_message(
                        db, phone_number_id=phone_number_id, from_phone=from_phone,
                        body=body, whatsapp_message_id=whatsapp_message_id,
                        contact_name=contacts.get(from_phone),
                    )
                except Exception as exc:  # noqa: BLE001
                    logger.exception("Failed to process inbound WhatsApp message: %s", exc)
    return {"status": "received"}


def _resolve_organization(db: Session, phone_number_id: str | None) -> Organization | None:
    if phone_number_id:
        org = db.query(Organization).filter(Organization.whatsapp_phone_number_id == phone_number_id).first()
        if org:
            return org
    # Prioritize Hikers Horizon or the real active non-demo organization
    org = db.query(Organization).filter(
        Organization.is_active == True,
        ~Organization.slug.contains("demo"),
        ~Organization.name.contains("[DEMO]"),
    ).first()
    if org:
        return org
    return db.query(Organization).filter(Organization.is_active == True).first()


def _process_inbound_whatsapp_message(
    db: Session, *, phone_number_id: str | None, from_phone: str, body: str,
    whatsapp_message_id: str | None, contact_name: str | None,
):
    if not from_phone or not body:
        return
    org = _resolve_organization(db, phone_number_id)
    if not org:
        return

    customer = db.query(Customer).filter(
        Customer.organization_id == org.id, Customer.phone == from_phone
    ).first()
    if not customer:
        customer = Customer(organization_id=org.id, full_name=contact_name or from_phone, phone=from_phone)
        db.add(customer)
        db.flush()

    lead = db.query(Lead).filter(
        Lead.organization_id == org.id, Lead.customer_id == customer.id,
        Lead.status.notin_([LeadStatus.CONFIRMED, LeadStatus.COMPLETED, LeadStatus.LOST]),
    ).order_by(Lead.created_at.desc()).first()
    if not lead:
        lead = Lead(
            organization_id=org.id, customer_id=customer.id, source=LeadSource.WHATSAPP,
            status=LeadStatus.NEW, notes="Auto-created from inbound WhatsApp message",
        )
        db.add(lead)
        db.flush()
        db.add(LeadActivity(
            organization_id=org.id, lead_id=lead.id, activity_type="CREATED",
            description="Lead auto-created from inbound WhatsApp message",
        ))

    inbound = Message(
        organization_id=org.id, customer_id=customer.id, lead_id=lead.id,
        direction=MessageDirection.INBOUND, channel="whatsapp", body=body,
        whatsapp_message_id=whatsapp_message_id, status="received",
    )
    db.add(inbound)
    lead.last_contact_at = datetime.datetime.utcnow()
    if lead.status == LeadStatus.NEW:
        lead.status = LeadStatus.CONTACTED
    db.commit()

    if org.ai_auto_reply_enabled and settings.AI_AUTO_REPLY_ENABLED:
        if not customer.ai_disabled and not getattr(lead, "ai_disabled", False):
            send_ai_reply(db, org=org, customer=customer, lead=lead, channel="whatsapp")
        else:
            logger.info("AI auto-reply is paused for customer %s (%s) - Human takeover active", customer.id, customer.full_name)
