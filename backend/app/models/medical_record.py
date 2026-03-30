"""Electronic Medical Record (EMR/EHR) models."""
from typing import List, Optional

from sqlalchemy import Boolean, Float, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class MedicalRecord(BaseModel):
    """
    Visit note / SOAP note for a single appointment.
    This is the primary EMR record created during/after a consultation.
    """
    __tablename__ = "medical_records"

    appointment_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("appointments.id", ondelete="CASCADE"),
        unique=True, nullable=False
    )
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    doctor_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False, index=True
    )
    clinic_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False
    )

    visit_date: Mapped[str] = mapped_column(String(10), nullable=False)

    # SOAP Notes
    subjective: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Chief complaint, HPI (History of Present Illness), review of systems

    objective: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Physical examination findings, vitals

    assessment: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Diagnoses, differential diagnoses

    plan: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # Treatment plan, medications, referrals, follow-up

    # Vitals (stored at time of visit)
    vitals: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # {
    #   "temperature": {"value": 98.6, "unit": "F"},
    #   "blood_pressure": {"systolic": 120, "diastolic": 80, "unit": "mmHg"},
    #   "pulse": {"value": 72, "unit": "bpm"},
    #   "respiratory_rate": {"value": 16, "unit": "breaths/min"},
    #   "oxygen_saturation": {"value": 98, "unit": "%"},
    #   "weight": {"value": 70, "unit": "kg"},
    #   "height": {"value": 175, "unit": "cm"},
    #   "bmi": 22.9
    # }

    # Diagnoses (ICD-10 coded)
    diagnoses: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # [{"icd10_code": "J06.9", "description": "Acute upper respiratory infection", "type": "primary"}]

    # Procedures performed (CPT coded)
    procedures: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # [{"cpt_code": "99213", "description": "Office visit, established patient"}]

    # Clinical decision support flags
    clinical_alerts: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # Drug interactions, allergy conflicts, critical values

    # Follow-up
    follow_up_required: Mapped[bool] = mapped_column(Boolean, default=False)
    follow_up_days: Mapped[Optional[int]] = mapped_column(nullable=True)
    follow_up_notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Referrals
    referrals: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # [{"specialty": "Cardiology", "reason": "...", "urgency": "routine", "doctor_id": "..."}]

    # Attachments (Azure Blob Storage paths)
    attachments: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # [{"name": "xray.jpg", "url": "...", "type": "xray", "uploaded_at": "..."}]

    # Signature / Lock
    is_signed: Mapped[bool] = mapped_column(Boolean, default=False)
    signed_at: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    signed_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    # Once locked (signed), record cannot be edited (only addenda)

    # Confidentiality
    is_confidential: Mapped[bool] = mapped_column(Boolean, default=False)
    # Marks record as highly sensitive (e.g., mental health, HIV)

    # Relationships
    appointment: Mapped["Appointment"] = relationship(
        "Appointment", back_populates="medical_record"
    )
    patient: Mapped["Patient"] = relationship("Patient", back_populates="medical_records")
    prescriptions: Mapped[List["Prescription"]] = relationship(
        "Prescription", back_populates="medical_record"
    )
    lab_orders: Mapped[List["LabOrder"]] = relationship(
        "LabOrder", back_populates="medical_record"
    )
    addenda: Mapped[List["MedicalRecordAddendum"]] = relationship(
        "MedicalRecordAddendum", back_populates="record", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<MedicalRecord {self.visit_date} P:{self.patient_id}>"


class MedicalRecordAddendum(BaseModel):
    """
    Addendum to a locked medical record.
    Doctors can add notes after signing without modifying the original.
    """
    __tablename__ = "medical_record_addenda"

    record_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("medical_records.id", ondelete="CASCADE"), nullable=False
    )
    doctor_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    record: Mapped["MedicalRecord"] = relationship(
        "MedicalRecord", back_populates="addenda"
    )
