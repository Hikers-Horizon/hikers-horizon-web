from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_platform_admin
from app.models import Organization, Plan, Subscription, User

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/organizations", dependencies=[Depends(require_platform_admin)])
def list_organizations(db: Session = Depends(get_db)):
    """Platform admin view: org metadata + subscription status only, never customer data."""
    orgs = db.query(Organization).all()
    return [
        {
            "id": o.id, "name": o.name, "slug": o.slug, "is_active": o.is_active,
            "subscription_status": o.subscription_status,
        }
        for o in orgs
    ]


@router.post("/organizations/{org_id}/toggle-active", dependencies=[Depends(require_platform_admin)])
def toggle_active(org_id: str, db: Session = Depends(get_db)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if org:
        org.is_active = not org.is_active
        db.commit()
    return {"is_active": org.is_active if org else None}


@router.get("/plans", dependencies=[Depends(require_platform_admin)])
def list_plans(db: Session = Depends(get_db)):
    return db.query(Plan).all()


@router.get("/health")
def system_health():
    return {"status": "ok"}
