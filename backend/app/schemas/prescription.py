"""Prescription schemas."""
from typing import List, Optional

from app.models.prescription import PrescriptionStatus
from app.schemas.base import AuditSchema, BaseSchema


class PrescriptionItemCreate(BaseSchema):
    drug_name: str
    generic_name: Optional[str] = None
    drug_code: Optional[str] = None
    form: str
    strength: str
    dose: str
    frequency: str
    route: str
    duration: str
    quantity: str
    instructions: Optional[str] = None
    take_with_food: Optional[bool] = None
    take_at_bedtime: Optional[bool] = None
    allow_generic: bool = True


class PrescriptionItemResponse(AuditSchema):
    id: str
    prescription_id: str
    drug_name: str
    generic_name: Optional[str] = None
    drug_code: Optional[str] = None
    form: str
    strength: str
    dose: str
    frequency: str
    route: str
    duration: str
    quantity: str
    instructions: Optional[str] = None
    take_with_food: Optional[bool] = None
    take_at_bedtime: Optional[bool] = None
    allow_generic: bool
    is_dispensed: bool
    quantity_dispensed: Optional[str] = None


class PrescriptionCreate(BaseSchema):
    medical_record_id: Optional[str] = None
    patient_id: str
    doctor_id: str
    clinic_id: str
    prescribed_date: str   # YYYY-MM-DD
    expiry_date: str       # YYYY-MM-DD
    diagnosis_notes: Optional[str] = None
    special_instructions: Optional[str] = None
    dispense_as_written: bool = False
    refills_allowed: int = 0
    is_controlled_substance: bool = False
    dea_number: Optional[str] = None
    items: List[PrescriptionItemCreate]


class PrescriptionUpdate(BaseSchema):
    status: Optional[PrescriptionStatus] = None
    expiry_date: Optional[str] = None
    diagnosis_notes: Optional[str] = None
    special_instructions: Optional[str] = None
    refills_allowed: Optional[int] = None


class PrescriptionDispenseRequest(BaseSchema):
    dispensed_by_id: str
    dispensed_clinic_id: str
    notes: Optional[str] = None


class PrescriptionRefillRequestCreate(BaseSchema):
    notes: Optional[str] = None


class PrescriptionRefillRequestResponse(AuditSchema):
    id: str
    prescription_id: str
    requested_by: str
    requested_at: str
    status: str
    notes: Optional[str] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[str] = None
    denial_reason: Optional[str] = None


class PrescriptionRefillReview(BaseSchema):
    approve: bool
    denial_reason: Optional[str] = None


class PrescriptionResponse(AuditSchema):
    id: str
    tenant_id: str
    prescription_number: str
    medical_record_id: Optional[str] = None
    patient_id: str
    doctor_id: str
    clinic_id: str
    status: str
    prescribed_date: str
    expiry_date: str
    diagnosis_notes: Optional[str] = None
    special_instructions: Optional[str] = None
    dispense_as_written: bool
    refills_allowed: int
    refills_used: int
    refills_remaining: int
    is_electronic: bool
    is_controlled_substance: bool
    dea_number: Optional[str] = None
    interaction_warnings: Optional[dict] = None
    is_signed: bool
    signed_at: Optional[str] = None
    dispensed_at: Optional[str] = None
    dispensed_by_id: Optional[str] = None
    items: List[PrescriptionItemResponse] = []
    refill_requests: List[PrescriptionRefillRequestResponse] = []


class PrescriptionSummary(BaseSchema):
    id: str
    prescription_number: str
    patient_id: str
    doctor_id: str
    status: str
    prescribed_date: str
    expiry_date: str
    is_controlled_substance: bool
    refills_remaining: int
