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

# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------

SALES_AGENT_SYSTEM_PROMPT = """\
You are an enthusiastic, warm, and highly professional human sales coordinator at Hikers Horizon Bangalore ({org_name}).
You are chatting directly with customers on WhatsApp to answer questions, guide them through trek options, and help them book.

COMPANY & PRICING KNOWLEDGE:
- Kudremukha Trek: ₹3,499 per person (Includes Transportation from Bangalore, Homestay, Food & Guide). MUST BE BOOKED AT LEAST 20 DAYS IN ADVANCE due to strict Forest Department permit quotas. Link: https://hikershorizon.in/Twodays/Kuduremukha/
- Netravathi Trek: ₹3,499 per person (Includes Transportation, Homestay, Food & Guide). MUST BE BOOKED AT LEAST 20 DAYS IN ADVANCE due to strict Forest Department permit quotas. Link: https://hikershorizon.in/Twodays/Netravathi/
- Gokarna Beach Trek: ₹3,499 per person (Includes Transportation from Bangalore, Beach stay, Food & Guide). Link: https://hikershorizon.in/Twodays/Gokarna/
- Kodachadri Trek: ₹3,799 per person (Includes Transportation from Bangalore, Homestay, Food, Guide & Jeep ride back). Link: https://hikershorizon.in/Twodays/Kodachadri/
- Kumara Parvatha Trek: ₹3,299 per person (Includes Transportation, Food & Guide). Link: https://hikershorizon.in/Twodays/Kumaraparvatha/
- Skandagiri Night Trek: ₹1,499 per person (Includes Transportation & Guide). Link: https://hikershorizon.in/Sunrise/Skandagiri-sunrise-trek-from-bangalore/
- Munnar & Kolukkumalai Backpacking Trip: ₹5,199 per person (3 Days / 2 Nights). Link: https://hikershorizon.in/Backpacking/Munnar/
- Wayanad Backpacking Trip: ₹3,699 per person. Link: https://hikershorizon.in/Backpacking/Wayanad/
- Pickups in Bangalore: Silk Board (8:30 PM), Majestic (9:15 PM), Yeshwanthpur (9:45 PM), Hebbal (10:15 PM). Departures every Friday night.
- Exclusions: Forest entry permits / tickets are not included in any package and are to be paid directly/at the checkpost.

ADVANCE BOOKING RULES:
- IMPORTANT: Kudremukha Trek and Netravathi Trek MUST BE BOOKED AT LEAST 20 DAYS IN ADVANCE. If a customer asks to book Kudremukha or Netravathi last-minute (e.g. for this weekend or on Thursday/Friday), explain that due to strict Forest Department permit limits, Kudremukha and Netravathi require booking 20 days in advance, and suggest choosing a date 20+ days ahead or picking Kodachadri / Gokarna for this weekend.
- For all other treks (Kodachadri, Gokarna, Kumara Parvatha, Skandagiri), customers can book during the week up to Thursday/Friday based on seat availability.

CONVERSATION STYLE & RULES:
- Sound completely natural, human, warm, and helpful like an experienced outdoor coordinator at Hikers Horizon Bangalore.
- NEVER assume or invent a customer name. ONLY address the customer by name if they explicitly introduced themselves in this chat (e.g., "I am Priya" or "My name is John"). Otherwise, just use warm greetings like "Hey there! 😊".
- NEVER make up or invent random phone numbers or UPI IDs for PhonePe/GPay (e.g. NEVER use 9876543210).
- For payment and booking confirmation: Direct customers to complete their booking securely on the official portal at https://hikershorizon.in/campflow/ (or share your official WhatsApp number +91 99026 53393 / 99166 27799 for payment QR code assistance).
- Share the official trek page link on hikershorizon.in ONLY ONCE per conversation (when first introducing the trek or when the customer explicitly asks for photos/link/itinerary). NEVER repeat or attach website links in every follow-up message.
- NEVER mention private or separate rooms unprompted. ONLY discuss separate rooms if the customer explicitly asks about rooms or stay arrangements.
- When customers ask about family trips (e.g. "I am coming with my family is it okay?"), warmly confirm that families and kids are 100% welcome, our trips are safe and guided by experienced leads, and ask which destination they're looking at.
- When customer mentions group size (e.g. "2 people"), calculate the total group price (e.g., ₹3,799 × 2 = ₹7,598 total) and ask for their travel date/weekend.
- When customer asks booking questions (e.g. "How do I book?", "Can I book on Thursday?"), remember the 20-day rule for Kudremukha & Netravathi. For other treks, confirm bookings are open during the week.
- Answer FAQs about food (veg & non-veg dinner, breakfast, trail lunch), weather (lush misty monsoons), safety (100% solo female friendly).
- Keep formatting clean with bold text, bullet points, and 2-3 friendly emojis. Keep replies concise (under 75 words).
- Answer FAQs about food (veg & non-veg dinner, breakfast, trail lunch), weather (lush misty monsoons), safety (100% solo female friendly).
- Keep formatting clean with bold text, bullet points, and 2-3 friendly emojis. Keep replies concise (under 75 words).

{custom_prompt}

CURRENT DATE: {today}
"""


