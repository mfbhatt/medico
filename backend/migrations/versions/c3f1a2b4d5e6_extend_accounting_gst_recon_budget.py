"""extend accounting: fiscal years, GST fields, bank reconciliation, budgets

Revision ID: c3f1a2b4d5e6
Revises: 8b45528478b2
Create Date: 2026-04-08 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = 'c3f1a2b4d5e6'
down_revision: Union[str, None] = '8b45528478b2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Fiscal Years ─────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS fiscal_years (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            name VARCHAR(50) NOT NULL,
            start_date VARCHAR(10) NOT NULL,
            end_date VARCHAR(10) NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            is_closed BOOLEAN NOT NULL DEFAULT FALSE,
            tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            created_by VARCHAR(36),
            updated_by VARCHAR(36),
            is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
            deleted_at TIMESTAMPTZ,
            deleted_by VARCHAR(36),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_fiscal_year_tenant_name UNIQUE (tenant_id, name)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_fiscal_years_tenant_id ON fiscal_years (tenant_id)")

    # ── Bank Reconciliations ─────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS bank_reconciliations (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            account_id VARCHAR(36) NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
            statement_date VARCHAR(10) NOT NULL,
            value_date VARCHAR(10),
            description VARCHAR(300) NOT NULL,
            ref_number VARCHAR(100),
            debit_amount DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            credit_amount DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            balance DOUBLE PRECISION,
            status VARCHAR(20) NOT NULL DEFAULT 'unmatched',
            tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            created_by VARCHAR(36),
            updated_by VARCHAR(36),
            is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
            deleted_at TIMESTAMPTZ,
            deleted_by VARCHAR(36),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_bank_recon_line UNIQUE (tenant_id, account_id, statement_date, ref_number)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_bank_reconciliations_tenant_id ON bank_reconciliations (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_bank_reconciliations_account_id ON bank_reconciliations (account_id)")

    # ── Budgets ──────────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS budgets (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            name VARCHAR(150) NOT NULL,
            fiscal_year_id VARCHAR(36) NOT NULL REFERENCES fiscal_years(id) ON DELETE RESTRICT,
            notes TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            created_by VARCHAR(36),
            updated_by VARCHAR(36),
            is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
            deleted_at TIMESTAMPTZ,
            deleted_by VARCHAR(36),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_budget_tenant_fy_name UNIQUE (tenant_id, fiscal_year_id, name)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_budgets_tenant_id ON budgets (tenant_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS budget_lines (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            budget_id VARCHAR(36) NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
            account_id VARCHAR(36) NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
            period_month INTEGER NOT NULL,
            period_year INTEGER NOT NULL,
            budgeted_amount DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            notes VARCHAR(300),
            tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            created_by VARCHAR(36),
            updated_by VARCHAR(36),
            is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
            deleted_at TIMESTAMPTZ,
            deleted_by VARCHAR(36),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_budget_line UNIQUE (budget_id, account_id, period_month, period_year)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_budget_lines_budget_id ON budget_lines (budget_id)")

    # ── Extend accounts table with GST/TDS fields ────────────────────────────
    op.execute("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(20)")
    op.execute("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS gstin VARCHAR(20)")
    op.execute("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS gst_type VARCHAR(15) NOT NULL DEFAULT 'none'")
    op.execute("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS gst_rate DOUBLE PRECISION NOT NULL DEFAULT 0.0")
    op.execute("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS hsn_sac_code VARCHAR(20)")
    op.execute("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS is_tds_applicable BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tds_rate DOUBLE PRECISION NOT NULL DEFAULT 0.0")
    op.execute("ALTER TABLE accounts ADD COLUMN IF NOT EXISTS tds_section VARCHAR(20)")

    # ── Extend vouchers table with fiscal year + GST totals ──────────────────
    op.execute("ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS fiscal_year_id VARCHAR(36) REFERENCES fiscal_years(id) ON DELETE SET NULL")
    op.execute("ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS party_gstin VARCHAR(20)")
    op.execute("ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS place_of_supply VARCHAR(50)")
    op.execute("ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS is_reverse_charge BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS total_taxable_amount DOUBLE PRECISION NOT NULL DEFAULT 0.0")
    op.execute("ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS total_cgst DOUBLE PRECISION NOT NULL DEFAULT 0.0")
    op.execute("ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS total_sgst DOUBLE PRECISION NOT NULL DEFAULT 0.0")
    op.execute("ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS total_igst DOUBLE PRECISION NOT NULL DEFAULT 0.0")
    op.execute("ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS total_cess DOUBLE PRECISION NOT NULL DEFAULT 0.0")

    # ── Extend voucher_lines with GST breakdown + reconciliation ─────────────
    op.execute("ALTER TABLE voucher_lines ADD COLUMN IF NOT EXISTS hsn_sac_code VARCHAR(20)")
    op.execute("ALTER TABLE voucher_lines ADD COLUMN IF NOT EXISTS gst_rate DOUBLE PRECISION NOT NULL DEFAULT 0.0")
    op.execute("ALTER TABLE voucher_lines ADD COLUMN IF NOT EXISTS taxable_amount DOUBLE PRECISION NOT NULL DEFAULT 0.0")
    op.execute("ALTER TABLE voucher_lines ADD COLUMN IF NOT EXISTS cgst_amount DOUBLE PRECISION NOT NULL DEFAULT 0.0")
    op.execute("ALTER TABLE voucher_lines ADD COLUMN IF NOT EXISTS sgst_amount DOUBLE PRECISION NOT NULL DEFAULT 0.0")
    op.execute("ALTER TABLE voucher_lines ADD COLUMN IF NOT EXISTS igst_amount DOUBLE PRECISION NOT NULL DEFAULT 0.0")
    op.execute("ALTER TABLE voucher_lines ADD COLUMN IF NOT EXISTS cess_amount DOUBLE PRECISION NOT NULL DEFAULT 0.0")
    op.execute("ALTER TABLE voucher_lines ADD COLUMN IF NOT EXISTS tds_amount DOUBLE PRECISION NOT NULL DEFAULT 0.0")
    op.execute("ALTER TABLE voucher_lines ADD COLUMN IF NOT EXISTS tds_section VARCHAR(20)")
    op.execute("ALTER TABLE voucher_lines ADD COLUMN IF NOT EXISTS reconciliation_id VARCHAR(36) REFERENCES bank_reconciliations(id) ON DELETE SET NULL")
    op.execute("ALTER TABLE voucher_lines ADD COLUMN IF NOT EXISTS is_reconciled BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("ALTER TABLE voucher_lines ADD COLUMN IF NOT EXISTS reconciled_date VARCHAR(10)")


def downgrade() -> None:
    # Reverse voucher_lines extensions
    for col in ["reconciled_date", "is_reconciled", "reconciliation_id", "tds_section",
                "tds_amount", "cess_amount", "igst_amount", "sgst_amount", "cgst_amount",
                "taxable_amount", "gst_rate", "hsn_sac_code"]:
        op.execute(f"ALTER TABLE voucher_lines DROP COLUMN IF EXISTS {col}")

    # Reverse vouchers extensions
    for col in ["total_cess", "total_igst", "total_sgst", "total_cgst", "total_taxable_amount",
                "is_reverse_charge", "place_of_supply", "party_gstin", "fiscal_year_id"]:
        op.execute(f"ALTER TABLE vouchers DROP COLUMN IF EXISTS {col}")

    # Reverse accounts extensions
    for col in ["tds_section", "tds_rate", "is_tds_applicable", "hsn_sac_code",
                "gst_rate", "gst_type", "gstin", "ifsc_code"]:
        op.execute(f"ALTER TABLE accounts DROP COLUMN IF EXISTS {col}")

    op.execute("DROP TABLE IF EXISTS budget_lines")
    op.execute("DROP TABLE IF EXISTS budgets")
    op.execute("DROP TABLE IF EXISTS bank_reconciliations")
    op.execute("DROP TABLE IF EXISTS fiscal_years")
