"""
Import all models here so Alembic autogenerate can detect them.
"""
from app.core.database import Base  # noqa: F401

from app.models.tenant import Tenant  # noqa: F401
from app.models.user import User  # noqa: F401
from app.models.user_tenant import UserTenant  # noqa: F401
from app.models.clinic import Clinic, ClinicRoom  # noqa: F401
from app.models.doctor import (  # noqa: F401
    Doctor,
    DoctorClinicAssignment,
    DoctorSchedule,
    DoctorScheduleException,
    DoctorRating,
)
from app.models.patient import (  # noqa: F401
    Patient,
    EmergencyContact,
    PatientAllergy,
    ChronicCondition,
    InsurancePolicy,
    PatientFamilyLink,
)
from app.models.appointment import Appointment, AppointmentWaitlist  # noqa: F401
from app.models.medical_record import MedicalRecord, MedicalRecordAddendum  # noqa: F401
from app.models.prescription import (  # noqa: F401
    Prescription,
    PrescriptionItem,
    PrescriptionRefillRequest,
)
from app.models.lab_report import LabOrder, LabOrderItem, LabReport, LabTestCatalog  # noqa: F401
from app.models.billing import Invoice, InvoiceItem, Payment, InsuranceClaim  # noqa: F401
from app.models.inventory import (  # noqa: F401
    DrugItem,
    StockBatch,
    StockTransaction,
    PurchaseOrder,
    PurchaseOrderItem,
)
from app.models.notification import Notification, AuditLog  # noqa: F401
from app.models.specialization import Specialization  # noqa: F401
from app.models.platform_config import PlatformConfig  # noqa: F401
from app.models.accounting import AccountGroup, Account, Voucher, VoucherLine  # noqa: F401
