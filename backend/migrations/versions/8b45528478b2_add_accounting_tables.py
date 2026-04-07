"""add accounting tables

Revision ID: 8b45528478b2
Revises: a1f3c8e92b04
Create Date: 2026-04-06 21:27:42.943104

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '8b45528478b2'
down_revision: Union[str, None] = 'a1f3c8e92b04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use raw DDL with IF NOT EXISTS — tables may already exist if DB was seeded via create_all
    op.execute("""
        CREATE TABLE IF NOT EXISTS account_groups (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            name VARCHAR(100) NOT NULL,
            slug VARCHAR(60) NOT NULL,
            nature VARCHAR(10) NOT NULL,
            parent_id VARCHAR(36) REFERENCES account_groups(id) ON DELETE SET NULL,
            is_system BOOLEAN NOT NULL DEFAULT FALSE,
            order_index INTEGER NOT NULL DEFAULT 0,
            tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            created_by VARCHAR(36),
            updated_by VARCHAR(36),
            is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
            deleted_at TIMESTAMPTZ,
            deleted_by VARCHAR(36),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_account_group_tenant_slug UNIQUE (tenant_id, slug)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_account_groups_tenant_id ON account_groups (tenant_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS accounts (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            account_group_id VARCHAR(36) NOT NULL REFERENCES account_groups(id) ON DELETE RESTRICT,
            name VARCHAR(150) NOT NULL,
            code VARCHAR(30),
            account_type VARCHAR(20) NOT NULL,
            opening_balance DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            opening_balance_type VARCHAR(5) NOT NULL DEFAULT 'dr',
            is_system BOOLEAN NOT NULL DEFAULT FALSE,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            description TEXT,
            bank_name VARCHAR(150),
            bank_account_number VARCHAR(50),
            tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            created_by VARCHAR(36),
            updated_by VARCHAR(36),
            is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
            deleted_at TIMESTAMPTZ,
            deleted_by VARCHAR(36),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_account_tenant_name UNIQUE (tenant_id, name)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_accounts_tenant_id ON accounts (tenant_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS vouchers (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            voucher_number VARCHAR(40) NOT NULL,
            voucher_type VARCHAR(20) NOT NULL,
            voucher_date VARCHAR(10) NOT NULL,
            narration TEXT,
            reference VARCHAR(100),
            total_amount DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            is_posted BOOLEAN NOT NULL DEFAULT TRUE,
            source_type VARCHAR(50),
            source_id VARCHAR(36),
            tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            created_by VARCHAR(36),
            updated_by VARCHAR(36),
            is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
            deleted_at TIMESTAMPTZ,
            deleted_by VARCHAR(36),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_voucher_tenant_number UNIQUE (tenant_id, voucher_number)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_vouchers_tenant_id ON vouchers (tenant_id)")

    op.execute("""
        CREATE TABLE IF NOT EXISTS voucher_lines (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            voucher_id VARCHAR(36) NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
            account_id VARCHAR(36) NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
            debit_amount DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            credit_amount DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            narration VARCHAR(300),
            tenant_id VARCHAR(36) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            created_by VARCHAR(36),
            updated_by VARCHAR(36),
            is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
            deleted_at TIMESTAMPTZ,
            deleted_by VARCHAR(36),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_voucher_lines_tenant_id ON voucher_lines (tenant_id)")

    # Also allow phone to be nullable on patients (detected by autogenerate)
    op.execute("ALTER TABLE patients ALTER COLUMN phone DROP NOT NULL")


def downgrade() -> None:
    op.execute("ALTER TABLE patients ALTER COLUMN phone SET NOT NULL")
    op.execute("DROP TABLE IF EXISTS voucher_lines")
    op.execute("DROP TABLE IF EXISTS voucher_lines")
    op.execute("DROP TABLE IF EXISTS vouchers")
    op.execute("DROP TABLE IF EXISTS accounts")
    op.execute("DROP TABLE IF EXISTS account_groups")
