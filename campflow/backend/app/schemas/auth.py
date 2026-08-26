import uuid
from pydantic import BaseModel, EmailStr, Field
from app.models.enums import UserRole


class SignupRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    organization_name: str = Field(min_length=1, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class VerifyEmailRequest(BaseModel):
    token: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class OrganizationOut(BaseModel):
    id: uuid.UUID
    name: str
    slug: str
    role: UserRole

    class Config:
        from_attributes = True


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    full_name: str
    is_email_verified: bool

    class Config:
        from_attributes = True


class MeResponse(BaseModel):
    user: UserOut
    organizations: list[OrganizationOut]
