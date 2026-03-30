"""Lab order and report schemas."""
from typing import List, Optional

from app.models.lab_report import LabOrderStatus, ResultStatus
from app.schemas.base import AuditSchema, BaseSchema


class LabOrderItemCreate(BaseSchema):
    test_name: str
    test_code: Optional[str] = None
    loinc_code: Optional[str] = None
    panel_name: Optional[str] = None


class LabOrderItemResponse(AuditSchema):
    id: str
    order_id: str
    test_name: str
    test_code: Optional[str] = None
    loinc_code: Optional[str] = None
    panel_name: Optional[str] = None


class LabOrderCreate(BaseSchema):
    medical_record_id: Optional[str] = None
    patient_id: str
    ordering_doctor_id: str
    clinic_id: str
    order_date: str  # YYYY-MM-DD
    lab_name: Optional[str] = None
    is_external: bool = False
    specimen_type: Optional[str] = None
    clinical_notes: Optional[str] = None
    diagnosis_codes: Optional[dict] = None
    is_urgent: bool = False
    is_fasting_required: bool = False
    items: List[LabOrderItemCreate]


class LabOrderUpdate(BaseSchema):
    status: Optional[LabOrderStatus] = None
    lab_name: Optional[str] = None
    lab_reference_number: Optional[str] = None
    specimen_type: Optional[str] = None
    collected_at: Optional[str] = None
    collected_by: Optional[str] = None
    clinical_notes: Optional[str] = None


class LabOrderResponse(AuditSchema):
    id: str
    tenant_id: str
    order_number: str
    medical_record_id: Optional[str] = None
    patient_id: str
    ordering_doctor_id: str
    clinic_id: str
    order_date: str
    status: str
    lab_name: Optional[str] = None
    lab_reference_number: Optional[str] = None
    is_external: bool
    specimen_type: Optional[str] = None
    collected_at: Optional[str] = None
    collected_by: Optional[str] = None
    clinical_notes: Optional[str] = None
    diagnosis_codes: Optional[dict] = None
    is_urgent: bool
    is_fasting_required: bool
    items: List[LabOrderItemResponse] = []


class LabResultEntry(BaseSchema):
    """Individual test result within a lab report."""
    test_name: str
    loinc_code: Optional[str] = None
    value: str
    unit: Optional[str] = None
    reference_range: Optional[str] = None
    flag: str = "normal"  # normal, high, low, critical_high, critical_low
    interpretation: Optional[str] = None


class LabReportCreate(BaseSchema):
    order_id: str
    patient_id: str
    ordering_doctor_id: str
    report_date: str  # YYYY-MM-DD
    results: List[LabResultEntry]
    has_critical_values: bool = False
    overall_interpretation: Optional[str] = None
    pathologist_notes: Optional[str] = None
    report_pdf_url: Optional[str] = None


class LabReportUpdate(BaseSchema):
    status: Optional[ResultStatus] = None
    results: Optional[List[LabResultEntry]] = None
    has_critical_values: Optional[bool] = None
    overall_interpretation: Optional[str] = None
    pathologist_notes: Optional[str] = None
    report_pdf_url: Optional[str] = None
    reviewed_by_doctor: Optional[bool] = None
    reviewed_at: Optional[str] = None


class LabReportResponse(AuditSchema):
    id: str
    tenant_id: str
    order_id: str
    patient_id: str
    ordering_doctor_id: str
    report_date: str
    status: str
    results: Optional[List[dict]] = None
    has_critical_values: bool
    critical_notified_at: Optional[str] = None
    critical_notified_by: Optional[str] = None
    overall_interpretation: Optional[str] = None
    pathologist_notes: Optional[str] = None
    reviewed_by_doctor: bool
    reviewed_at: Optional[str] = None
    report_pdf_url: Optional[str] = None
    patient_notified: bool
    patient_notified_at: Optional[str] = None
    doctor_notified: bool
    doctor_notified_at: Optional[str] = None
    is_signed: bool
    signed_at: Optional[str] = None
    signed_by: Optional[str] = None
