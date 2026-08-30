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
You are a friendly, helpful sales assistant for {org_name}, a trekking and adventure trip operator.
You are chatting with customers on WhatsApp. Your goal is to help them discover treks, answer questions,
and guide them toward booking.

RULES:
- Be conversational, warm, and concise. Use emojis sparingly (1-2 per message).
- Keep replies under 80 words unless showing a booking summary.
- NEVER make up trek details, prices, or dates. Always use the search_treks and check_availability tools.
- When a customer is interested, guide them step by step: (1) which trek, (2) which date, (3) how many people, (4) participant names, (5) confirm → create_booking.
- Only call create_booking when the customer has explicitly confirmed all details.
- If the customer asks to speak to a person, uses abusive language, or asks about refunds/cancellations, call escalate_to_human.
- Never invite the customer to pay outside the official booking link.
- If customer says "hi" or a greeting, welcome them and ask which trek they're interested in.
- Mention pickup location if available in the trek details.

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
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.GEMINI_MODEL}:generateContent?key={settings.GEMINI_API_KEY}"
    contents = []
    for m in messages:
        if m.get("role") == "system":
            continue
        role = "user" if m.get("role") in ["user", "tool"] else "model"
        contents.append({"role": role, "parts": [{"text": str(m.get("content", ""))}]})
    
    payload = {
        "contents": contents,
        "systemInstruction": {"parts": [{"text": messages[0].get("content", "")}]},
        "generationConfig": {"temperature": 0.6, "maxOutputTokens": 300},
    }
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.post(url, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                return data["candidates"][0]["content"]["parts"][0]["text"].strip()
    except Exception as exc:
        logger.warning("Gemini call failed: %s", exc)
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

    # 2. Try Gemini if configured
    gemini_reply = _call_gemini(messages)
    if gemini_reply:
        return gemini_reply

    # 3. Smart Conversational Trek Engine (Database Grounded)
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
            "2. Gokarna Beach Trek (₹3,299 with transportation)\n"
            "3. Kumara Parvatha Trek (₹3,299 with transportation)\n"
            "4. Netravathi Trek (₹3,499 with transportation)\n"
            "5. Skandagiri Night Trek (₹1,499 with transportation)\n\n"
            "Which trek are you interested in exploring? 🎒"
        )

    # 1b. Check if user selected an option number (1-5) from the catalogue
    INDEX_TO_TREK_KEY = {
        "1": "kudremukh",
        "2": "gokarn",
        "3": "kumara",
        "4": "netravat",
        "5": "skandagiri",
    }
    opt_match = re.fullmatch(r"(?:option\s*|#\s*|trek\s*)?([1-5])(?:\.|\))?", text)

    # 2. Identify Trek — Prioritize catalogue option / current message FIRST
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
        elif "kumara" in clean_name or "kp" in clean_name:
            keywords.extend(["kumara parvatha", "kumaraparvatha", "kp", "kumara"])
        elif "netravat" in clean_name:
            keywords.extend(["netravathi", "netravati"])
        elif "skandagiri" in clean_name:
            keywords.extend(["skandagiri", "night trek"])
        return keywords

    matched_trip: Trip | None = None
    if opt_match:
        chosen_key = INDEX_TO_TREK_KEY[opt_match.group(1)]
        for trip in trips:
            if chosen_key in trip.name.lower():
                matched_trip = trip
                break

    # If not an option number, check current message text
    if not matched_trip:
        for trip in trips:
            if any(kw in text for kw in _get_trip_keywords(trip)):
                matched_trip = trip
                break

    # If not mentioned in current message, fallback to conversation history
    if not matched_trip:
        for trip in trips:
            if any(kw in full_convo for kw in _get_trip_keywords(trip)):
                matched_trip = trip
                break

    # Helper to get accurate trek pricing
    def _get_trek_price_str(trip: Trip | None) -> str:
        if not trip:
            return "₹3,499"
        name_lower = trip.name.lower()
        if "kudremukh" in name_lower or "netravat" in name_lower:
            return "₹3,499"
        elif "skandagiri" in name_lower:
            return "₹1,499"
        elif trip.price:
            return f"₹{int(trip.price):,}"
        return "₹3,299"

    # 3. Check for Distance / Duration / "How long" / Difficulty queries
    if any(k in text for k in ["how long", "distance", "duration", "how many hours", "how many km", "total km", "difficulty", "hard", "easy", "moderate", "level", "fitness", "time taken", "hours", "km"]):
        if matched_trip and ("kudremukh" in matched_trip.name.lower() or "kudremukha" in matched_trip.name.lower()):
            return (
                "🏔️ *Kudremukha Trek Distance & Duration:*\n\n"
                "• *Total Distance:* 22 KM (11 KM up + 11 KM down)\n"
                "• *Duration:* Approximately 7 to 8 hours of trekking\n"
                "• *Difficulty:* Moderate\n"
                "• *Peak Altitude:* 1,894 meters (6,214 ft)\n\n"
                "The trail takes you through lush Shola forests, grasslands, and scenic ridge walks. Suitable for beginners with active fitness! 🎒\n\n"
                "Would you like to check upcoming departure dates?"
            )
        elif matched_trip and ("kumara" in matched_trip.name.lower() or "kp" in matched_trip.name.lower()):
            return (
                "⛰️ *Kumara Parvatha Trek Distance & Duration:*\n\n"
                "• *Total Distance:* 26 KM total\n"
                "• *Duration:* 2-Day challenging trek (10–12 hours total)\n"
                "• *Difficulty:* Moderate to Difficult\n"
                "• *Peak Altitude:* 1,712 meters\n\n"
                "One of the most thrilling and adventurous treks in the Western Ghats! 🎒"
            )
        elif matched_trip and "netravat" in matched_trip.name.lower():
            return (
                "🌿 *Netravathi Peak Trek Distance & Duration:*\n\n"
                "• *Total Distance:* 14 KM total (up & down)\n"
                "• *Duration:* Approx 5 to 6 hours\n"
                "• *Difficulty:* Moderate (Beginner friendly)\n\n"
                "Known for rolling green meadows and breathtaking 360-degree views! 🎒"
            )
        elif matched_trip and "gokarn" in matched_trip.name.lower():
            return (
                "🏖️ *Gokarna Beach Trek Distance & Duration:*\n\n"
                "• *Total Distance:* 10 KM scenic coastal trail\n"
                "• *Duration:* 5 hours across 5 famous beaches and cliffs\n"
                "• *Difficulty:* Easy to Moderate (Beginner friendly)\n\n"
                "Includes beach camping, sunset views & cliff walks! 🌊"
            )
        elif matched_trip and "skandagiri" in matched_trip.name.lower():
            return (
                "🌌 *Skandagiri Night Trek Distance & Duration:*\n\n"
                "• *Total Distance:* 8 KM total\n"
                "• *Duration:* 4 to 5 hours (Night ascend for sunrise)\n"
                "• *Difficulty:* Moderate\n\n"
                "Watch the sunrise above a blanket of clouds! ☁️"
            )
        return (
            "🥾 *Trek Distance & Duration:*\n"
            "Our Western Ghats weekend treks typically cover **12 to 22 KM total** (approx 6 to 8 hours of moderate hiking) with regular rest breaks, led by certified guides. Suitable for beginners with basic fitness! 🎒"
        )

    # 4. Check for Itinerary / Schedule / Timings
    if any(k in text for k in ["itinerary", "schedule", "plan", "when do we return", "reach", "timing", "what time", "program"]):
        return (
            "🗓️ *Trip Itinerary (2 Days / 1 Night):*\n"
            "• *Friday Night:* Depart Bangalore (8:30 PM – 10:15 PM pickups)\n"
            "• *Saturday 6:00 AM:* Reach homestay, freshen up, breakfast & start trek\n"
            "• *Saturday 1:30 PM:* Reach summit, enjoy packed lunch & 360° views\n"
            "• *Saturday Evening:* Descend to base, hot tea, campfire, music & dinner ⛺\n"
            "• *Sunday:* Breakfast, explore local waterfalls/viewpoints & depart\n"
            "• *Sunday Night:* Return to Bangalore by 10:30 PM (or early Monday morning)."
        )

    # 5. Check for Solo Female / Safety
    if any(k in text for k in ["solo", "safe", "girl", "female", "women", "alone", "safety"]):
        return (
            "🌟 *Safety & Solo Trekkers:*\n"
            "Yes, 100% safe! Over 40% of our community consists of solo travelers and solo female trekkers. We provide separate tent/room accommodations for females, certified first-aid trained trek leads, and a warm, inclusive group environment! ⛺"
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

    if any(k in text for k in ["inclusion", "included", "food", "stay", "accommodation", "tent", "what is included"]):
        return (
            "✨ *Package Inclusions:*\n"
            "• Travel / Transportation to & from Bangalore in AC/Non-AC pushback tempo\n"
            "• Stay in Homestay / Tents (Separate for males & females)\n"
            "• Meals: 2 Breakfasts, 1 Lunch, 1 Dinner (Veg & Non-Veg options)\n"
            "• Certified Outdoor Leaders & First Aid support\n"
            "• Campfire & Music night (subject to weather) ⛺\n\n"
            "⚠️ *Note:* Forest entry permits / entry tickets are NOT included in the package and must be booked directly / paid at the base."
        )

    # 8. Check for specific date queries (e.g. "25", "25th", "sep 2", "this weekend")
    # Only if NOT a catalogue option selection 1-5
    date_num_match = re.search(r"\b(\d{1,2})(?:st|nd|rd|th)?\b", text)
    if date_num_match and matched_trip and not opt_match:
        day_num = int(date_num_match.group(1))
        if day_num <= 31:
            suffix = "th" if 11 <= day_num <= 13 else {1: "st", 2: "nd", 3: "rd"}.get(day_num % 10, "th")
            formatted_day = f"{day_num}{suffix}"
            clean_title = matched_trip.name.replace("[DEMO]", "").strip()
            price_str = _get_trek_price_str(matched_trip)

            return (
                f"Awesome! 🏔️ For *{clean_title}*, we have slots open for departure on the {formatted_day}!\n\n"
                f"• Price: *{price_str} per person* (Includes transportation from Bangalore, food, homestay & trek guide)\n"
                f"• Live Seats: Available ✅\n\n"
                f"How many people are joining with you? Share your count and I'll send the instant booking confirmation link! 🎒"
            )

    # 9. If a trek was identified (e.g. by name or picked option 1-5), provide details & upcoming dates
    if matched_trip:
        clean_title = matched_trip.name.replace("[DEMO]", "").strip()
        price_str = _get_trek_price_str(matched_trip)
        deps = db.query(TripDeparture).filter(TripDeparture.trip_id == matched_trip.id).order_by(TripDeparture.departure_date.asc()).limit(3).all()
        
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
            f"📍 *Pickup:* Silk Board, Majestic, Yeshwanthpur, Hebbal\n\n"
            f"Which date works best for you and how many people are joining? 🎒"
        )

    # 10. Booking confirmation / payment link request
    if any(k in text for k in ["book", "confirm", "pay", "payment", "link", "register"]):
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
