"""add_payroll_manual_adjustment

Revision ID: f6a78b9c0d24
Revises: e5f67a8b9c13
Create Date: 2026-10-16
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'f6a78b9c0d24'
down_revision: str | None = 'e5f67a8b9c13'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        'payroll_details',
        sa.Column('manual_adjustment', sa.Numeric(14, 2), nullable=False, server_default='0.00'),
    )


def downgrade() -> None:
    op.drop_column('payroll_details', 'manual_adjustment')
