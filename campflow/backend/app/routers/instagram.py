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

    expected_token = settings.INSTAGRAM_WEBHOOK_VERIFY_TOKEN or "campflow_webhook_verify_token"
    allowed_tokens = {
        expected_token,
        settings.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
        "campflow_webhook_verify_token",
        "campflow-webhook-token-2026",
        "campflow_webhook_verify_token_2026",
    }
    allowed_tokens = {t for t in allowed_tokens if t}

    if token not in allowed_tokens:
        # Also check if any org has this verify token or page id
        org = db.query(Organization).filter(
            (Organization.whatsapp_webhook_verify_token == token) | (Organization.instagram_page_id == token)
        ).first()
        if not org:
            logger.warning("Instagram webhook verification failed. Token received: %s, expected one of: %s", token, allowed_tokens)
            raise HTTPException(status_code=403, detail="Invalid verify token")

    logger.info("Instagram webhook successfully verified with challenge: %s", challenge)
    return PlainTextResponse(content=challenge)


def _verify_signature(app_secret: str, raw_body: bytes, signature_header: str | None) -> bool:
    if not app_secret:
        return True  # not configured locally; skip verification
    if not signature_header or not signature_header.startswith("sha256="):
        return False
    expected = hmac.new(app_secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header.split("=", 1)[1])


def _extract_ad_referral(obj: dict) -> dict:
    info = {
        "ad_id": None,
        "ad_title": None,
        "source": None,
        "ref": None,
        "media_url": None,
        "detected_trek": None,
    }
    referral = (
        obj.get("referral")
        or obj.get("message", {}).get("referral")
        or obj.get("postback", {}).get("referral")
        or {}
    )
    if referral:
        info["ad_id"] = referral.get("ad_id")
        info["source"] = referral.get("source")
        info["ref"] = referral.get("ref")
        ads_ctx = referral.get("ads_context_data") or {}
        info["ad_title"] = ads_ctx.get("ad_title") or referral.get("ad_title")
        info["media_url"] = ads_ctx.get("video_url") or ads_ctx.get("photo_url")

    # Check attachments (shares / reels / stories)
    attachments = (
        obj.get("message", {}).get("attachments")
        or obj.get("attachments")
        or []
    )
    for att in attachments:
        p = att.get("payload") or {}
        if isinstance(p, dict):
            if p.get("title") and not info["ad_title"]:
                info["ad_title"] = p.get("title")
            if p.get("url") and not info["media_url"]:
                info["media_url"] = p.get("url")

    reply_to = obj.get("message", {}).get("reply_to") or {}
    story = reply_to.get("story") or {}
    if story.get("url") and not info["media_url"]:
        info["media_url"] = story.get("url")

    from app.services.trek_catalog import detect_trek
    search_str = " ".join(filter(None, [info["ad_title"], info["ref"], info["media_url"]]))
    m = detect_trek(search_str)
    if m:
        info["detected_trek"] = m["name"]

    return info


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
            page_id = str(entry.get("id")) if entry.get("id") else None
            
            # Format 1: Messenger / Instagram standard messaging format
            for messaging in entry.get("messaging", []):
                message = messaging.get("message") or {}
                if message.get("is_echo"):
                    logger.info("Skipping echo message sent by page itself: %s", message.get("mid"))
                    continue
                sender_id = str(messaging.get("sender", {}).get("id")) if messaging.get("sender", {}).get("id") else None
                # Skip if sender is the page itself (prevent echo loops)
                if sender_id and (sender_id == page_id or (settings.INSTAGRAM_PAGE_ID and sender_id == str(settings.INSTAGRAM_PAGE_ID))):
                    logger.info("Skipping echo message where sender is page itself: %s", sender_id)
                    continue

                text = (
                    message.get("text")
                    or (message.get("quick_reply", {}).get("payload") if isinstance(message.get("quick_reply"), dict) else None)
                    or (messaging.get("postback", {}).get("title") if isinstance(messaging.get("postback"), dict) else None)
                    or (messaging.get("postback", {}).get("payload") if isinstance(messaging.get("postback"), dict) else None)
                )
                mid = message.get("mid") or (messaging.get("postback", {}).get("mid") if isinstance(messaging.get("postback"), dict) else None)
                ad_info = _extract_ad_referral(messaging)

                if sender_id and text:
                    logger.info("Processing inbound Instagram DM from sender_id: %s, text: %s, ad: %s", sender_id, text, ad_info.get("detected_trek"))
                    try:
                        _process_inbound_instagram_message(
                            db, page_id=page_id, sender_id=sender_id, text=text, mid=mid, ad_info=ad_info,
                        )
                    except Exception as exc:  # noqa: BLE001
                        logger.exception("Failed to process inbound Instagram message: %s", exc)

            # Format 2: Instagram Graph API changes format
            for change in entry.get("changes", []):
                val = change.get("value") or {}
                if change.get("field") == "messages" or "message" in val or "text" in val:
                    raw_sender = val.get("from", {}).get("id") or val.get("sender", {}).get("id") or val.get("id")
                    sender_id = str(raw_sender) if raw_sender else None
                    if sender_id and (sender_id == page_id or (settings.INSTAGRAM_PAGE_ID and sender_id == str(settings.INSTAGRAM_PAGE_ID))):
                        logger.info("Skipping echo message (changes) where sender is page itself: %s", sender_id)
                        continue

                    raw_msg = val.get("message")
                    text = (
                        val.get("text")
                        or (raw_msg if isinstance(raw_msg, str) else (raw_msg.get("text") if isinstance(raw_msg, dict) else None))
                        or (val.get("quick_reply", {}).get("payload") if isinstance(val.get("quick_reply"), dict) else None)
                        or (val.get("postback", {}).get("title") if isinstance(val.get("postback"), dict) else None)
                        or (val.get("postback", {}).get("payload") if isinstance(val.get("postback"), dict) else None)
                    )
                    mid = val.get("mid") or val.get("id")
                    ad_info = _extract_ad_referral(val)

                    if sender_id and text:
                        logger.info("Processing inbound Instagram DM (changes) from sender_id: %s, text: %s, ad: %s", sender_id, text, ad_info.get("detected_trek"))
                        try:
                            _process_inbound_instagram_message(
                                db, page_id=page_id, sender_id=sender_id, text=text, mid=mid, ad_info=ad_info,
                            )
                        except Exception as exc:  # noqa: BLE001
                            logger.exception("Failed to process inbound Instagram message (changes): %s", exc)
    finally:
        db.close()
    return {"status": "received"}