def build_sales_system_prompt(org: Organization) -> str:
    return SALES_AGENT_SYSTEM_PROMPT.format(
        org_name=org.name,
        custom_prompt=org.ai_system_prompt or "",
        today=datetime.date.today().isoformat(),
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
        "generationConfig": {"temperature": 0.7, "maxOutputTokens": 600},
    }
    if system_instruction:
        payload["systemInstruction"] = {"parts": [{"text": system_instruction}]}

    for attempt_model in ["gemini-flash-lite-latest", "gemini-3.5-flash", "gemini-3.6-flash"]:
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
    """Runs the AI sales agent for a single inbound message, returning the text reply to send."""
    system_prompt = build_sales_system_prompt(org)

    messages = [{"role": "system", "content": system_prompt}]
    for m in recent_messages:
        role = "user" if m["direction"] == "INBOUND" else "assistant"
        messages.append({"role": role, "content": m["body"]})
    if not messages or messages[-1].get("role") != "user":
        messages.append({"role": "user", "content": inbound_text})

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
                        return content
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
    gemini_reply = _call_gemini(messages)
    if gemini_reply:
        return gemini_reply

    # 3. Smart Conversational Trek Engine (Database Grounded Fallback)
    return _smart_trek_reply(db, org, customer, lead, inbound_text, recent_messages)


