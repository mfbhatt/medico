"""add_location_tables

Revision ID: i5j6k7l8m9n0
Revises: h4i5j6k7l8m9
Create Date: 2026-05-02 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


revision: str = 'i5j6k7l8m9n0'
down_revision: Union[str, None] = 'h4i5j6k7l8m9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _table_exists(name: str) -> bool:
    return inspect(op.get_bind()).has_table(name)


def upgrade() -> None:
    if _table_exists('countries') and _table_exists('states') and _table_exists('cities'):
        return
    op.create_table(
        'countries',
        sa.Column('code', sa.String(10), primary_key=True),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('state_label', sa.String(50), nullable=False, server_default='State / Region'),
        sa.Column('postal_label', sa.String(50), nullable=False, server_default='Postal Code'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.VARCHAR(50)),
        sa.Column('updated_at', sa.VARCHAR(50)),
    )

    op.create_table(
        'states',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('country_code', sa.String(10), sa.ForeignKey('countries.code', ondelete='CASCADE'), nullable=False),
        sa.Column('code', sa.String(20), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.VARCHAR(50)),
        sa.Column('updated_at', sa.VARCHAR(50)),
        sa.UniqueConstraint('country_code', 'code', name='uq_states_country_code'),
    )
    op.create_index('ix_states_country_code', 'states', ['country_code'])

    op.create_table(
        'cities',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('state_id', sa.String(36), sa.ForeignKey('states.id', ondelete='CASCADE'), nullable=False),
        sa.Column('country_code', sa.String(10), sa.ForeignKey('countries.code', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.VARCHAR(50)),
        sa.Column('updated_at', sa.VARCHAR(50)),
    )
    op.create_index('ix_cities_state_id', 'cities', ['state_id'])
    op.create_index('ix_cities_country_code', 'cities', ['country_code'])


def downgrade() -> None:
    op.drop_index('ix_cities_country_code', table_name='cities')
    op.drop_index('ix_cities_state_id', table_name='cities')
    op.drop_table('cities')
    op.drop_index('ix_states_country_code', table_name='states')
    op.drop_table('states')
    op.drop_table('countries')
