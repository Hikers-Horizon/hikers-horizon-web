"""Automated 2-Week Follow-Up Engine for Bengaluru Trails / Hikers Horizon.

Monitors customer conversations on Instagram DM and WhatsApp.
If a customer messaged but went silent without booking, this engine executes a
courteous, personalized 5-stage follow-up sequence spread over 14 days (2 weeks).

Automated rules:
1. Only follows up if customer hasn't replied to the last agent message.
2. If customer replies at ANY point, sequence pauses immediately (AI sales agent takes over).
3. If customer books (Lead confirmed or booking created), follow-ups stop completely.
4. Human takeover (ai_disabled=True) prevents all automated follow-ups.
5. Max 5 follow-up touches across 14 days, concluding with a polite sign-off.
"""
from __future__ import annotations
import datetime
import logging
from typing import List, Tuple
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Customer, Lead, Message, Organization, LeadActivity, FollowUp, Booking
from app.models.enums import MessageDirection, LeadStatus, FollowUpStatus, BookingStatus
from app.services.whatsapp import WhatsAppClient
from app.services.instagram import InstagramClient
from app.services.trek_catalog import get_trek_by_name

logger = logging.getLogger("campflow.follow_up_engine")

# Follow-up touchpoints across 14 days (2 weeks):
# (stage_num, min_hours_since_last_contact, min_days_from_start)
FOLLOW_UP_SCHEDULE: List[Tuple[int, int]] = [
    (1, 24),   # Day 1:  24 hours after last agent message
    (2, 72),   # Day 3:  72 hours (3 days)
    (3, 168),  # Day 7:  168 hours (1 week)
    (4, 240),  # Day 10: 240 hours (10 days)
    (5, 336),  # Day 14: 336 hours (2 weeks / final polite sign-off)
]


def _get_customer_first_name(customer: Customer) -> str:
    """Extract a friendly first name, falling back to empty string."""
    name = (customer.full_name or "").strip()
    if not name or "instagram user" in name.lower() or name.lower().startswith("ig:"):
        return ""
    first = name.split()[0].title()
    return f" {first}" if first else ""


def _generate_follow_up_copy(stage: int, customer: Customer, lead: Lead) -> str:
    """Generates natural, human-sounding follow-up messages tailored to the customer and trek."""
    name_str = _get_customer_first_name(customer)
    trek_name = lead.trek_name or ""
    trek_info = get_trek_by_name(trek_name)
    display_trek = trek_info["name"] if trek_info else trek_name

    if stage == 1:
        # Day 1: Friendly check-in
        if display_trek:
            return (
                f"Hey{name_str}! Just following up to see if you had any questions about the {display_trek} trip "
                f"or upcoming weekend departures? Let me know, happy to help!"
            )
        return (
            f"Hey{name_str}! Just following up to see if you're still looking for a weekend trek from Bangalore? "
            f"Happy to answer any questions or share options!"
        )

    elif stage == 2:
        # Day 3: Slots / group availability update
        if display_trek:
            return (
                f"Hey{name_str}! Slots for our upcoming weekend batches for {display_trek} are filling up. "
                f"Would you like us to hold slots for you and your group before the batch closes?"
            )
        return (
            f"Hey{name_str}! Slots for our upcoming weekend batches from Bangalore are filling up quickly. "
            f"Let us know if you'd like us to check availability for any weekend getaway!"
        )

    elif stage == 3:
        # Day 7 (1 Week): Mid-sequence check-in
        if display_trek:
            return (
                f"Hey{name_str}, hope you're having a good week! Are you still planning to do {display_trek} soon? "
                f"We run departures every Friday night from Bangalore."
            )
        return (
            f"Hey{name_str}, hope you're having a great week! Just checking in to see if you have a weekend trip "
            f"on your radar for this or next Friday?"
        )

    elif stage == 4:
        # Day 10: Weather & Itinerary update
        if display_trek:
            return (
                f"Hey{name_str}! Quick update — weather and trail views for {display_trek} have been fantastic lately. "
                f"Let me know if you'd like me to send over the day-by-day plan or recent photos!"
            )
        return (
            f"Hey{name_str}! Weather has been perfect for weekend trekking lately. "
            f"Let us know if you'd like any trek itineraries or recommendations!"
        )

    elif stage == 5:
        # Day 14 (2 Weeks): Final courteous sign-off
        return (
            f"Hey{name_str}! Closing the loop for now so we don't spam your inbox. "
            f"Whenever you're ready to plan a trek, feel free to text us here anytime. "
            f"Have a great week ahead! 🌿"
        )

    return f"Hey{name_str}! Let us know if you need any assistance planning your upcoming trek."


