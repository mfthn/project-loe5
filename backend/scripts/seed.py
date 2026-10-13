"""Script untuk mengisi seed data demo: klien dan akun untuk seluruh 8 peran operasional."""
import sys
from pathlib import Path

# Pastikan backend ada di sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from app.core.database import SessionLocal
from app.core.security import hash_password
from app.modules.auth.models import Client, User, UserRole


def seed_data() -> None:
    db = SessionLocal()
    try:
        print("Memulai seeding data demo...")

        # 1. Klien Maklon & Brand Internal
        existing_clients = {c.company_name: c for c in db.scalars(select(Client)).all()}

        snohund = existing_clients.get("Snøhund (Internal Brand)")
        if not snohund:
            snohund = Client(
                company_name="Snøhund (Internal Brand)",
                contact_person="Internal Management",
                phone_number="0811000001",
            )
            db.add(snohund)

        klien_a = existing_clients.get("PT Tekstil Maju (Klien A)")
        if not klien_a:
            klien_a = Client(
                company_name="PT Tekstil Maju (Klien A)",
                contact_person="Ibu Maya",
                phone_number="08123456789",
            )
            db.add(klien_a)

        klien_b = existing_clients.get("CV Busana Prima (Klien B)")
        if not klien_b:
            klien_b = Client(
                company_name="CV Busana Prima (Klien B)",
                contact_person="Bapak Doni",
                phone_number="08198765432",
            )
            db.add(klien_b)

        db.flush()

        # 2. Akun Pengguna untuk ke-8 Role
        demo_users = [
            # (username, password, name, email, role, client_ref)
            ("owner", "owner123", "Pak Hendra (Owner/CEO)", "owner@lukla.id", UserRole.OWNER, None),
            ("adis_sample", "sample123", "Adis (Tim Sample)", "adis@lukla.id", UserRole.TIM_SAMPLE, None),
            ("gudang_budi", "gudang123", "Budi (Petugas Gudang)", "gudang@lukla.id", UserRole.GUDANG, None),
            ("mandor_agus", "mandor123", "Agus (Mandor Line 1)", "agus@lukla.id", UserRole.MANDOR, None),
            ("mandor_joko", "mandor123", "Joko (Mandor Line 2)", "joko@lukla.id", UserRole.MANDOR, None),
            ("ka_ops", "kaops123", "Bambang (Kepala Operasional)", "kaops@lukla.id", UserRole.MANDOR, None),
            ("penjahit_siti", "jahit123", "Siti (Penjahit Line 1)", "siti@lukla.id", UserRole.PENJAHIT, None),
            ("penjahit_rini", "jahit123", "Rini (Penjahit Line 2)", "rini@lukla.id", UserRole.PENJAHIT, None),
            ("qc_dewi", "qc123", "Dewi (QC Inspector)", "qc@lukla.id", UserRole.QC_INSPECTOR, None),
            ("finance_rina", "finance123", "Rina (Finance & Payroll)", "finance@lukla.id", UserRole.FINANCE_PAYROLL, None),
            ("klien_a", "klien123", "Klien A - PT Tekstil Maju", "maya@tekstilmaju.com", UserRole.KLIEN_MAKLON, klien_a.id),
            ("klien_b", "klien123", "Klien B - CV Busana Prima", "doni@busanaprima.com", UserRole.KLIEN_MAKLON, klien_b.id),
        ]

        for username, password, name, email, role, client_id in demo_users:
            existing = db.scalar(select(User).where(User.username == username))
            if not existing:
                user = User(
                    username=username,
                    email=email,
                    name=name,
                    hashed_password=hash_password(password),
                    role=role,
                    client_id=client_id,
                    is_active=True,
                )
                db.add(user)
                print(f"  + User '{username}' ({role.value}) berhasil dibuat.")

        db.commit()
        print("Seeding data demo selesai dengan sukses!")
    except Exception as e:
        db.rollback()
        print("Seeding gagal:", e)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_data()
