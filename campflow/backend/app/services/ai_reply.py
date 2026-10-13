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
    "You are a real human trekking coordinator texting customers on WhatsApp / Instagram for Bengaluru Trails. "
    "You are NOT an AI assistant. Never use marketing hype, bullet lists, bold text, or long explanations. "
    "Answer only the specific question asked in 1 or 2 short sentences (under 25 words). "
    "Do NOT append forced follow-up questions like 'Which weekend?' or 'How many people?' to every reply. "
    "Sound like a real person casually texting on a phone."
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
        "temperature": 0.3,
        "max_tokens": 100,
    }
    with httpx.Client(timeout=20) as client:
        resp = client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()


def _fallback_reply(inbound_text: str) -> str:
    """Rule-based reply used when no OpenAI key is configured, so replies still go out."""
    from app.services.trek_catalog import detect_trek
    text = inbound_text.lower().strip()
    matched = detect_trek(text)
    trek_name = matched["name"] if matched else ""

    if any(k in text for k in ["hi", "hello", "hey", "hii"]):
        if trek_name:
            return f"Hey! Looking at {trek_name}?"
        return "Hey! Looking for any trek?"
    if any(k in text for k in ["inclusion", "included", "what is included"]):
        if matched:
            return f"{matched['name']} includes {matched['inclusions']}"
        return "Our packages include Bangalore travel, stay, meals, and guide. Which trek are you looking at?"
    if any(k in text for k in ["price", "cost", "fee", "how much"]):
        if matched:
            return f"{matched['name']} is {matched['price']} per person, all inclusive."
        return "Treks start at ₹3,499 per person, all inclusive. Which trek are you looking at?"
    if any(k in text for k in ["date", "when", "departure", "schedule"]):
        if trek_name:
            return f"We have {trek_name} departures every Friday night from Bangalore."
        return "Departures are every Friday night from Bangalore."
    if any(k in text for k in ["book", "confirm", "payment", "pay", "how do i book", "how to book"]):
        if trek_name:
            return f"Just share your dates and group size for {trek_name}, I'll check slots."
        return "Which trek are you looking to book?"
    return "Which trek are you looking at? We have Munnar, Kudremukh, Gokarna, Kodachadri and more."
