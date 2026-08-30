"""Conversations router — WhatsApp-style chat inbox API.

Provides endpoints to list customer conversation threads, view full message
history, send manual replies, and toggle AI auto-reply per customer.
"""
import uuid
import datetime
import logging
from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, case, and_
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_context, CurrentContext
from app.config import settings
from app.models import Message, Customer, Lead, LeadActivity
from app.models.enums import MessageDirection, LeadSource, LeadStatus
from app.services.whatsapp import WhatsAppClient
from app.services.instagram import InstagramClient

router = APIRouter(prefix="/api/conversations", tags=["conversations"])
logger = logging.getLogger("campflow.conversations")


class ManualReplyRequest(BaseModel):
    body: str
    channel: str = "whatsapp"


class AIToggleRequest(BaseModel):
    ai_enabled: bool


# ── List all conversation threads ─────────────────────────────────────

@router.get("")
def list_conversations(
    ctx: CurrentContext = Depends(get_current_context),
    db: Session = Depends(get_db),
):
    """Returns a list of customer conversation threads, ordered by most recent
    message. Each thread includes customer info, last message preview, unread
    count, and whether AI auto-reply is active for that customer.
    """
    org_id = ctx.organization.id

    # Subquery: latest message per customer
    latest_msg = (
        db.query(
            Message.customer_id,
            func.max(Message.created_at).label("last_msg_at"),
        )
        .filter(Message.organization_id == org_id)
        .group_by(Message.customer_id)
        .subquery()
    )

    customers_with_msgs = (
        db.query(Customer, latest_msg.c.last_msg_at)
        .join(latest_msg, Customer.id == latest_msg.c.customer_id)
        .filter(Customer.organization_id == org_id)
        .order_by(latest_msg.c.last_msg_at.desc())
        .limit(100)
        .all()
    )

    threads = []
    for customer, last_msg_at in customers_with_msgs:
        # Get the last message for preview
        last_message = (
            db.query(Message)
            .filter(Message.organization_id == org_id, Message.customer_id == customer.id)
            .order_by(Message.created_at.desc())
            .first()
        )

        msg_count = (
            db.query(func.count(Message.id))
            .filter(
                Message.organization_id == org_id,
                Message.customer_id == customer.id,
            )
            .scalar()
        )

        lead = (
            db.query(Lead)
            .filter(
                Lead.organization_id == org_id,
                Lead.customer_id == customer.id,
                Lead.status.notin_([LeadStatus.CONFIRMED, LeadStatus.COMPLETED, LeadStatus.LOST]),
            )
            .order_by(Lead.created_at.desc())
            .first()
        )

        channel = "instagram" if (customer.instagram_id or (last_message and last_message.channel == "instagram")) else "whatsapp"

        threads.append({
            "customer_id": str(customer.id),
            "customer_name": customer.full_name,
            "customer_phone": customer.phone,
            "last_message": last_message.body[:120] if last_message else "",
            "last_message_direction": last_message.direction.value if last_message else None,
            "last_message_at": last_msg_at.isoformat() if last_msg_at else None,
            "message_count": msg_count,
            "channel": channel,
            "lead_status": lead.status.value if lead else None,
            "trek_name": lead.trek_name if lead else None,
            "ai_auto_reply": ctx.organization.ai_auto_reply_enabled and not getattr(customer, "ai_disabled", False),
            "ai_disabled": getattr(customer, "ai_disabled", False),
        })

    return threads


# ── Get full message history for a customer ───────────────────────────

