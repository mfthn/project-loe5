"""add_po_confirmation_and_payments

Revision ID: d4e56f7a8b12
Revises: c9d42e8b1f05
Create Date: 2026-10-16
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'd4e56f7a8b12'
down_revision: str | None = 'c9d42e8b1f05'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

PO_STATUSES = ('DRAFT', 'TERKONFIRMASI', 'DISETUJUI', 'DITOLAK', 'DITERIMA_SEBAGIAN', 'SELESAI')


def upgrade() -> None:
    op.execute("ALTER TYPE po_status_enum ADD VALUE IF NOT EXISTS 'TERKONFIRMASI'")
    op.create_table(
        'po_payments',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('po_id', sa.UUID(), nullable=False),
        sa.Column('amount', sa.Numeric(14, 2), nullable=False),
        sa.Column('recorded_by_user_id', sa.UUID(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('paid_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['po_id'], ['purchase_orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['recorded_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_po_payments_po_id', 'po_payments', ['po_id'])


def downgrade() -> None:
    op.drop_table('po_payments')
