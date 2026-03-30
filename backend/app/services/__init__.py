"""Service layer — business logic for all domain areas."""
from app.services.appointment_service import AppointmentService
from app.services.billing_service import BillingService
from app.services.doctor_service import DoctorService
from app.services.inventory_service import InventoryService
from app.services.lab_service import LabService
from app.services.medical_record_service import MedicalRecordService
from app.services.patient_service import PatientService
from app.services.prescription_service import PrescriptionService

__all__ = [
    "AppointmentService",
    "BillingService",
    "DoctorService",
    "InventoryService",
    "LabService",
    "MedicalRecordService",
    "PatientService",
    "PrescriptionService",
]
