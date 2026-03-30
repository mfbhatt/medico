"""Clinic and room schemas."""
from typing import Optional

from app.models.clinic import ClinicStatus
from app.schemas.base import AuditSchema, BaseSchema


class ClinicRoomCreate(BaseSchema):
    name: str
    room_type: str  # consultation, treatment, lab
    capacity: int = 1
    is_active: bool = True
    equipment: Optional[dict] = None


class ClinicRoomUpdate(BaseSchema):
    name: Optional[str] = None
    room_type: Optional[str] = None
    capacity: Optional[int] = None
    is_active: Optional[bool] = None
    equipment: Optional[dict] = None


class ClinicRoomResponse(AuditSchema):
    id: str
    clinic_id: str
    name: str
    room_type: str
    capacity: int
    is_active: bool
    equipment: Optional[dict] = None


class ClinicCreate(BaseSchema):
    name: str
    code: Optional[str] = None
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    postal_code: str
    country: str = "US"
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: str = "UTC"
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    operating_hours: Optional[dict] = None
    holidays: Optional[dict] = None
    services: Optional[dict] = None
    appointment_slot_duration: int = 15
    max_advance_booking_days: int = 30
    cancellation_notice_hours: int = 24
    no_show_charge_enabled: bool = False
    no_show_charge_amount: Optional[float] = None


class ClinicUpdate(BaseSchema):
    name: Optional[str] = None
    code: Optional[str] = None
    status: Optional[ClinicStatus] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    operating_hours: Optional[dict] = None
    holidays: Optional[dict] = None
    services: Optional[dict] = None
    appointment_slot_duration: Optional[int] = None
    max_advance_booking_days: Optional[int] = None
    cancellation_notice_hours: Optional[int] = None
    no_show_charge_enabled: Optional[bool] = None
    no_show_charge_amount: Optional[float] = None
    logo_url: Optional[str] = None


class ClinicResponse(AuditSchema):
    id: str
    tenant_id: str
    name: str
    code: Optional[str] = None
    status: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    postal_code: str
    country: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    timezone: str
    phone: Optional[str] = None
    email: Optional[str] = None
    website: Optional[str] = None
    operating_hours: Optional[dict] = None
    holidays: Optional[dict] = None
    services: Optional[dict] = None
    appointment_slot_duration: int
    max_advance_booking_days: int
    cancellation_notice_hours: int
    no_show_charge_enabled: bool
    no_show_charge_amount: Optional[float] = None
    logo_url: Optional[str] = None


class ClinicSummary(BaseSchema):
    id: str
    name: str
    city: str
    state: str
    status: str
    timezone: str
    phone: Optional[str] = None
