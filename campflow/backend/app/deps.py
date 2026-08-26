import uuid
from typing import Optional
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.database import get_db
from app.security import decode_token
from app.models import User, OrganizationMember, Organization
from app.models.enums import UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

ROLE_RANK = {UserRole.STAFF: 1, UserRole.ADMIN: 2, UserRole.OWNER: 3}


class CurrentContext:
    def __init__(self, user: User, organization: Organization, role: UserRole):
        self.user = user
        self.organization = organization
        self.role = role


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = db.query(User).filter(User.id == uuid.UUID(user_id)).first()
    if user is None or not user.is_active:
        raise credentials_exception
    return user


def get_current_context(
    x_organization_id: Optional[str] = Header(default=None, alias="X-Organization-Id"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CurrentContext:
    """Resolves the active organization for the request and enforces membership.

    The organization is selected via the `X-Organization-Id` header. This guarantees
    strict tenant isolation: every request must explicitly resolve to a membership
    row owned by the authenticated user.
    """
    if not x_organization_id:
        raise HTTPException(status_code=400, detail="X-Organization-Id header is required")

    try:
        org_uuid = uuid.UUID(x_organization_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid organization id")

    membership = (
        db.query(OrganizationMember)
        .filter(OrganizationMember.user_id == user.id, OrganizationMember.organization_id == org_uuid)
        .first()
    )
    if not membership:
        raise HTTPException(status_code=403, detail="You do not have access to this organization")

    org = db.query(Organization).filter(Organization.id == org_uuid).first()
    if not org or not org.is_active:
        raise HTTPException(status_code=403, detail="Organization is inactive")

    return CurrentContext(user=user, organization=org, role=membership.role)


def require_role(*allowed_roles: UserRole):
    def dependency(ctx: CurrentContext = Depends(get_current_context)) -> CurrentContext:
        if ctx.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return ctx

    return dependency


def require_platform_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_platform_admin:
        raise HTTPException(status_code=403, detail="Platform admin access required")
    return user