def process_automated_follow_ups(db: Session) -> dict:
    """Scans all eligible leads that have gone silent without booking and dispatches

    the appropriate 2-week follow-up message.
    """
    now = datetime.datetime.utcnow()
    results = {
        "scanned_leads": 0,
        "sent_follow_ups": 0,
        "completed_leads": 0,
        "skipped": 0,
    }

    # 1. Fetch active organizations
    orgs = db.query(Organization).filter(Organization.is_active == True).all()

    for org in orgs:
        # Respect org-level AI toggle
        if hasattr(org, "ai_auto_reply_enabled") and not org.ai_auto_reply_enabled:
            continue

        # 2. Query open leads that have not booked and not lost
        leads = (
            db.query(Lead)
            .filter(
                Lead.organization_id == org.id,
                Lead.status.notin_([
                    LeadStatus.CONFIRMED,
                    LeadStatus.COMPLETED,
                    LeadStatus.LOST,
                ]),
            )
            .all()
        )

        for lead in leads:
            results["scanned_leads"] += 1

            # Check if lead or customer has human takeover active
            if getattr(lead, "ai_disabled", False):
                results["skipped"] += 1
                continue

            customer = db.query(Customer).filter(Customer.id == lead.customer_id).first()
            if not customer or getattr(customer, "ai_disabled", False):
                results["skipped"] += 1
                continue

            # Verify customer hasn't already confirmed a booking
            has_booking = db.query(Booking).filter(
                Booking.customer_id == customer.id,
                Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING]),
            ).first()
            if has_booking and has_booking.status == BookingStatus.CONFIRMED:
                results["skipped"] += 1
                continue

            # Fetch all messages for this customer
            channel = "instagram" if (customer.instagram_id or customer.phone.startswith("ig:")) else "whatsapp"
            messages = (
                db.query(Message)
                .filter(
                    Message.organization_id == org.id,
                    Message.customer_id == customer.id,
                )
                .order_by(Message.created_at.asc())
                .all()
            )

            if not messages:
                results["skipped"] += 1
                continue

            # The customer must NOT be waiting for a reply:
            # If the last message is INBOUND, the customer recently messaged us! Do NOT send automated follow-up.
            last_msg = messages[-1]
            if last_msg.direction == MessageDirection.INBOUND:
                results["skipped"] += 1
                continue

            # Count how many AI follow-ups have already been sent for this lead
            follow_up_activities = [
                act for act in lead.activities
                if act.activity_type == "AI_FOLLOW_UP_SENT"
            ]
            stages_sent = len(follow_up_activities)

            # Check if 14-day 5-stage follow-up sequence is already completed
            if stages_sent >= 5:
                # Mark lead as lost / finished follow-up cycle
                if lead.status != LeadStatus.LOST:
                    lead.status = LeadStatus.LOST
                    lead.notes = (lead.notes or "") + "\n[2-week follow-up cycle completed without booking]"
                    db.commit()
                results["completed_leads"] += 1
                continue

            # Next stage to send:
            next_stage = stages_sent + 1
            min_hours_required = 24
            for s_num, s_hours in FOLLOW_UP_SCHEDULE:
                if s_num == next_stage:
                    min_hours_required = s_hours
                    break

            # Time since last contact
            last_contact = lead.last_contact_at or last_msg.created_at or lead.created_at
            if not last_contact:
                continue

            hours_elapsed = (now - last_contact).total_seconds() / 3600.0

            # Only send if required silence duration has passed
            if hours_elapsed < min_hours_required:
                results["skipped"] += 1
                continue

            # Generate the follow-up text for this stage
            followup_text = _generate_follow_up_copy(next_stage, customer, lead)

            # Dispatch message
            dispatch_success = _dispatch_follow_up_message(
                org=org,
                customer=customer,
                channel=channel,
                text=followup_text,
            )

            if dispatch_success:
                outbound = Message(
                    organization_id=org.id,
                    customer_id=customer.id,
                    lead_id=lead.id,
                    direction=MessageDirection.OUTBOUND,
                    channel=channel,
                    body=followup_text,
                    status="sent",
                )
                db.add(outbound)

                db.add(LeadActivity(
                    organization_id=org.id,
                    lead_id=lead.id,
                    activity_type="AI_FOLLOW_UP_SENT",
                    description=f"Auto follow-up stage {next_stage} sent via {channel}: {followup_text[:120]}",
                ))

                db.add(FollowUp(
                    organization_id=org.id,
                    lead_id=lead.id,
                    due_at=now,
                    status=FollowUpStatus.DONE,
                    reason=f"Auto follow-up stage {next_stage} (2-week sequence)",
                    outcome_notes=f"Dispatched via {channel}",
                ))

                lead.last_contact_at = now
                if lead.status in [LeadStatus.NEW, LeadStatus.CONTACTED]:
                    lead.status = LeadStatus.FOLLOW_UP

                db.commit()
                results["sent_follow_ups"] += 1
                logger.info(
                    "Sent 2-week follow-up stage %d to customer %s via %s",
                    next_stage, customer.full_name, channel
                )
            else:
                # Dispatch failed (e.g. Meta 24-hour window closed or user ID unavailable)
                lead.last_contact_at = now
                db.add(LeadActivity(
                    organization_id=org.id,
                    lead_id=lead.id,
                    activity_type="AI_FOLLOW_UP_SKIPPED",
                    description=f"Auto follow-up stage {next_stage} skipped ({channel} window closed or user unavailable)",
                ))
                db.commit()
                results["skipped"] += 1

    return results


