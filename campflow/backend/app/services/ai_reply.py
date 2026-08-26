"""AI-driven auto-reply generation for inbound WhatsApp/Instagram messages.

Uses OpenAI's chat completion API (if OPENAI_API_KEY is configured) to draft a
context-aware reply on behalf of the trekking operator, grounded in the
customer's lead/trip details. Falls back to a simple rule-based reply when no
API key is configured, so the feature still works (in a degraded form) out of
the box for local development.
"""
import httpx
from app.config import settings

SYSTEM_PROMPT_DEFAULT = (
    "You are a friendly, concise customer support assistant for a trekking and adventure-trip "
    "operator. You reply to enquiries received over WhatsApp/Instagram. Always be helpful, "
    "accurate, and encourage the customer toward booking. Keep replies under 60 words, "
    "no markdown, plain conversational text suitable for a chat message. If you don't know "
    "specific trip details, ask a clarifying question instead of making facts up. Never invite "
    "the customer to pay outside the official booking flow."
)


def build_context(*, organization_name: str, trek_name: str | None, lead_status: str | None,
                   estimated_value, num_people: int | None, customer_name: str | None,
                   recent_messages: list[dict]) -> str:
    lines = [f"Trekking operator: {organization_name}."]
    if customer_name:
        lines.append(f"Customer name: {customer_name}.")
    if trek_name:
        lines.append(f"Trek of interest: {trek_name}.")
    if num_people:
        lines.append(f"Group size: {num_people}.")
    if lead_status:
        lines.append(f"Current lead stage: {lead_status}.")
    if estimated_value:
        lines.append(f"Estimated booking value: {estimated_value}.")
    if recent_messages:
        lines.append("Recent conversation (oldest first):")
        for m in recent_messages:
            speaker = "Customer" if m["direction"] == "INBOUND" else "Operator"
            lines.append(f"{speaker}: {m['body']}")
    return "\n".join(lines)


def generate_reply(*, inbound_text: str, context: str, system_prompt: str | None = None) -> str:
    """Returns a drafted reply text. Uses OpenAI if configured, else a safe fallback."""
    if settings.OPENAI_API_KEY:
        try:
            return _generate_with_openai(inbound_text, context, system_prompt)
        except Exception:  # noqa: BLE001 - never let AI errors break message ingestion
            pass
    return _fallback_reply(inbound_text)


def _generate_with_openai(inbound_text: str, context: str, system_prompt: str | None) -> str:
    url = f"{settings.OPENAI_BASE_URL.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.OPENAI_MODEL,
        "messages": [
            {"role": "system", "content": system_prompt or SYSTEM_PROMPT_DEFAULT},
            {"role": "system", "content": f"Context:\n{context}"},
            {"role": "user", "content": inbound_text},
        ],
        "temperature": 0.5,
        "max_tokens": 150,
    }
    with httpx.Client(timeout=20) as client:
        resp = client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()


def _fallback_reply(inbound_text: str) -> str:
    """Rule-based reply used when no OpenAI key is configured, so replies still go out."""
    text = inbound_text.lower()
    if any(k in text for k in ["price", "cost", "fee", "how much"]):
        return ("Thanks for reaching out! Pricing depends on the trek and group size — "
                "our team will share exact costs shortly. Which trek are you interested in?")
    if any(k in text for k in ["date", "when", "departure", "schedule"]):
        return ("Thanks for your message! We run several departures a month — "
                "let us know your preferred dates and we'll check availability for you.")
    if any(k in text for k in ["book", "confirm", "payment", "pay"]):
        return ("Great, we'd love to help you book! Our team will follow up shortly with "
                "the booking link and payment details.")
    return ("Thanks for reaching out! A member of our team will get back to you shortly. "
            "In the meantime, let us know which trek and dates you're interested in.")
