import hashlib
import hmac
import datetime
import logging
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal
from app.config import settings
from app.models import Message, Lead, Customer, Organization, LeadActivity
from app.models.enums import MessageDirection, LeadSource, LeadStatus
from app.services.messaging_ai import send_ai_reply

router = APIRouter(prefix="/api/instagram", tags=["instagram"])
logger = logging.getLogger("campflow.instagram")


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
    if settings.INSTAGRAM_WEBHOOK_VERIFY_TOKEN and token != settings.INSTAGRAM_WEBHOOK_VERIFY_TOKEN:
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
async def receive_webhook(request: Request):
    """Receives inbound Instagram DM events from Meta and, when enabled,
    automatically drafts and sends an AI-generated reply back to the customer.
    """
    raw_body = await request.body()
    if not _verify_signature(settings.INSTAGRAM_APP_SECRET, raw_body, request.headers.get("X-Hub-Signature-256")):
        logger.warning("Invalid webhook signature received on Instagram webhook")
        raise HTTPException(status_code=403, detail="Invalid webhook signature")

    payload = await request.json()
    logger.info("Received Instagram webhook event: %s", payload)
    
    db = SessionLocal()
    try:
        for entry in payload.get("entry", []):
            page_id = entry.get("id")
            for messaging in entry.get("messaging", []):
                message = messaging.get("message") or {}
                if message.get("is_echo"):
                    logger.info("Skipping echo message sent by page itself: %s", message.get("mid"))
                    continue
                sender_id = messaging.get("sender", {}).get("id")
                text = message.get("text")
                mid = message.get("mid")
                logger.info("Processing inbound DM from sender_id: %s, text: %s", sender_id, text)
                try:
                    _process_inbound_instagram_message(
                        db, page_id=page_id, sender_id=sender_id, text=text, mid=mid,
                    )
                except Exception as exc:  # noqa: BLE001
                    logger.exception("Failed to process inbound Instagram message: %s", exc)
    finally:
        db.close()
    return {"status": "received"}


def _resolve_organization(db: Session, page_id: str | None) -> Organization | None:
    if page_id:
        org = db.query(Organization).filter(Organization.instagram_page_id == page_id).first()
        if org:
            return org
    # Fallback to the first active organization (e.g. Hikers Horizon)
    return db.query(Organization).filter(Organization.is_active == True).order_by(Organization.created_at.asc()).first()


def _process_inbound_instagram_message(
    db: Session, *, page_id: str | None, sender_id: str | None, text: str | None, mid: str | None,
):
    if not sender_id or not text:
        return
    org = _resolve_organization(db, page_id)
    if not org:
        return

    customer = db.query(Customer).filter(
        Customer.organization_id == org.id, Customer.instagram_id == sender_id
    ).first()
    if not customer:
        customer = Customer(
            organization_id=org.id, full_name=f"Instagram user {sender_id}",
            phone=f"ig:{sender_id}", instagram_id=sender_id,
        )
        db.add(customer)
        db.flush()

    lead = db.query(Lead).filter(
        Lead.organization_id == org.id, Lead.customer_id == customer.id,
        Lead.status.notin_([LeadStatus.CONFIRMED, LeadStatus.COMPLETED, LeadStatus.LOST]),
    ).order_by(Lead.created_at.desc()).first()
    if not lead:
        lead = Lead(
            organization_id=org.id, customer_id=customer.id, source=LeadSource.INSTAGRAM,
            status=LeadStatus.NEW, notes="Auto-created from inbound Instagram message",
        )
        db.add(lead)
        db.flush()
        db.add(LeadActivity(
            organization_id=org.id, lead_id=lead.id, activity_type="CREATED",
            description="Lead auto-created from inbound Instagram message",
        ))

    inbound = Message(
        organization_id=org.id, customer_id=customer.id, lead_id=lead.id,
        direction=MessageDirection.INBOUND, channel="instagram", body=text,
        whatsapp_message_id=mid, status="received",
    )
    db.add(inbound)
    lead.last_contact_at = datetime.datetime.utcnow()
    if lead.status == LeadStatus.NEW:
        lead.status = LeadStatus.CONTACTED
    db.commit()

    if org.ai_auto_reply_enabled and settings.AI_AUTO_REPLY_ENABLED:
        send_ai_reply(db, org=org, customer=customer, lead=lead, channel="instagram")
