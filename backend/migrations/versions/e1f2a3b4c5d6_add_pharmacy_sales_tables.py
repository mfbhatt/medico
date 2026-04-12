"""add pharmacy sales tables

Revision ID: e1f2a3b4c5d6
Revises: d7e8f9a0b1c2
Create Date: 2026-04-12 10:00:00.000000

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = 'd7e8f9a0b1c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'pharmacy_sales',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('tenant_id', sa.String(36), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sale_number', sa.String(30), unique=True, nullable=False),
        sa.Column('clinic_id', sa.String(36), sa.ForeignKey('clinics.id', ondelete='CASCADE'), nullable=False),
        sa.Column('patient_id', sa.String(36), sa.ForeignKey('patients.id', ondelete='SET NULL'), nullable=True),
        sa.Column('patient_name', sa.String(200), nullable=True),
        sa.Column('cashier_id', sa.String(36), nullable=False),
        sa.Column('payment_method', sa.String(20), nullable=False, server_default='cash'),
        sa.Column('subtotal', sa.Float(), nullable=False, server_default='0'),
        sa.Column('discount_amount', sa.Float(), nullable=False, server_default='0'),
        sa.Column('tax_amount', sa.Float(), nullable=False, server_default='0'),
        sa.Column('total_amount', sa.Float(), nullable=False),
        sa.Column('paid_amount', sa.Float(), nullable=False),
        sa.Column('change_amount', sa.Float(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(20), nullable=False, server_default='completed'),
        sa.Column('notes', sa.String(500), nullable=True),
        sa.Column('created_by', sa.String(36), nullable=True),
        sa.Column('updated_by', sa.String(36), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_pharmacy_sales_tenant_id', 'pharmacy_sales', ['tenant_id'])
    op.create_index('ix_pharmacy_sales_clinic_id', 'pharmacy_sales', ['clinic_id'])
    op.create_index('ix_pharmacy_sales_patient_id', 'pharmacy_sales', ['patient_id'])
    op.create_index('ix_pharmacy_sales_sale_number', 'pharmacy_sales', ['sale_number'])

    op.create_table(
        'pharmacy_sale_items',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('tenant_id', sa.String(36), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('sale_id', sa.String(36), sa.ForeignKey('pharmacy_sales.id', ondelete='CASCADE'), nullable=False),
        sa.Column('drug_item_id', sa.String(36), sa.ForeignKey('drug_items.id', ondelete='RESTRICT'), nullable=False),
        sa.Column('drug_name', sa.String(200), nullable=False),
        sa.Column('quantity', sa.Integer(), nullable=False),
        sa.Column('unit_price', sa.Float(), nullable=False),
        sa.Column('discount_percent', sa.Float(), nullable=False, server_default='0'),
        sa.Column('line_total', sa.Float(), nullable=False),
        sa.Column('created_by', sa.String(36), nullable=True),
        sa.Column('updated_by', sa.String(36), nullable=True),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_by', sa.String(36), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_pharmacy_sale_items_tenant_id', 'pharmacy_sale_items', ['tenant_id'])
    op.create_index('ix_pharmacy_sale_items_sale_id', 'pharmacy_sale_items', ['sale_id'])


def downgrade() -> None:
    op.drop_table('pharmacy_sale_items')
    op.drop_table('pharmacy_sales')
