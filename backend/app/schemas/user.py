"""User schemas."""
from typing import Optional

from pydantic import EmailStr, field_validator

from app.models.user import UserRole, UserStatus
from app.schemas.base import AuditSchema, BaseSchema


class UserBase(BaseSchema):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None  # YYYY-MM-DD
    language: str = "en"


class UserCreate(UserBase):
    role: UserRole = UserRole.PATIENT
    clinic_id: Optional[str] = None
    password: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_strength(cls, v: Optional[str]) -> Optional[str]:
        if v and len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class UserUpdate(BaseSchema):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    language: Optional[str] = None
    profile_photo_url: Optional[str] = None
    fcm_token: Optional[str] = None
    notification_preferences: Optional[str] = None


class UserResponse(AuditSchema):
    id: str
    tenant_id: Optional[str] = None  # comes from the JWT context, not from User directly
    email: Optional[str] = None
    phone: Optional[str] = None
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[str] = None
    role: str
    status: str
    is_email_verified: bool
    is_phone_verified: bool
    mfa_enabled: bool
    clinic_id: Optional[str] = None
    profile_photo_url: Optional[str] = None
    language: str


class UserSummary(BaseSchema):
    """Lightweight user for embedding in other responses."""
    id: str
    first_name: str
    last_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str
