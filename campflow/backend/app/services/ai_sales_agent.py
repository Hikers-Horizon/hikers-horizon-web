"""AI Sales Agent — conversational booking engine for WhatsApp/Instagram.

Uses OpenAI-compatible function-calling (tool_choice=auto) so the LLM can
autonomously search treks, check availability, create bookings, and send
payment links during a natural conversation with a customer.

Falls back to the simpler rule-based reply when no OpenAI key is configured.
"""
import datetime
import json
import logging
from decimal import Decimal

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from app.models import (
    Booking, BookingParticipant, Customer, Lead, LeadActivity,
    Trip, TripDeparture, Organization,
)
from app.models.enums import BookingStatus, LeadStatus, PaymentStatus, TripStatus

logger = logging.getLogger("campflow.ai_sales_agent")

# ---------------------------------------------------------------------------
# Tool definitions (sent to OpenAI as `tools` in the chat completion request)
# ---------------------------------------------------------------------------

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "search_treks",
            "description": "Search available treks/trips by keyword. Returns trek name, price, description, and upcoming departure dates with availability.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search keyword (trek name, location, etc.). Leave empty to list all treks."},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_availability",
            "description": "Check seat availability for a specific trek departure date.",
            "parameters": {
                "type": "object",
                "properties": {
                    "trek_name": {"type": "string", "description": "Name of the trek"},
                    "departure_date": {"type": "string", "description": "Departure date in YYYY-MM-DD format"},
                },
                "required": ["trek_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_booking",
            "description": "Create a confirmed booking after collecting all details from the customer. Call this only when customer explicitly confirms.",
            "parameters": {
                "type": "object",
                "properties": {
                    "trek_name": {"type": "string", "description": "Name of the trek"},
                    "departure_date": {"type": "string", "description": "Departure date in YYYY-MM-DD format"},
                    "num_people": {"type": "integer", "description": "Number of participants"},
                    "participant_names": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of participant full names",
                    },
                },
                "required": ["trek_name", "departure_date", "num_people", "participant_names"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_customer_status",
            "description": "Check if the current customer has any existing bookings or leads.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "escalate_to_human",
            "description": "Flag this conversation for manual staff follow-up when the customer requests to speak to a person or the query is too complex for AI.",
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {"type": "string", "description": "Why the conversation needs human attention"},
                },
                "required": ["reason"],
            },
        },
    },
]

from app.services.trek_catalog import (
    TREK_CATALOG, detect_trek, get_trek_by_name, get_trek_url,
    get_trek_inclusions, get_trek_price,
)

# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------

