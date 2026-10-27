"""Script untuk mengisi seed data demo: klien dan akun untuk seluruh 8 peran operasional."""
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

# Pastikan backend ada di sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from app.core.database import SessionLocal
from app.core.security import hash_password

# Registrasi seluruh model ORM agar metadata foreign key terhubung utuh
from app.modules.auth import models as auth_models  # noqa: F401
from app.modules.gudang import models as gudang_models  # noqa: F401
from app.modules.payroll import models as payroll_models  # noqa: F401
from app.modules.produksi import models as produksi_models  # noqa: F401
from app.modules.qc import models as qc_models  # noqa: F401
from app.modules.sample import models as sample_models  # noqa: F401

from app.modules.auth.models import Client, User, UserRole
from app.modules.auth.client_code import build_client_code


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
                client_code=build_client_code("0811000001"),
            )
            db.add(snohund)

        klien_a = existing_clients.get("PT Tekstil Maju (Klien A)")
        if not klien_a:
            klien_a = Client(
                company_name="PT Tekstil Maju (Klien A)",
                contact_person="Ibu Maya",
                phone_number="08123456789",
                client_code=build_client_code("08123456789"),
            )
            db.add(klien_a)

        klien_b = existing_clients.get("CV Busana Prima (Klien B)")
        if not klien_b:
            klien_b = Client(
                company_name="CV Busana Prima (Klien B)",
                contact_person="Bapak Doni",
                phone_number="08198765432",
                client_code=build_client_code("08198765432"),
            )
            db.add(klien_b)

        db.flush()

        # 2. Akun Pengguna per Role (Akun Produksi — bukan demo)
        # Password disimpan di README.md bagian "Akun Sistem per Role"
        internal_users = [
            # (username, password, name, email, role, client_id)
            ("hendra_owner",   "Lukla@Owner2026",   "Hendra Lukla (Owner/CEO)",       "owner@lukla.id",   UserRole.OWNER,          None),
            ("rina_finance",   "Lukla@Finance2026", "Rina Lestari (Finance & Payroll)","finance@lukla.id", UserRole.FINANCE_PAYROLL, None),
            ("agus_mandor",    "Lukla@Mandor2026",  "Agus Santoso (Mandor Line 1)",   "mandor@lukla.id",  UserRole.MANDOR,          None),
            ("siti_jahit",     "Lukla@Jahit2026",   "Siti Rahayu (Penjahit Line 1)",  "siti@lukla.id",    UserRole.PENJAHIT,        None),
            ("budi_gudang",    "Lukla@Gudang2026",  "Budi Santoso (Petugas Gudang)",  "gudang@lukla.id",  UserRole.GUDANG,          None),
            ("adis_sample",    "Lukla@Sample2026",  "Adis Purnama (Tim Sample)",      "sample@lukla.id",  UserRole.TIM_SAMPLE,      None),
            ("dewi_qc",        "Lukla@QC2026",      "Dewi Anggraini (QC Inspector)",  "qc@lukla.id",      UserRole.QC_INSPECTOR,    None),
        ]

        for username, password, name, email, role, client_id in internal_users:
            existing = db.scalar(
                select(User).where((User.username == username) | (User.email == email))
            )
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
            else:
                existing.username = username
                existing.email = email
                existing.name = name
                existing.hashed_password = hash_password(password)
                existing.role = role
                existing.client_id = client_id
                existing.is_active = True
                print(f"  ~ User '{username}' ({role.value}) berhasil diperbarui.")

        db.flush()

        # 3. Seed Bahan Baku Gudang Multi-Tenant
        from app.modules.gudang.models import InventoryItem, InventoryTransaction, TransactionType
        from app.modules.produksi.models import (
            MaklonScheme,
            Order,
            OrderComponent,
            OrderStatus,
            ProductionOutput,
            RateCard,
        )
        from app.modules.qc.models import QCInspection, QCStatus
        from app.modules.payroll.models import BatchFinancial

        demo_items = [
            (klien_a.id, "KAIN-COMBED-NAVY-01", "Cotton Combed 30s Navy", 800.0, "METER"),
            (klien_a.id, "BENANG-POLY-NAVY", "Benang Jahit Poliester Navy", 40.0, "CONE"),
            (klien_b.id, "KAIN-DRILL-KHAKI-02", "Kain Drill American Khaki", 500.0, "METER"),
            (klien_b.id, "KANCING-BATOK-20MM", "Kancing Batok Kelapa 20mm", 2000.0, "PCS"),
            (snohund.id, "KAIN-FLEECE-BLACK-03", "Heavyweight Cotton Fleece 330gsm", 600.0, "METER"),
        ]

        for cid, code, name, stock, unit in demo_items:
            existing_item = db.scalar(select(InventoryItem).where(InventoryItem.material_code == code))
            if not existing_item:
                item = InventoryItem(
                    client_id=cid,
                    material_code=code,
                    material_name=name,
                    current_stock=stock,
                    unit_measure=unit,
                )
                db.add(item)
                db.flush()
                # Transaksi IN perdana
                trx = InventoryTransaction(
                    inventory_item_id=item.id,
                    client_id=cid,
                    order_id=None,
                    transaction_type=TransactionType.IN,
                    quantity=stock,
                    notes="Saldo awal penerimaan bahan titipan",
                )
                db.add(trx)
                print(f"  + Material '{code}' ({stock} {unit}) berhasil didaftarkan.")

        # 4. Seed Contoh Order Massal
        demo_orders = [
            (klien_a.id, "ORD-MAKLON-A-001", MaklonScheme.CMT, 500, OrderStatus.CUTTING),
            (klien_b.id, "ORD-MAKLON-B-002", MaklonScheme.SEMI_CMT, 300, OrderStatus.CUTTING),
            (snohund.id, "ORD-SNOHUND-003", MaklonScheme.FULL_PACKAGE, 200, OrderStatus.SEWING),
        ]

        for cid, onum, scheme, target, st in demo_orders:
            existing_ord = db.scalar(select(Order).where(Order.order_number == onum))
            if not existing_ord:
                ord_obj = Order(
                    client_id=cid,
                    order_number=onum,
                    scheme=scheme,
                    target_quantity=target,
                    status=st,
                )
                db.add(ord_obj)
                print(f"  + Order '{onum}' ({target} pcs) berhasil dibuat.")

        db.flush()
        demo_order = db.scalar(select(Order).where(Order.order_number == "ORD-SNOHUND-003"))
        demo_sewers = list(
            db.scalars(
                select(User).where((User.role == UserRole.PENJAHIT) & (User.is_active == True))
            ).all()
        )
        demo_mandor = db.scalar(
            select(User).where((User.role == UserRole.MANDOR) & (User.is_active == True))
        )
        if demo_order and demo_sewers and demo_mandor:
            component = db.scalar(
                select(OrderComponent).where(
                    OrderComponent.order_id == demo_order.id,
                    OrderComponent.component_name == "Jahitan Demo",
                )
            )
            if not component:
                component = OrderComponent(
                    order_id=demo_order.id,
                    component_name="Jahitan Demo",
                    sequence_order=1,
                )
                db.add(component)
                db.flush()
            rate_card = db.scalar(
                select(RateCard).where(RateCard.order_component_id == component.id)
            )
            if not rate_card:
                db.add(
                    RateCard(
                        order_component_id=component.id,
                        cutting_rate_per_pcs=Decimal("500.00"),
                        sewing_rate_per_pcs=Decimal("2500.00"),
                    )
                )

            monday = datetime.now(timezone.utc).date()
            monday -= timedelta(days=monday.weekday())
            for index, sewer in enumerate(demo_sewers):
                work_time = datetime.combine(
                    monday + timedelta(days=index + 1),
                    datetime.min.time(),
                    tzinfo=timezone.utc,
                ) + timedelta(hours=9)
                existing_output = db.scalar(
                    select(ProductionOutput).where(
                        ProductionOutput.order_id == demo_order.id,
                        ProductionOutput.operator_user_id == sewer.id,
                        ProductionOutput.time_window == work_time,
                    )
                )
                if not existing_output:
                    db.add(
                        ProductionOutput(
                            order_id=demo_order.id,
                            order_component_id=component.id,
                            operator_user_id=sewer.id,
                            verified_by_user_id=demo_mandor.id,
                            line_number=index + 1,
                            qty_completed=40 + index * 10,
                            is_verified=True,
                            time_window=work_time,
                        )
                    )

            if not db.scalar(
                select(QCInspection.id).where(QCInspection.order_id == demo_order.id)
            ):
                db.add(
                    QCInspection(
                        order_id=demo_order.id,
                        inspector_user_id=db.scalar(
                            select(User.id).where(
                                (User.role == UserRole.QC_INSPECTOR) & (User.is_active == True)
                            )
                        ),
                        status=QCStatus.LOLOS,
                        qty_inspected=80,
                        repair_count=0,
                        escalated_to_sample=False,
                    )
                )

            if not db.scalar(
                select(BatchFinancial.id).where(
                    BatchFinancial.order_id == demo_order.id
                )
            ):
                db.add(
                    BatchFinancial(
                        order_id=demo_order.id,
                        contract_revenue=Decimal("120000000.00"),
                        material_cost=Decimal("45000000.00"),
                        overhead_cost=Decimal("12000000.00"),
                        labor_cost=Decimal("225000.00"),
                        total_hpp=Decimal("57225000.00"),
                        net_profit=Decimal("62775000.00"),
                        status="DRAFT",
                    )
                )
            print(
                "  + Data demo payroll, QC, dan finansial ditambahkan untuk ORD-SNOHUND-003. "
                "Pastikan output Mandor sudah terverifikasi sebelum menghitung payroll."
            )

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
