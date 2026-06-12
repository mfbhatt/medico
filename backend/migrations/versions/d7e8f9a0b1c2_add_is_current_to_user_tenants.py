"""add is_current to user_tenants

Revision ID: d7e8f9a0b1c2
Revises: c3f1a2b4d5e6
Create Date: 2026-04-10 10:00:00.000000

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = 'd7e8f9a0b1c2'
down_revision: Union[str, None] = 'c3f1a2b4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    cols = [c['name'] for c in inspect(bind).get_columns(table)]
    return column in cols


def upgrade() -> None:
    if not _column_exists('user_tenants', 'is_current'):
        op.add_column(
            'user_tenants',
            sa.Column('is_current', sa.Boolean(), nullable=False, server_default='false'),
        )


def downgrade() -> None:
    if _column_exists('user_tenants', 'is_current'):
        op.drop_column('user_tenants', 'is_current')
