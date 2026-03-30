"""Billing, invoicing, and payment models."""
from enum import Enum
from typing import List, Optional

from sqlalchemy import Boolean, Float, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class InvoiceStatus(str, Enum):
    DRAFT = "draft"
    ISSUED = "issued"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    OVERDUE = "overdue"
    WRITTEN_OFF = "written_off"
    VOIDED = "voided"


class PaymentMethod(str, Enum):
    CASH = "cash"
    CARD = "card"
    INSURANCE = "insurance"
    BANK_TRANSFER = "bank_transfer"
    ONLINE = "online"
    CHEQUE = "cheque"
    WALLET = "wallet"


class ClaimStatus(str, Enum):
    PENDING = "pending"
    SUBMITTED = "submitted"
    PROCESSING = "processing"
    APPROVED = "approved"
    PARTIALLY_APPROVED = "partially_approved"
    DENIED = "denied"
    APPEALED = "appealed"
    PAID = "paid"


class Invoice(BaseModel):
    """Main invoice for a patient visit or service."""
    __tablename__ = "invoices"

    invoice_number: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True
    )
    appointment_id: Mapped[Optional[str]] = mapped_column(
        String(36), nullable=True
    )
    clinic_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("clinics.id", ondelete="CASCADE"), nullable=False
    )
    doctor_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("doctors.id", ondelete="SET NULL"), nullable=True
    )

    status: Mapped[str] = mapped_column(
        String(20), default=InvoiceStatus.DRAFT, nullable=False
    )

    issue_date: Mapped[str] = mapped_column(String(10), nullable=False)
    due_date: Mapped[str] = mapped_column(String(10), nullable=False)

    # Amounts (in cents to avoid float issues — or use Decimal)
    subtotal: Mapped[float] = mapped_column(Float, default=0.0)
    discount_amount: Mapped[float] = mapped_column(Float, default=0.0)
    discount_reason: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    tax_amount: Mapped[float] = mapped_column(Float, default=0.0)
    tax_rate: Mapped[float] = mapped_column(Float, default=0.0)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0)
    paid_amount: Mapped[float] = mapped_column(Float, default=0.0)
    balance_due: Mapped[float] = mapped_column(Float, default=0.0)

    # Insurance
    insurance_policy_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("insurance_policies.id", ondelete="SET NULL"), nullable=True
    )
    insurance_amount: Mapped[float] = mapped_column(Float, default=0.0)
    copay_amount: Mapped[float] = mapped_column(Float, default=0.0)
    patient_responsibility: Mapped[float] = mapped_column(Float, default=0.0)

    # Currency
    currency: Mapped[str] = mapped_column(String(3), default="USD")

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    terms: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # PDF path in blob storage
    pdf_url: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # Relationships
    items: Mapped[List["InvoiceItem"]] = relationship(
        "InvoiceItem", back_populates="invoice", cascade="all, delete-orphan"
    )
    payments: Mapped[List["Payment"]] = relationship(
        "Payment", back_populates="invoice"
    )
    insurance_claim: Mapped[Optional["InsuranceClaim"]] = relationship(
        "InsuranceClaim", back_populates="invoice", uselist=False
    )

    def __repr__(self) -> str:
        return f"<Invoice {self.invoice_number} ${self.total_amount}>"


class InvoiceItem(BaseModel):
    __tablename__ = "invoice_items"

    invoice_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False
    )
    description: Mapped[str] = mapped_column(String(300), nullable=False)
    item_type: Mapped[str] = mapped_column(String(30), nullable=False)
    # consultation, procedure, lab, medication, room, misc

    cpt_code: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    quantity: Mapped[float] = mapped_column(Float, default=1.0)
    unit_price: Mapped[float] = mapped_column(Float, nullable=False)
    discount_percent: Mapped[float] = mapped_column(Float, default=0.0)
    tax_percent: Mapped[float] = mapped_column(Float, default=0.0)
    line_total: Mapped[float] = mapped_column(Float, nullable=False)

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="items")


class Payment(BaseModel):
    __tablename__ = "payments"

    invoice_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True
    )
    patient_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("patients.id", ondelete="CASCADE"), nullable=False
    )

    payment_date: Mapped[str] = mapped_column(String(10), nullable=False)
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    payment_method: Mapped[str] = mapped_column(String(20), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="USD")

    # For card/online payments
    transaction_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    gateway: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)  # stripe, etc.
    gateway_response: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    status: Mapped[str] = mapped_column(String(20), default="completed")
    # pending, completed, failed, refunded, partially_refunded

    refund_amount: Mapped[float] = mapped_column(Float, default=0.0)
    refund_reason: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    refunded_at: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    received_by: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="payments")

    def __repr__(self) -> str:
        return f"<Payment ${self.amount} via {self.payment_method}>"


class InsuranceClaim(BaseModel):
    __tablename__ = "insurance_claims"

    invoice_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("invoices.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    insurance_policy_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("insurance_policies.id", ondelete="CASCADE"), nullable=False
    )

    claim_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default=ClaimStatus.PENDING)

    submitted_at: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    claim_amount: Mapped[float] = mapped_column(Float, nullable=False)
    approved_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    paid_amount: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    paid_at: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    denial_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    denial_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    eob_data: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # Explanation of Benefits
    appeal_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    appeal_submitted_at: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="insurance_claim")
