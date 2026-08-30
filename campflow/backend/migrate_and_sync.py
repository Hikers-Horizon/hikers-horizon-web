"""One-click migration and sync script for Lightsail production.
Run on server: python backend/migrate_and_sync.py
"""
import sys
import datetime
import decimal
from sqlalchemy import text
from app.database import engine, SessionLocal
from app.models import Organization, Customer, Lead, Message, FollowUp
from app.models.enums import LeadStatus, LeadSource, LeadScore, FollowUpStatus, MessageDirection

def run():
    print("[*] Running database migration...")
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE customers ADD COLUMN IF NOT EXISTS ai_disabled BOOLEAN DEFAULT FALSE;"))
        conn.execute(text("ALTER TABLE leads ADD COLUMN IF NOT EXISTS ai_disabled BOOLEAN DEFAULT FALSE;"))
    print("[+] Columns verified on PostgreSQL!")

    db = SessionLocal()
    try:
        # Find Hikers Horizon organization
        hh = db.query(Organization).filter(
            Organization.slug == "hikers-horizon"
        ).first()
        if not hh:
            hh = db.query(Organization).filter(
                Organization.name.ilike("%hikers%")
            ).first()
        if not hh:
            hh = db.query(Organization).filter(
                Organization.is_active == True,
                ~Organization.slug.contains("demo")
            ).first()

        if not hh:
            print("[!] Hikers Horizon organization not found, creating it...")
            hh = Organization(name="Hikers Horizon", slug="hikers-horizon", is_active=True)
            db.add(hh)
            db.flush()

        print(f"[+] Active Organization: {hh.name} (ID: {hh.id})")

        # Re-link all customers, messages, and leads to Hikers Horizon
        cust_updated = db.query(Customer).filter(Customer.organization_id != hh.id).update({"organization_id": hh.id}, synchronize_session=False)
        msg_updated = db.query(Message).filter(Message.organization_id != hh.id).update({"organization_id": hh.id}, synchronize_session=False)
        lead_updated = db.query(Lead).filter(Lead.organization_id != hh.id).update({"organization_id": hh.id}, synchronize_session=False)
        fu_updated = db.query(FollowUp).filter(FollowUp.organization_id != hh.id).update({"organization_id": hh.id}, synchronize_session=False)
        db.commit()
        print(f"[+] Re-linked to {hh.name}: {cust_updated} customers, {msg_updated} messages, {lead_updated} leads.")

        # If zero customers exist, seed starter threads
        total_customers = db.query(Customer).filter(Customer.organization_id == hh.id).count()
        if total_customers == 0:
            print("[*] Seeding starter conversations for Hikers Horizon...")
            c1 = Customer(organization_id=hh.id, full_name="Anamika Sharma", phone="+919902653393", email="anamika@gmail.com")
            c2 = Customer(organization_id=hh.id, full_name="Instagram user (Rohit)", phone="ig:17841470744614901", instagram_id="17841470744614901")
            c3 = Customer(organization_id=hh.id, full_name="Kiran Gowda", phone="+919876543220", email="kiran.g@outlook.com")
            db.add_all([c1, c2, c3])
            db.flush()

            m1 = Message(organization_id=hh.id, customer_id=c1.id, direction=MessageDirection.INBOUND, channel="whatsapp", body="Hello in Kodachadri trekking will get 2 separate rooms ?...", status="received")
            m2 = Message(organization_id=hh.id, customer_id=c1.id, direction=MessageDirection.OUTBOUND, channel="whatsapp", body="Hey! Standard stay is sharing. Private rooms can be arranged upon request!\n\nHow many people are joining? 🎒", status="delivered")
            m3 = Message(organization_id=hh.id, customer_id=c2.id, direction=MessageDirection.INBOUND, channel="instagram", body="Hey! What is the price for Gokarna beach trek?", status="received")
            m4 = Message(organization_id=hh.id, customer_id=c2.id, direction=MessageDirection.OUTBOUND, channel="instagram", body="Hey! 🏖️ Gokarna Beach Trek is ₹3,499 per person. Which weekend are you planning for? 🌊", status="delivered")
            db.add_all([m1, m2, m3, m4])

            l1 = Lead(organization_id=hh.id, customer_id=c1.id, trek_name="Kodachadri Trek", num_people=2, source=LeadSource.WHATSAPP, status=LeadStatus.INTERESTED, score=LeadScore.HOT, estimated_value=decimal.Decimal("7598"))
            l2 = Lead(organization_id=hh.id, customer_id=c2.id, trek_name="Gokarna Beach Trek", num_people=3, source=LeadSource.INSTAGRAM, status=LeadStatus.CONTACTED, score=LeadScore.WARM, estimated_value=decimal.Decimal("10497"))
            db.add_all([l1, l2])
            db.commit()
            print("[+] Starter threads created successfully!")

        final_c = db.query(Customer).filter(Customer.organization_id == hh.id).count()
        final_m = db.query(Message).filter(Message.organization_id == hh.id).count()
        print(f"[+] SUCCESS! Total in Hikers Horizon Inbox: {final_c} Customers, {final_m} Messages.")
    finally:
        db.close()

if __name__ == "__main__":
    run()
