"""add_overhead_expenses

Revision ID: a7b38c9d0e41
Revises: f6a78b9c0d24
Create Date: 2026-10-16
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'a7b38c9d0e41'
down_revision: str | None = 'f6a78b9c0d24'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'overhead_expenses',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('month', sa.Integer(), nullable=False),
        sa.Column('category', sa.String(100), nullable=False),
        sa.Column('amount', sa.Numeric(14, 2), nullable=False),
        sa.Column('recorded_by_user_id', sa.UUID(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['recorded_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_overhead_year_month', 'overhead_expenses', ['year', 'month'])


def downgrade() -> None:
    op.drop_table('overhead_expenses')
