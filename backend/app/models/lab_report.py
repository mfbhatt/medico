"""Lab order and report models."""
import uuid
from enum import Enum
from typing import List, Optional

from sqlalchemy import Boolean, Float, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.base import AuditMixin, BaseModel


class LabTestCatalog(Base, AuditMixin):
    """
    Global (platform-level) catalog of available lab tests.
    Not tenant-scoped — all tenants share the same catalog.
    """
    __tablename__ = "lab_test_catalog"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    test_name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True, index=True)
    test_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    loinc_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    panel_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # e.g. "Hematology", "Chemistry", "Lipids", "Thyroid", "Cardiac", etc.
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    specimen_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_fasting_required: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    def __repr__(self) -> str:
        return f"<LabTestCatalog {self.test_name}>"


class LabOrderStatus(str, Enum):
    ORDERED = "ordered"
    SPECIMEN_COLLECTED = "specimen_collected"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    REJECTED = "rejected"


class ResultStatus(str, Enum):
    PENDING = "pending"
    PRELIMINARY = "preliminary"
    FINAL = "final"
    CORRECTED = "corrected"
    CANCELLED = "cancelled"


class LabOrder(BaseModel):
    """Lab test order created by a doctor."""
    __tablename__ = "lab_orders"

    medical_record_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("medical_records.id", ondelete="SET NULL"), nullable=True
    )
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ordering_doctor_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False
    )
    clinic_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False
    )

    order_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    order_date: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default=LabOrderStatus.ORDERED)

    # External lab
    lab_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    lab_reference_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    is_external: Mapped[bool] = mapped_column(Boolean, default=False)

    # Specimen
    specimen_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    collected_at: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    collected_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    # Clinical context
    clinical_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    diagnosis_codes: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    is_urgent: Mapped[bool] = mapped_column(Boolean, default=False)
    is_fasting_required: Mapped[bool] = mapped_column(Boolean, default=False)

    # Relationships
    medical_record: Mapped[Optional["MedicalRecord"]] = relationship(
        "MedicalRecord", back_populates="lab_orders"
    )
    items: Mapped[List["LabOrderItem"]] = relationship(
        "LabOrderItem", back_populates="order", cascade="all, delete-orphan"
    )
    report: Mapped[Optional["LabReport"]] = relationship(
        "LabReport", back_populates="order", uselist=False
    )

    def __repr__(self) -> str:
        return f"<LabOrder {self.order_number}>"


class LabOrderItem(BaseModel):
    """Individual test within a lab order."""
    __tablename__ = "lab_order_items"

    order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("lab_orders.id", ondelete="CASCADE"), nullable=False
    )
    test_name: Mapped[str] = mapped_column(String(200), nullable=False)
    test_code: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # LOINC code
    loinc_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    panel_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    # For grouped tests like "Metabolic Panel"

    order: Mapped["LabOrder"] = relationship("LabOrder", back_populates="items")


class LabReport(BaseModel):
    """Results report for a lab order."""
    __tablename__ = "lab_reports"

    order_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("lab_orders.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    ordering_doctor_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False
    )

    report_date: Mapped[str] = mapped_column(String(10), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default=ResultStatus.PENDING)

    # Results
    results: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    # [
    #   {
    #     "test_name": "Glucose",
    #     "loinc_code": "2345-7",
    #     "value": "95",
    #     "unit": "mg/dL",
    #     "reference_range": "70-100",
    #     "flag": "normal",  # normal, high, low, critical_high, critical_low
    #     "interpretation": ""
    #   }
    # ]

    # Critical value handling
    has_critical_values: Mapped[bool] = mapped_column(Boolean, default=False)
    critical_notified_at: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    critical_notified_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    # Interpretation
    overall_interpretation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    pathologist_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reviewed_by_doctor: Mapped[bool] = mapped_column(Boolean, default=False)
    reviewed_at: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Document (scanned PDF)
    report_pdf_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Notification tracking
    patient_notified: Mapped[bool] = mapped_column(Boolean, default=False)
    patient_notified_at: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    doctor_notified: Mapped[bool] = mapped_column(Boolean, default=False)
    doctor_notified_at: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Signed off
    is_signed: Mapped[bool] = mapped_column(Boolean, default=False)
    signed_at: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    signed_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    order: Mapped["LabOrder"] = relationship("LabOrder", back_populates="report")

    def __repr__(self) -> str:
        return f"<LabReport for Order:{self.order_id}>"
