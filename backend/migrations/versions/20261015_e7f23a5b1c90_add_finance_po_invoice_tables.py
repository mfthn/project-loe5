"""add_finance_po_invoice_tables

Revision ID: e7f23a5b1c90
Revises: d5b82e3f9a11
Create Date: 2026-10-15
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'e7f23a5b1c90'
down_revision: str | None = 'd5b82e3f9a11'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'purchase_orders',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('po_number', sa.String(100), nullable=False),
        sa.Column('client_id', sa.UUID(), nullable=False),
        sa.Column('order_id', sa.UUID(), nullable=False),
        sa.Column('supplier_name', sa.String(255), nullable=False),
        sa.Column('status', postgresql.ENUM(
            'DRAFT', 'DISETUJUI', 'DITOLAK', 'DITERIMA_SEBAGIAN', 'SELESAI',
            name='po_status_enum', create_type=True,
        ), nullable=False, server_default='DRAFT'),
        sa.Column('requested_by_user_id', sa.UUID(), nullable=True),
        sa.Column('reviewed_by_user_id', sa.UUID(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['requested_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['reviewed_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('po_number'),
    )
    op.create_index('ix_purchase_orders_client_id', 'purchase_orders', ['client_id'])
    op.create_index('ix_purchase_orders_order_id', 'purchase_orders', ['order_id'])
    op.create_index('ix_purchase_orders_status', 'purchase_orders', ['status'])
    op.create_table(
        'po_lines',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('po_id', sa.UUID(), nullable=False),
        sa.Column('inventory_item_id', sa.UUID(), nullable=False),
        sa.Column('sequence_order', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('qty_ordered', sa.Float(), nullable=False),
        sa.Column('qty_received', sa.Float(), nullable=False, server_default='0'),
        sa.Column('unit_price', sa.Numeric(14, 2), nullable=False),
        sa.ForeignKeyConstraint(['po_id'], ['purchase_orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['inventory_item_id'], ['inventory_items.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_po_lines_po_id', 'po_lines', ['po_id'])
    op.create_table(
        'invoices',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('invoice_number', sa.String(100), nullable=False),
        sa.Column('client_id', sa.UUID(), nullable=False),
        sa.Column('order_id', sa.UUID(), nullable=False),
        sa.Column('amount_total', sa.Numeric(14, 2), nullable=False),
        sa.Column('amount_paid', sa.Numeric(14, 2), nullable=False, server_default='0.00'),
        sa.Column('status', postgresql.ENUM(
            'DRAFT', 'BELUM_BAYAR', 'SEBAGIAN', 'LUNAS', 'DITOLAK',
            name='invoice_status_enum', create_type=True,
        ), nullable=False, server_default='DRAFT'),
        sa.Column('issued_by_user_id', sa.UUID(), nullable=True),
        sa.Column('approved_by_user_id', sa.UUID(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['issued_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['approved_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('invoice_number'),
        sa.UniqueConstraint('order_id'),
    )
    op.create_index('ix_invoices_client_id', 'invoices', ['client_id'])
    op.create_table(
        'invoice_payments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('invoice_id', sa.UUID(), nullable=False),
        sa.Column('amount', sa.Numeric(14, 2), nullable=False),
        sa.Column('recorded_by_user_id', sa.UUID(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('paid_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['recorded_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_invoice_payments_invoice_id', 'invoice_payments', ['invoice_id'])


def downgrade() -> None:
    op.drop_table('invoice_payments')
    op.drop_table('invoices')
    op.drop_table('po_lines')
    op.drop_table('purchase_orders')
    sa.Enum(name='invoice_status_enum').drop(op.get_bind(), checkfirst=True)
    sa.Enum(name='po_status_enum').drop(op.get_bind(), checkfirst=True)
