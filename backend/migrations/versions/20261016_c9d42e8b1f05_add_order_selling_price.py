"""add_order_selling_price

Revision ID: c9d42e8b1f05
Revises: b8c21d4a5e77
Create Date: 2026-10-16
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'c9d42e8b1f05'
down_revision: str | None = 'b8c21d4a5e77'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('orders', sa.Column('selling_price', sa.Numeric(14, 2), nullable=True))
    op.add_column('orders', sa.Column(
        'selling_price_status', sa.String(20), nullable=False, server_default='-',
    ))
    op.add_column('orders', sa.Column('selling_price_proposed_by', sa.UUID(), nullable=True))
    op.add_column('orders', sa.Column('selling_price_approved_by', sa.UUID(), nullable=True))
    op.add_column('orders', sa.Column('selling_price_approved_at', sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key(
        'fk_orders_selling_price_proposed_by', 'orders', 'users',
        ['selling_price_proposed_by'], ['id'], ondelete='SET NULL',
    )
    op.create_foreign_key(
        'fk_orders_selling_price_approved_by', 'orders', 'users',
        ['selling_price_approved_by'], ['id'], ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_orders_selling_price_approved_by', 'orders', type_='foreignkey')
    op.drop_constraint('fk_orders_selling_price_proposed_by', 'orders', type_='foreignkey')
    op.drop_column('orders', 'selling_price_approved_at')
    op.drop_column('orders', 'selling_price_approved_by')
    op.drop_column('orders', 'selling_price_proposed_by')
    op.drop_column('orders', 'selling_price_status')
    op.drop_column('orders', 'selling_price')
