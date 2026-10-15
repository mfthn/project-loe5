"""add_cutting_results_table

Revision ID: f1a94c7d2e33
Revises: e7f23a5b1c90
Create Date: 2026-10-15
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'f1a94c7d2e33'
down_revision: str | None = 'e7f23a5b1c90'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'cutting_results',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('order_id', sa.UUID(), nullable=False),
        sa.Column('inventory_item_id', sa.UUID(), nullable=True),
        sa.Column('client_id', sa.UUID(), nullable=False),
        sa.Column('qty_lapis', sa.Float(), nullable=False),
        sa.Column('qty_potong_hasil', sa.Integer(), nullable=False),
        sa.Column('waste_qty', sa.Float(), nullable=False, server_default='0'),
        sa.Column('cut_by_user_id', sa.UUID(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('cut_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['inventory_item_id'], ['inventory_items.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['cut_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_cutting_results_order_id', 'cutting_results', ['order_id'])
    op.create_index('ix_cutting_results_client_id', 'cutting_results', ['client_id'])


def downgrade() -> None:
    op.drop_table('cutting_results')
