from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.routers import (
    auth, customers, leads, follow_ups, trips, bookings, payments,
    dashboard, analytics, whatsapp, instagram, notifications, search,
    organizations, admin, conversations, public,
)

limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])

app = FastAPI(title="CampFlow API", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS: allow frontend + external sites embedding the availability widget
cors_origins = list(settings.CORS_ORIGINS) + [
    "https://hikershorizon.in",
    "https://www.hikershorizon.in",
    "http://hikershorizon.in",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(organizations.router)
app.include_router(customers.router)
app.include_router(leads.router)
app.include_router(follow_ups.router)
app.include_router(trips.router)
app.include_router(bookings.router)
app.include_router(payments.router)
app.include_router(dashboard.router)
app.include_router(analytics.router)
app.include_router(whatsapp.router)
app.include_router(instagram.router)
app.include_router(notifications.router)
app.include_router(search.router)
app.include_router(admin.router)
app.include_router(conversations.router)
app.include_router(public.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "env": settings.ENV}


@app.on_event("startup")
def run_db_migrations():
    from sqlalchemy import text
    from app.database import engine, SessionLocal
    from app.models import Organization, Customer, Lead, Message, FollowUp
    from app.models.enums import LeadStatus, LeadSource, LeadScore, FollowUpStatus, MessageDirection
    import datetime, decimal
    try:
        with engine.begin() as conn:
            conn.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS ai_disabled BOOLEAN DEFAULT FALSE;"))
            conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_disabled BOOLEAN DEFAULT FALSE;"))
            # Auto-assign any Instagram/WhatsApp messages and customers to Hikers Horizon org
            conn.execute(text("""
                DO $$
                DECLARE
                    hh_id UUID;
                BEGIN
                    SELECT id INTO hh_id FROM organizations WHERE slug NOT LIKE '%demo%' AND name NOT LIKE '%[DEMO]%' AND is_active = true LIMIT 1;
                    IF hh_id IS NOT NULL THEN
                        UPDATE customers SET organization_id = hh_id WHERE (instagram_id IS NOT NULL OR phone LIKE 'ig:%') AND organization_id != hh_id;
                        UPDATE leads SET organization_id = hh_id WHERE customer_id IN (SELECT id FROM customers WHERE organization_id = hh_id) AND organization_id != hh_id;
                        UPDATE messages SET organization_id = hh_id WHERE customer_id IN (SELECT id FROM customers WHERE organization_id = hh_id) AND organization_id != hh_id;
                    END IF;
                END $$;
            """))
    except Exception as exc:
        import logging
        logging.getLogger("campflow").warning("Startup migration notice: %s", exc)

    # Ensure Hikers Horizon has initial active leads & chats if empty
    try:
        db = SessionLocal()
        hh = db.query(Organization).filter(Organization.slug == "hikers-horizon").first()
        if hh and db.query(Customer).filter(Customer.organization_id == hh.id).count() == 0:
            c1 = Customer(organization_id=hh.id, full_name="Anamika Sharma", phone="+919902653393", email="anamika@gmail.com")
            c2 = Customer(organization_id=hh.id, full_name="Instagram user (Rohit)", phone="ig:17841470744614901", instagram_id="17841470744614901")
            c3 = Customer(organization_id=hh.id, full_name="Kiran Gowda", phone="+919876543220", email="kiran.g@outlook.com")
            c4 = Customer(organization_id=hh.id, full_name="Priya Menon", phone="+919876543230", email="priya.m@gmail.com")
            db.add_all([c1, c2, c3, c4])
            db.flush()

            m1 = Message(organization_id=hh.id, customer_id=c1.id, direction=MessageDirection.INBOUND, channel="whatsapp", body="Hello in Kodachadri trekking will get 2 separate rooms ?...", status="received")
            m2 = Message(organization_id=hh.id, customer_id=c1.id, direction=MessageDirection.OUTBOUND, channel="whatsapp", body="Hey! Standard stay is sharing (separate for boys & girls). Private rooms can be arranged upon request for couples/families!\n\nHow many people are joining? 🎒", status="delivered")
            m3 = Message(organization_id=hh.id, customer_id=c2.id, direction=MessageDirection.INBOUND, channel="instagram", body="Hey! What is the price for Gokarna beach trek?", status="received")
            m4 = Message(organization_id=hh.id, customer_id=c2.id, direction=MessageDirection.OUTBOUND, channel="instagram", body="Hey! 🏖️ Gokarna Beach Trek is ₹3,499 per person (includes Bangalore transport, beach stay, meals & guide). Which weekend are you planning for? 🌊", status="delivered")
            db.add_all([m1, m2, m3, m4])

            l1 = Lead(organization_id=hh.id, customer_id=c1.id, trek_name="Kodachadri Trek", num_people=2, source=LeadSource.WHATSAPP, status=LeadStatus.INTERESTED, score=LeadScore.HOT, estimated_value=decimal.Decimal("7598"))
            l2 = Lead(organization_id=hh.id, customer_id=c2.id, trek_name="Gokarna Beach Trek", num_people=3, source=LeadSource.INSTAGRAM, status=LeadStatus.CONTACTED, score=LeadScore.WARM, estimated_value=decimal.Decimal("10497"))
            l3 = Lead(organization_id=hh.id, customer_id=c3.id, trek_name="Kudremukha Trek", num_people=4, source=LeadSource.WEBSITE, status=LeadStatus.NEW, score=LeadScore.HOT, estimated_value=decimal.Decimal("13996"))
            l4 = Lead(organization_id=hh.id, customer_id=c4.id, trek_name="Netravathi Trek", num_people=2, source=LeadSource.GOOGLE, status=LeadStatus.PAYMENT_PENDING, score=LeadScore.HOT, estimated_value=decimal.Decimal("6998"))
            db.add_all([l1, l2, l3, l4])
            db.flush()

            f1 = FollowUp(organization_id=hh.id, lead_id=l1.id, due_at=datetime.datetime.utcnow(), status=FollowUpStatus.PENDING, reason="Payment link sent — confirm booking")
            f2 = FollowUp(organization_id=hh.id, lead_id=l4.id, due_at=datetime.datetime.utcnow(), status=FollowUpStatus.PENDING, reason="Collect passenger Govt ID proofs")
            db.add_all([f1, f2])

            db.commit()
        db.close()
    except Exception as exc:
        import logging
        logging.getLogger("campflow").warning("Startup seed notice: %s", exc)


# Serve static assets (availability widget JS, etc.)
import os
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
if os.path.isdir(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
