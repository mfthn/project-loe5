"""add_owner_approval_to_sample_versions

Revision ID: d5b82e3f9a11
Revises: c4a91d2e7f55
Create Date: 2026-10-15
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = 'd5b82e3f9a11'
down_revision: str | None = 'c4a91d2e7f55'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Tambah nilai enum baru (Postgres ENUM perlu ALTER ... ADD VALUE)
    op.execute("ALTER TYPE sample_status_enum ADD VALUE IF NOT EXISTS 'OWNER_APPROVED'")
    op.execute("ALTER TYPE sample_status_enum ADD VALUE IF NOT EXISTS 'OWNER_REJECTED'")
    op.add_column('sample_versions', sa.Column('agreed_price', sa.Numeric(14, 2), nullable=True))
    op.add_column('sample_versions', sa.Column('currency', sa.String(3), nullable=False, server_default='IDR'))
    op.add_column('sample_versions', sa.Column('costing_notes', sa.Text(), nullable=True))
    op.add_column('sample_versions', sa.Column('sample_approved_by', sa.UUID(), nullable=True))
    op.add_column('sample_versions', sa.Column('sample_approved_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('sample_versions', sa.Column('owner_approved_by', sa.UUID(), nullable=True))
    op.add_column('sample_versions', sa.Column('owner_approved_at', sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key('fk_sample_versions_sample_approved_by', 'sample_versions', 'users', ['sample_approved_by'], ['id'], ondelete='SET NULL')
    op.create_foreign_key('fk_sample_versions_owner_approved_by', 'sample_versions', 'users', ['owner_approved_by'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('fk_sample_versions_owner_approved_by', 'sample_versions', type_='foreignkey')
    op.drop_constraint('fk_sample_versions_sample_approved_by', 'sample_versions', type_='foreignkey')
    op.drop_column('sample_versions', 'owner_approved_at')
    op.drop_column('sample_versions', 'owner_approved_by')
    op.drop_column('sample_versions', 'sample_approved_at')
    op.drop_column('sample_versions', 'sample_approved_by')
    op.drop_column('sample_versions', 'costing_notes')
    op.drop_column('sample_versions', 'currency')
    op.drop_column('sample_versions', 'agreed_price')
