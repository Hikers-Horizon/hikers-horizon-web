# CampFlow (TrekLead) — CRM for Trekking & Adventure Operators

A multi-tenant SaaS CRM built specifically for trekking/adventure-trip operators to
capture leads, automate follow-ups, convert leads to bookings, and track payments.

## Stack

- **Backend**: FastAPI + SQLAlchemy 2.0 + PostgreSQL, JWT auth, Celery + Redis for
  background jobs (follow-up reminders, payment alerts).
- **Frontend**: Next.js 14 (App Router) + Tailwind CSS + Recharts.
- **Integrations**: WhatsApp Business Cloud API (Meta), payment gateway abstraction
  (Razorpay / Cashfree / Stripe).

## Project Structure

```
backend/   FastAPI app (app/), Alembic-ready SQLAlchemy models, routers, services
frontend/  Next.js app (src/app), shared components in src/components, API client in src/lib
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 14+
- Redis (for Celery follow-up/payment reminder jobs)

## Backend Setup

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # macOS/Linux
pip install -r requirements.txt

# Create a .env file (see Environment Variables below)

# Create the database, then run the app (tables are created via SQLAlchemy metadata
# on first run in this scaffold; wire up Alembic migrations for production).
uvicorn app.main:app --reload --port 8000

# Optional: seed demo data
python -m app.seed
```

API docs available at `http://localhost:8000/docs`.

### Background workers (optional, for follow-up/payment reminders)

```bash
celery -A app.celery_app worker --loglevel=info
celery -A app.celery_app beat --loglevel=info
```

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

App available at `http://localhost:3000`.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Default |
|---|---|---|
| `ENV` | `development` / `production` | `development` |
| `SECRET_KEY` | JWT signing secret — **must** be changed in production | `change-me-in-production` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT lifetime | `1440` |
| `ALGORITHM` | JWT algorithm | `HS256` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql+psycopg2://postgres:postgres@localhost:5432/campflow` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379/0` |
| `CELERY_BROKER_URL` | Celery broker | `redis://localhost:6379/1` |
| `CELERY_RESULT_BACKEND` | Celery result backend | `redis://localhost:6379/2` |
| `WHATSAPP_ACCESS_TOKEN` | Meta Cloud API access token | — |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta phone number ID | — |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Meta WABA ID | — |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Webhook verification token you choose | — |
| `WHATSAPP_APP_SECRET` | Meta app secret (webhook signature validation) | — |
| `PAYMENT_PROVIDER` | `razorpay` \| `cashfree` \| `stripe` | `razorpay` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay credentials | — |
| `CASHFREE_APP_ID` / `CASHFREE_SECRET_KEY` | Cashfree credentials | — |
| `FRONTEND_URL` | Used for links in emails/messages | `http://localhost:3000` |
| `CORS_ORIGINS` | Allowed CORS origins (list) | `["http://localhost:3000"]` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` / `EMAIL_FROM` | Transactional email | — |

### Frontend (`frontend/.env.local`)

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Base URL of the backend API | `http://localhost:8000` |

## Core Features

- **Multi-tenant isolation**: every table carries `organization_id`; all queries are
  scoped through `get_current_context` / `get_tenant_db` dependencies so users can
  never see another organization's data.
- **RBAC**: `OWNER`, `ADMIN`, `STAFF` roles gate sensitive actions (payments, org
  settings, user management).
- **Lead pipeline**: `NEW → CONTACTED → INTERESTED → PAYMENT_PENDING → CONFIRMED`
  (or `LOST`), with automatic HOT/WARM/COLD scoring (`app/services/lead_scoring.py`).
- **Follow-ups**: schedule, reschedule, mark-contacted, cancel; dashboard surfaces
  today's due follow-ups.
- **Trips & departures**: capacity tracking, auto OPEN/FULL status, printable
  passenger lists per departure.
- **Bookings & payments**: booking code generation, partial/full payment tracking,
  payment-status auto-recompute, pluggable `PaymentProvider` abstraction.
- **Analytics**: conversion funnel, lead source breakdown, revenue by trek.
- **Global search** across customers, bookings, and trips.

## What's Production-Ready vs Stubbed

- **Production-ready**: schema/tenant isolation, auth, lead/booking/payment business
  logic, RBAC dependencies, follow-up scheduling logic.
- **Needs real credentials before going live**: WhatsApp Cloud API tokens, payment
  gateway keys, SMTP credentials — the code paths are implemented against these
  providers' APIs but require your own account credentials.
- **Recommended before production deploy**: wire up Alembic migrations (currently
  tables are created via SQLAlchemy metadata for dev convenience), add rate limiting
  config (slowapi is included), and configure HTTPS/reverse proxy.
