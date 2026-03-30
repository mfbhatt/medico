"""add_platform_config_table

Revision ID: a1f3c8e92b04
Revises: dac9da5957bc
Create Date: 2026-03-28 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1f3c8e92b04'
down_revision: Union[str, None] = 'dac9da5957bc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'platform_config',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('settings', sa.JSON(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.String(50), nullable=True),
        sa.Column('updated_at', sa.String(50), nullable=True),
    )
    # Seed the single default row
    op.execute(
        "INSERT INTO platform_config (id, settings) VALUES ('default', '{}')"
    )


def downgrade() -> None:
    op.drop_table('platform_config')
