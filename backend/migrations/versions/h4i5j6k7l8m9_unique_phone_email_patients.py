"""unique phone and email per tenant on patients

Revision ID: h4i5j6k7l8m9
Revises: g3h4i5j6k7l8
Create Date: 2026-04-24 13:00:00.000000

"""
from typing import Sequence, Union
from alembic import op

revision: str = 'h4i5j6k7l8m9'
down_revision: Union[str, None] = 'g3h4i5j6k7l8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Normalise empty-string phone/email → NULL so the unique index ignores them.
    op.execute("UPDATE patients SET phone = NULL WHERE phone = ''")
    op.execute("UPDATE patients SET email = NULL WHERE email = ''")

    # Deduplicate (tenant_id, phone): keep the record that already has a user_id
    # (the verified one), or the oldest one if none are linked.
    op.execute("""
        WITH ranked AS (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY tenant_id, phone
                       ORDER BY (user_id IS NOT NULL) DESC, created_at ASC NULLS LAST
                   ) AS rn
            FROM patients
            WHERE phone IS NOT NULL
              AND is_deleted = false
        )
        UPDATE patients
        SET phone = NULL
        WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    """)

    # Deduplicate (tenant_id, email): same strategy.
    op.execute("""
        WITH ranked AS (
            SELECT id,
                   ROW_NUMBER() OVER (
                       PARTITION BY tenant_id, email
                       ORDER BY (user_id IS NOT NULL) DESC, created_at ASC NULLS LAST
                   ) AS rn
            FROM patients
            WHERE email IS NOT NULL
              AND is_deleted = false
        )
        UPDATE patients
        SET email = NULL
        WHERE id IN (SELECT id FROM ranked WHERE rn > 1)
    """)

    # Partial unique indexes — NULLs, empty strings, and soft-deleted rows are excluded.
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_tenant_phone
        ON patients (tenant_id, phone)
        WHERE phone IS NOT NULL AND phone != '' AND is_deleted = false
    """)
    op.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_tenant_email
        ON patients (tenant_id, email)
        WHERE email IS NOT NULL AND email != '' AND is_deleted = false
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_patients_tenant_phone")
    op.execute("DROP INDEX IF EXISTS uq_patients_tenant_email")
