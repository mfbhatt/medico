"""unique phone constraint on users

Revision ID: g3h4i5j6k7l8
Revises: f2a3b4c5d6e7
Create Date: 2026-04-24 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect, text

revision: str = 'g3h4i5j6k7l8'
down_revision: Union[str, None] = ('f2a3b4c5d6e7', 'c4d5e6f7a8b9')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _constraint_exists(table: str, name: str) -> bool:
    result = op.get_bind().execute(
        text("SELECT 1 FROM information_schema.table_constraints WHERE table_name=:t AND constraint_name=:n"),
        {"t": table, "n": name},
    )
    return result.fetchone() is not None


def upgrade() -> None:
    if _constraint_exists('users', 'uq_users_phone'):
        return

    op.execute("""
        UPDATE users
        SET phone = NULL
        WHERE phone IS NOT NULL
          AND id NOT IN (
              SELECT DISTINCT ON (phone) id
              FROM users
              WHERE phone IS NOT NULL
              ORDER BY phone, created_at DESC NULLS LAST
          )
    """)
    op.create_unique_constraint('uq_users_phone', 'users', ['phone'])


def downgrade() -> None:
    if _constraint_exists('users', 'uq_users_phone'):
        op.drop_constraint('uq_users_phone', 'users', type_='unique')
