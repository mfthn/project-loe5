"""add_material_request_handover_tables

Revision ID: c4a91d2e7f55
Revises: 9ce18c1d2a44
Create Date: 2026-10-15
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'c4a91d2e7f55'
down_revision: str | None = '9ce18c1d2a44'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'inventory_items',
        sa.Column('storage_location', sa.String(length=100), nullable=True),
    )
    op.create_table(
        'material_requests',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('order_id', sa.UUID(), nullable=False),
        sa.Column('inventory_item_id', sa.UUID(), nullable=False),
        sa.Column('client_id', sa.UUID(), nullable=False),
        sa.Column('qty_requested', sa.Float(), nullable=False),
        sa.Column('qty_fulfilled', sa.Float(), nullable=False, server_default='0'),
        sa.Column('status', postgresql.ENUM(
            'DIAJUKAN', 'DISETUJUI', 'DITOLAK', 'DISERAHKAN',
            name='material_request_status_enum', create_type=True,
        ), nullable=False, server_default='DIAJUKAN'),
        sa.Column('requested_by_user_id', sa.UUID(), nullable=True),
        sa.Column('reviewed_by_user_id', sa.UUID(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['inventory_item_id'], ['inventory_items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['requested_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['reviewed_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_material_requests_order_id', 'material_requests', ['order_id'])
    op.create_index('ix_material_requests_client_id', 'material_requests', ['client_id'])
    op.create_index('ix_material_requests_status', 'material_requests', ['status'])
    op.create_table(
        'material_handovers',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('order_id', sa.UUID(), nullable=False),
        sa.Column('inventory_item_id', sa.UUID(), nullable=False),
        sa.Column('material_request_id', sa.UUID(), nullable=True),
        sa.Column('transaction_id', sa.UUID(), nullable=True),
        sa.Column('client_id', sa.UUID(), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('handed_by_user_id', sa.UUID(), nullable=True),
        sa.Column('received_by_user_id', sa.UUID(), nullable=True),
        sa.Column('handed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('received_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['inventory_item_id'], ['inventory_items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['material_request_id'], ['material_requests.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['transaction_id'], ['inventory_transactions.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['handed_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['received_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_material_handovers_order_id', 'material_handovers', ['order_id'])
    op.create_index('ix_material_handovers_client_id', 'material_handovers', ['client_id'])


def downgrade() -> None:
    op.drop_table('material_handovers')
    op.drop_table('material_requests')
    sa.Enum(name='material_request_status_enum').drop(op.get_bind(), checkfirst=True)
    op.drop_column('inventory_items', 'storage_location')
