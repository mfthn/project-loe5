"""add_waste_category_rate_history_assembly_qc_route

Revision ID: a3b87e1f9c40
Revises: f1a94c7d2e33
Create Date: 2026-10-15
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'a3b87e1f9c40'
down_revision: str | None = 'f1a94c7d2e33'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    waste_enum = sa.Enum(
        'SISA_POTONG', 'SCRAP', 'BS_REJECT',
        name='waste_category_enum',
    )
    waste_enum.create(op.get_bind(), checkfirst=True)
    op.add_column(
        'cutting_results',
        sa.Column('waste_category', waste_enum, nullable=True),
    )
    op.add_column(
        'qc_inspections',
        sa.Column('action_route', sa.String(30), nullable=True),
    )
    op.create_table(
        'rate_card_changes',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('order_component_id', sa.UUID(), nullable=False),
        sa.Column('old_cutting_rate', sa.Float(), nullable=False),
        sa.Column('old_sewing_rate', sa.Float(), nullable=False),
        sa.Column('new_cutting_rate', sa.Float(), nullable=False),
        sa.Column('new_sewing_rate', sa.Float(), nullable=False),
        sa.Column('changed_by_user_id', sa.UUID(), nullable=True),
        sa.Column('changed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['order_component_id'], ['order_components.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['changed_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_rate_card_changes_component', 'rate_card_changes', ['order_component_id'])
    op.create_table(
        'assembly_batches',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('order_id', sa.UUID(), nullable=False),
        sa.Column('client_id', sa.UUID(), nullable=False),
        sa.Column('qty_assembled', sa.Integer(), nullable=False),
        sa.Column('assembled_by_user_id', sa.UUID(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('assembled_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['client_id'], ['clients.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['assembled_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_assembly_batches_order_id', 'assembly_batches', ['order_id'])
    op.create_index('ix_assembly_batches_client_id', 'assembly_batches', ['client_id'])


def downgrade() -> None:
    op.drop_table('assembly_batches')
    op.drop_table('rate_card_changes')
    op.drop_column('qc_inspections', 'action_route')
    op.drop_column('cutting_results', 'waste_category')
    sa.Enum(name='waste_category_enum').drop(op.get_bind(), checkfirst=True)
