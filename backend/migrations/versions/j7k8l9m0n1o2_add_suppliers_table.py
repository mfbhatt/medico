"""add suppliers table

Revision ID: j7k8l9m0n1o2
Revises: i5j6k7l8m9n0
Create Date: 2026-06-08 10:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = 'j7k8l9m0n1o2'
down_revision: Union[str, None] = 'i5j6k7l8m9n0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_AUDIT_COLS = [
    sa.Column('created_by', sa.String(36), nullable=True),
    sa.Column('updated_by', sa.String(36), nullable=True),
    sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
    sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('deleted_by', sa.String(36), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
]


def _table_exists(name: str) -> bool:
    bind = op.get_bind()
    return inspect(bind).has_table(name)


def upgrade() -> None:
    if not _table_exists('suppliers'):
        op.create_table(
            'suppliers',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('tenant_id', sa.String(36), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
            sa.Column('name', sa.String(200), nullable=False),
            sa.Column('contact_person', sa.String(200), nullable=True),
            sa.Column('phone', sa.String(50), nullable=True),
            sa.Column('email', sa.String(200), nullable=True),
            sa.Column('address', sa.Text(), nullable=True),
            sa.Column('payment_terms', sa.String(100), nullable=True),
            sa.Column('outstanding_balance', sa.Float(), nullable=False, server_default='0'),
            sa.Column('notes', sa.Text(), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
            *_AUDIT_COLS,
        )
        op.create_index('ix_suppliers_tenant_id', 'suppliers', ['tenant_id'])
        op.create_index('ix_suppliers_name', 'suppliers', ['name'])


def downgrade() -> None:
    if _table_exists('suppliers'):
        op.drop_index('ix_suppliers_name', table_name='suppliers')
        op.drop_index('ix_suppliers_tenant_id', table_name='suppliers')
        op.drop_table('suppliers')
