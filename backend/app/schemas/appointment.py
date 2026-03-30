"""Appointment and waitlist schemas."""
from typing import List, Optional

from app.models.appointment import (
    AppointmentPriority,
    AppointmentStatus,
    AppointmentType,
)
from app.schemas.base import AuditSchema, BaseSchema


class AppointmentCreate(BaseSchema):
    patient_id: str
    doctor_id: str
    clinic_id: str
    room_id: Optional[str] = None
    appointment_date: str   # YYYY-MM-DD
    start_time: str         # HH:MM
    duration_minutes: int = 15
    timezone: str = "UTC"
    appointment_type: AppointmentType = AppointmentType.IN_PERSON
    priority: AppointmentPriority = AppointmentPriority.ROUTINE
    chief_complaint: Optional[str] = None
    visit_type: str = "new"  # new, follow_up, emergency
    is_first_visit: bool = True
    referred_by_doctor_id: Optional[str] = None
    is_walk_in: bool = False
    internal_notes: Optional[str] = None
    patient_notes: Optional[str] = None
    recurrence_rule: Optional[dict] = None


class AppointmentUpdate(BaseSchema):
    appointment_date: Optional[str] = None
    start_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    room_id: Optional[str] = None
    status: Optional[AppointmentStatus] = None
    priority: Optional[AppointmentPriority] = None
    chief_complaint: Optional[str] = None
    visit_type: Optional[str] = None
    internal_notes: Optional[str] = None
    patient_notes: Optional[str] = None


class AppointmentCancelRequest(BaseSchema):
    reason: str
    charge_cancellation_fee: bool = False


class AppointmentRescheduleRequest(BaseSchema):
    new_date: str   # YYYY-MM-DD
    new_start_time: str  # HH:MM
    reason: Optional[str] = None


class CheckInRequest(BaseSchema):
    queue_number: Optional[int] = None


class AppointmentResponse(AuditSchema):
    id: str
    tenant_id: str
    patient_id: str
    doctor_id: str
    clinic_id: str
    room_id: Optional[str] = None
    appointment_date: str
    start_time: str
    end_time: str
    duration_minutes: int
    timezone: str
    status: str
    appointment_type: str
    priority: str
    chief_complaint: Optional[str] = None
    visit_type: str
    is_first_visit: bool
    referred_by_doctor_id: Optional[str] = None
    checked_in_at: Optional[str] = None
    consultation_started_at: Optional[str] = None
    consultation_ended_at: Optional[str] = None
    checked_out_at: Optional[str] = None
    cancelled_at: Optional[str] = None
    cancellation_reason: Optional[str] = None
    cancellation_fee_charged: bool
    rescheduled_from_id: Optional[str] = None
    reschedule_count: int
    recurrence_id: Optional[str] = None
    recurrence_rule: Optional[dict] = None
    video_room_id: Optional[str] = None
    video_room_url: Optional[str] = None
    video_session_started: bool
    is_walk_in: bool
    queue_number: Optional[int] = None
    internal_notes: Optional[str] = None
    patient_notes: Optional[str] = None
    reminder_24h_sent: bool
    reminder_2h_sent: bool
    invoice_id: Optional[str] = None


class AppointmentSummary(BaseSchema):
    id: str
    patient_id: str
    doctor_id: str
    clinic_id: str
    appointment_date: str
    start_time: str
    end_time: str
    status: str
    appointment_type: str
    priority: str
    chief_complaint: Optional[str] = None
    is_walk_in: bool


# ── Waitlist ───────────────────────────────────────────────────────────────


class WaitlistCreate(BaseSchema):
    patient_id: str
    doctor_id: str
    clinic_id: str
    preferred_date_from: str
    preferred_date_until: Optional[str] = None
    preferred_time_from: Optional[str] = None
    preferred_time_until: Optional[str] = None
    priority: AppointmentPriority = AppointmentPriority.ROUTINE
    chief_complaint: Optional[str] = None


class WaitlistResponse(AuditSchema):
    id: str
    tenant_id: str
    patient_id: str
    doctor_id: str
    clinic_id: str
    preferred_date_from: str
    preferred_date_until: Optional[str] = None
    preferred_time_from: Optional[str] = None
    preferred_time_until: Optional[str] = None
    priority: str
    chief_complaint: Optional[str] = None
    position: int
    status: str
    offered_appointment_id: Optional[str] = None
    offer_expires_at: Optional[str] = None
