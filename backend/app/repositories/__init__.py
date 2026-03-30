"""Repository layer — data access objects for all entities."""
from app.repositories.appointment import AppointmentRepository, WaitlistRepository
from app.repositories.base import BaseRepository
from app.repositories.billing import (
    InsuranceClaimRepository,
    InvoiceRepository,
    PaymentRepository,
)
from app.repositories.clinic import ClinicRepository
from app.repositories.doctor import DoctorRepository
from app.repositories.inventory import (
    DrugItemRepository,
    PurchaseOrderRepository,
    StockBatchRepository,
    StockTransactionRepository,
)
from app.repositories.lab_report import LabOrderRepository, LabReportRepository
from app.repositories.medical_record import MedicalRecordRepository
from app.repositories.patient import PatientRepository
from app.repositories.prescription import PrescriptionRepository
from app.repositories.tenant import TenantRepository
from app.repositories.user import UserRepository

__all__ = [
    "BaseRepository",
    "TenantRepository",
    "UserRepository",
    "ClinicRepository",
    "DoctorRepository",
    "PatientRepository",
    "AppointmentRepository",
    "WaitlistRepository",
    "MedicalRecordRepository",
    "PrescriptionRepository",
    "LabOrderRepository",
    "LabReportRepository",
    "InvoiceRepository",
    "PaymentRepository",
    "InsuranceClaimRepository",
    "DrugItemRepository",
    "StockBatchRepository",
    "StockTransactionRepository",
    "PurchaseOrderRepository",
]