def _resolve_organization(db: Session, page_id: str | None) -> Organization | None:
    if page_id:
        org = db.query(Organization).filter(Organization.instagram_page_id == page_id).first()
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


def _process_inbound_instagram_message(
    db: Session, *, page_id: str | None, sender_id: str | None, text: str | None, mid: str | None,
    ad_info: dict | None = None,
):
    if not sender_id or not text:
        return
    org = _resolve_organization(db, page_id)
    if not org:
        return

    from app.services.trek_catalog import detect_trek
    detected_trek = None
    if ad_info and ad_info.get("detected_trek"):
        detected_trek = ad_info["detected_trek"]
    if not detected_trek:
        m = detect_trek(text)
        if m:
            detected_trek = m["name"]

    customer = db.query(Customer).filter(
        Customer.organization_id == org.id, Customer.instagram_id == sender_id
    ).first()
    if not customer:
        customer = Customer(
            organization_id=org.id, full_name=f"Instagram user {sender_id}",
            phone=f"ig:{sender_id}", instagram_id=sender_id,
        )
        if ad_info and (ad_info.get("ad_title") or detected_trek):
            customer.notes = f"Engaged via Ad: {ad_info.get('ad_title') or detected_trek}"
        db.add(customer)
        db.flush()
    else:
        if ad_info and (ad_info.get("ad_title") or detected_trek) and not customer.notes:
            customer.notes = f"Engaged via Ad: {ad_info.get('ad_title') or detected_trek}"

    lead = db.query(Lead).filter(
        Lead.organization_id == org.id, Lead.customer_id == customer.id,
        Lead.status.notin_([LeadStatus.CONFIRMED, LeadStatus.COMPLETED, LeadStatus.LOST]),
    ).order_by(Lead.created_at.desc()).first()

    if not lead:
        notes = "Auto-created from inbound Instagram message"
        if ad_info and (ad_info.get("ad_title") or ad_info.get("ad_id")):
            notes = f"Ad Referral: {ad_info.get('ad_title') or detected_trek} (Ad ID: {ad_info.get('ad_id')})"

        lead = Lead(
            organization_id=org.id, customer_id=customer.id, source=LeadSource.INSTAGRAM,
            status=LeadStatus.NEW, trek_name=detected_trek, notes=notes,
        )
        db.add(lead)
        db.flush()
        db.add(LeadActivity(
            organization_id=org.id, lead_id=lead.id, activity_type="CREATED",
            description=f"Lead auto-created from inbound Instagram DM" + (f" [Ad: {ad_info.get('ad_title') or detected_trek}]" if ad_info and (ad_info.get('ad_title') or detected_trek) else ""),
        ))
    else:
        if detected_trek and not lead.trek_name:
            lead.trek_name = detected_trek
        if ad_info and (ad_info.get("ad_title") or ad_info.get("ad_id")):
            if not lead.notes or "Ad" not in lead.notes:
                lead.notes = (lead.notes or "") + f" [Ad: {ad_info.get('ad_title') or detected_trek}]"

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
        if not customer.ai_disabled and not getattr(lead, "ai_disabled", False):
            send_ai_reply(db, org=org, customer=customer, lead=lead, channel="instagram")
        else:
            logger.info("AI auto-reply is paused for Instagram user %s - Human takeover active", customer.id)