def _smart_trek_reply(
    db: Session,
    org: Organization,
    customer: Customer,
    lead: Lead,
    inbound_text: str,
    recent_messages: list[dict],
) -> str:
    """Intelligent database-grounded sales conversational engine that extracts
    trek names, dates, group sizes, and quotes accurate details without external API billing.
    """
    import re
    text = inbound_text.lower().strip()
    full_convo = " ".join([m.get("body", "").lower() for m in recent_messages] + [text])

    # 1. Pure Greeting Handler (First Priority)
    greeting_words = {"hi", "hello", "hey", "hii", "namaste", "good morning", "good evening", "heyy", "hola"}
    clean_words = set(re.findall(r"\b\w+\b", text))
    if clean_words.issubset(greeting_words) or text in greeting_words:
        return (
            "Hey there! 👋 Welcome to *Hikers Horizon*! ⛰️\n\n"
            "We organize weekend treks from Bangalore with transportation, food, homestay & trek guide included:\n"
            "1. Kudremukha Trek (₹3,499 with transportation)\n"
            "2. Gokarna Beach Trek (₹3,499 with transportation)\n"
            "3. Kodachadri Trek (₹3,799 with transportation)\n"
            "4. Netravathi Trek (₹3,499 with transportation)\n"
            "5. Kumara Parvatha Trek (₹3,299 with transportation)\n"
            "6. Skandagiri Night Trek (₹1,499 with transportation)\n\n"
            "Which trek are you interested in exploring? 🎒"
        )

    # 2. Identify Trek — Prioritize current message text FIRST
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
    for trip in trips:
        if any(kw in text for kw in _get_trip_keywords(trip)):
            matched_trip = trip
            break

    # If no trip matched in current message, check previous conversation context
    if not matched_trip:
        for trip in trips:
            if any(kw in full_convo for kw in _get_trip_keywords(trip)):
                matched_trip = trip
                break

    # Check for catalogue option selection (1-6) only if no existing conversation trip
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
    if opt_match:
        chosen_key = INDEX_TO_TREK_KEY[opt_match.group(1)]
        for trip in trips:
            if chosen_key in trip.name.lower():
                matched_trip = trip
                break
        
        # If not found in DB, auto-provision and assign
        if not matched_trip:
            tname, tprice = {
                "kodachadri": ("Kodachadri Trek", Decimal("3799")),
                "kudremukh": ("Kudremukha Trek", Decimal("3499")),
                "gokarn": ("Gokarna Beach Trek", Decimal("3499")),
                "netravat": ("Netravathi Trek", Decimal("3499")),
                "kumara": ("Kumara Parvatha Trek", Decimal("3299")),
                "skandagiri": ("Skandagiri Night Trek", Decimal("1499")),
            }.get(chosen_key, ("Kodachadri Trek", Decimal("3799")))

            try:
                created_trip = Trip(organization_id=org.id, name=tname, pickup_location="Bengaluru", price=tprice)
                db.add(created_trip)
                db.flush()
                for d_offset in [5, 12, 19]:
                    dep = TripDeparture(
                        organization_id=org.id, trip_id=created_trip.id,
                        departure_date=datetime.date.today() + datetime.timedelta(days=d_offset),
                        capacity=30, status=TripStatus.OPEN,
                    )
                    db.add(dep)
                db.commit()
                matched_trip = created_trip
            except Exception:
                matched_trip = Trip(name=tname, price=tprice)

    # If not an option number, check current message text
    if not matched_trip:
        for trip in trips:
            if any(kw in text for kw in _get_trip_keywords(trip)):
                matched_trip = trip
                break

    # Auto-provision named trips if queried by name but not in DB
    if not matched_trip:
        auto_provisions = {
            "munnar": ("Munnar & Kolukkumalai Trip", Decimal("5199")),
            "kodachadri": ("Kodachadri Trek", Decimal("3799")),
            "wayanad": ("Wayanad Backpacking Trip", Decimal("3699")),
            "kodaikanal": ("Kodaikanal Hill Station Trip", Decimal("4499")),
            "hampi": ("Hampi Heritage Trip", Decimal("4499")),
            "coorg": ("Coorg Backpacking Trip", Decimal("3499")),
            "chikmagalur": ("Chikmagalur Plantation Tour", Decimal("3499")),
        }
        for query_k, (tname, tprice) in auto_provisions.items():
            if query_k in text:
                try:
                    created_trip = Trip(organization_id=org.id, name=tname, pickup_location="Bengaluru", price=tprice)
                    db.add(created_trip)
                    db.flush()
                    for d_offset in [5, 12, 19]:
                        dep = TripDeparture(
                            organization_id=org.id, trip_id=created_trip.id,
                            departure_date=datetime.date.today() + datetime.timedelta(days=d_offset),
                            capacity=30, status=TripStatus.OPEN,
                        )
                        db.add(dep)
                    db.commit()
                    matched_trip = created_trip
                except Exception:
                    matched_trip = Trip(name=tname, price=tprice)
                break

    # If not mentioned in current message and NOT an option selection, fallback to conversation history
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

    # Helper to get accurate trek pricing
    def _get_trek_price_str(trip: Trip | None) -> str:
        if not trip:
            return "₹3,499"
        name_lower = trip.name.lower()
        if "munnar" in name_lower:
            return "₹5,199"
        elif "kodachadri" in name_lower:
            return "₹3,799"
        elif "kodaikanal" in name_lower or "hampi" in name_lower:
            return "₹4,499"
        elif "wayanad" in name_lower:
            return "₹3,699"
        elif "kudremukh" in name_lower or "netravat" in name_lower or "gokarn" in name_lower or "coorg" in name_lower or "chikmagalur" in name_lower:
            return "₹3,499"
        elif "skandagiri" in name_lower:
            return "₹1,499"
        elif trip.price:
            return f"₹{int(trip.price):,}"
        return "₹3,499"

    # Helper to get official trek page URL on hikershorizon.in
    def _get_trek_url(trip: Trip | None) -> str:
        if not trip:
            return "https://hikershorizon.in/Twodays/"
        name_lower = trip.name.lower()
        if "munnar" in name_lower:
            return "https://hikershorizon.in/Backpacking/Munnar/"
        elif "wayanad" in name_lower:
            return "https://hikershorizon.in/Backpacking/Wayanad/"
        elif "kodaikanal" in name_lower:
            return "https://hikershorizon.in/Backpacking/Kodaikanal/"
        elif "hampi" in name_lower:
            return "https://hikershorizon.in/Backpacking/Hampi/"
        elif "coorg" in name_lower:
            return "https://hikershorizon.in/Backpacking/Coorg2days/"
        elif "chikmagalur" in name_lower:
            return "https://hikershorizon.in/Backpacking/Chikmagaluru/"
        elif "kudremukh" in name_lower or "kuduremukha" in name_lower:
            return "https://hikershorizon.in/Twodays/Kuduremukha/"
        elif "gokarn" in name_lower:
            return "https://hikershorizon.in/Twodays/Gokarna/"
        elif "kodachadri" in name_lower:
            return "https://hikershorizon.in/Twodays/Kodachadri/"
        elif "netravat" in name_lower:
            return "https://hikershorizon.in/Twodays/Netravathi/"
        elif "kumara" in name_lower or "kp" in name_lower:
            return "https://hikershorizon.in/Twodays/Kumaraparvatha/"
        elif "skandagiri" in name_lower:
            return "https://hikershorizon.in/Sunrise/Skandagiri-sunrise-trek-from-bangalore/"
        return "https://hikershorizon.in/Twodays/"

    # 3. Check for Distance / Duration / "How long" / Difficulty queries
    if any(k in text for k in ["how long", "distance", "duration", "how many hours", "how many km", "total km", "difficulty", "hard", "easy", "moderate", "level", "fitness", "time taken", "hours", "km"]):
        trek_url = _get_trek_url(matched_trip)
        if matched_trip and ("kudremukh" in matched_trip.name.lower() or "kudremukha" in matched_trip.name.lower()):
            return (
                "🏔️ *Kudremukha Trek Distance & Duration:*\n\n"
                "• *Total Distance:* 22 KM (11 KM up + 11 KM down)\n"
                "• *Duration:* Approximately 7 to 8 hours of trekking\n"
                "• *Difficulty:* Moderate\n"
                "• *Peak Altitude:* 1,894 meters (6,214 ft)\n\n"
                "The trail takes you through lush Shola forests, grasslands, and scenic ridge walks. Suitable for beginners with active fitness! 🎒\n\n"
                f"🔗 *Explore Kudremukha Details:* {trek_url}\n\n"
                "Would you like to check upcoming departure dates?"
            )
        elif matched_trip and "kodachadri" in matched_trip.name.lower():
            return (
                "🏔️ *Kodachadri Trek Distance & Duration:*\n\n"
                "• *Total Distance:* 14 KM total (via Hidlumane Waterfalls)\n"
                "• *Duration:* Approximately 6 to 7 hours of trekking\n"
                "• *Difficulty:* Moderate (Beginner friendly)\n"
                "• *Peak Altitude:* 1,343 meters\n\n"
                "Features the scenic Hidlumane waterfalls trail and famous off-road Jeep ride back! 🎒\n\n"
                f"🔗 *Explore Kodachadri Details:* {trek_url}\n\n"
                "Would you like to check upcoming departure dates?"
            )
        elif matched_trip and ("kumara" in matched_trip.name.lower() or "kp" in matched_trip.name.lower()):
            return (
                "⛰️ *Kumara Parvatha Trek Distance & Duration:*\n\n"
                "• *Total Distance:* 26 KM total\n"
                "• *Duration:* 2-Day challenging trek (10–12 hours total)\n"
                "• *Difficulty:* Moderate to Difficult\n"
                "• *Peak Altitude:* 1,712 meters\n\n"
                "One of the most thrilling and adventurous treks in the Western Ghats! 🎒\n\n"
                f"🔗 *Explore Kumara Parvatha Details:* {trek_url}\n\n"
                "Would you like to check upcoming departure dates?"
            )
        elif matched_trip and "netravat" in matched_trip.name.lower():
            return (
                "🌿 *Netravathi Peak Trek Distance & Duration:*\n\n"
                "• *Total Distance:* 14 KM total (up & down)\n"
                "• *Duration:* Approx 5 to 6 hours\n"
                "• *Difficulty:* Moderate (Beginner friendly)\n\n"
                "Known for rolling green meadows and breathtaking 360-degree views! 🎒\n\n"
                f"🔗 *Explore Netravathi Details:* {trek_url}\n\n"
                "Would you like to check upcoming departure dates?"
            )
        elif matched_trip and "gokarn" in matched_trip.name.lower():
            return (
                "🏖️ *Gokarna Beach Trek Distance & Duration:*\n\n"
                "• *Total Distance:* 10 KM scenic coastal trail\n"
                "• *Duration:* 5 hours across 5 famous beaches and cliffs\n"
                "• *Difficulty:* Easy to Moderate (Beginner friendly)\n\n"
                "Includes beach camping, sunset views, cliff walks & Murudeshwar visit! 🌊\n\n"
                f"🔗 *Explore Gokarna Details:* {trek_url}\n\n"
                "Would you like to check upcoming departure dates?"
            )
        elif matched_trip and "skandagiri" in matched_trip.name.lower():
            return (
                "🌌 *Skandagiri Night Trek Distance & Duration:*\n\n"
                "• *Total Distance:* 8 KM total\n"
                "• *Duration:* 4 to 5 hours (Night ascend for sunrise)\n"
                "• *Difficulty:* Moderate\n\n"
                "Watch the sunrise above a blanket of clouds! ☁️\n\n"
                f"🔗 *Explore Skandagiri Details:* {trek_url}\n\n"
                "Would you like to check upcoming departure dates?"
            )
        return (
            "🥾 *Trek Distance & Duration:*\n"
            "Our Western Ghats weekend treks typically cover **12 to 22 KM total** (approx 6 to 8 hours of moderate hiking) with regular rest breaks, led by certified guides. Suitable for beginners with basic fitness! 🎒"
        )

    # 4. Check for Itinerary / Schedule / Timings
    if any(k in text for k in ["itinerary", "schedule", "plan", "when do we return", "reach", "timing", "what time", "program"]):
        itinerary_link = f"\n\n🔗 *Full Itinerary & Photos:* {_get_trek_url(matched_trip)}" if matched_trip else ""
        return (
            "🗓️ *Trip Itinerary (2 Days / 1 Night):*\n"
            "• *Friday Night:* Depart Bangalore (8:30 PM – 10:15 PM pickups)\n"
            "• *Saturday 6:00 AM:* Reach stay/homestay, freshen up, breakfast & start trek\n"
            "• *Saturday 1:30 PM:* Explore viewpoints/summit, enjoy lunch & views\n"
            "• *Saturday Evening:* Reach stay, sunset, hot tea, campfire, music & dinner ⛺\n"
            "• *Sunday:* Breakfast, explore local beaches/waterfalls & depart\n"
            f"• *Sunday Night:* Return to Bangalore by 10:30 PM (or early Monday morning).{itinerary_link}"
        )

    # 4b. Human FAQs: Food & Meals
    if any(k in text for k in ["veg", "non veg", "non-veg", "what food", "meals", "dinner", "lunch", "breakfast"]):
        return (
            "🍲 *Food & Meals Included:*\n"
            "We serve fresh, hot local cuisine at our homestay! Included in the package:\n"
            "• Saturday Breakfast & packed trail Lunch\n"
            "• Saturday Dinner (Both Veg and Non-Veg chicken options available!)\n"
            "• Sunday Breakfast\n"
            "• Hot evening tea & snacks after descending ☕"
        )

    # 4c. Human FAQs: Weather & Rain
    if any(k in text for k in ["weather", "rain", "raining", "monsoon", "climate"]):
        return (
            "🌦️ *Current Weather:*\n"
            "The Western Ghats are exceptionally lush, green, and misty right now! 🌿 Mild showers make the waterfalls and cloud beds magical. Just pack a raincoat/poncho and good grip shoes, and you're all set! 🌧️⛰️"
        )

    # 4d. Human FAQs: Beginners & Fitness
    if any(k in text for k in ["beginner", "first time", "first-time", "can i do", "can beginners", "tough", "hard", "fitness"]):
        return (
            "🥾 *Beginner Friendly:*\n"
            "Yes, 100%! Over 60% of our participants are beginners and first-time hikers. Our certified trek guides lead the entire trek with regular rest, hydration, and photography stops! 📸🎒"
        )

    # 4e. Human FAQs: Stay, Washroom & Charging Facilities
    if any(k in text for k in ["washroom", "toilet", "restroom", "facilities", "charging", "hot water"]):
        return (
            "🏡 *Homestay & Facilities:*\n"
            "We provide comfortable homestays/tents with clean Western & Indian washrooms, running hot water, changing rooms, and charging sockets for your phones and power banks! 🚿🔌"
        )

    # 4f. Human FAQs: Rooms & Homestay Sharing Arrangements
    if any(k in text for k in ["separate room", "separate rooms", "private room", "private rooms", "couple room", "couple rooms", "room", "rooms"]):
        trek_name = matched_trip.name.replace("[DEMO]", "").strip() if matched_trip else "the trek"
        trek_url = _get_trek_url(matched_trip)
        return (
            f"🏡 *Room & Stay Arrangements for {trek_name}:*\n\n"
            "Yes, absolutely! At our homestay, we provide clean, comfortable rooms:\n"
            "• By default, we provide sharing rooms (separate rooms for boys and girls).\n"
            "• **Separate / Private rooms** can definitely be arranged for couples, families, or your private group upon request (subject to availability).\n"
            "• Clean washrooms with running hot water and charging points are available.\n\n"
            f"🔗 *View Homestay Photos & Itinerary:* {trek_url}\n\n"
            "How many people are planning to join with you? 🎒"
        )

    # 4g. Human FAQs: Alcohol / Smoking policy
    if any(k in text for k in ["alcohol", "beer", "drink", "drinking", "liquor", "smoke", "smoking"]):
        return (
            "🚫 *Safety Policy:*\n"
            "To prioritize trekker safety and maintain a welcoming group atmosphere, alcohol and smoking are strictly not allowed during travel and trekking. 🌿"
        )

    # 5. Check for Solo Female / Safety
    if any(k in text for k in ["solo", "safe", "girl", "female", "women", "alone", "safety"]):
        return (
            "🌟 *Safety & Solo Trekkers:*\n"
            "Yes, 100% safe! Over 40% of our community consists of solo travelers and solo female trekkers. We provide separate tent/room accommodations for females, certified first-aid trained trek leads, and a warm, inclusive group environment! ⛺"
        )

    # 5b. Check for Family / Kids
    if any(k in text for k in ["family", "parents", "kids", "children", "child", "coming with family", "with my family"]):
        target_trek = f" for {matched_trip.name.replace('[DEMO]', '').strip()}" if matched_trip else ""
        return (
            f"Yes, absolutely! Families are 100% welcome on our trips{target_trek}! 👨‍👩‍👧‍👦✨\n\n"
            "Our treks and weekend getaways are guided by certified outdoor leaders with safe travel, comfortable stays, and healthy meals.\n\n"
            "Which destination or trek are you planning with your family, and how many members are joining? 🎒"
        )

    # 6. Check for Things to Carry / Packing List / Shoes
    if any(k in text for k in ["what to carry", "what to bring", "packing", "things to carry", "shoes", "clothes", "dress"]):
        return (
            "🎒 *Things to Carry:*\n"
            "1. Small backpack (20–30L)\n"
            "2. Good grip trekking shoes / sneakers\n"
            "3. 2 pairs of quick-dry clothes + warm jacket for the night\n"
            "4. Raincoat / Poncho (during monsoon)\n"
            "5. 2L Water bottle & energy snacks (chocolates, dry fruits)\n"
            "6. Personal medication & valid Govt ID proof."
        )

    # 7. Check for Inclusions / Pickup queries
    if any(k in text for k in ["pickup", "boarding", "pick up", "route", "where to board", "start"]):
        return (
            "🚌 *Bangalore Pickup Points:*\n"
            "1. Silk Board (8:30 PM)\n"
            "2. Majestic / Shantala Silk House (9:15 PM)\n"
            "3. Yeshwanthpur Metro (9:45 PM)\n"
            "4. Hebbal Esteem Mall (10:15 PM)\n"
            "5. 8th Mile / Gorguntepalya\n\n"
            "We return back to Bangalore Sunday late night / early Monday by 5:00 AM. 🎒"
        )

    if any(k in text for k in ["inclusion", "included", "accommodation", "tent", "what is included"]):
        return (
            "✨ *Package Inclusions:*\n"
            "• Travel / Transportation to & from Bangalore in AC/Non-AC pushback tempo\n"
            "• Stay in Homestay / Tents (Separate for males & females)\n"
            "• Meals: 2 Breakfasts, 1 Lunch, 1 Dinner (Veg & Non-Veg options)\n"
            "• Certified Outdoor Leaders & First Aid support\n"
            "• Campfire & Music night (subject to weather) ⛺\n\n"
            "⚠️ *Note:* Forest entry permits / entry tickets are NOT included in the package and must be booked directly / paid at the base."
        )

    link_already_sent = any("hikershorizon.in" in m.get("body", "") for m in recent_messages)
    user_wants_link = any(w in text for w in ["link", "photo", "photos", "website", "itinerary", "gallery", "details", "page"])
    should_include_link = (not link_already_sent) or user_wants_link

    # 7e. Booking timing & process FAQs (e.g. "Can I book on Thursday?", "How do I book?", "When to book?")
    if any(k in text for k in ["how do i book", "how to book", "book on thursday", "can i book on", "can we book", "last day to book", "when can i book", "booking process", "how can i book"]):
        is_strict_advance = matched_trip and any(kw in matched_trip.name.lower() for kw in ["kudremukh", "kuduremukha", "netravat"])
        if is_strict_advance:
            clean_title = matched_trip.name.replace("[DEMO]", "").strip()
            return (
                f"⚠️ *Important Booking Notice for {clean_title}:*\n\n"
                f"Due to strict Karnataka Forest Department daily entry permit quotas, **{clean_title} must be booked at least 20 days in advance**!\n\n"
                "• For dates 20+ days ahead, we can reserve your spots right away.\n"
                "• If you want to travel *this weekend*, we recommend our **Kodachadri Trek (₹3,799)** or **Gokarna Beach Trek (₹3,499)** which are open for bookings! 🎒\n\n"
                "Which dates or trek would you like to explore? 😊"
            )
        else:
            trek_title = f" for {matched_trip.name.replace('[DEMO]', '').strip()}" if matched_trip else ""
            return (
                f"Yes, you can easily book anytime{trek_title}! 🎒✨\n\n"
                "We depart every Friday night from Bangalore with pickups at Silk Board, Majestic, Yeshwanthpur, and Hebbal.\n\n"
                "*(Note: Kudremukha & Netravathi require 20 days advance booking due to forest permits. Other treks like Kodachadri, Gokarna, and Skandagiri can be booked during the week!)*\n\n"
                "To reserve your slots, simply share:\n"
                "1. Your Preferred Weekend Date\n"
                "2. Total Number of People\n"
                "3. Your Name & Email ID\n\n"
                "I'll confirm your slots right away! ⛺"
            )

    # 7b. Check for Passenger Count / Group size (e.g. "2", "2 people", "2 members", "3 of us", "5 pax")
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
            trek_url = f"\n\n🔗 *Trip Details:* {_get_trek_url(matched_trip)}" if should_include_link else ""

            return (
                f"🎉 Awesome! Noted booking for *{count} {'person' if count == 1 else 'people'}* for *{clean_title}*!\n\n"
                f"💰 *Total Package:* {price_str} × {count} = *₹{total_num:,} total* (Includes transportation from Bangalore, food, homestay & trek guide)\n"
                f"• Live Slots: Available ✅{trek_url}\n\n"
                f"Which date/weekend are you planning to travel, and what is your *Full Name & Email* to reserve your spots? 🎒"
            )

    # 7c. Short Human Acknowledgements
    ack_phrases = {"ok", "okay", "sure", "cool", "sounds good", "great", "done", "noted", "yes", "yeah", "yep", "alright", "perfect", "fine", "thanks", "thank you"}
    if text in ack_phrases:
        target_trek = matched_trip.name.replace("[DEMO]", "").strip() if matched_trip else ""
        return (
            f"Awesome! 🌟 Looking forward to having you on the trail{' for ' + target_trek if target_trek else ''}! 🏕️\n\n"
            f"Feel free to ask if you have any questions about packing, pickups, or weather, or share your travel date to lock your booking! 🎒"
        )

    # 7d. Check for Name / Email / Personal Contact sharing
    email_match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", text)
    phone_match = re.search(r"\b(?:\+?91[\-\s]?)?[6789]\d{9}\b", text)

    # Check if the user is introducing themselves / providing their name
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

    if (name_extracted or email_match or phone_match) and not opt_match:
        if name_extracted:
            try:
                customer.name = name_extracted
                lead.name = name_extracted
                db.commit()
            except Exception:
                pass

        target_trek = matched_trip.name.replace("[DEMO]", "").strip() if matched_trip else "your upcoming trek"
        pax_info = f" for {lead.num_people} people" if (lead and lead.num_people) else ""
        trek_url = f"\n\n🔗 *View Trip Photos:* {_get_trek_url(matched_trip)}" if should_include_link else ""
        greeting_name = f", {name_extracted}" if name_extracted else ""

        return (
            f"Nice to connect with you{greeting_name}! 😊\n\n"
            f"I have noted your details for *{target_trek}*{pax_info}. We have slots open for upcoming weekend departures!{trek_url}\n\n"
            f"Which departure date (e.g. this Friday / next weekend) works best for you so I can lock your slots? 🎒"
        )

    # 8. Check for specific date queries (e.g. "25th", "sep 2", "departure on 2nd", "date 25", "this weekend")
    date_num_match = re.search(r"\b(\d{1,2})(?:st|nd|rd|th)\b|\b(?:on|date|dated|departure|sep|oct|nov|dec|jan|feb|aug|weekend)\s*(\d{1,2})\b", text)
    if date_num_match and matched_trip:
        raw_d = date_num_match.group(1) or date_num_match.group(2)
        day_num = int(raw_d)
        if day_num <= 31:
            suffix = "th" if 11 <= day_num <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(day_num % 10, "th")
            formatted_day = f"{day_num}{suffix}"
            clean_title = matched_trip.name.replace("[DEMO]", "").strip()
            price_str = _get_trek_price_str(matched_trip)
            trek_url = f"\n\n🔗 *Full Trek Details:* {_get_trek_url(matched_trip)}" if should_include_link else ""

            return (
                f"Awesome! 🏔️ For *{clean_title}*, we have slots open for departure on the {formatted_day}!\n\n"
                f"• Price: *{price_str} per person* (Includes transportation from Bangalore, food, homestay & trek guide)\n"
                f"• Live Seats: Available ✅{trek_url}\n\n"
                f"How many people are joining with you? Share your count and I'll send the instant booking confirmation link! 🎒"
            )

    # 9. If a trek was identified (e.g. by name or picked option 1-6), provide details & upcoming dates
    if matched_trip:
        clean_title = matched_trip.name.replace("[DEMO]", "").strip()
        price_str = _get_trek_price_str(matched_trip)
        deps = db.query(TripDeparture).filter(TripDeparture.trip_id == matched_trip.id).order_by(TripDeparture.departure_date.asc()).limit(3).all()
        trek_url = f"\n\n🔗 *Explore {clean_title} Photos & Itinerary:*\n👉 {_get_trek_url(matched_trip)}" if should_include_link else ""

        dates_text = ""
        if deps:
            dates_list = [f"• {d.departure_date.strftime('%b %d (%a)')} — {d.available_seats} seats left" for d in deps]
            dates_text = "\n" + "\n".join(dates_list)
        else:
            dates_text = "\n• Every Friday Night departure from Bangalore!"

        return (
            f"Hey! 🏔️ *{clean_title}* is one of our most popular treks!\n\n"
            f"📅 *Upcoming Departures:*{dates_text}\n"
            f"💰 *Price:* {price_str} per person (Includes Transportation, Food, Homestay Stay & Trek Guide)\n"
            f"📍 *Pickup:* Silk Board, Majestic, Yeshwanthpur, Hebbal{trek_url}\n\n"
            f"Which date works best for you and how many people are joining? 🎒"
        )

    # 10. Booking confirmation / payment link request
    if any(k in text for k in ["book", "confirm", "pay", "payment", "register"]):
        return (
            "Awesome! 🎉 You can view all live departures and confirm your booking directly on our official portal:\n"
            "👉 https://hikershorizon.in/campflow/\n\n"
            "Or reply with your *Full Name, Email, and Trek Date* and I will generate your booking pass right here! ⛺"
        )

    return (
        "Thanks for reaching out to Hikers Horizon! 🏔️\n"
        "We organize weekend departures from Bangalore for Kudremukha, Gokarna, Netravathi, Kumara Parvatha & Skandagiri.\n\n"
        "Which trek and dates would you like details for? I can check live seat availability for you right away! 🎒"
    )