@router.get("/{customer_id}/messages")
def get_messages(
    customer_id: uuid.UUID,
    ctx: CurrentContext = Depends(get_current_context),
    db: Session = Depends(get_db),
):
    """Returns the full message history for a customer conversation."""
    customer = db.query(Customer).filter(
        Customer.id == customer_id, Customer.organization_id == ctx.organization.id
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    messages = (
        db.query(Message)
        .filter(Message.organization_id == ctx.organization.id, Message.customer_id == customer_id)
        .order_by(Message.created_at.asc())
        .limit(200)
        .all()
    )

    lead = db.query(Lead).filter(
        Lead.organization_id == ctx.organization.id, Lead.customer_id == customer_id
    ).order_by(Lead.created_at.desc()).first()

    activities = []
    if lead:
        acts = db.query(LeadActivity).filter(
            LeadActivity.lead_id == lead.id,
            LeadActivity.activity_type.in_(["BOOKING_CREATED", "ESCALATED_TO_HUMAN", "AI_REPLY_SENT", "AI_TOGGLED"]),
        ).order_by(LeadActivity.created_at.asc()).all()
        activities = [
            {
                "type": a.activity_type,
                "description": a.description,
                "created_at": a.created_at.isoformat(),
            }
            for a in acts
        ]

    return {
        "customer": {
            "id": str(customer.id),
            "name": customer.full_name,
            "phone": customer.phone,
            "email": customer.email,
            "instagram_id": customer.instagram_id,
            "ai_disabled": getattr(customer, "ai_disabled", False),
        },
        "lead": {
            "id": str(lead.id) if lead else None,
            "trek_name": lead.trek_name if lead else None,
            "status": lead.status.value if lead else None,
            "num_people": lead.num_people if lead else None,
            "ai_disabled": getattr(lead, "ai_disabled", False) if lead else False,
        } if lead else None,
        "messages": [
            {
                "id": str(m.id),
                "direction": m.direction.value,
                "body": m.body,
                "channel": m.channel,
                "status": m.status,
                "created_at": m.created_at.isoformat(),
            }
            for m in messages
        ],
        "activities": activities,
    }


# ── Toggle AI Auto-reply per Customer (Human Takeover) ────────────────

@router.post("/{customer_id}/toggle-ai")
def toggle_ai(
    customer_id: uuid.UUID,
    payload: AIToggleRequest,
    ctx: CurrentContext = Depends(get_current_context),
    db: Session = Depends(get_db),
):
    """Pauses or resumes AI auto-reply for this specific customer."""
    customer = db.query(Customer).filter(
        Customer.id == customer_id, Customer.organization_id == ctx.organization.id
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    customer.ai_disabled = not payload.ai_enabled
    lead = db.query(Lead).filter(
        Lead.organization_id == ctx.organization.id, Lead.customer_id == customer.id
    ).order_by(Lead.created_at.desc()).first()
    if lead:
        lead.ai_disabled = not payload.ai_enabled
        db.add(LeadActivity(
            organization_id=ctx.organization.id,
            lead_id=lead.id,
            activity_type="AI_TOGGLED",
            description=f"AI auto-reply {'resumed' if payload.ai_enabled else 'paused (Human Takeover active)'}",
        ))
    db.commit()
    return {
        "customer_id": str(customer.id),
        "ai_enabled": not customer.ai_disabled,
        "status": "active" if payload.ai_enabled else "paused",
    }


# ── Send a manual reply ──────────────────────────────────────────────

@router.post("/{customer_id}/send")
def send_manual_reply(
    customer_id: uuid.UUID,
    payload: ManualReplyRequest,
    ctx: CurrentContext = Depends(get_current_context),
    db: Session = Depends(get_db),
):
    """Sends a manual reply from staff to a customer via WhatsApp or Instagram."""
    customer = db.query(Customer).filter(
        Customer.id == customer_id, Customer.organization_id == ctx.organization.id
    ).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    lead = db.query(Lead).filter(
        Lead.organization_id == ctx.organization.id, Lead.customer_id == customer_id
    ).order_by(Lead.created_at.desc()).first()

    channel = payload.channel
    if customer.instagram_id and channel != "whatsapp":
        channel = "instagram"

    outbound = Message(
        organization_id=ctx.organization.id,
        customer_id=customer.id,
        lead_id=lead.id if lead else None,
        direction=MessageDirection.OUTBOUND,
        channel=channel,
        body=payload.body,
        status="queued",
    )
    db.add(outbound)

    if channel == "whatsapp":
        org = ctx.organization
        token = org.whatsapp_access_token or settings.WHATSAPP_ACCESS_TOKEN
        phone_id = org.whatsapp_phone_number_id or settings.WHATSAPP_PHONE_NUMBER_ID
        if token and phone_id and customer.phone:
            try:
                client = WhatsAppClient(phone_number_id=phone_id, access_token=token)
                result = client.send_text_message(customer.phone, payload.body)
                outbound.whatsapp_message_id = result.get("messages", [{}])[0].get("id")
                outbound.status = "sent"
            except Exception as e:  # noqa: BLE001
                outbound.status = "failed"
                logger.exception("Manual WhatsApp send failed")
                db.commit()
                raise HTTPException(status_code=502, detail=f"WhatsApp send failed: {e}")
        else:
            outbound.status = "not_configured"

    elif channel == "instagram":
        org = ctx.organization
        token = org.instagram_access_token or settings.INSTAGRAM_ACCESS_TOKEN
        page_id = org.instagram_page_id or settings.INSTAGRAM_PAGE_ID
        recipient_id = customer.instagram_id or customer.phone.replace("ig:", "")
        if token and recipient_id:
            try:
                client = InstagramClient(access_token=token, page_id=page_id)
                result = client.send_text_message(recipient_id, payload.body)
                outbound.whatsapp_message_id = result.get("message_id") or result.get("id")
                outbound.status = "sent"
            except Exception as e:  # noqa: BLE001
                outbound.status = "failed"
                logger.exception("Manual Instagram send failed")
                db.commit()
                raise HTTPException(status_code=502, detail=f"Instagram send failed: {e}")
        else:
            outbound.status = "not_configured"

    db.commit()
    db.refresh(outbound)
    return {
        "id": str(outbound.id),
        "status": outbound.status,
        "body": outbound.body,
        "created_at": outbound.created_at.isoformat(),
    }
