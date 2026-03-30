"""Prescription models — digital prescriptions with drug interaction checking."""
from enum import Enum
from typing import List, Optional

from sqlalchemy import Boolean, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class PrescriptionStatus(str, Enum):
    ACTIVE = "active"
    DISPENSED = "dispensed"
    PARTIALLY_DISPENSED = "partially_dispensed"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    ON_HOLD = "on_hold"


class Prescription(BaseModel):
    """
    Digital prescription created by a doctor during a visit.
    Can contain multiple medications (PrescriptionItem).
    """
    __tablename__ = "prescriptions"

    medical_record_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("medical_records.id", ondelete="SET NULL"), nullable=True
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

    prescription_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(
        String(30), default=PrescriptionStatus.ACTIVE, nullable=False
    )

    prescribed_date: Mapped[str] = mapped_column(String(10), nullable=False)
    expiry_date: Mapped[str] = mapped_column(String(10), nullable=False)
    # Typically 30-90 days for regular, 6 months for chronic conditions

    # Notes
    diagnosis_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    special_instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    dispense_as_written: Mapped[bool] = mapped_column(Boolean, default=False)
    # If True, pharmacist cannot substitute generic

    # Refill tracking
    refills_allowed: Mapped[int] = mapped_column(Integer, default=0)
    refills_used: Mapped[int] = mapped_column(Integer, default=0)

    # E-prescription
    is_electronic: Mapped[bool] = mapped_column(Boolean, default=True)
    ehr_prescription_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Controlled substance
    is_controlled_substance: Mapped[bool] = mapped_column(Boolean, default=False)
    dea_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Drug interaction warnings (checked at time of creation)
    interaction_warnings: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # Digital signature
    is_signed: Mapped[bool] = mapped_column(Boolean, default=False)
    signed_at: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    signature_data: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Base64

    # Dispensing info
    dispensed_at: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    dispensed_by_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    dispensed_clinic_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("clinics.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    medical_record: Mapped[Optional["MedicalRecord"]] = relationship(
        "MedicalRecord", back_populates="prescriptions"
    )
    items: Mapped[List["PrescriptionItem"]] = relationship(
        "PrescriptionItem", back_populates="prescription", cascade="all, delete-orphan"
    )
    refill_requests: Mapped[List["PrescriptionRefillRequest"]] = relationship(
        "PrescriptionRefillRequest", back_populates="prescription"
    )

    @property
    def refills_remaining(self) -> int:
        return max(0, self.refills_allowed - self.refills_used)

    def __repr__(self) -> str:
        return f"<Prescription {self.prescription_number}>"


class PrescriptionItem(BaseModel):
    """Individual medication line item within a prescription."""
    __tablename__ = "prescription_items"

    prescription_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("prescriptions.id", ondelete="CASCADE"), nullable=False
    )

    # Drug information
    drug_name: Mapped[str] = mapped_column(String(200), nullable=False)
    generic_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    drug_code: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)  # NDC / DrugBank ID
    form: Mapped[str] = mapped_column(String(50), nullable=False)
    # tablet, capsule, liquid, injection, cream, inhaler, patch, etc.

    # Dosage
    strength: Mapped[str] = mapped_column(String(50), nullable=False)  # "500mg", "10mg/5ml"
    dose: Mapped[str] = mapped_column(String(50), nullable=False)       # "1 tablet", "5ml"
    frequency: Mapped[str] = mapped_column(String(100), nullable=False)  # "twice daily", "every 8 hours"
    route: Mapped[str] = mapped_column(String(50), nullable=False)      # oral, iv, topical, etc.
    duration: Mapped[str] = mapped_column(String(50), nullable=False)   # "7 days", "1 month"
    quantity: Mapped[str] = mapped_column(String(50), nullable=False)   # "14 tablets"

    # Instructions
    instructions: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    take_with_food: Mapped[Optional[bool]] = mapped_column(nullable=True)
    take_at_bedtime: Mapped[Optional[bool]] = mapped_column(nullable=True)

    # Substitution
    allow_generic: Mapped[bool] = mapped_column(Boolean, default=True)

    # Dispensing
    is_dispensed: Mapped[bool] = mapped_column(Boolean, default=False)
    quantity_dispensed: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    prescription: Mapped["Prescription"] = relationship(
        "Prescription", back_populates="items"
    )


class PrescriptionRefillRequest(BaseModel):
    """Patient request for a prescription refill."""
    __tablename__ = "prescription_refill_requests"

    prescription_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("prescriptions.id", ondelete="CASCADE"), nullable=False
    )
    requested_by: Mapped[str] = mapped_column(String(36), nullable=False)
    requested_at: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    # pending, approved, denied, auto_approved
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    reviewed_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)
    reviewed_at: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    denial_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    prescription: Mapped["Prescription"] = relationship(
        "Prescription", back_populates="refill_requests"
    )
