"""Tenant schemas."""
from datetime import datetime
from typing import Optional

from pydantic import EmailStr

from app.models.tenant import SubscriptionPlan, TenantStatus
from app.schemas.base import BaseSchema, TimestampSchema


class TenantCreate(BaseSchema):
    name: str
    slug: str
    primary_email: EmailStr
    primary_phone: Optional[str] = None
    address: Optional[str] = None
    country: str = "US"
    timezone: str = "UTC"
    subscription_plan: SubscriptionPlan = SubscriptionPlan.BASIC


class TenantUpdate(BaseSchema):
    name: Optional[str] = None
    primary_email: Optional[EmailStr] = None
    primary_phone: Optional[str] = None
    address: Optional[str] = None
    country: Optional[str] = None
    timezone: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    custom_domain: Optional[str] = None
    settings: Optional[dict] = None
    features: Optional[dict] = None


class TenantResponse(TimestampSchema):
    id: str
    name: str
    slug: str
    status: str
    subscription_plan: str
    subscription_expires_at: Optional[datetime] = None
    primary_email: str
    primary_phone: Optional[str] = None
    address: Optional[str] = None
    country: str
    timezone: str
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    custom_domain: Optional[str] = None
    max_clinics: int
    max_doctors: int
    max_patients: int
    features: Optional[dict] = None
    settings: Optional[dict] = None


class TenantSummary(BaseSchema):
    id: str
    name: str
    slug: str
    status: str
    subscription_plan: str
