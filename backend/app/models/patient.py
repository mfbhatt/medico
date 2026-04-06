"""Patient models — demographics, medical history, contacts."""
from enum import Enum
from typing import List, Optional

from sqlalchemy import Boolean, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class BloodGroup(str, Enum):
    A_POS = "A+"
    A_NEG = "A-"
    B_POS = "B+"
    B_NEG = "B-"
    AB_POS = "AB+"
    AB_NEG = "AB-"
    O_POS = "O+"
    O_NEG = "O-"
    UNKNOWN = "unknown"


class MaritalStatus(str, Enum):
    SINGLE = "single"
    MARRIED = "married"
    DIVORCED = "divorced"
    WIDOWED = "widowed"
    OTHER = "other"


class Patient(BaseModel):
    """
    Full patient profile.
    Linked 1:1 to a User account (for portal access).
    Can also exist without a User account (walk-in patients).
    """
    __tablename__ = "patients"

    user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, unique=True
    )

    # Unique patient identifier (e.g., MRN - Medical Record Number)
    mrn: Mapped[str] = mapped_column(String(20), nullable=False, unique=True, index=True)

    # Demographics
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    middle_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    date_of_birth: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    gender: Mapped[str] = mapped_column(String(10), nullable=False)
    marital_status: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    nationality: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    language: Mapped[str] = mapped_column(String(10), default="en")

    # Contact
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    alternate_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Address
    address_line1: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    country: Mapped[str] = mapped_column(String(2), default="US")

    # Medical identifiers
    national_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # Encrypted
    ssn: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Encrypted

    # Medical basics
    blood_group: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    height_cm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    weight_kg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Flags
    is_minor: Mapped[bool] = mapped_column(Boolean, default=False)
    is_vip: Mapped[bool] = mapped_column(Boolean, default=False)
    is_deceased: Mapped[bool] = mapped_column(Boolean, default=False)
    deceased_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    # Consent tracking
    consent_given: Mapped[bool] = mapped_column(Boolean, default=False)
    consent_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    marketing_opt_in: Mapped[bool] = mapped_column(Boolean, default=False)

    # Preferred doctor/clinic
    preferred_doctor_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("doctors.id", ondelete="SET NULL"), nullable=True
    )
    preferred_clinic_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("clinics.id", ondelete="SET NULL"), nullable=True
    )

    # Relationships
    user: Mapped[Optional["User"]] = relationship("User", back_populates="patient_profile")
    emergency_contacts: Mapped[List["EmergencyContact"]] = relationship(
        "EmergencyContact", back_populates="patient", cascade="all, delete-orphan"
    )
    allergies: Mapped[List["PatientAllergy"]] = relationship(
        "PatientAllergy", back_populates="patient", cascade="all, delete-orphan"
    )
    chronic_conditions: Mapped[List["ChronicCondition"]] = relationship(
        "ChronicCondition", back_populates="patient", cascade="all, delete-orphan"
    )
    insurance_policies: Mapped[List["InsurancePolicy"]] = relationship(
        "InsurancePolicy", back_populates="patient", cascade="all, delete-orphan"
    )
    appointments: Mapped[List["Appointment"]] = relationship(
        "Appointment", back_populates="patient"
    )
    medical_records: Mapped[List["MedicalRecord"]] = relationship(
        "MedicalRecord", back_populates="patient"
    )
    family_members: Mapped[List["PatientFamilyLink"]] = relationship(
        "PatientFamilyLink",
        foreign_keys="PatientFamilyLink.patient_id",
        back_populates="patient",
    )

    @property
    def full_name(self) -> str:
        parts = [self.first_name, self.middle_name, self.last_name]
        return " ".join(p for p in parts if p)

    def __repr__(self) -> str:
        return f"<Patient {self.mrn}: {self.full_name}>"


class EmergencyContact(BaseModel):
    __tablename__ = "emergency_contacts"

    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    relation_type: Mapped[str] = mapped_column(String(50), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    alternate_phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False)

    patient: Mapped["Patient"] = relationship("Patient", back_populates="emergency_contacts")


class PatientAllergy(BaseModel):
    __tablename__ = "patient_allergies"

    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    allergen: Mapped[str] = mapped_column(String(100), nullable=False)
    allergen_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # Types: drug, food, environmental, latex, contrast_media, other
    severity: Mapped[str] = mapped_column(String(20), nullable=False)  # mild, moderate, severe, life_threatening
    reaction: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    onset_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    noted_by_doctor_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("doctors.id", ondelete="SET NULL"), nullable=True
    )

    patient: Mapped["Patient"] = relationship("Patient", back_populates="allergies")


class ChronicCondition(BaseModel):
    __tablename__ = "chronic_conditions"

    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    condition_name: Mapped[str] = mapped_column(String(200), nullable=False)
    icd10_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    diagnosed_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, remission, resolved
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    diagnosed_by_doctor_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("doctors.id", ondelete="SET NULL"), nullable=True
    )

    patient: Mapped["Patient"] = relationship("Patient", back_populates="chronic_conditions")


class InsurancePolicy(BaseModel):
    __tablename__ = "insurance_policies"

    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    insurance_provider: Mapped[str] = mapped_column(String(200), nullable=False)
    policy_number: Mapped[str] = mapped_column(String(100), nullable=False)
    group_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    member_id: Mapped[str] = mapped_column(String(100), nullable=False)
    policy_holder_name: Mapped[str] = mapped_column(String(200), nullable=False)
    relationship_to_patient: Mapped[str] = mapped_column(String(30), default="self")
    valid_from: Mapped[str] = mapped_column(String(10), nullable=False)
    valid_until: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    copay_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    deductible_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    coverage_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    patient: Mapped["Patient"] = relationship("Patient", back_populates="insurance_policies")


class PatientFamilyLink(BaseModel):
    """Links family members (e.g., parent → child)."""
    __tablename__ = "patient_family_links"

    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    related_patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )
    relationship_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # Types: parent, child, spouse, sibling, guardian

    patient: Mapped["Patient"] = relationship(
        "Patient", foreign_keys=[patient_id], back_populates="family_members"
    )
    related_patient: Mapped["Patient"] = relationship(
        "Patient", foreign_keys=[related_patient_id]
    )
