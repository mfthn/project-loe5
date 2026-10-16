"""add_attendance_checkins

Revision ID: e5f67a8b9c13
Revises: d4e56f7a8b12
Create Date: 2026-10-16
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'e5f67a8b9c13'
down_revision: str | None = 'd4e56f7a8b12'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        'attendance_checkins',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('order_id', sa.UUID(), nullable=True),
        sa.Column('line_number', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('task_category', sa.String(100), nullable=True),
        sa.Column('checked_in_by_user_id', sa.UUID(), nullable=True),
        sa.Column('checkin_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('checkout_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['order_id'], ['orders.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['checked_in_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_checkins_user_id', 'attendance_checkins', ['user_id'])
    op.create_index('ix_checkins_checkin_at', 'attendance_checkins', ['checkin_at'])


def downgrade() -> None:
    op.drop_table('attendance_checkins')