SALES_AGENT_SYSTEM_PROMPT = """\
You are a real human trekking coordinator texting customers on WhatsApp / Instagram for Bengaluru Trails. You are NOT an AI assistant.

CRITICAL RULES — SOUND EXACTLY LIKE A REAL PERSON TEXTING ON A PHONE:

1. ZERO OVERACTION: Never say "Awesome!", "Exciting!", "That's wonderful!", "Absolutely!", "Welcome to Bengaluru Trails!", "Pack your bags!", "Magical journey", "Great choice!", "Perfect!", "I'd love to help!", "Delighted to assist", or any similar bot-like hype. These phrases instantly reveal you are a bot.

2. ANSWER AND STOP — NO FORCED FOLLOW-UP QUESTIONS: When answering a question (price, food, difficulty, inclusions), answer ONLY that question and STOP. Do NOT tack on "Which weekend are you looking for?", "How many people are joining?", "Are you looking to travel this weekend or next?" to every single reply. A real human doesn't push a follow-up question after every answer. Only ask a follow-up when it naturally fits (e.g., customer says "I want to book" → then ask dates/group size).

3. KEEP IT SHORT: 1–2 short sentences, under 25 words. Text casually like a real person typing on a phone. No bullet points, no bold/markdown, no walls of text. Use lowercase naturally (don't over-capitalize).

4. SIMPLE TREK NAMES: Say "Munnar", "Kudremukh", "Gokarna" — never "Munnar Backpacking Trip Package" or formal full names.

5. EMOJIS: At most 0–1 simple emoji per message. Never multiple emojis.

6. GREETINGS: If user says "hi"/"hello"/"hey" → reply casually: "Hey! Looking for any trek?" or "Hey! How can I help?" Never say "How can I help you today?" — that sounds scripted.

7. VERIFY TREK FIRST:
   - If customer messages from an ad and trek is detected: give a brief 1-line answer about that trek.
   - If trek is unknown: "Which trek are you looking at?"

8. NO LINKS IN FIRST 3-4 MESSAGES:
   - In early messages (inbound_count < 4), NEVER send any links or URLs.
   - If customer asks "how do I book?": "Just tell me your dates and group size, I'll check slots for you."
   - If customer asks what's included: state inclusions directly. No link.

9. LINKS ONLY AFTER 3-4 MESSAGES:
   - After 3-4 messages, when customer confirms dates/group or asks for the booking link, share the EXACT trek page:
     * Munnar: https://bengalurutrails.in/Backpacking/Munnar/
     * Kudremukha: https://bengalurutrails.in/Twodays/Kuduremukha/
     * Gokarna: https://bengalurutrails.in/Twodays/Gokarna/
     * Kodachadri: https://bengalurutrails.in/Twodays/Kodachadri/
     * Kumara Parvatha: https://bengalurutrails.in/Twodays/Kumaraparvatha/
     * Netravathi: https://bengalurutrails.in/Twodays/Netravathi/
     * Tadiandamol: https://bengalurutrails.in/Twodays/Tadiandamol/
     * Wayanad: https://bengalurutrails.in/Backpacking/Wayanad/
     * Chikmagalur: https://bengalurutrails.in/Backpacking/Chikmagaluru/
     * Coorg: https://bengalurutrails.in/Backpacking/Coorg2days/
     * Kodaikanal: https://bengalurutrails.in/Backpacking/Kodaikanal/
     * Hampi: https://bengalurutrails.in/Backpacking/Hampi/
     * Skandagiri: https://bengalurutrails.in/Sunrise/Skandagiri-sunrise-trek-from-bangalore/
     * Anthargange: https://bengalurutrails.in/Sunrise/Anthargange-trek/
     * Uttaribetta: https://bengalurutrails.in/Sunrise/Uttaribetta-sunrise-trek/
     * Kuntibetta: https://bengalurutrails.in/Sunrise/Kuntibetta-sunrise-trek/
     * Makalidurga: https://bengalurutrails.in/Sunrise/Makalidurga-sunrise-trek/

10. ADVANCE PERMITS: Kudremukh and Netravathi need 20 days advance booking for forest permits.
11. NEVER invent phone numbers or UPI IDs. Direct to bengalurutrails.in only.

EXAMPLES OF GOOD vs BAD REPLIES:
- Customer: "What's the price for Kudremukh?"
  BAD: "Kudremukha Peak Trek is ₹3,499 per person, which includes Bangalore travel, stay, meals, and guide. Which weekend are you planning for? 🏔️"
  GOOD: "Kudremukh is ₹3,499 per person, all inclusive."

- Customer: "Is food included?"
  BAD: "Yes, food is included! You'll get 2 breakfasts, lunch, and dinner. How many people are joining? 😊"
  GOOD: "Yep, meals are included — breakfast, lunch, and dinner."

- Customer: "hi"
  BAD: "Hey! Welcome to Bengaluru Trails! How can I help you today? 🏔️🥾"
  GOOD: "Hey! Looking for any trek?"

CURRENT DATE: {today}
CUSTOMER INBOUND MESSAGE COUNT: {inbound_count}
CURRENT TREK IDENTIFIED: {current_trek}
"""



def build_sales_system_prompt(org: Organization, inbound_count: int = 1, current_trek: str = "") -> str:
    return SALES_AGENT_SYSTEM_PROMPT.format(
        today=datetime.date.today().isoformat(),
        inbound_count=inbound_count,
        current_trek=current_trek or "Not yet specified",
    )


# ---------------------------------------------------------------------------
# Tool execution
# ---------------------------------------------------------------------------

def _exec_search_treks(db: Session, org: Organization, args: dict) -> str:
    query = args.get("query", "").strip().lower()
    trips_q = db.query(Trip).filter(Trip.organization_id == org.id)
    if query:
        trips_q = trips_q.filter(Trip.name.ilike(f"%{query}%"))
    trips = trips_q.limit(10).all()
    if not trips:
        return json.dumps({"treks": [], "message": "No treks found matching your search."})

    results = []
    for trip in trips:
        departures = (
            db.query(TripDeparture)
            .filter(
                TripDeparture.trip_id == trip.id,
                TripDeparture.organization_id == org.id,
                TripDeparture.status.in_([TripStatus.OPEN, TripStatus.DRAFT]),
                TripDeparture.departure_date >= datetime.date.today(),
            )
            .order_by(TripDeparture.departure_date.asc())
            .limit(5)
            .all()
        )
        dep_list = []
        for d in departures:
            dep_list.append({
                "date": d.departure_date.isoformat(),
                "return_date": d.return_date.isoformat() if d.return_date else None,
                "available_seats": d.available_seats,
                "price": str(d.price_override or trip.price),
            })
        results.append({
            "name": trip.name,
            "description": trip.description or "",
            "price_per_person": str(trip.price),
            "pickup_location": trip.pickup_location or "",
            "upcoming_departures": dep_list,
        })
    return json.dumps({"treks": results})


def _exec_check_availability(db: Session, org: Organization, args: dict) -> str:
    trek_name = args.get("trek_name", "").strip()
    date_str = args.get("departure_date", "")

    trip = db.query(Trip).filter(
        Trip.organization_id == org.id, Trip.name.ilike(f"%{trek_name}%")
    ).first()
    if not trip:
        return json.dumps({"available": False, "error": f"Trek '{trek_name}' not found."})

    deps_q = db.query(TripDeparture).filter(
        TripDeparture.trip_id == trip.id,
        TripDeparture.organization_id == org.id,
        TripDeparture.departure_date >= datetime.date.today(),
    )
    if date_str:
        try:
            target = datetime.date.fromisoformat(date_str)
            deps_q = deps_q.filter(TripDeparture.departure_date == target)
        except ValueError:
            pass

    departures = deps_q.order_by(TripDeparture.departure_date.asc()).limit(5).all()
    if not departures:
        return json.dumps({"available": False, "error": "No upcoming departures found for this trek."})

    results = []
    for d in departures:
        results.append({
            "date": d.departure_date.isoformat(),
            "available_seats": d.available_seats,
            "price": str(d.price_override or trip.price),
            "status": d.status.value,
        })
    return json.dumps({"available": True, "trek_name": trip.name, "departures": results})


