"""Pydantic schemas for request validation and response serialization."""
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentResponse,
    AppointmentSummary,
    AppointmentUpdate,
    WaitlistCreate,
    WaitlistResponse,
)
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    OTPRequest,
    OTPVerifyRequest,
    PasswordResetConfirm,
    PasswordResetRequest,
    RefreshTokenRequest,
    TokenResponse,
)
from app.schemas.base import (
    APIResponse,
    AuditSchema,
    BaseSchema,
    PaginatedResponse,
    PaginationMeta,
    TimestampSchema,
)
from app.schemas.billing import (
    InsuranceClaimCreate,
    InsuranceClaimResponse,
    InvoiceCreate,
    InvoiceResponse,
    InvoiceSummary,
    PaymentCreate,
    PaymentResponse,
)
from app.schemas.clinic import (
    ClinicCreate,
    ClinicResponse,
    ClinicRoomCreate,
    ClinicRoomResponse,
    ClinicSummary,
    ClinicUpdate,
)
from app.schemas.doctor import (
    AvailableSlot,
    DoctorCreate,
    DoctorResponse,
    DoctorScheduleCreate,
    DoctorScheduleExceptionCreate,
    DoctorScheduleResponse,
    DoctorSummary,
    DoctorUpdate,
)
from app.schemas.inventory import (
    DrugItemCreate,
    DrugItemResponse,
    LowStockAlert,
    PurchaseOrderCreate,
    PurchaseOrderResponse,
    StockAdjustmentCreate,
    StockBatchCreate,
    StockBatchResponse,
)
from app.schemas.lab_report import (
    LabOrderCreate,
    LabOrderResponse,
    LabReportCreate,
    LabReportResponse,
    LabReportUpdate,
)
from app.schemas.medical_record import (
    MedicalRecordAddendumCreate,
    MedicalRecordCreate,
    MedicalRecordResponse,
    MedicalRecordSummary,
    MedicalRecordUpdate,
)
from app.schemas.patient import (
    ChronicConditionCreate,
    EmergencyContactCreate,
    InsurancePolicyCreate,
    PatientAllergyCreate,
    PatientCreate,
    PatientResponse,
    PatientSummary,
    PatientUpdate,
)
from app.schemas.prescription import (
    PrescriptionCreate,
    PrescriptionRefillRequestCreate,
    PrescriptionResponse,
    PrescriptionSummary,
    PrescriptionUpdate,
)
from app.schemas.tenant import TenantCreate, TenantResponse, TenantSummary, TenantUpdate
from app.schemas.user import UserCreate, UserResponse, UserSummary, UserUpdate

__all__ = [
    # Base
    "APIResponse", "PaginatedResponse", "PaginationMeta",
    "BaseSchema", "TimestampSchema", "AuditSchema",
    # Auth
    "LoginRequest", "OTPRequest", "OTPVerifyRequest", "TokenResponse",
    "RefreshTokenRequest", "PasswordResetRequest", "PasswordResetConfirm",
    "ChangePasswordRequest",
    # User
    "UserCreate", "UserUpdate", "UserResponse", "UserSummary",
    # Tenant
    "TenantCreate", "TenantUpdate", "TenantResponse", "TenantSummary",
    # Clinic
    "ClinicCreate", "ClinicUpdate", "ClinicResponse", "ClinicSummary",
    "ClinicRoomCreate", "ClinicRoomResponse",
    # Doctor
    "DoctorCreate", "DoctorUpdate", "DoctorResponse", "DoctorSummary",
    "DoctorScheduleCreate", "DoctorScheduleResponse",
    "DoctorScheduleExceptionCreate", "AvailableSlot",
    # Patient
    "PatientCreate", "PatientUpdate", "PatientResponse", "PatientSummary",
    "EmergencyContactCreate", "PatientAllergyCreate",
    "ChronicConditionCreate", "InsurancePolicyCreate",
    # Appointment
    "AppointmentCreate", "AppointmentUpdate", "AppointmentResponse", "AppointmentSummary",
    "WaitlistCreate", "WaitlistResponse",
    # Medical Record
    "MedicalRecordCreate", "MedicalRecordUpdate", "MedicalRecordResponse",
    "MedicalRecordSummary", "MedicalRecordAddendumCreate",
    # Prescription
    "PrescriptionCreate", "PrescriptionUpdate", "PrescriptionResponse",
    "PrescriptionSummary", "PrescriptionRefillRequestCreate",
    # Lab
    "LabOrderCreate", "LabOrderResponse", "LabReportCreate",
    "LabReportUpdate", "LabReportResponse",
    # Billing
    "InvoiceCreate", "InvoiceResponse", "InvoiceSummary",
    "PaymentCreate", "PaymentResponse",
    "InsuranceClaimCreate", "InsuranceClaimResponse",
    # Inventory
    "DrugItemCreate", "DrugItemResponse",
    "StockBatchCreate", "StockBatchResponse", "StockAdjustmentCreate",
    "PurchaseOrderCreate", "PurchaseOrderResponse", "LowStockAlert",
]
