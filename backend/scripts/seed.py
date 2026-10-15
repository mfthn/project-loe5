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
                select(User).where(User.username.in_(["penjahit_siti", "penjahit_rini"]))
            ).all()
        )
        demo_mandor = db.scalar(select(User).where(User.username == "mandor_agus")        )
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
                            select(User.id).where(User.username == "qc_dewi")
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
