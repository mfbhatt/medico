"""Medical record (EMR/EHR) and addendum schemas."""
from typing import List, Optional

from app.schemas.base import AuditSchema, BaseSchema


class MedicalRecordCreate(BaseSchema):
    appointment_id: str
    patient_id: str
    doctor_id: str
    clinic_id: str
    visit_date: str  # YYYY-MM-DD
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    vitals: Optional[dict] = None
    diagnoses: Optional[dict] = None
    procedures: Optional[dict] = None
    referrals: Optional[dict] = None
    follow_up_required: bool = False
    follow_up_days: Optional[int] = None
    follow_up_notes: Optional[str] = None
    is_confidential: bool = False


class MedicalRecordUpdate(BaseSchema):
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    vitals: Optional[dict] = None
    diagnoses: Optional[dict] = None
    procedures: Optional[dict] = None
    referrals: Optional[dict] = None
    follow_up_required: Optional[bool] = None
    follow_up_days: Optional[int] = None
    follow_up_notes: Optional[str] = None
    is_confidential: Optional[bool] = None


class MedicalRecordSignRequest(BaseSchema):
    """Request to sign/lock the medical record."""
    confirm: bool = True


class MedicalRecordAddendumCreate(BaseSchema):
    content: str
    reason: Optional[str] = None


class MedicalRecordAddendumResponse(AuditSchema):
    id: str
    record_id: str
    doctor_id: str
    content: str
    reason: Optional[str] = None


class MedicalRecordResponse(AuditSchema):
    id: str
    tenant_id: str
    appointment_id: str
    patient_id: str
    doctor_id: str
    clinic_id: str
    visit_date: str
    subjective: Optional[str] = None
    objective: Optional[str] = None
    assessment: Optional[str] = None
    plan: Optional[str] = None
    vitals: Optional[dict] = None
    diagnoses: Optional[dict] = None
    procedures: Optional[dict] = None
    clinical_alerts: Optional[dict] = None
    referrals: Optional[dict] = None
    attachments: Optional[dict] = None
    follow_up_required: bool
    follow_up_days: Optional[int] = None
    follow_up_notes: Optional[str] = None
    is_signed: bool
    signed_at: Optional[str] = None
    signed_by: Optional[str] = None
    is_locked: bool
    is_confidential: bool
    addenda: List[MedicalRecordAddendumResponse] = []


class MedicalRecordSummary(BaseSchema):
    id: str
    appointment_id: str
    patient_id: str
    doctor_id: str
    visit_date: str
    is_signed: bool
    is_locked: bool
    follow_up_required: bool