def _dispatch_follow_up_message(
    *, org: Organization, customer: Customer, channel: str, text: str
) -> bool:
    """Dispatches the follow-up text to Instagram or WhatsApp."""
    whatsapp_token = org.whatsapp_access_token or settings.WHATSAPP_ACCESS_TOKEN
    instagram_token = org.instagram_access_token or settings.INSTAGRAM_ACCESS_TOKEN

    if channel == "instagram" and customer.instagram_id and instagram_token:
        page_id = org.instagram_page_id or settings.INSTAGRAM_PAGE_ID
        try:
            client = InstagramClient(page_id=page_id, access_token=instagram_token)
            client.send_text_message(customer.instagram_id, text)
            return True
        except Exception as exc:
            err_str = str(exc)
            if "outside of allowed window" in err_str or "2534022" in err_str:
                logger.info("Instagram 24h window closed for customer %s. Cannot send freeform follow-up.", customer.id)
                return False
            if "cannot be found" in err_str or "2534014" in err_str:
                logger.info("Instagram customer %s not found.", customer.id)
                return False

            logger.info("Org Instagram token did not deliver follow-up (%s), trying fallback", exc)
            if settings.INSTAGRAM_ACCESS_TOKEN and instagram_token != settings.INSTAGRAM_ACCESS_TOKEN:
                try:
                    fallback_client = InstagramClient(page_id=settings.INSTAGRAM_PAGE_ID, access_token=settings.INSTAGRAM_ACCESS_TOKEN)
                    fallback_client.send_text_message(customer.instagram_id, text)
                    return True
                except Exception as fb_exc:
                    fb_err = str(fb_exc)
                    if "outside of allowed window" in fb_err or "2534022" in fb_err:
                        logger.info("Instagram 24h window closed for customer %s on fallback.", customer.id)
                    elif "cannot be found" in fb_err or "2534014" in fb_err:
                        logger.info("Instagram customer %s not found on fallback.", customer.id)
                    else:
                        logger.warning("Fallback Instagram token failed for follow-up: %s", fb_exc)
            return False

    elif channel == "whatsapp" and customer.phone and whatsapp_token:
        try:
            phone_id = org.whatsapp_phone_number_id or settings.WHATSAPP_PHONE_NUMBER_ID
            client = WhatsAppClient(phone_number_id=phone_id, access_token=whatsapp_token)
            client.send_text_message(customer.phone, text)
            return True
        except Exception as exc:
            logger.warning("Failed to dispatch WhatsApp follow-up for %s: %s", customer.phone, exc)
            return False

    return False
