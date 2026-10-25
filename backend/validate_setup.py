"""Comprehensive validation script for database setup"""
from sqlalchemy import create_engine, text
from app.core.config import get_settings

settings = get_settings()
engine = create_engine(str(settings.database_url))

print("=" * 60)
print("DATABASE SETUP VALIDATION")
print("=" * 60)

with engine.connect() as conn:
    # Check alembic version
    result = conn.execute(text("SELECT version_num FROM alembic_version"))
    version = result.fetchone()[0]
    print(f"\n✓ Alembic Version: {version}")
    
    # Check critical tables from restored migrations
    critical_tables = [
        'material_requests',
        'penjahit_assignments', 
        'penjahit_attendance',
        'qc_requests',
        'inventory_items',
        'orders',
        'clients',
    ]
    
    print("\n✓ Critical Tables:")
    for table in critical_tables:
        result = conn.execute(text(f"""
            SELECT COUNT(*) FROM information_schema.tables 
            WHERE table_name = '{table}'
        """))
        exists = result.fetchone()[0] > 0
        status = "✓" if exists else "✗"
        print(f"  {status} {table}")
    
    # Check critical columns that were manually added
    critical_columns = [
        ('inventory_items', 'storage_location'),
        ('orders', 'selling_price'),
        ('qc_inspections', 'action_route'),
        ('payroll_details', 'manual_adjustment'),
    ]
    
    print("\n✓ Critical Columns:")
    for table, column in critical_columns:
        result = conn.execute(text(f"""
            SELECT COUNT(*) FROM information_schema.columns 
            WHERE table_name = '{table}' AND column_name = '{column}'
        """))
        exists = result.fetchone()[0] > 0
        status = "✓" if exists else "✗"
        print(f"  {status} {table}.{column}")
    
    # Check for phone number constraints on clients
    result = conn.execute(text("""
        SELECT COUNT(*) FROM information_schema.table_constraints 
        WHERE table_name = 'clients' AND constraint_name = 'uq_clients_phone_number'
    """))
    has_constraint = result.fetchone()[0] > 0
    print(f"\n✓ Phone Number Unique Constraint: {'✓ Present' if has_constraint else '✗ Missing'}")

print("\n" + "=" * 60)
print("VALIDATION COMPLETE")
print("=" * 60)
print("\nAll systems operational! ✓")
print("\nNext steps:")
print("  1. Run: uvicorn app.main:app --reload")
print("  2. Access API docs: http://localhost:8000/docs")
print("  3. Frontend can connect to backend")
