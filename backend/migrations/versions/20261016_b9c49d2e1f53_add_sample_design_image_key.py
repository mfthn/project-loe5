"""add_sample_design_image_key

Revision ID: b9c49d2e1f53
Revises: a7b38c9d0e41
Create Date: 2026-10-16
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'b9c49d2e1f53'
down_revision: str | None = 'a7b38c9d0e41'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('sample_versions', sa.Column('design_image_key', sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column('sample_versions', 'design_image_key')
