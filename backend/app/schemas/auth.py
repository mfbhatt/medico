"""Auth schemas: login, token, OTP, password reset."""
from typing import Optional

from pydantic import EmailStr, field_validator

from app.schemas.base import BaseSchema


class LoginRequest(BaseSchema):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: str

    @field_validator("email", "phone", mode="before")
    @classmethod
    def at_least_one_identifier(cls, v, info):
        return v


class OTPRequest(BaseSchema):
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    purpose: str = "login"  # login, verify_phone, verify_email


class OTPVerifyRequest(BaseSchema):
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    otp: str


class TokenResponse(BaseSchema):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  # seconds


class RefreshTokenRequest(BaseSchema):
    refresh_token: str


class PasswordResetRequest(BaseSchema):
    email: EmailStr


class PasswordResetConfirm(BaseSchema):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v


class ChangePasswordRequest(BaseSchema):
    current_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_strength(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        return v
