"""Doctor schemas: profiles, schedules, exceptions, availability."""
from typing import List, Optional

from app.models.doctor import DayOfWeek
from app.schemas.base import AuditSchema, BaseSchema


# ── Doctor Profile ─────────────────────────────────────────────────────────


class DoctorCreate(BaseSchema):
    user_id: str
    registration_number: str
    registration_council: Optional[str] = None
    registration_expiry: Optional[str] = None
    npi_number: Optional[str] = None
    primary_specialization: str
    secondary_specializations: Optional[dict] = None
    qualifications: Optional[dict] = None
    experience_years: int = 0
    biography: Optional[str] = None
    languages: Optional[dict] = None
    consultation_fee: Optional[float] = None
    follow_up_fee: Optional[float] = None
    default_slot_duration: int = 15
    max_patients_per_day: int = 30
    is_accepting_new_patients: bool = True
    telemedicine_enabled: bool = False


class DoctorUpdate(BaseSchema):
    registration_number: Optional[str] = None
    registration_council: Optional[str] = None
    registration_expiry: Optional[str] = None
    npi_number: Optional[str] = None
    primary_specialization: Optional[str] = None
    secondary_specializations: Optional[dict] = None
    qualifications: Optional[dict] = None
    experience_years: Optional[int] = None
    biography: Optional[str] = None
    languages: Optional[dict] = None
    consultation_fee: Optional[float] = None
    follow_up_fee: Optional[float] = None
    default_slot_duration: Optional[int] = None
    max_patients_per_day: Optional[int] = None
    is_accepting_new_patients: Optional[bool] = None
    telemedicine_enabled: Optional[bool] = None


class DoctorResponse(AuditSchema):
    id: str
    tenant_id: str
    user_id: str
    registration_number: str
    registration_council: Optional[str] = None
    registration_expiry: Optional[str] = None
    npi_number: Optional[str] = None
    primary_specialization: str
    secondary_specializations: Optional[dict] = None
    qualifications: Optional[dict] = None
    experience_years: int
    biography: Optional[str] = None
    languages: Optional[dict] = None
    consultation_fee: Optional[float] = None
    follow_up_fee: Optional[float] = None
    default_slot_duration: int
    max_patients_per_day: int
    is_accepting_new_patients: bool
    telemedicine_enabled: bool
    average_rating: float
    total_ratings: int


class DoctorSummary(BaseSchema):
    id: str
    user_id: str
    primary_specialization: str
    consultation_fee: Optional[float] = None
    average_rating: float
    is_accepting_new_patients: bool
    telemedicine_enabled: bool


# ── Clinic Assignment ──────────────────────────────────────────────────────


class DoctorClinicAssignmentCreate(BaseSchema):
    clinic_id: str
    is_primary_clinic: bool = True
    consultation_fee_override: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


class DoctorClinicAssignmentResponse(AuditSchema):
    id: str
    doctor_id: str
    clinic_id: str
    is_primary_clinic: bool
    consultation_fee_override: Optional[float] = None
    is_active: bool
    start_date: Optional[str] = None
    end_date: Optional[str] = None


# ── Schedule ───────────────────────────────────────────────────────────────


class DoctorScheduleCreate(BaseSchema):
    clinic_id: str
    day_of_week: DayOfWeek
    start_time: str  # HH:MM
    end_time: str    # HH:MM
    slot_duration: int = 15
    break_start: Optional[str] = None
    break_end: Optional[str] = None
    max_appointments: Optional[int] = None
    is_active: bool = True
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None


class DoctorScheduleUpdate(BaseSchema):
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    slot_duration: Optional[int] = None
    break_start: Optional[str] = None
    break_end: Optional[str] = None
    max_appointments: Optional[int] = None
    is_active: Optional[bool] = None
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None


class DoctorScheduleResponse(AuditSchema):
    id: str
    doctor_id: str
    clinic_id: str
    day_of_week: str
    start_time: str
    end_time: str
    slot_duration: int
    break_start: Optional[str] = None
    break_end: Optional[str] = None
    max_appointments: Optional[int] = None
    is_active: bool
    valid_from: Optional[str] = None
    valid_until: Optional[str] = None


# ── Schedule Exception ─────────────────────────────────────────────────────


class DoctorScheduleExceptionCreate(BaseSchema):
    clinic_id: str
    exception_date: str  # YYYY-MM-DD
    exception_type: str  # day_off, leave, extra_hours, modified_hours, emergency_leave
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    reason: Optional[str] = None
    notify_patients: bool = True
    substitute_doctor_id: Optional[str] = None


class DoctorScheduleExceptionResponse(AuditSchema):
    id: str
    doctor_id: str
    clinic_id: str
    exception_date: str
    exception_type: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    reason: Optional[str] = None
    notify_patients: bool
    substitute_doctor_id: Optional[str] = None


# ── Availability Slot (computed, not stored) ───────────────────────────────


class AvailableSlot(BaseSchema):
    date: str        # YYYY-MM-DD
    start_time: str  # HH:MM
    end_time: str    # HH:MM
    doctor_id: str
    clinic_id: str
    is_available: bool = True


class DoctorAvailabilityRequest(BaseSchema):
    clinic_id: str
    date_from: str  # YYYY-MM-DD
    date_until: str
    appointment_type: Optional[str] = None


# ── Rating ─────────────────────────────────────────────────────────────────


class DoctorRatingCreate(BaseSchema):
    doctor_id: str
    appointment_id: str
    rating: int  # 1-5
    review: Optional[str] = None
    is_anonymous: bool = False


class DoctorRatingResponse(AuditSchema):
    id: str
    doctor_id: str
    patient_id: str
    appointment_id: str
    rating: int
    review: Optional[str] = None
    is_anonymous: bool
    is_approved: bool
