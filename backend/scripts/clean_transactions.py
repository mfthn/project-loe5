"""Bersihkan seluruh data transaksional, pertahankan akun pengguna + data klien.

Tabel yang dipertahankan: users, clients (+ alembic_version).
Urut memakai TRUNCATE ... CASCADE agar FK antar tabel ikut beres.
Jalankan: python scripts/clean_transactions.py [--yes]
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text

from app.core.database import SessionLocal

TRANSACTIONAL_TABLES = [
    "invoice_payments",
    "invoices",
    "po_lines",
    "purchase_orders",
    "cutting_results",
    "material_handovers",
    "material_requests",
    "inventory_transactions",
    "production_outputs",
    "qc_inspections",
    "payroll_details",
    "payroll_payments",
    "payroll_runs",
    "payroll_notifications",
    "batch_financials",
    "rate_cards",
    "rate_card_changes",
    "order_components",
    "assembly_batches",
    "orders",
    "inventory_items",
    "sample_components",
    "sample_versions",
    "samples",
]

KEPT_TABLES = ["users", "clients"]


def existing_tables(db) -> list[str]:
    rows = db.execute(
        text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")
    ).all()
    return [r[0] for r in rows]


def clean() -> None:
    db = SessionLocal()
    try:
        present = set(existing_tables(db))
        targets = [t for t in TRANSACTIONAL_TABLES if t in present]
        if not targets:
            print("Tidak ada tabel transaksional yang perlu dibersihkan.")
            return
        cols = ", ".join(targets)
        db.execute(text(f"TRUNCATE {cols} RESTART IDENTITY CASCADE"))
        db.commit()
        print(f"Dibersihkan {len(targets)} tabel: {cols}")
        users = db.execute(text("SELECT COUNT(*) FROM users")).scalar()
        clients = db.execute(text("SELECT COUNT(*) FROM clients")).scalar()
        print(f"Akun dipertahankan: {users} users, {clients} clients.")
    finally:
        db.close()


if __name__ == "__main__":
    if "--yes" not in sys.argv:
        print("Jalankan dengan --yes untuk mengeksekusi pembersihan.")
        print("Tabel transaksional akan dikosongkan; users + clients dipertahankan.")
        sys.exit(1)
    clean()
