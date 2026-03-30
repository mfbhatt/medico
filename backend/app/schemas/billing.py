"""Billing schemas: invoices, payments, insurance claims."""
from typing import List, Optional

from app.models.billing import ClaimStatus, InvoiceStatus, PaymentMethod
from app.schemas.base import AuditSchema, BaseSchema


class InvoiceItemCreate(BaseSchema):
    description: str
    item_type: str  # consultation, procedure, lab, medication, room, misc
    cpt_code: Optional[str] = None
    quantity: float = 1.0
    unit_price: float
    discount_percent: float = 0.0
    tax_percent: float = 0.0


class InvoiceItemResponse(AuditSchema):
    id: str
    invoice_id: str
    description: str
    item_type: str
    cpt_code: Optional[str] = None
    quantity: float
    unit_price: float
    discount_percent: float
    tax_percent: float
    line_total: float


class InvoiceCreate(BaseSchema):
    patient_id: str
    appointment_id: Optional[str] = None
    clinic_id: str
    doctor_id: Optional[str] = None
    issue_date: str     # YYYY-MM-DD
    due_date: str       # YYYY-MM-DD
    discount_amount: float = 0.0
    discount_reason: Optional[str] = None
    tax_rate: float = 0.0
    insurance_policy_id: Optional[str] = None
    insurance_amount: float = 0.0
    copay_amount: float = 0.0
    currency: str = "USD"
    notes: Optional[str] = None
    terms: Optional[str] = None
    items: List[InvoiceItemCreate]


class InvoiceUpdate(BaseSchema):
    status: Optional[InvoiceStatus] = None
    due_date: Optional[str] = None
    discount_amount: Optional[float] = None
    discount_reason: Optional[str] = None
    tax_rate: Optional[float] = None
    insurance_amount: Optional[float] = None
    copay_amount: Optional[float] = None
    notes: Optional[str] = None
    terms: Optional[str] = None


class PaymentCreate(BaseSchema):
    invoice_id: str
    patient_id: str
    payment_date: str  # YYYY-MM-DD
    amount: float
    payment_method: PaymentMethod
    currency: str = "USD"
    transaction_id: Optional[str] = None
    gateway: Optional[str] = None
    notes: Optional[str] = None
    received_by: Optional[str] = None


class PaymentResponse(AuditSchema):
    id: str
    tenant_id: str
    invoice_id: str
    patient_id: str
    payment_date: str
    amount: float
    payment_method: str
    currency: str
    transaction_id: Optional[str] = None
    gateway: Optional[str] = None
    status: str
    refund_amount: float
    refund_reason: Optional[str] = None
    refunded_at: Optional[str] = None
    notes: Optional[str] = None
    received_by: Optional[str] = None


class InsuranceClaimCreate(BaseSchema):
    invoice_id: str
    insurance_policy_id: str
    claim_amount: float


class InsuranceClaimUpdate(BaseSchema):
    status: Optional[ClaimStatus] = None
    approved_amount: Optional[float] = None
    paid_amount: Optional[float] = None
    paid_at: Optional[str] = None
    denial_reason: Optional[str] = None
    denial_code: Optional[str] = None
    eob_data: Optional[dict] = None
    appeal_notes: Optional[str] = None


class InsuranceClaimResponse(AuditSchema):
    id: str
    tenant_id: str
    invoice_id: str
    insurance_policy_id: str
    claim_number: str
    status: str
    submitted_at: Optional[str] = None
    claim_amount: float
    approved_amount: Optional[float] = None
    paid_amount: Optional[float] = None
    paid_at: Optional[str] = None
    denial_reason: Optional[str] = None
    denial_code: Optional[str] = None
    eob_data: Optional[dict] = None
    appeal_notes: Optional[str] = None
    appeal_submitted_at: Optional[str] = None


class InvoiceResponse(AuditSchema):
    id: str
    tenant_id: str
    invoice_number: str
    patient_id: str
    appointment_id: Optional[str] = None
    clinic_id: str
    doctor_id: Optional[str] = None
    status: str
    issue_date: str
    due_date: str
    subtotal: float
    discount_amount: float
    discount_reason: Optional[str] = None
    tax_amount: float
    tax_rate: float
    total_amount: float
    paid_amount: float
    balance_due: float
    insurance_policy_id: Optional[str] = None
    insurance_amount: float
    copay_amount: float
    patient_responsibility: float
    currency: str
    notes: Optional[str] = None
    terms: Optional[str] = None
    pdf_url: Optional[str] = None
    items: List[InvoiceItemResponse] = []
    payments: List[PaymentResponse] = []
    insurance_claim: Optional[InsuranceClaimResponse] = None


class InvoiceSummary(BaseSchema):
    id: str
    invoice_number: str
    patient_id: str
    status: str
    issue_date: str
    due_date: str
    total_amount: float
    paid_amount: float
    balance_due: float
    currency: str
