import re
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, Organization, OrganizationMember
from app.models.enums import UserRole
from app.schemas.auth import (
    SignupRequest, LoginRequest, TokenResponse, MeResponse, UserOut, OrganizationOut,
    ForgotPasswordRequest, ResetPasswordRequest, VerifyEmailRequest,
)
from app.security import hash_password, verify_password, create_access_token, generate_token
from app.deps import get_current_user
from app.models.org import EmailVerificationToken, PasswordResetToken

router = APIRouter(prefix="/api/auth", tags=["auth"])


def slugify(name: str) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") or "org"
    return base


@router.post("/signup", response_model=TokenResponse)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
    )
    db.add(user)
    db.flush()

    base_slug = slugify(payload.organization_name)
    slug = base_slug
    i = 1
    while db.query(Organization).filter(Organization.slug == slug).first():
        i += 1
        slug = f"{base_slug}-{i}"

    org = Organization(name=payload.organization_name, slug=slug)
    db.add(org)
    db.flush()

    member = OrganizationMember(organization_id=org.id, user_id=user.id, role=UserRole.OWNER)
    db.add(member)

    verification = EmailVerificationToken(user_id=user.id, token=generate_token())
    db.add(verification)

    db.commit()

    # NOTE: In production, send `verification.token` via email (SMTP settings in config).
    token = create_access_token(str(user.id), str(org.id), UserRole.OWNER.value)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    membership = db.query(OrganizationMember).filter(OrganizationMember.user_id == user.id).first()
    org_id = str(membership.organization_id) if membership else None
    role = membership.role.value if membership else None

    token = create_access_token(str(user.id), org_id, role)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=MeResponse)
def me(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    memberships = db.query(OrganizationMember).filter(OrganizationMember.user_id == user.id).all()
    orgs = []
    for m in memberships:
        org = db.query(Organization).filter(Organization.id == m.organization_id).first()
        if org:
            orgs.append(OrganizationOut(id=org.id, name=org.name, slug=org.slug, role=m.role))
    return MeResponse(user=UserOut.model_validate(user), organizations=orgs)


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if user:
        reset = PasswordResetToken(user_id=user.id, token=generate_token())
        db.add(reset)
        db.commit()
        # NOTE: send `reset.token` via email in production.
    # Always return success to avoid leaking which emails are registered.
    return {"message": "If that email exists, a reset link has been sent."}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    reset = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == payload.token, PasswordResetToken.used == False  # noqa: E712
    ).first()
    if not reset:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == reset.user_id).first()
    user.hashed_password = hash_password(payload.new_password)
    reset.used = True
    db.commit()
    return {"message": "Password reset successful"}


@router.post("/verify-email")
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    verification = db.query(EmailVerificationToken).filter(
        EmailVerificationToken.token == payload.token, EmailVerificationToken.used == False  # noqa: E712
    ).first()
    if not verification:
        raise HTTPException(status_code=400, detail="Invalid or expired token")
    user = db.query(User).filter(User.id == verification.user_id).first()
    user.is_email_verified = True
    verification.used = True
    db.commit()
    return {"message": "Email verified"}
