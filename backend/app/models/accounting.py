"""Double-entry accounting models: AccountGroup, Account, Voucher, VoucherLine."""
from enum import Enum
from typing import List, Optional

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel


class AccountNature(str, Enum):
    DEBIT = "dr"
    CREDIT = "cr"


class AccountType(str, Enum):
    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    INCOME = "income"
    EXPENSE = "expense"


class VoucherType(str, Enum):
    PAYMENT = "payment"        # Cash/bank paid out (expense payment)
    RECEIPT = "receipt"        # Cash/bank received (from patient)
    JOURNAL = "journal"        # General adjustment
    CONTRA = "contra"          # Cash ↔ Bank transfer
    SALES = "sales"            # Revenue / invoice issued
    PURCHASE = "purchase"      # Purchase / bill received
    CREDIT_NOTE = "credit_note"
    DEBIT_NOTE = "debit_note"


class AccountGroup(BaseModel):
    """Hierarchical grouping of accounts (e.g. Assets > Current Assets)."""
    __tablename__ = "account_groups"

    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(60), nullable=False)
    nature: Mapped[str] = mapped_column(String(10), nullable=False)   # dr / cr
    parent_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("account_groups.id", ondelete="SET NULL"), nullable=True
    )
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    order_index: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    children: Mapped[List["AccountGroup"]] = relationship(
        "AccountGroup", back_populates="parent", foreign_keys=[parent_id]
    )
    parent: Mapped[Optional["AccountGroup"]] = relationship(
        "AccountGroup", back_populates="children", remote_side="AccountGroup.id",
        foreign_keys=[parent_id]
    )
    accounts: Mapped[List["Account"]] = relationship("Account", back_populates="group")

    __table_args__ = (
        UniqueConstraint("tenant_id", "slug", name="uq_account_group_tenant_slug"),
    )


class Account(BaseModel):
    """Individual ledger account (e.g. Cash in Hand, Accounts Receivable)."""
    __tablename__ = "accounts"

    account_group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("account_groups.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    account_type: Mapped[str] = mapped_column(String(20), nullable=False)   # AccountType enum value
    opening_balance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    opening_balance_type: Mapped[str] = mapped_column(String(5), default="dr", nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    bank_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    bank_account_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # Relationships
    group: Mapped["AccountGroup"] = relationship("AccountGroup", back_populates="accounts")
    voucher_lines: Mapped[List["VoucherLine"]] = relationship("VoucherLine", back_populates="account")

    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_account_tenant_name"),
    )


class Voucher(BaseModel):
    """Journal entry header (Payment, Receipt, Journal, Sales, Purchase, etc.)."""
    __tablename__ = "vouchers"

    voucher_number: Mapped[str] = mapped_column(String(40), nullable=False)
    voucher_type: Mapped[str] = mapped_column(String(20), nullable=False)  # VoucherType enum value
    voucher_date: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    narration: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_posted: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Optional link back to source transaction
    source_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)   # "invoice", "payment", "purchase_order"
    source_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    # Relationships
    lines: Mapped[List["VoucherLine"]] = relationship(
        "VoucherLine", back_populates="voucher", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "voucher_number", name="uq_voucher_tenant_number"),
    )


class VoucherLine(BaseModel):
    """Single debit or credit line within a voucher."""
    __tablename__ = "voucher_lines"

    voucher_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("vouchers.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False
    )
    debit_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    credit_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    narration: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)

    # Relationships
    voucher: Mapped["Voucher"] = relationship("Voucher", back_populates="lines")
    account: Mapped["Account"] = relationship("Account", back_populates="voucher_lines")
