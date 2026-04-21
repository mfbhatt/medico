"""add core inventory tables (drug_items, stock_batches, transactions, purchase orders)

Revision ID: b3c4d5e6f7a8
Revises: f2a3b4c5d6e7
Create Date: 2026-04-21 10:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = 'b3c4d5e6f7a8'
down_revision: Union[str, None] = 'f2a3b4c5d6e7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Common audit columns added to every table
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
    # ── drug_items ────────────────────────────────────────────────
    if not _table_exists('drug_items'):
        op.create_table(
            'drug_items',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('tenant_id', sa.String(36), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
            sa.Column('clinic_id', sa.String(36), sa.ForeignKey('clinics.id', ondelete='CASCADE'), nullable=False),
            sa.Column('name', sa.String(200), nullable=False),
            sa.Column('generic_name', sa.String(200), nullable=True),
            sa.Column('brand_name', sa.String(200), nullable=True),
            sa.Column('drug_code', sa.String(30), nullable=True),
            sa.Column('form', sa.String(50), nullable=False),
            sa.Column('strength', sa.String(50), nullable=False),
            sa.Column('unit', sa.String(20), nullable=False),
            sa.Column('is_controlled', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('schedule_class', sa.String(5), nullable=True),
            sa.Column('category', sa.String(100), nullable=True),
            sa.Column('manufacturer', sa.String(200), nullable=True),
            sa.Column('unit_cost', sa.Float(), nullable=False, server_default='0'),
            sa.Column('selling_price', sa.Float(), nullable=False, server_default='0'),
            sa.Column('reorder_level', sa.Integer(), nullable=False, server_default='10'),
            sa.Column('reorder_quantity', sa.Integer(), nullable=False, server_default='100'),
            sa.Column('max_stock_level', sa.Integer(), nullable=True),
            sa.Column('requires_prescription', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('storage_conditions', sa.String(200), nullable=True),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
            *_AUDIT_COLS,
        )
        op.create_index('ix_drug_items_tenant_id', 'drug_items', ['tenant_id'])
        op.create_index('ix_drug_items_clinic_id', 'drug_items', ['clinic_id'])

    # ── purchase_orders ───────────────────────────────────────────
    if not _table_exists('purchase_orders'):
        op.create_table(
            'purchase_orders',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('tenant_id', sa.String(36), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
            sa.Column('clinic_id', sa.String(36), sa.ForeignKey('clinics.id', ondelete='CASCADE'), nullable=False),
            sa.Column('po_number', sa.String(30), unique=True, nullable=False),
            sa.Column('supplier_name', sa.String(200), nullable=False),
            sa.Column('supplier_contact', sa.String(200), nullable=True),
            sa.Column('status', sa.String(20), nullable=False, server_default='draft'),
            sa.Column('order_date', sa.String(10), nullable=False),
            sa.Column('expected_delivery_date', sa.String(10), nullable=True),
            sa.Column('received_date', sa.String(10), nullable=True),
            sa.Column('total_amount', sa.Float(), nullable=False, server_default='0'),
            sa.Column('notes', sa.Text(), nullable=True),
            *_AUDIT_COLS,
        )
        op.create_index('ix_purchase_orders_tenant_id', 'purchase_orders', ['tenant_id'])
        op.create_index('ix_purchase_orders_clinic_id', 'purchase_orders', ['clinic_id'])
        op.create_index('ix_purchase_orders_po_number', 'purchase_orders', ['po_number'])

    # ── stock_batches ─────────────────────────────────────────────
    if not _table_exists('stock_batches'):
        op.create_table(
            'stock_batches',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('tenant_id', sa.String(36), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
            sa.Column('drug_item_id', sa.String(36), sa.ForeignKey('drug_items.id', ondelete='CASCADE'), nullable=False),
            sa.Column('batch_number', sa.String(50), nullable=False),
            sa.Column('quantity', sa.Integer(), nullable=False),
            sa.Column('quantity_remaining', sa.Integer(), nullable=False),
            sa.Column('unit_cost', sa.Float(), nullable=False),
            sa.Column('expiry_date', sa.String(10), nullable=False),
            sa.Column('manufacture_date', sa.String(10), nullable=True),
            sa.Column('supplier_name', sa.String(200), nullable=True),
            sa.Column('purchase_order_id', sa.String(36), sa.ForeignKey('purchase_orders.id', ondelete='SET NULL'), nullable=True),
            sa.Column('received_date', sa.String(10), nullable=False),
            sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
            sa.Column('sku_code', sa.String(50), nullable=True),
            sa.Column('barcode', sa.String(100), nullable=True),
            *_AUDIT_COLS,
        )
        op.create_index('ix_stock_batches_tenant_id', 'stock_batches', ['tenant_id'])
        op.create_index('ix_stock_batches_drug_item_id', 'stock_batches', ['drug_item_id'])

    # ── stock_transactions ────────────────────────────────────────
    if not _table_exists('stock_transactions'):
        op.create_table(
            'stock_transactions',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('tenant_id', sa.String(36), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
            sa.Column('drug_item_id', sa.String(36), sa.ForeignKey('drug_items.id', ondelete='CASCADE'), nullable=False),
            sa.Column('batch_id', sa.String(36), sa.ForeignKey('stock_batches.id', ondelete='SET NULL'), nullable=True),
            sa.Column('transaction_type', sa.String(20), nullable=False),
            sa.Column('quantity', sa.Integer(), nullable=False),
            sa.Column('quantity_before', sa.Integer(), nullable=False),
            sa.Column('quantity_after', sa.Integer(), nullable=False),
            sa.Column('unit_cost', sa.Float(), nullable=True),
            sa.Column('reference_id', sa.String(36), nullable=True),
            sa.Column('reference_type', sa.String(50), nullable=True),
            sa.Column('notes', sa.String(300), nullable=True),
            sa.Column('performed_by', sa.String(36), nullable=False),
            *_AUDIT_COLS,
        )
        op.create_index('ix_stock_transactions_tenant_id', 'stock_transactions', ['tenant_id'])
        op.create_index('ix_stock_transactions_drug_item_id', 'stock_transactions', ['drug_item_id'])

    # ── purchase_order_items ──────────────────────────────────────
    if not _table_exists('purchase_order_items'):
        op.create_table(
            'purchase_order_items',
            sa.Column('id', sa.String(36), primary_key=True),
            sa.Column('tenant_id', sa.String(36), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
            sa.Column('order_id', sa.String(36), sa.ForeignKey('purchase_orders.id', ondelete='CASCADE'), nullable=False),
            sa.Column('drug_item_id', sa.String(36), sa.ForeignKey('drug_items.id', ondelete='CASCADE'), nullable=False),
            sa.Column('quantity_ordered', sa.Integer(), nullable=False),
            sa.Column('quantity_received', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('unit_cost', sa.Float(), nullable=False),
            sa.Column('line_total', sa.Float(), nullable=False),
            *_AUDIT_COLS,
        )
        op.create_index('ix_purchase_order_items_tenant_id', 'purchase_order_items', ['tenant_id'])
        op.create_index('ix_purchase_order_items_order_id', 'purchase_order_items', ['order_id'])


def downgrade() -> None:
    for table in ('purchase_order_items', 'stock_transactions', 'stock_batches', 'purchase_orders', 'drug_items'):
        if _table_exists(table):
            op.drop_table(table)