def _generate_booking_code(db: Session, org_id) -> str:
    year = datetime.datetime.utcnow().year
    count = db.query(Booking).filter(Booking.organization_id == org_id).count() + 1
    return f"TH-{year}-{count:05d}"


def _exec_create_booking(
    db: Session, org: Organization, customer: Customer, lead: Lead, args: dict
) -> str:
    trek_name = args.get("trek_name", "").strip()
    date_str = args.get("departure_date", "")
    num_people = args.get("num_people", 1)
    participant_names = args.get("participant_names", [])

    trip = db.query(Trip).filter(
        Trip.organization_id == org.id, Trip.name.ilike(f"%{trek_name}%")
    ).first()
    if not trip:
        return json.dumps({"success": False, "error": f"Trek '{trek_name}' not found."})

    try:
        target = datetime.date.fromisoformat(date_str)
    except ValueError:
        return json.dumps({"success": False, "error": "Invalid departure date format."})

    departure = db.query(TripDeparture).filter(
        TripDeparture.trip_id == trip.id,
        TripDeparture.organization_id == org.id,
        TripDeparture.departure_date == target,
    ).first()
    if not departure:
        return json.dumps({"success": False, "error": f"No departure found on {date_str}."})
    if departure.available_seats < num_people:
        return json.dumps({
            "success": False,
            "error": f"Only {departure.available_seats} seats available, but {num_people} requested.",
        })

    price = departure.price_override or trip.price
    total = Decimal(str(price)) * num_people
    booking_code = _generate_booking_code(db, org.id)

    # Build payment link
    base_url = settings.BOOKING_PAYMENT_BASE_URL or f"{settings.FRONTEND_URL}/pay"
    payment_link = f"{base_url}/{booking_code}"

    booking = Booking(
        organization_id=org.id,
        booking_code=booking_code,
        customer_id=customer.id,
        lead_id=lead.id,
        trip_id=trip.id,
        departure_id=departure.id,
        num_participants=num_people,
        total_amount=total,
        amount_paid=Decimal("0"),
        status=BookingStatus.PENDING,
        payment_status=PaymentStatus.UNPAID,
        payment_link=payment_link,
    )
    db.add(booking)
    db.flush()

    for name in participant_names:
        db.add(BookingParticipant(
            organization_id=org.id,
            booking_id=booking.id,
            full_name=name.strip(),
        ))

    # Update lead status
    lead.status = LeadStatus.PAYMENT_PENDING
    lead.trek_name = trip.name
    lead.trip_id = trip.id
    lead.num_people = num_people
    lead.estimated_value = total

    # Sync departure status if full
    if departure.available_seats - num_people <= 0 and departure.status == TripStatus.OPEN:
        departure.status = TripStatus.FULL

    db.add(LeadActivity(
        organization_id=org.id,
        lead_id=lead.id,
        activity_type="BOOKING_CREATED",
        description=f"AI agent created booking {booking_code} for {num_people} people on {trip.name} ({date_str})",
    ))
    db.commit()

    return json.dumps({
        "success": True,
        "booking_code": booking_code,
        "trek_name": trip.name,
        "departure_date": date_str,
        "num_people": num_people,
        "participants": participant_names,
        "total_amount": str(total),
        "price_per_person": str(price),
        "payment_link": payment_link,
    })


def _exec_get_customer_status(db: Session, org: Organization, customer: Customer) -> str:
    leads = db.query(Lead).filter(
        Lead.organization_id == org.id, Lead.customer_id == customer.id
    ).order_by(Lead.created_at.desc()).limit(5).all()

    bookings = db.query(Booking).filter(
        Booking.organization_id == org.id, Booking.customer_id == customer.id
    ).order_by(Booking.created_at.desc()).limit(5).all()

    return json.dumps({
        "customer_name": customer.full_name,
        "leads": [
            {"trek": l.trek_name, "status": l.status.value, "num_people": l.num_people}
            for l in leads
        ],
        "bookings": [
            {
                "code": b.booking_code,
                "status": b.status.value,
                "total": str(b.total_amount),
                "paid": str(b.amount_paid),
                "payment_status": b.payment_status.value,
            }
            for b in bookings
        ],
    })


def _exec_escalate(db: Session, org: Organization, lead: Lead, args: dict) -> str:
    reason = args.get("reason", "Customer requested human agent")
    db.add(LeadActivity(
        organization_id=org.id,
        lead_id=lead.id,
        activity_type="ESCALATED_TO_HUMAN",
        description=f"AI escalated: {reason}",
    ))
    db.commit()
    return json.dumps({"escalated": True, "message": "A team member will follow up shortly."})


