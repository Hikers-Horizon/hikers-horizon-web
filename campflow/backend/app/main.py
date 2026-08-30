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
    from app.database import engine
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


# Serve static assets (availability widget JS, etc.)
import os
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
if os.path.isdir(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")
