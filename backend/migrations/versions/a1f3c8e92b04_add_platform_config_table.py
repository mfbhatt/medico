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
    # Use raw SQL with IF NOT EXISTS — table may already exist if DB was created via create_all
    op.execute("""
        CREATE TABLE IF NOT EXISTS platform_config (
            id VARCHAR(36) NOT NULL PRIMARY KEY,
            settings JSON NOT NULL DEFAULT '{}',
            created_at VARCHAR(50),
            updated_at VARCHAR(50)
        )
    """)
    op.execute(
        "INSERT INTO platform_config (id, settings) VALUES ('default', '{}') ON CONFLICT (id) DO NOTHING"
    )


def downgrade() -> None:
    op.drop_table('platform_config')