TOOL_EXECUTORS = {
    "search_treks": lambda db, org, customer, lead, args: _exec_search_treks(db, org, args),
    "check_availability": lambda db, org, customer, lead, args: _exec_check_availability(db, org, args),
    "create_booking": lambda db, org, customer, lead, args: _exec_create_booking(db, org, customer, lead, args),
    "get_customer_status": lambda db, org, customer, lead, args: _exec_get_customer_status(db, org, customer),
    "escalate_to_human": lambda db, org, customer, lead, args: _exec_escalate(db, org, lead, args),
}


def _call_openai(messages: list[dict]) -> dict:
    url = f"{settings.OPENAI_BASE_URL.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.OPENAI_MODEL,
        "messages": messages,
        "tools": TOOLS,
        "tool_choice": "auto",
        "temperature": 0.5,
        "max_tokens": settings.AI_MAX_TOKENS,
    }
    with httpx.Client(timeout=10) as client:
        resp = client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()


def _call_gemini(messages: list[dict]) -> str | None:
    if not settings.GEMINI_API_KEY:
        return None
    model_name = settings.GEMINI_MODEL or "gemini-flash-lite-latest"
    headers = {
        "Content-Type": "application/json",
        "x-goog-api-key": settings.GEMINI_API_KEY,
    }
    contents = []
    system_instruction = ""
    for m in messages:
        if m.get("role") == "system":
            system_instruction = str(m.get("content", ""))
            continue
        role = "user" if m.get("role") in ["user", "tool"] else "model"
        text_content = str(m.get("content", "")).strip()
        if not text_content:
            continue
        # Merge consecutive identical roles to adhere to Gemini's alternation requirements
        if contents and contents[-1]["role"] == role:
            contents[-1]["parts"][0]["text"] += "\n" + text_content
        else:
            contents.append({"role": role, "parts": [{"text": text_content}]})
    
    # Gemini requires first content to have role 'user'
    while contents and contents[0]["role"] != "user":
        contents.pop(0)

    if not contents:
        return None

    payload = {
        "contents": contents,
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 100},
    }
    if system_instruction:
        payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

    candidate_models = [settings.GEMINI_MODEL, "gemini-3.8-flash", "gemini-3.5-flash", "gemini-flash-lite-latest", "gemini-3.6-flash"]
    attempt_models = [m for m in dict.fromkeys(candidate_models) if m]

    for attempt_model in attempt_models:
        try:
            req_url = f"https://generativelanguage.googleapis.com/v1beta/models/{attempt_model}:generateContent"
            with httpx.Client(timeout=12) as client:
                resp = client.post(req_url, json=payload, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            res_text = parts[0].get("text", "").strip()
                            if res_text:
                                return res_text
                else:
                    logger.warning("Gemini model %s returned %s: %s", attempt_model, resp.status_code, resp.text[:150])
        except Exception as exc:
            logger.warning("Gemini call for %s failed: %s", attempt_model, exc)
    return None


# ---------------------------------------------------------------------------
# Main agent entry point
# ---------------------------------------------------------------------------

def run_sales_agent(
    db: Session,
    *,
    org: Organization,
    customer: Customer,
    lead: Lead,
    inbound_text: str,
    recent_messages: list[dict],
) -> str:
    # Count total customer messages received so far (including current message)
    inbound_count = sum(1 for m in recent_messages if m.get("direction") == "INBOUND")
    if inbound_text and not (recent_messages and recent_messages[-1].get("direction") == "INBOUND" and recent_messages[-1].get("body") == inbound_text):
        inbound_count += 1
    inbound_count = max(inbound_count, 1)

    # Resolve or verify trek from lead, notes, or inbound text
    current_trek = lead.trek_name or ""
    if not current_trek:
        m = (
            detect_trek(inbound_text)
            or (detect_trek(lead.notes) if lead.notes else None)
            or (detect_trek(customer.notes) if customer.notes else None)
        )
        if m:
            current_trek = m["name"]
            lead.trek_name = current_trek
            try:
                db.commit()
            except Exception:
                pass

    system_prompt = build_sales_system_prompt(org, inbound_count=inbound_count, current_trek=current_trek)

    messages = [{"role": "system", "content": system_prompt}]
    for m in recent_messages:
        role = "user" if m["direction"] == "INBOUND" else "assistant"
        messages.append({"role": role, "content": m["body"]})
    if not messages or messages[-1].get("role") != "user":
        messages.append({"role": "user", "content": inbound_text})

    final_reply = None

    # 1. Try OpenAI if key is present
    if settings.OPENAI_API_KEY:
        for _iteration in range(5):
            try:
                response = _call_openai(messages)
                choice = response.get("choices", [{}])[0]
                msg = choice.get("message", {})
                tool_calls = msg.get("tool_calls")
                if not tool_calls:
                    content = msg.get("content", "").strip()
                    if content:
                        final_reply = content
                        break
                    break
                messages.append(msg)
                for tc in tool_calls:
                    fn_name = tc["function"]["name"]
                    fn_args = json.loads(tc["function"]["arguments"]) if tc["function"].get("arguments") else {}
                    executor = TOOL_EXECUTORS.get(fn_name)
                    result = executor(db, org, customer, lead, fn_args) if executor else json.dumps({"error": "Unknown tool"})
                    messages.append({"role": "tool", "tool_call_id": tc["id"], "content": result})
            except Exception as exc:
                logger.warning("OpenAI call failed or quota exceeded: %s", exc)
                break

    # 2. Try Gemini if configured (Primary AI)
    if not final_reply:
        gemini_reply = _call_gemini(messages)
        if gemini_reply:
            final_reply = gemini_reply

    # 3. Smart Conversational Trek Engine (Database Grounded Fallback)
    if not final_reply:
        final_reply = _smart_trek_reply(db, org, customer, lead, inbound_text, recent_messages)

    # Defensive guarantee: Under 4 customer messages, STRICTLY NO links/URLs
    if inbound_count < 4 and final_reply:
        import re
        if "http://" in final_reply or "https://" in final_reply or "bengalurutrails.in" in final_reply:
            cleaned = re.sub(r"(?:at|on|through|via|link:?|website:?)\s*https?://\S+", "", final_reply, flags=re.IGNORECASE)
            cleaned = re.sub(r"https?://\S+", "", cleaned)
            cleaned = re.sub(r"bengalurutrails\.in\S*", "", cleaned)
            cleaned = re.sub(r"\s+", " ", cleaned).strip()
            cleaned = re.sub(r"\b(at|on our website at|through our website at|on our website|website|link|here:?)\s*[.!]?$", "", cleaned, flags=re.IGNORECASE).strip()
            if len(cleaned) < 35 or any(w in cleaned.lower() for w in ["book directly", "book online", "book at", "click here", "visit our", "book here", "at directly"]):
                if current_trek:
                    final_reply = f"To book {current_trek}, just let me know your preferred weekend and number of travelers, and we'll check slots for you!"
                else:
                    final_reply = "To book, just let me know which trek you're interested in and your preferred dates!"
            else:
                final_reply = cleaned

    return final_reply


def _smart_trek_reply(
    db: Session,
    org: Organization,
    customer: Customer,
    lead: Lead,
    inbound_text: str,
    recent_messages: list[dict],
) -> str:
    """Natural, concise human reply engine grounded in database treks."""
    import re
    text = inbound_text.lower().strip()
    full_convo = " ".join([m.get("body", "").lower() for m in recent_messages] + [text])

    inbound_count = sum(1 for m in recent_messages if m.get("direction") == "INBOUND")
    if inbound_text and not (recent_messages and recent_messages[-1].get("direction") == "INBOUND" and recent_messages[-1].get("body") == inbound_text):
        inbound_count += 1
    inbound_count = max(inbound_count, 1)
    is_early = inbound_count < 4

    # 1. Pure Greeting Handler (First Priority)
    greeting_words = {"hi", "hello", "hey", "hii", "namaste", "good morning", "good evening", "heyy", "hola"}
    clean_words = set(re.findall(r"\b\w+\b", text))
    if clean_words.issubset(greeting_words) or text in greeting_words:
        if lead.trek_name:
            return f"Hey! Looking at {lead.trek_name}?"
        return "Hey! Looking for any trek?"

    # 2. Short Acknowledgements
    ack_words = {"ok", "okay", "sure", "cool", "great", "done", "noted", "yes", "yeah", "yep", "alright", "perfect", "fine", "thanks", "thank", "you", "thx"}
    if clean_words.issubset(ack_words) or any(p in text for p in ["thank you", "thanks", "sounds good"]):
        return "No worries! Let me know if you need anything."

    # 3. Identify Trek via Centralized Catalog First
    matched_catalog = (
        (detect_trek(lead.trek_name) if lead.trek_name else None)
        or (detect_trek(lead.notes) if lead.notes else None)
        or (detect_trek(customer.notes) if customer.notes else None)
        or detect_trek(text)
        or detect_trek(full_convo)
    )
    if matched_catalog and not lead.trek_name:
        lead.trek_name = matched_catalog["name"]
        try:
            db.commit()
        except Exception:
            pass

    trips = db.query(Trip).filter(Trip.organization_id == org.id).all()
    if not trips:
        trips = db.query(Trip).all()

    def _get_trip_keywords(trip: Trip) -> list[str]:
        clean_name = trip.name.lower().replace("[demo]", "").strip()
        keywords = [clean_name, clean_name.split()[0]]
        if "kudremukh" in clean_name or "kudremukha" in clean_name:
            keywords.extend(["kudremukh", "kudremukha", "kuduremukha", "kudremuk"])
        elif "gokarn" in clean_name:
            keywords.extend(["gokarna", "gokarn", "beach trek"])
        elif "kodachadri" in clean_name:
            keywords.extend(["kodachadri", "kodachadri trek", "hidlumane", "hidlumane falls"])
        elif "kumara" in clean_name or "kp" in clean_name:
            keywords.extend(["kumara parvatha", "kumaraparvatha", "kp", "kumara"])
        elif "netravat" in clean_name:
            keywords.extend(["netravathi", "netravati"])
        elif "skandagiri" in clean_name:
            keywords.extend(["skandagiri", "night trek"])
        elif "munnar" in clean_name:
            keywords.extend(["munnar", "kolukkumalai"])
        elif "wayanad" in clean_name:
            keywords.extend(["wayanad"])
        elif "kodaikanal" in clean_name:
            keywords.extend(["kodaikanal", "kodai"])
        elif "hampi" in clean_name:
            keywords.extend(["hampi"])
        elif "coorg" in clean_name:
            keywords.extend(["coorg"])
        elif "chikmagalur" in clean_name or "chikmagaluru" in clean_name:
            keywords.extend(["chikmagalur", "chikmagaluru"])
        return keywords

    matched_trip: Trip | None = None
    if matched_catalog:
        matched_trip = Trip(name=matched_catalog["name"], price=matched_catalog["price_num"])
    else:
        for trip in trips:
            if any(kw in text for kw in _get_trip_keywords(trip)):
                matched_trip = trip
                break

        INDEX_TO_TREK_KEY = {
            "1": "kudremukh",
            "2": "gokarn",
            "3": "kodachadri",
            "4": "netravat",
            "5": "kumara",
            "6": "skandagiri",
        }
        opt_match = re.fullmatch(r"(?:option\s*|#\s*|trek\s*)?([1-6])(?:\.|\))?", text)
        if opt_match and not matched_trip:
            chosen_key = INDEX_TO_TREK_KEY[opt_match.group(1)]
            for trip in trips:
                if chosen_key in trip.name.lower():
                    matched_trip = trip
                    break

        auto_provisions = {
            "munnar": ("Munnar & Kolukkumalai Trip", Decimal("5499")),
            "kodachadri": ("Kodachadri Trek", Decimal("3799")),
            "wayanad": ("Wayanad Backpacking Trip", Decimal("3699")),
            "kodaikanal": ("Kodaikanal Hill Station Trip", Decimal("4499")),
            "hampi": ("Hampi Heritage Trip", Decimal("4499")),
            "coorg": ("Coorg Backpacking Trip", Decimal("3499")),
            "chikmagalur": ("Chikmagalur Plantation Tour", Decimal("3499")),
            "netravat": ("Netravathi Peak Trek", Decimal("3499")),
            "nethravat": ("Netravathi Peak Trek", Decimal("3499")),
            "kudremukh": ("Kudremukha Peak Trek", Decimal("3499")),
            "kuduremukha": ("Kudremukha Peak Trek", Decimal("3499")),
            "gokarn": ("Gokarna Beach Trek", Decimal("3499")),
            "kumara": ("Kumara Parvatha Trek", Decimal("3299")),
            "kp": ("Kumara Parvatha Trek", Decimal("3299")),
            "tadiandamol": ("Tadiandamol Peak Trek", Decimal("2299")),
            "skandagiri": ("Skandagiri Sunrise Trek", Decimal("1499")),
            "uttari": ("Uttaribetta Sunrise Trek", Decimal("999")),
            "kunti": ("Kuntibetta Sunrise Trek", Decimal("1199")),
            "anthargange": ("Anthargange Sunrise Trek", Decimal("1099")),
        }
        if not matched_trip:
            for query_k, (tname, tprice) in auto_provisions.items():
                if query_k in text:
                    matched_trip = Trip(name=tname, price=tprice)
                    break

        if not matched_trip and not opt_match:
            for trip in trips:
                if any(kw in full_convo for kw in _get_trip_keywords(trip)):
                    matched_trip = trip
                    break

        if not matched_trip and not opt_match:
            for query_k, (tname, tprice) in auto_provisions.items():
                if query_k in full_convo:
                    matched_trip = Trip(name=tname, price=tprice)
                    break

    def _get_trek_price_str(trip: Trip | None) -> str:
        if not trip:
            return "₹3,499"
        name_lower = trip.name.lower()
        if "munnar" in name_lower:
            return "₹5,499"
        elif "kodachadri" in name_lower:
            return "₹3,799"
        elif "kodaikanal" in name_lower or "hampi" in name_lower:
            return "₹4,499"
        elif "wayanad" in name_lower:
            return "₹3,699"
        elif any(k in name_lower for k in ["kudremukh", "netravat", "nethravat", "gokarn", "coorg", "chikmagalur"]):
            return "₹3,499"
        elif "skandagiri" in name_lower:
            return "₹1,499"
        elif "uttari" in name_lower:
            return "₹999"
        elif "kunti" in name_lower or "anthargange" in name_lower:
            return "₹1,199"
        elif trip.price:
            return f"₹{int(trip.price):,}"
        return "₹3,499"

    # 4. Check for Distance / Duration / Difficulty
    if any(k in text for k in ["how long", "distance", "duration", "how many hours", "how many km", "total km", "difficulty", "hard", "easy", "moderate", "level", "fitness", "time taken", "hours"]):
        if matched_trip and any(kw in matched_trip.name.lower() for kw in ["kudremukh", "kuduremukha"]):
            return "Kudremukha is around 22 km total (7–8 hours). It's a moderate trek."
        elif matched_trip and "kodachadri" in matched_trip.name.lower():
            return "Kodachadri is about 14 km via Hidlumane falls, moderate level, with a jeep ride back."
        elif matched_trip and any(kw in matched_trip.name.lower() for kw in ["netravat", "nethravat"]):
            return "Netravathi is around 14 km total and is a moderate trek."
        elif matched_trip and "gokarn" in matched_trip.name.lower():
            return "Gokarna is an easy 10 km beach trail."
        elif matched_trip and "skandagiri" in matched_trip.name.lower():
            return "Skandagiri is an 8 km night trek to catch the sunrise."
        return "Our Western Ghats treks are usually 12–14 km and moderate difficulty."

    # 5. Itinerary / Timings / Schedule
    if any(k in text for k in ["itinerary", "schedule", "when do we return", "reach", "timing", "what time", "program"]):
        return "We depart Bangalore on Friday night, trek on Saturday, and return by Sunday night."

    # 6. Food & Meals
    if any(k in text for k in ["veg", "non veg", "non-veg", "what food", "meals", "dinner", "lunch", "breakfast", "food"]):
        return "Food includes 2 breakfasts, 1 packed trail lunch, and Saturday dinner (both veg and non-veg available)."

    # 7. Weather
    if any(k in text for k in ["weather", "rain", "raining", "monsoon", "climate"]):
        return "The weather is misty with occasional showers. We recommend carrying a poncho or raincoat."

    # 8. Beginners & Fitness
    if any(k in text for k in ["beginner", "first time", "first-time", "can i do", "can beginners", "tough"]):
        return "Yes, it's beginner-friendly and our trek guides will be with the group throughout."

    # 9. Washrooms & Facilities
    if any(k in text for k in ["washroom", "toilet", "restroom", "facilities", "charging", "hot water"]):
        return "Yes, the homestay has clean washrooms, hot water, and phone charging points."

    # 10. Rooms / Private room / Sharing
    if any(k in text for k in ["separate room", "private room", "couple room", "room", "rooms"]):
        return "Standard stay is on a sharing basis (separate for guys and girls). Private rooms can be arranged on request."

    # 11. Alcohol & Smoking
    if any(k in text for k in ["alcohol", "beer", "drink", "drinking", "liquor", "smoke", "smoking"]):
        return "Alcohol and smoking are not allowed during the trip."

    # 12. Solo Female / Safety
    if any(k in text for k in ["solo", "safe", "girl", "female", "women", "alone", "safety"]):
        return "Yes, completely safe for solo female travelers. We have verified stays and trek leads with the group."

    # 13. Family / Kids
    if any(k in text for k in ["family", "parents", "kids", "children", "child"]):
        return "Yes, families are welcome. Our stays are comfortable and guides accompany the group."

    # 14. Things to carry / Shoes
    if any(k in text for k in ["what to carry", "what to bring", "packing", "things to carry", "shoes", "clothes"]):
        return "You'll need a small backpack, shoes with good grip, 2 pairs of clothes, a raincoat or poncho, and a water bottle."

    # 15. Bangalore Pickups
    if any(k in text for k in ["pickup", "boarding", "pick up", "route", "where to board", "start"]):
        return "Pickups are on Friday night from Silk Board (8:30 PM), Majestic (9:15 PM), Yeshwanthpur (9:45 PM), and Hebbal (10:15 PM)."

    # Resolve catalog trek variables for accurate responses
    trek_display_title = matched_catalog["name"] if matched_catalog else (matched_trip.name.replace("[DEMO]", "").strip() if matched_trip else "")
    trek_display_url = matched_catalog["url"] if matched_catalog else get_trek_url(trek_display_title)
    trek_display_inclusions = matched_catalog["inclusions"] if matched_catalog else (get_trek_inclusions(trek_display_title) if trek_display_title else "Bangalore round-trip travel, stay, meals, and guide.")

    # 16. Inclusions AND Booking Asked Together (e.g. "How do I book? What is included in the package tour?")
    inclusions_asked = any(k in text for k in ["inclusion", "included", "accommodation", "what is included", "package tour", "package include", "tour include"])
    booking_asked = any(k in text for k in ["how do i book", "how to book", "book on thursday", "can i book on", "can we book", "last day to book", "when can i book", "booking process", "how can i book"])

    if inclusions_asked and booking_asked:
        if trek_display_title:
            return f"{trek_display_title} includes {trek_display_inclusions} Just share your dates and group size to book."
        return "Our packages include Bangalore travel, stay, meals, and guide. Which trek are you looking at?"

    # 16b. Inclusions Asked Alone
    if inclusions_asked:
        if trek_display_title:
            return f"{trek_display_title} includes {trek_display_inclusions}"
        return "Our packages include Bangalore travel, stay, meals, and guide. Which trek are you looking at?"

    # 17. Booking timing & process FAQs
    if booking_asked:
        if is_early:
            if trek_display_title:
                is_strict_advance = any(kw in trek_display_title.lower() for kw in ["kudremukh", "kuduremukha", "netravat", "nethravat"])
                if is_strict_advance:
                    return f"{trek_display_title} needs forest permits, so book at least 20 days in advance. Share your dates and group size."
                return f"Just share your dates and group size for {trek_display_title}, I'll check slots."
            return "Which trek are you looking to book?"
        else:
            if trek_display_title:
                return f"You can book {trek_display_title} here: {trek_display_url}"
            return "Which trek are you booking? I'll share the link."

    # 18. Passenger Count / Group size
    pax_match = re.search(r"\b(\d+)\s*(?:people|persons|members|pax|travellers|guests|guys|friends|heads|of us)?\b", text)
    if pax_match and matched_trip:
        raw_val = pax_match.group(1)
        count = int(raw_val)
        if 1 <= count <= 50 and (len(text.split()) <= 4 or any(w in text for w in ["people", "person", "members", "pax", "of us", "group", "we are", "joining"])):
            clean_title = matched_trip.name.replace("[DEMO]", "").strip()
            price_str = _get_trek_price_str(matched_trip)
            try:
                unit_num = int(price_str.replace("₹", "").replace(",", "").strip())
            except Exception:
                unit_num = 3499
            total_num = unit_num * count
            return f"Got it, {count} people for {clean_title} — that's ₹{total_num:,} total ({price_str} per person)."

    # 19. Personal details / Name sharing
    name_extracted = ""
    words = text.split()
    non_name_words = {
        "hi", "hello", "hey", "hii", "ok", "okay", "yes", "no", "sure", "done", "noted",
        "trek", "price", "cost", "details", "itinerary", "distance", "pickup", "food",
        "stay", "weather", "booking", "book", "confirm", "available", "link", "thanks", "thank",
        "option", "options", "people", "persons", "members", "pax", "travel", "good", "sounds",
        "room", "rooms", "separate", "private", "sharing",
    }
    if 1 <= len(words) <= 3 and all(w.isalpha() for w in words) and not any(w in non_name_words for w in words):
        name_extracted = " ".join(words).title()
    elif "my name is" in text or "i am " in text or "this is " in text or "myself " in text:
        n_match = re.search(r"(?:my name is|i am|this is|myself)\s+([a-zA-Z\s]{2,25})", text)
        if n_match:
            name_extracted = n_match.group(1).strip().title()

    if name_extracted and not opt_match:
        try:
            customer.name = name_extracted
            lead.name = name_extracted
            db.commit()
        except Exception:
            pass
        return f"Thanks {name_extracted}! Noted."

    # 20. Specific date queries
    date_num_match = re.search(r"\b(\d{1,2})(?:st|nd|rd|th)\b|\b(?:on|date|dated|departure|sep|oct|nov|dec|jan|feb|aug|weekend)\s*(\d{1,2})\b", text)
    if date_num_match and matched_trip:
        raw_d = date_num_match.group(1) or date_num_match.group(2)
        day_num = int(raw_d)
        if day_num <= 31:
            suffix = "th" if 11 <= day_num <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(day_num % 10, "th")
            formatted_day = f"{day_num}{suffix}"
            clean_title = matched_trip.name.replace("[DEMO]", "").strip()
            return f"Yes, we have a {clean_title} batch on {formatted_day}."

    # 21. Booking / Payment / Link request
    if any(k in text for k in ["book", "confirm", "pay", "payment", "register", "link", "website", "url"]):
        if is_early:
            if trek_display_title:
                return f"Just share your dates and group size for {trek_display_title}, I'll check slots."
            return "Which trek are you looking to book?"
        else:
            if trek_display_title:
                return f"You can book {trek_display_title} here: {trek_display_url}"
            return "Which trek are you booking? I'll share the link."

    # 22. If a trek was identified: Price vs Dates vs General
    if matched_trip:
        clean_title = matched_trip.name.replace("[DEMO]", "").strip()
        price_str = _get_trek_price_str(matched_trip)

        # Asked for price
        if any(w in text for w in ["price", "cost", "how much", "charges", "charge", "fee", "rate"]):
            return f"{clean_title} is {price_str} per person, all inclusive."

        # Asked for dates
        if any(w in text for w in ["date", "dates", "when", "day", "days", "weekend", "departure"]):
            return f"We have {clean_title} departures every Friday night from Bangalore."

        # General inquiry about this trek
        return f"{clean_title} is {price_str} per person, departures every Friday from Bangalore."

    # 23. General Price or Departure questions (without trek name)
    if any(w in text for w in ["price", "cost", "how much", "charges", "rate"]):
        return "Weekend treks start at ₹3,499 per person, all inclusive. Which trek are you looking at?"

    if any(w in text for w in ["departure", "departures", "weekend", "this weekend", "dates"]):
        return "We have departures every Friday night from Bangalore. Which trek are you interested in?"

    # 24. Default fallback
    if trek_display_title:
        return f"{trek_display_title} is {get_trek_price(trek_display_title)} per person, departures every Friday from Bangalore."
    return "Which trek are you looking at? We have Munnar, Kudremukh, Gokarna, Kodachadri and more."
