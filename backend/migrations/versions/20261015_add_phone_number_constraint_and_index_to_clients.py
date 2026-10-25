"""add_phone_number_constraint_and_index_to_clients

Revision ID: add_phone_constraints
Revises: efb110abde0f
Create Date: 2026-10-15 10:00:00.000000

Add NOT NULL constraint, UNIQUE constraint, and INDEX to phone_number column 
in clients table to support phone-based client lookup and registration features.

Migration handles:
1. Update phone_number column to NOT NULL (populate NULL values with placeholder if needed)
2. Add UNIQUE constraint on phone_number
3. Create INDEX on phone_number for query performance
4. Provide downgrade path to remove constraints and index
"""
from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = 'add_phone_constraints'
down_revision: str | None = 'efb110abde0f'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """
    Upgrade migration: Add constraints and index to phone_number column.
    
    Steps:
    1. Handle existing NULL values (set to placeholder phone number)
    2. Alter column to NOT NULL
    3. Add UNIQUE constraint
    4. Create INDEX for query performance
    """
    
    # Step 1: Handle existing NULL values
    # For any existing clients with NULL phone_number, assign temporary unique values
    # to avoid constraint violations. In production, these should be updated manually.
    # Use REPLACE to remove hyphens from UUID and take first 15 characters
    op.execute(
        """
        UPDATE clients 
        SET phone_number = '+62' || REPLACE(id::text, '-', '')
        WHERE phone_number IS NULL;
        """
    )
    
    # Step 2: Make phone_number NOT NULL
    op.alter_column(
        'clients',
        'phone_number',
        existing_type=sa.String(length=50),
        nullable=False,
    )
    
    # Step 3: Add UNIQUE constraint on phone_number
    op.create_unique_constraint(
        constraint_name='uq_clients_phone_number',
        table_name='clients',
        columns=['phone_number'],
    )
    
    # Step 4: Create INDEX on phone_number for query performance
    op.create_index(
        index_name='ix_clients_phone_number',
        table_name='clients',
        columns=['phone_number'],
        unique=False,
    )


def downgrade() -> None:
    """
    Downgrade migration: Remove constraints and index from phone_number column.
    
    Steps:
    1. Drop INDEX
    2. Drop UNIQUE constraint
    3. Revert column to nullable
    """
    
    # Step 1: Drop INDEX
    op.drop_index(
        index_name='ix_clients_phone_number',
        table_name='clients',
    )
    
    # Step 2: Drop UNIQUE constraint
    op.drop_constraint(
        constraint_name='uq_clients_phone_number',
        table_name='clients',
        type_='unique',
    )
    
    # Step 3: Revert column to nullable
    op.alter_column(
        'clients',
        'phone_number',
        existing_type=sa.String(length=50),
        nullable=True,
    )
