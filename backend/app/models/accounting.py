"""Double-entry accounting models: AccountGroup, Account, Voucher, VoucherLine,
FiscalYear, BankReconciliation, Budget/BudgetLine."""
from enum import Enum
from typing import List, Optional

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, Text, UniqueConstraint, Date
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
    PAYMENT = "payment"
    RECEIPT = "receipt"
    JOURNAL = "journal"
    CONTRA = "contra"
    SALES = "sales"
    PURCHASE = "purchase"
    CREDIT_NOTE = "credit_note"
    DEBIT_NOTE = "debit_note"


class GSTType(str, Enum):
    NONE = "none"
    CGST_SGST = "cgst_sgst"   # Intra-state
    IGST = "igst"              # Inter-state
    EXEMPT = "exempt"          # GST exempt


# ── Fiscal Year ─────────────────────────────────────────────────────────────

class FiscalYear(BaseModel):
    """Financial year (e.g. April 2024 – March 2025 for Indian context)."""
    __tablename__ = "fiscal_years"

    name: Mapped[str] = mapped_column(String(50), nullable=False)          # e.g. "FY 2024-25"
    start_date: Mapped[str] = mapped_column(String(10), nullable=False)    # YYYY-MM-DD
    end_date: Mapped[str] = mapped_column(String(10), nullable=False)      # YYYY-MM-DD
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_closed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_fiscal_year_tenant_name"),
    )


# ── Account Group ────────────────────────────────────────────────────────────

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


# ── Account ──────────────────────────────────────────────────────────────────

class Account(BaseModel):
    """Individual ledger account (e.g. Cash in Hand, Accounts Receivable)."""
    __tablename__ = "accounts"

    account_group_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("account_groups.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    code: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    account_type: Mapped[str] = mapped_column(String(20), nullable=False)
    opening_balance: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    opening_balance_type: Mapped[str] = mapped_column(String(5), default="dr", nullable=False)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Bank account details
    bank_name: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    bank_account_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    ifsc_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # GST fields
    gstin: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)       # For party accounts
    gst_type: Mapped[str] = mapped_column(String(15), default="none", nullable=False)  # GSTType
    gst_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)   # e.g. 18.0
    hsn_sac_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    is_tds_applicable: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    tds_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tds_section: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)  # e.g. "194C"

    group: Mapped["AccountGroup"] = relationship("AccountGroup", back_populates="accounts")
    voucher_lines: Mapped[List["VoucherLine"]] = relationship("VoucherLine", back_populates="account")
    budget_lines: Mapped[List["BudgetLine"]] = relationship("BudgetLine", back_populates="account")

    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_account_tenant_name"),
    )


# ── Voucher ──────────────────────────────────────────────────────────────────

class Voucher(BaseModel):
    """Journal entry header (Payment, Receipt, Journal, Sales, Purchase, etc.)."""
    __tablename__ = "vouchers"

    voucher_number: Mapped[str] = mapped_column(String(40), nullable=False)
    voucher_type: Mapped[str] = mapped_column(String(20), nullable=False)
    voucher_date: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    narration: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reference: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    total_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_posted: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    source_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    source_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)

    # Fiscal year link
    fiscal_year_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("fiscal_years.id", ondelete="SET NULL"), nullable=True
    )

    # GST / tax fields
    party_gstin: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    place_of_supply: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # State code / name
    is_reverse_charge: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    total_taxable_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_cgst: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_sgst: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_igst: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_cess: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    lines: Mapped[List["VoucherLine"]] = relationship(
        "VoucherLine", back_populates="voucher", cascade="all, delete-orphan"
    )
    fiscal_year: Mapped[Optional["FiscalYear"]] = relationship("FiscalYear")

    __table_args__ = (
        UniqueConstraint("tenant_id", "voucher_number", name="uq_voucher_tenant_number"),
    )


# ── Voucher Line ─────────────────────────────────────────────────────────────

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

    # GST breakdown per line
    hsn_sac_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    gst_rate: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    taxable_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    cgst_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    sgst_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    igst_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    cess_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # TDS
    tds_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    tds_section: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    # Bank reconciliation link
    reconciliation_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("bank_reconciliations.id", ondelete="SET NULL"), nullable=True
    )
    is_reconciled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reconciled_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)

    voucher: Mapped["Voucher"] = relationship("Voucher", back_populates="lines")
    account: Mapped["Account"] = relationship("Account", back_populates="voucher_lines")
    reconciliation: Mapped[Optional["BankReconciliation"]] = relationship(
        "BankReconciliation", back_populates="matched_lines"
    )


# ── Bank Reconciliation ───────────────────────────────────────────────────────

class BankReconciliation(BaseModel):
    """Bank statement line imported for reconciliation."""
    __tablename__ = "bank_reconciliations"

    account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False
    )
    statement_date: Mapped[str] = mapped_column(String(10), nullable=False)  # YYYY-MM-DD
    value_date: Mapped[Optional[str]] = mapped_column(String(10), nullable=True)
    description: Mapped[str] = mapped_column(String(300), nullable=False)
    ref_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    debit_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    credit_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    balance: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Reconciliation status
    status: Mapped[str] = mapped_column(String(20), default="unmatched", nullable=False)
    # unmatched | matched | manual_match | exception

    matched_lines: Mapped[List["VoucherLine"]] = relationship(
        "VoucherLine", back_populates="reconciliation"
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "account_id", "statement_date", "ref_number",
                         name="uq_bank_recon_line"),
    )


# ── Budget ────────────────────────────────────────────────────────────────────

class Budget(BaseModel):
    """Annual budget header for a fiscal year."""
    __tablename__ = "budgets"

    name: Mapped[str] = mapped_column(String(150), nullable=False)
    fiscal_year_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("fiscal_years.id", ondelete="RESTRICT"), nullable=False
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    fiscal_year: Mapped["FiscalYear"] = relationship("FiscalYear")
    lines: Mapped[List["BudgetLine"]] = relationship(
        "BudgetLine", back_populates="budget", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("tenant_id", "fiscal_year_id", "name", name="uq_budget_tenant_fy_name"),
    )


class BudgetLine(BaseModel):
    """Monthly budget allocation for an account within a budget."""
    __tablename__ = "budget_lines"

    budget_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False
    )
    account_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("accounts.id", ondelete="RESTRICT"), nullable=False
    )
    period_month: Mapped[int] = mapped_column(Integer, nullable=False)   # 1–12
    period_year: Mapped[int] = mapped_column(Integer, nullable=False)    # e.g. 2024
    budgeted_amount: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(300), nullable=True)

    budget: Mapped["Budget"] = relationship("Budget", back_populates="lines")
    account: Mapped["Account"] = relationship("Account", back_populates="budget_lines")

    __table_args__ = (
        UniqueConstraint("budget_id", "account_id", "period_month", "period_year",
                         name="uq_budget_line"),
    )
