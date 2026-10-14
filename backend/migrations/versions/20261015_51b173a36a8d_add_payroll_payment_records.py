"""add_payroll_payment_records

Revision ID: 51b173a36a8d
Revises: efb110abde0f
Create Date: 2026-10-15
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "51b173a36a8d"
down_revision: str | None = "efb110abde0f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "payroll_payments",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("payroll_detail_id", sa.UUID(), nullable=False),
        sa.Column("paid_by_user_id", sa.UUID(), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["payroll_detail_id"], ["payroll_details.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["paid_by_user_id"], ["users.id"], ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_payroll_payments_payroll_detail_id"),
        "payroll_payments",
        ["payroll_detail_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_payroll_payments_payroll_detail_id"),
        table_name="payroll_payments",
    )
    op.drop_table("payroll_payments")
