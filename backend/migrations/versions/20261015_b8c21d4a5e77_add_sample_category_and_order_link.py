"""add_sample_category_and_order_link

Revision ID: b8c21d4a5e77
Revises: a3b87e1f9c40
Create Date: 2026-10-15
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'b8c21d4a5e77'
down_revision: str | None = 'a3b87e1f9c40'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column('samples', sa.Column('category', sa.String(50), nullable=True))
    op.add_column(
        'sample_versions',
        sa.Column('order_id', sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        'fk_sample_versions_order_id', 'sample_versions', 'orders',
        ['order_id'], ['id'], ondelete='SET NULL',
    )
    op.create_index('ix_sample_versions_order_id', 'sample_versions', ['order_id'])


def downgrade() -> None:
    op.drop_index('ix_sample_versions_order_id', table_name='sample_versions')
    op.drop_constraint('fk_sample_versions_order_id', 'sample_versions', type_='foreignkey')
    op.drop_column('sample_versions', 'order_id')
    op.drop_column('samples', 'category')
