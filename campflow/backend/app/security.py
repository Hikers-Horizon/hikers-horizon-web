import uuid
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    if not plain or not hashed:
        return False
    try:
        return pwd_context.verify(plain, hashed)
    except Exception:
        # Fallback to direct bcrypt check if passlib fails on certain salt formats
        try:
            import bcrypt
            hashed_bytes = hashed.encode("utf-8") if isinstance(hashed, str) else hashed
            return bcrypt.checkpw(plain.encode("utf-8"), hashed_bytes)
        except Exception:
            return False


def create_access_token(user_id: str, organization_id: Optional[str] = None, role: Optional[str] = None) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {
        "sub": str(user_id),
        "org": str(organization_id) if organization_id else None,
        "role": role,
        "exp": expire,
        "type": "access",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])


def generate_token() -> str:
    """Random opaque token for email verification / password reset."""
    return uuid.uuid4().hex + uuid.uuid4().hex
