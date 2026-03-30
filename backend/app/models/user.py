"""User model — global entity, tenant-agnostic.

A single User record represents one real person. Their membership in each
tenant (role, status, clinic assignment) lives in the UserTenant join table.
"""
from datetime import datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import TenantFreeModel


class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    TENANT_ADMIN = "tenant_admin"
    CLINIC_ADMIN = "clinic_admin"
    DOCTOR = "doctor"
    NURSE = "nurse"
    RECEPTIONIST = "receptionist"
    PHARMACIST = "pharmacist"
    LAB_TECHNICIAN = "lab_technician"
    PATIENT = "patient"


class UserStatus(str, Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"
    LOCKED = "locked"
    PENDING_VERIFICATION = "pending_verification"


class User(TenantFreeModel):
    """
    Global user record — not tied to any single tenant.
    Tenant-specific fields (role, status, clinic) live in UserTenant.
    """
    __tablename__ = "users"

    # Identity
    email: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True, index=True, unique=True
    )
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Profile
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    middle_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    gender: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    date_of_birth: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)  # YYYY-MM-DD
    profile_photo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Platform-level admin flag — bypasses tenant membership requirement
    is_super_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Auth verification
    is_email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    is_phone_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    mfa_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    mfa_secret: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Platform-level refresh token (used only for super_admin sessions)
    refresh_token_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Security tracking (global, not per-tenant)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_login_ip: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    failed_login_attempts: Mapped[int] = mapped_column(default=0)
    locked_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # FCM / push notification token
    fcm_token: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Preferences
    language: Mapped[str] = mapped_column(String(5), default="en")
    notification_preferences: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON

    # Tenant memberships (one User → many UserTenant records)
    tenant_memberships: Mapped[List["UserTenant"]] = relationship(
        "UserTenant", back_populates="user", cascade="all, delete-orphan"
    )

    # Other relationships
    doctor_profile: Mapped[Optional["Doctor"]] = relationship(
        "Doctor", back_populates="user", uselist=False
    )
    patient_profile: Mapped[Optional["Patient"]] = relationship(
        "Patient", back_populates="user", uselist=False
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship("AuditLog", back_populates="user")

    @property
    def full_name(self) -> str:
        parts = [self.first_name, self.middle_name, self.last_name]
        return " ".join(p for p in parts if p)

    def __repr__(self) -> str:
        return f"<User {self.email or self.phone}>"
