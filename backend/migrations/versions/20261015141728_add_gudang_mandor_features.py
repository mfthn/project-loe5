"""Add gudang and mandor enhanced features

Revision ID: 20261015141728
Revises: add_phone_constraints
Create Date: 2026-10-15 14:17:28.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20261015141728'
down_revision = 'add_phone_constraints'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create enum types using raw SQL
    op.execute("""
        DO $$ 
        BEGIN 
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'material_request_status_enum') THEN
                CREATE TYPE material_request_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'FULFILLED');
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_status_enum') THEN
                CREATE TYPE assignment_status_enum AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qc_request_status_enum') THEN
                CREATE TYPE qc_request_status_enum AS ENUM ('PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'RETURNED_TO_MANDOR');
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'qc_urgency_level_enum') THEN
                CREATE TYPE qc_urgency_level_enum AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
            END IF;
        END $$;
    """)

    # Create material_requests table using raw SQL
    op.execute("""
        CREATE TABLE material_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
            requested_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            approved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            quantity_requested FLOAT NOT NULL,
            quantity_fulfilled FLOAT NOT NULL DEFAULT 0.0,
            status material_request_status_enum NOT NULL DEFAULT 'PENDING',
            notes TEXT,
            rejection_reason TEXT,
            requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            processed_at TIMESTAMP WITH TIME ZONE
        );
        
        CREATE INDEX ix_material_requests_order_id ON material_requests(order_id);
        CREATE INDEX ix_material_requests_inventory_item_id ON material_requests(inventory_item_id);
        CREATE INDEX ix_material_requests_requested_by_user_id ON material_requests(requested_by_user_id);
        CREATE INDEX ix_material_requests_status ON material_requests(status);
    """)

    # Create penjahit_assignments table using raw SQL
    op.execute("""
        CREATE TABLE penjahit_assignments (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_component_id UUID NOT NULL REFERENCES order_components(id) ON DELETE CASCADE,
            penjahit_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            assigned_by_mandor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            quantity_assigned INTEGER NOT NULL,
            quantity_completed INTEGER NOT NULL DEFAULT 0,
            status assignment_status_enum NOT NULL DEFAULT 'ASSIGNED',
            notes TEXT,
            assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            completed_at TIMESTAMP WITH TIME ZONE
        );
        
        CREATE INDEX ix_penjahit_assignments_order_component_id ON penjahit_assignments(order_component_id);
        CREATE INDEX ix_penjahit_assignments_penjahit_user_id ON penjahit_assignments(penjahit_user_id);
        CREATE INDEX ix_penjahit_assignments_status ON penjahit_assignments(status);
    """)

    # Create penjahit_attendance table using raw SQL
    op.execute("""
        CREATE TABLE penjahit_attendance (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            penjahit_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            attendance_date DATE NOT NULL,
            check_in_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            checked_in_by_mandor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            notes VARCHAR(500)
        );
        
        CREATE INDEX ix_penjahit_attendance_penjahit_user_id ON penjahit_attendance(penjahit_user_id);
        CREATE INDEX ix_penjahit_attendance_attendance_date ON penjahit_attendance(attendance_date);
    """)

    # Create qc_requests table using raw SQL
    op.execute("""
        CREATE TABLE qc_requests (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
            order_component_id UUID REFERENCES order_components(id) ON DELETE CASCADE,
            requested_by_mandor_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
            assigned_qc_inspector_id UUID REFERENCES users(id) ON DELETE SET NULL,
            quantity_for_qc INTEGER NOT NULL,
            urgency_level qc_urgency_level_enum NOT NULL DEFAULT 'MEDIUM',
            status qc_request_status_enum NOT NULL DEFAULT 'PENDING',
            request_notes TEXT,
            defect_notes TEXT,
            qc_findings TEXT,
            quantity_passed INTEGER,
            quantity_failed INTEGER,
            requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            started_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE
        );
        
        CREATE INDEX ix_qc_requests_order_id ON qc_requests(order_id);
        CREATE INDEX ix_qc_requests_order_component_id ON qc_requests(order_component_id);
        CREATE INDEX ix_qc_requests_requested_by_mandor_id ON qc_requests(requested_by_mandor_id);
        CREATE INDEX ix_qc_requests_urgency_level ON qc_requests(urgency_level);
        CREATE INDEX ix_qc_requests_status ON qc_requests(status);
    """)


def downgrade() -> None:
    # Drop tables
    op.execute("DROP TABLE IF EXISTS qc_requests CASCADE;")
    op.execute("DROP TABLE IF EXISTS penjahit_attendance CASCADE;")
    op.execute("DROP TABLE IF EXISTS penjahit_assignments CASCADE;")
    op.execute("DROP TABLE IF EXISTS material_requests CASCADE;")

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS qc_urgency_level_enum CASCADE;")
    op.execute("DROP TYPE IF EXISTS qc_request_status_enum CASCADE;")
    op.execute("DROP TYPE IF EXISTS assignment_status_enum CASCADE;")
    op.execute("DROP TYPE IF EXISTS material_request_status_enum CASCADE;")
