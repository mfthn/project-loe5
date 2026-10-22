"""Tambah penjahit aktif yang sedang bekerja: akun + check-in + output terverifikasi.

Jalankan: python scripts/seed_penjahit.py
"""
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.modules.auth.models import User, UserRole
from app.modules.produksi.models import (
    AttendanceCheckin,
    Order,
    OrderComponent,
    OrderStatus,
    ProductionOutput,
)

NOW = datetime.now(timezone.utc)

PENJAHIT = [
    ("rini_jahit", "Rini Marlina (Penjahit Line 1)", "rini@lukla.id"),
    ("dewi_jahit", "Dewi Sartika (Penjahit Line 1)", "dewis@lukla.id"),
    ("agus_jahit", "Agus Hermawan (Penjahit Line 2)", "agush@lukla.id"),
    ("maya_jahit", "Maya Putri (Penjahit Line 2)", "maya@lukla.id"),
    ("tono_jahit", "Tono Supriadi (Penjahit Line 3)", "tono@lukla.id"),
]
PASSWORD = "Lukla@Jahit2026"


def seed() -> None:
    db = SessionLocal()
    try:
        mandor = db.scalar(select(User).where(User.username == "agus_mandor"))
        assert mandor is not None
        sewing_orders = db.scalars(
            select(Order).where(Order.status == OrderStatus.SEWING).order_by(Order.order_number)
        ).all()
        assert sewing_orders, "tidak ada order SEWING (jalankan seed_demo10 dulu)"

        for i, (username, name, email) in enumerate(PENJAHIT):
            u = db.scalar(select(User).where(User.username == username))
            if u is None:
                taken = db.scalar(select(User).where(User.email == email))
                final_email = email if taken is None else f"{username}@lukla.id"
                u = User(username=username, email=final_email, name=name,
                         hashed_password=hash_password(PASSWORD),
                         role=UserRole.PENJAHIT, client_id=None, is_active=True)
                db.add(u)
                db.flush()
                print(f"  + akun {username}")
            order = sewing_orders[i % len(sewing_orders)]
            comp = db.scalars(
                select(OrderComponent).where(OrderComponent.order_id == order.id)
            ).first()
            line = (i % 3) + 1
            open_ci = db.scalar(select(AttendanceCheckin).where(
                AttendanceCheckin.user_id == u.id, AttendanceCheckin.checkout_at.is_(None)))
            if open_ci is None:
                db.add(AttendanceCheckin(
                    user_id=u.id, order_id=order.id, line_number=line,
                    task_category=comp.component_name if comp else None,
                    checked_in_by_user_id=mandor.id, notes="Seed penjahit aktif"))
                db.flush()
            exists = db.scalar(select(ProductionOutput).where(
                ProductionOutput.order_id == order.id,
                ProductionOutput.operator_user_id == u.id))
            if exists is None and comp is not None:
                db.add(ProductionOutput(
                    order_id=order.id, order_component_id=comp.id,
                    operator_user_id=u.id, verified_by_user_id=mandor.id,
                    line_number=line, qty_completed=30 + i * 10, is_verified=True,
                    time_window=NOW))
        db.commit()
        print("Seed penjahit selesai.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
