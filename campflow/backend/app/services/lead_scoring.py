from datetime import datetime, timedelta
from app.models.enums import LeadStatus, LeadScore
from app.models.crm import Lead


def compute_lead_score(lead: Lead) -> tuple[LeadScore, int, str]:
    """Simple rule-based lead scoring (not the core product, just a helpful signal).

    HOT: asked for payment link / availability / booking confirmation, responded recently
    WARM: interested, asked price / itinerary
    COLD: no response, generic enquiry, old lead
    """
    score = 0
    reasons = []

    if lead.status in (LeadStatus.PAYMENT_PENDING, LeadStatus.CONFIRMED):
        score += 50
        reasons.append("Close to booking (payment pending/confirmed)")
    elif lead.status == LeadStatus.INTERESTED:
        score += 30
        reasons.append("Marked as interested")
    elif lead.status == LeadStatus.CONTACTED:
        score += 15
        reasons.append("Already contacted")

    if lead.last_contact_at and lead.last_contact_at >= datetime.utcnow() - timedelta(days=2):
        score += 25
        reasons.append("Responded recently")
    elif lead.last_contact_at and lead.last_contact_at < datetime.utcnow() - timedelta(days=14):
        score -= 20
        reasons.append("No recent response")

    if lead.created_at < datetime.utcnow() - timedelta(days=30) and lead.status in (LeadStatus.NEW, LeadStatus.CONTACTED):
        score -= 15
        reasons.append("Old lead with little progress")

    if lead.estimated_value and lead.estimated_value > 0:
        score += 10
        reasons.append("Has an estimated booking value")

    score = max(0, min(100, score))

    if score >= 65:
        band = LeadScore.HOT
    elif score >= 35:
        band = LeadScore.WARM
    else:
        band = LeadScore.COLD

    reason_text = "; ".join(reasons) if reasons else "Generic enquiry, insufficient signal"
    return band, score, reason_text
