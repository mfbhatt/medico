"""add features to user_tenants

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-04-12 11:00:00.000000

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = 'f2a3b4c5d6e7'
down_revision: Union[str, None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    cols = [c['name'] for c in inspect(op.get_bind()).get_columns(table)]
    return column in cols


def upgrade() -> None:
    if not _column_exists('user_tenants', 'features'):
        op.add_column(
            'user_tenants',
            sa.Column('features', sa.JSON(), nullable=True),
        )


def downgrade() -> None:
    if _column_exists('user_tenants', 'features'):
        op.drop_column('user_tenants', 'features')
