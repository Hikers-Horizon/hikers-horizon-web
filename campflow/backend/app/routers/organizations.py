import uuid
import logging
from typing import Optional
from pydantic import BaseModel, EmailStr
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import httpx

from app.database import get_db
from app.deps import get_current_context, CurrentContext, require_role
from app.models import User, OrganizationMember
from app.models.enums import UserRole
from app.security import hash_password, generate_token

router = APIRouter(prefix="/api/organizations", tags=["organizations"])
logger = logging.getLogger("campflow.organizations")


class InviteMemberRequest(BaseModel):
    email: EmailStr
    full_name: str
    role: UserRole = UserRole.STAFF


class AISettingsUpdate(BaseModel):
    ai_auto_reply_enabled: Optional[bool] = None
    ai_system_prompt: Optional[str] = None
    whatsapp_phone_number_id: Optional[str] = None
    whatsapp_business_account_id: Optional[str] = None
    whatsapp_webhook_verify_token: Optional[str] = None
    whatsapp_access_token: Optional[str] = None
    instagram_page_id: Optional[str] = None
    instagram_access_token: Optional[str] = None


class WhatsAppTestRequest(BaseModel):
    phone_number_id: str
    access_token: str


def _mask(token: Optional[str]) -> Optional[str]:
    """Never return the raw token to the client after it's saved; show a masked hint instead."""
    if not token:
        return None
    return f"••••{token[-4:]}" if len(token) > 4 else "••••"


def _ai_settings_out(org):
    return {
        "ai_auto_reply_enabled": org.ai_auto_reply_enabled,
        "ai_system_prompt": org.ai_system_prompt,
        "whatsapp_phone_number_id": org.whatsapp_phone_number_id,
        "whatsapp_business_account_id": org.whatsapp_business_account_id,
        "whatsapp_webhook_verify_token": org.whatsapp_webhook_verify_token,
        "whatsapp_access_token_set": bool(org.whatsapp_access_token),
        "whatsapp_access_token_hint": _mask(org.whatsapp_access_token),
        "instagram_page_id": org.instagram_page_id,
        "instagram_access_token_set": bool(org.instagram_access_token),
        "instagram_access_token_hint": _mask(org.instagram_access_token),
    }


@router.get("/ai-settings")
def get_ai_settings(ctx: CurrentContext = Depends(get_current_context)):
    return _ai_settings_out(ctx.organization)


@router.put("/ai-settings")
def update_ai_settings(
    payload: AISettingsUpdate,
    ctx: CurrentContext = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    org = ctx.organization
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(org, field, value)
    db.commit()
    db.refresh(org)
    return _ai_settings_out(org)


@router.post("/whatsapp-test")
def test_whatsapp_connection(
    payload: WhatsAppTestRequest,
    ctx: CurrentContext = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
):
    """Validates WhatsApp credentials by calling Meta Graph API to fetch the phone number profile.
    Returns the connected display name and verified status on success."""
    url = f"https://graph.facebook.com/v19.0/{payload.phone_number_id}"
    headers = {"Authorization": f"Bearer {payload.access_token}"}
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.get(url, headers=headers, params={"fields": "display_phone_number,verified_name,quality_rating"})
            if resp.status_code == 401:
                return {"connected": False, "error": "Invalid or expired access token. Please generate a new one from Meta Developer Console."}
            if resp.status_code == 400:
                data = resp.json()
                error_msg = data.get("error", {}).get("message", "Invalid Phone Number ID")
                return {"connected": False, "error": error_msg}
            resp.raise_for_status()
            data = resp.json()
            return {
                "connected": True,
                "display_phone_number": data.get("display_phone_number", ""),
                "verified_name": data.get("verified_name", ""),
                "quality_rating": data.get("quality_rating", ""),
            }
    except httpx.TimeoutException:
        return {"connected": False, "error": "Connection timed out. Please try again."}
    except Exception as e:  # noqa: BLE001
        logger.exception("WhatsApp connection test failed")
        return {"connected": False, "error": str(e)}


@router.get("/members")
def list_members(ctx: CurrentContext = Depends(get_current_context), db: Session = Depends(get_db)):
    members = db.query(OrganizationMember).filter(OrganizationMember.organization_id == ctx.organization.id).all()
    result = []
    for m in members:
        user = db.query(User).filter(User.id == m.user_id).first()
        result.append({"id": m.id, "user_id": user.id, "email": user.email, "full_name": user.full_name, "role": m.role})
    return result


@router.post("/members", status_code=201)
def invite_member(
    payload: InviteMemberRequest,
    ctx: CurrentContext = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    """Creates a user (invite flow simplified for MVP: temp password + email verification token)."""
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing and db.query(OrganizationMember).filter(
        OrganizationMember.user_id == existing.id, OrganizationMember.organization_id == ctx.organization.id
    ).first():
        raise HTTPException(status_code=400, detail="User already a member of this organization")

    if not existing:
        temp_password = generate_token()[:16]
        existing = User(email=payload.email, full_name=payload.full_name, hashed_password=hash_password(temp_password))
        db.add(existing)
        db.flush()
        # NOTE: email `temp_password` (or a set-password link) to the invited user in production.

    member = OrganizationMember(organization_id=ctx.organization.id, user_id=existing.id, role=payload.role)
    db.add(member)
    db.commit()
    return {"status": "invited", "user_id": existing.id}


@router.delete("/members/{member_id}")
def remove_member(
    member_id: uuid.UUID,
    ctx: CurrentContext = Depends(require_role(UserRole.OWNER, UserRole.ADMIN)),
    db: Session = Depends(get_db),
):
    member = db.query(OrganizationMember).filter(
        OrganizationMember.id == member_id, OrganizationMember.organization_id == ctx.organization.id
    ).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    if member.role == UserRole.OWNER:
        raise HTTPException(status_code=400, detail="Cannot remove the organization owner")
    db.delete(member)
    db.commit()
    return {"status": "removed"}
