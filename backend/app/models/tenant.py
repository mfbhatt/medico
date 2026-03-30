"""Tenant model — represents a clinic group/organization."""
import uuid
from datetime import datetime
from enum import Enum
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import TimestampMixin


class TenantStatus(str, Enum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    TRIAL = "trial"
    CANCELLED = "cancelled"


class SubscriptionPlan(str, Enum):
    BASIC = "basic"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"


class Tenant(Base, TimestampMixin):
    """
    Top-level tenant (clinic group / organization).
    Does NOT include TenantMixin — tenants themselves aren't tenant-scoped.
    """
    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String(20), default=TenantStatus.TRIAL, nullable=False
    )
    subscription_plan: Mapped[str] = mapped_column(
        String(20), default=SubscriptionPlan.BASIC, nullable=False
    )
    subscription_expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Contact info
    primary_email: Mapped[str] = mapped_column(String(255), nullable=False)
    primary_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    country: Mapped[str] = mapped_column(String(2), default="US", nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC", nullable=False)

    # Branding
    logo_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    primary_color: Mapped[Optional[str]] = mapped_column(String(7), nullable=True)  # hex
    custom_domain: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Limits (based on plan)
    max_clinics: Mapped[int] = mapped_column(Integer, default=1)
    max_doctors: Mapped[int] = mapped_column(Integer, default=5)
    max_patients: Mapped[int] = mapped_column(Integer, default=1000)

    # Feature flags (tenant-level overrides)
    features: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Settings
    settings: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Relationships
    clinics: Mapped[List["Clinic"]] = relationship(
        "Clinic", back_populates="tenant", cascade="all, delete-orphan"
    )
    memberships: Mapped[List["UserTenant"]] = relationship(
        "UserTenant", back_populates="tenant", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<Tenant {self.slug}: {self.name}>"

    @property
    def is_active(self) -> bool:
        return self.status == TenantStatus.ACTIVE

    def get_feature(self, feature_name: str, default: bool = False) -> bool:
        if self.features and feature_name in self.features:
            return bool(self.features[feature_name])
        return default
