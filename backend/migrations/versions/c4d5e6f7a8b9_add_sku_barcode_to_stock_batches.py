"""add sku_code and barcode columns to stock_batches

Revision ID: c4d5e6f7a8b9
Revises: b3c4d5e6f7a8
Create Date: 2026-04-21 14:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect, text

revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, None] = 'b3c4d5e6f7a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    result = bind.execute(
        text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name=:t AND column_name=:c"
        ),
        {"t": table, "c": column},
    )
    return result.fetchone() is not None


def upgrade() -> None:
    if not _column_exists('stock_batches', 'sku_code'):
        op.add_column('stock_batches', sa.Column('sku_code', sa.String(50), nullable=True))
    if not _column_exists('stock_batches', 'barcode'):
        op.add_column('stock_batches', sa.Column('barcode', sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column('stock_batches', 'barcode')
    op.drop_column('stock_batches', 'sku_code')
