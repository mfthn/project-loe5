"""Add Finance funding review audit fields and Mandor payroll notifications."""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "9ce18c1d2a44"
down_revision: str | None = "51b173a36a8d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "payroll_runs",
        sa.Column(
            "funding_status",
            sa.String(length=20),
            server_default="PENDING",
            nullable=False,
        ),
    )
    op.add_column(
        "payroll_runs",
        sa.Column("available_funds", sa.Numeric(14, 2), nullable=True),
    )
    op.add_column(
        "payroll_runs",
        sa.Column("reviewed_by_user_id", sa.UUID(), nullable=True),
    )
    op.add_column(
        "payroll_runs",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.add_column(
        "payroll_runs",
        sa.Column("review_note", sa.Text(), nullable=True),
    )
    op.create_foreign_key(
        "fk_payroll_runs_reviewed_by_user_id_users",
        "payroll_runs",
        "users",
        ["reviewed_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_table(
        "payroll_notifications",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("payroll_run_id", sa.UUID(), nullable=False),
        sa.Column("recipient_user_id", sa.UUID(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["payroll_run_id"], ["payroll_runs.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["recipient_user_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_payroll_notifications_payroll_run_id",
        "payroll_notifications",
        ["payroll_run_id"],
    )
    op.create_index(
        "ix_payroll_notifications_recipient_user_id",
        "payroll_notifications",
        ["recipient_user_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_payroll_notifications_recipient_user_id",
        table_name="payroll_notifications",
    )
    op.drop_index(
        "ix_payroll_notifications_payroll_run_id",
        table_name="payroll_notifications",
    )
    op.drop_table("payroll_notifications")
    op.drop_constraint(
        "fk_payroll_runs_reviewed_by_user_id_users",
        "payroll_runs",
        type_="foreignkey",
    )
    op.drop_column("payroll_runs", "review_note")
    op.drop_column("payroll_runs", "reviewed_at")
    op.drop_column("payroll_runs", "reviewed_by_user_id")
    op.drop_column("payroll_runs", "available_funds")
    op.drop_column("payroll_runs", "funding_status")
