import sys
import os
import datetime
import decimal

backend_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)

from sqlalchemy import text
from app.database import engine, SessionLocal
from app.models import Organization, Customer, Lead, Message, FollowUp, User, OrganizationMember
from app.models.enums import LeadStatus, LeadSource, LeadScore, FollowUpStatus, MessageDirection, UserRole
from app.security import hash_password

def run():
    print("[*] Running database migration...")
    is_sqlite = engine.dialect.name == "sqlite"
    with engine.begin() as conn:
        for tbl in ["customers", "leads"]:
            if is_sqlite:
                try:
                    conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN ai_disabled BOOLEAN DEFAULT 0;"))
                except Exception:
                    pass
            else:
                conn.execute(text(f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS ai_disabled BOOLEAN DEFAULT FALSE;"))
    print("[+] Columns verified!")

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

        # Ensure AI auto-reply is turned OFF (per user request: "i dont want agent as of now")
        hh.ai_auto_reply_enabled = False
        db.commit()
        print(f"[+] AI auto-reply turned OFF for {hh.name}!")

        # Ensure admin user hikershorizon@gmail.com exists with verified credentials
        admin_user = db.query(User).filter(User.email == "hikershorizon@gmail.com").first()
        if not admin_user:
            admin_user = User(
                email="hikershorizon@gmail.com",
                full_name="Hikers Horizon Admin",
                hashed_password=hash_password("Asdf@2003"),
                is_email_verified=True,
                is_active=True,
            )
            db.add(admin_user)
            db.flush()
            print("[+] Created admin user hikershorizon@gmail.com with password Asdf@2003")
        else:
            admin_user.is_active = True
            admin_user.is_email_verified = True
            admin_user.hashed_password = hash_password("Asdf@2003")
            db.flush()
            print(f"[+] Updated password for {admin_user.email} to Asdf@2003!")

        member = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == hh.id,
            OrganizationMember.user_id == admin_user.id,
        ).first()
        if not member:
            member = OrganizationMember(organization_id=hh.id, user_id=admin_user.id, role=UserRole.OWNER)
            db.add(member)
            db.commit()
            print(f"[+] Linked {admin_user.email} as OWNER of {hh.name}!")
        else:
            member.role = UserRole.OWNER
            db.commit()

        # Check if the DB Instagram token is expired or broken (legacy token that expired in August 2026)
        if hh.instagram_access_token and (hh.instagram_access_token.startswith("EAFZC2lreDqngBS") or "EAFZC" in hh.instagram_access_token):
            print(f"[!] Clearing expired legacy Instagram token from {hh.name} to allow platform fallback from .env...")
            hh.instagram_access_token = None
            db.commit()
            print("[+] Expired Instagram token cleared successfully! System will use INSTAGRAM_ACCESS_TOKEN from .env.")

        # Update ai_system_prompt to enforce human-like, no-overaction tone
        HUMAN_TONE_PROMPT = (
            "You are a real human trekking coordinator texting customers on WhatsApp / Instagram for Hikers Horizon (hikershorizon.in). "
            "You are NOT an AI. Location: Yelahanka, Bangalore. Contact: +91 9902653393.\n\n"
            "CRITICAL RULES:\n"
            "1. ZERO OVERACTION: No 'Awesome!', 'Exciting!', 'Perfect!', 'Great choice!', 'Welcome!', 'I'd love to help!', or any bot-like hype.\n"
            "2. ANSWER AND STOP: Answer the question asked. Do NOT append forced follow-up questions like 'Which weekend?' or 'How many people?' to every reply.\n"
            "3. KEEP IT SHORT: 1-2 sentences, under 25 words. Text casually like a real person on a phone. No bullet points, no markdown bold.\n"
            "4. At most 0-1 simple emoji per message.\n"
            "5. Use simple trek names: 'Munnar', 'Kudremukh', 'Gokarna' — not formal full names.\n\n"
            "TREK CATEGORIES: Sunrise (Rs.600-999), 2-Day (Rs.2499-3299), Backpacking (Rs.2550-4000).\n"
            "Cancellation: 30+ days = 75% refund, 15-30 days = 50% credit, <15 days = no refund."
        )
        if hh.ai_system_prompt != HUMAN_TONE_PROMPT:
            hh.ai_system_prompt = HUMAN_TONE_PROMPT
            db.commit()
            print("[+] Updated ai_system_prompt to human-like, no-overaction tone.")

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
            m2 = Message(organization_id=hh.id, customer_id=c1.id, direction=MessageDirection.OUTBOUND, channel="whatsapp", body="Hey! Standard stay is sharing basis. Private rooms can be arranged on request.", status="delivered")
            m3 = Message(organization_id=hh.id, customer_id=c2.id, direction=MessageDirection.INBOUND, channel="instagram", body="Hey! What is the price for Gokarna beach trek?", status="received")
            m4 = Message(organization_id=hh.id, customer_id=c2.id, direction=MessageDirection.OUTBOUND, channel="instagram", body="Gokarna is \u20b93,499 per person, all inclusive.", status="delivered")
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
