"""add is_current to user_tenants

Revision ID: d7e8f9a0b1c2
Revises: c3f1a2b4d5e6
Create Date: 2026-04-10 10:00:00.000000

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = 'd7e8f9a0b1c2'
down_revision: Union[str, None] = 'c3f1a2b4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'user_tenants',
        sa.Column('is_current', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade() -> None:
    op.drop_column('user_tenants', 'is_current')
