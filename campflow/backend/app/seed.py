"""Development-only seed script with clearly fictional demo data.

Run with: python -m app.seed
DO NOT run against a production database.
"""
import datetime
from decimal import Decimal
from app.database import SessionLocal, engine, Base
from app.models import (
    Organization, User, OrganizationMember, Customer, Lead, Trip, TripDeparture,
    Booking, BookingParticipant, Payment, MessageTemplate, Plan,
)
from app.models.enums import UserRole, LeadStatus, LeadSource, TripStatus, BookingStatus, PaymentStatus
from app.security import hash_password


def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(Organization).filter(Organization.slug == "demo-treks").first():
            print("Demo data already exists. Skipping.")
            return

        for slug, name, price in [("starter", "Starter", 499), ("growth", "Growth", 999), ("pro", "Pro", 1999)]:
            db.add(Plan(name=name, slug=slug, price_monthly=Decimal(price)))

        org = Organization(name="[DEMO] Malenadu Treks", slug="demo-treks")
        db.add(org)
        db.flush()

        owner = User(email="owner@demo-treks.example", full_name="[DEMO] Asha Rao (Owner)", hashed_password=hash_password("Demo1234!"), is_email_verified=True)
        staff = User(email="staff@demo-treks.example", full_name="[DEMO] Vikram Shetty (Staff)", hashed_password=hash_password("Demo1234!"), is_email_verified=True)
        db.add_all([owner, staff])
        db.flush()
        db.add(OrganizationMember(organization_id=org.id, user_id=owner.id, role=UserRole.OWNER))
        db.add(OrganizationMember(organization_id=org.id, user_id=staff.id, role=UserRole.STAFF))

        templates = [
            ("New enquiry", "ENQUIRY", "Hi {{name}}, thanks for your interest in {{trek}}. We have departures available on {{date}}. Would you like me to share the itinerary and pricing?"),
            ("Follow-up", "FOLLOW_UP", "Hi {{name}}, just checking if you'd like to confirm your {{trek}} booking for {{date}}."),
            ("Payment reminder", "PAYMENT_REMINDER", "Hi {{name}}, your remaining balance for {{trek}} is \u20b9{{amount}}. Please complete the payment before {{date}}."),
            ("Booking confirmation", "BOOKING_CONFIRMATION", "Your {{trek}} booking is confirmed! \U0001F389"),
        ]
        for name, category, body in templates:
            db.add(MessageTemplate(organization_id=org.id, name=name, category=category, body=body))

        trek_configs = [
            ("[DEMO] Kudremukha Trek", Decimal("3499")),
            ("[DEMO] Netravati Trek", Decimal("3499")),
            ("[DEMO] Gokarna Coastal Trek", Decimal("3499")),
            ("[DEMO] Kumara Parvatha Trek", Decimal("3299")),
            ("[DEMO] Skandagiri Night Trek", Decimal("1499")),
        ]
        trips = []
        for tname, tprice in trek_configs:
            t = Trip(organization_id=org.id, name=tname, pickup_location="[DEMO] Bengaluru", price=tprice)
            db.add(t)
            trips.append(t)
        db.flush()

        departures = []
        for i, t in enumerate(trips):
            dep = TripDeparture(
                organization_id=org.id, trip_id=t.id,
                departure_date=datetime.date.today() + datetime.timedelta(days=10 + i * 5),
                return_date=datetime.date.today() + datetime.timedelta(days=11 + i * 5),
                capacity=30, status=TripStatus.OPEN,
            )
            db.add(dep)
            departures.append(dep)
        db.flush()

        customer_names = ["[DEMO] Rahul Kumar", "[DEMO] Anjali Nair", "[DEMO] Kiran Gowda", "[DEMO] Priya Menon", "[DEMO] Suresh Bhat"]
        customers = []
        for i, cname in enumerate(customer_names):
            c = Customer(organization_id=org.id, full_name=cname, phone=f"+9198765432{i}0", email=f"demo.customer{i}@example.com")
            db.add(c)
            customers.append(c)
        db.flush()

        sources = [LeadSource.WHATSAPP, LeadSource.INSTAGRAM, LeadSource.WEBSITE, LeadSource.GOOGLE, LeadSource.REFERRAL, LeadSource.PHONE, LeadSource.FACEBOOK, LeadSource.WALK_IN, LeadSource.OTHER, LeadSource.WHATSAPP]
        statuses = [LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.INTERESTED, LeadStatus.PAYMENT_PENDING, LeadStatus.CONFIRMED, LeadStatus.FOLLOW_UP, LeadStatus.LOST, LeadStatus.NEW, LeadStatus.CONTACTED, LeadStatus.CONFIRMED]
        leads = []
        for i in range(10):
            c = customers[i % len(customers)]
            t = trips[i % len(trips)]
            lead = Lead(
                organization_id=org.id, customer_id=c.id, trip_id=t.id, trek_name=t.name,
                preferred_departure=departures[i % len(departures)].departure_date,
                num_people=(i % 4) + 1, source=sources[i], status=statuses[i],
                estimated_value=Decimal(3299 * ((i % 4) + 1)), assigned_to=staff.id,
                next_follow_up_at=datetime.datetime.utcnow() + datetime.timedelta(hours=i),
            )
            db.add(lead)
            leads.append(lead)
        db.flush()

        for i in range(8):
            lead = leads[i]
            dep = departures[i % len(departures)]
            booking = Booking(
                organization_id=org.id, booking_code=f"TH-2026-{i+1:05d}", customer_id=lead.customer_id,
                lead_id=lead.id, trip_id=dep.trip_id, departure_id=dep.id, num_participants=lead.num_people,
                total_amount=lead.estimated_value, amount_paid=lead.estimated_value / 2,
                status=BookingStatus.CONFIRMED, payment_status=PaymentStatus.PARTIAL,
                payment_deadline=dep.departure_date - datetime.timedelta(days=5),
            )
            db.add(booking)
            db.flush()
            db.add(Payment(organization_id=org.id, booking_id=booking.id, amount=booking.amount_paid, method="upi"))

        db.commit()
        print("Seed complete. Login: owner@demo-treks.example / Demo1234! (org: demo-treks)")
    finally:
        db.close()


if __name__ == "__main__":
    run()
