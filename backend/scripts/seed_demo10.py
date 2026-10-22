"""Seed 10 pesanan demo yang mencakup seluruh alur bisnis.

ORD-DEMO-01 (A): COMPLETED + invoice LUNAS
ORD-DEMO-02 (B): COMPLETED + invoice BELUM_BAYAR
ORD-DEMO-03 (A): SEWING + output terverifikasi
ORD-DEMO-04 (B): SEWING + output belum verifikasi
ORD-DEMO-05 (A): CUTTING, handover menunggu mandor
ORD-DEMO-06 (B): CUTTING, PO terima sebagian
ORD-DEMO-07 (A): SAMPLE (order baru)
ORD-DEMO-08 (Snohund): MENUNGGU_QC (sudah rakit)
ORD-DEMO-09 (A): QC (inspeksi sebagian)
ORD-DEMO-10 (B): CUTTING, PO masih DRAFT

Jalankan: python scripts/seed_demo10.py
"""
import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from app.core.database import SessionLocal
from app.modules.auth.models import Client, User
from app.modules.finance.models import Invoice, InvoicePayment, InvoiceStatus, POLine, POStatus, PurchaseOrder
from app.modules.gudang.models import (
    AssemblyBatch,
    InventoryItem,
    InventoryTransaction,
    MaterialHandover,
    MaterialRequest,
    RequestStatus,
    TransactionType,
)
from app.modules.produksi.models import (
    MaklonScheme,
    Order,
    OrderComponent,
    OrderStatus,
    ProductionOutput,
    RateCard,
)
from app.modules.qc.models import QCInspection, QCStatus
from app.modules.sample.models import Sample, SampleComponent, SampleStatus, SampleVersion

NOW = datetime.now(timezone.utc)
CATS = ["TAS", "HOODIE", "JAKET", "KAOS", "CELANA", "KEMEJA"]


def _get(db, model, **kw):
    return db.scalar(select(model).filter_by(**kw))


def seed() -> dict:
    db = SessionLocal()
    try:
        if _get(db, Order, order_number="ORD-DEMO-01") is not None:
            print("Demo10 sudah ada — lewati.")
            return {}
        owner = db.scalar(select(User).where(User.username == "hendra_owner"))
        mandor = db.scalar(select(User).where(User.username == "agus_mandor"))
        jahit = db.scalar(select(User).where(User.username == "siti_jahit"))
        gudang = db.scalar(select(User).where(User.username == "budi_gudang"))
        sample_u = db.scalar(select(User).where(User.username == "adis_sample"))
        qc_u = db.scalar(select(User).where(User.username == "dewi_qc"))
        finance = db.scalar(select(User).where(User.username == "rina_finance"))
        assert all([owner, mandor, jahit, gudang, sample_u, qc_u, finance]), "seed akun dulu"
        ka = db.scalar(select(Client).where(Client.company_name.like("%Klien A%")))
        kb = db.scalar(select(Client).where(Client.company_name.like("%Klien B%")))
        sn = db.scalar(select(Client).where(Client.company_name.like("%Snøhund%")))
        assert ka and kb and sn, "seed klien dulu"

        def sample(client_id, code, article, cat, price):
            s = Sample(client_id=client_id, sample_code=code, article_name=article, category=cat)
            db.add(s)
            db.flush()
            v = SampleVersion(
                sample_id=s.id, version_number=1, status=SampleStatus.OWNER_APPROVED,
                tech_pack_notes="Demo10", agreed_price=Decimal(str(price)), currency="IDR",
                sample_approved_by=sample_u.id, sample_approved_at=NOW,
                owner_approved_by=owner.id, owner_approved_at=NOW,
            )
            db.add(v)
            db.flush()
            for name, usage, secs in (("Badan Depan", 1.2, 120.0), ("Lengan", 0.5, 60.0)):
                db.add(SampleComponent(sample_version_id=v.id, component_name=name,
                                       material_usage_est=usage, time_study_seconds=secs))
            db.flush()
            return v

        def item(client_id, code, name, loc):
            it = InventoryItem(client_id=client_id, material_code=code, material_name=name,
                               current_stock=0.0, unit_measure="METER", storage_location=loc)
            db.add(it)
            db.flush()
            return it

        def order(client_id, number, scheme, target, version_id, status):
            o = Order(client_id=client_id, order_number=number, scheme=scheme,
                      target_quantity=target, sample_version_id=version_id, status=status)
            db.add(o)
            db.flush()
            comps = []
            for i, (name, cut, sew) in enumerate((("Badan Depan", 500, 2500), ("Lengan", 400, 1800)), start=1):
                c = OrderComponent(order_id=o.id, component_name=name, sequence_order=i)
                db.add(c)
                db.flush()
                db.add(RateCard(order_component_id=c.id, cutting_rate_per_pcs=Decimal(str(cut)),
                                sewing_rate_per_pcs=Decimal(str(sew))))
                comps.append(c)
            db.flush()
            return o, comps

        def po(number, client_id, order_id, supplier, lines, approved=True):
            p = PurchaseOrder(po_number=number, client_id=client_id, order_id=order_id,
                              supplier_name=supplier, status=POStatus.DRAFT,
                              requested_by_user_id=sample_u.id, notes="Demo10")
            db.add(p)
            db.flush()
            for i, (it, qty, price) in enumerate(lines, start=1):
                db.add(POLine(po_id=p.id, inventory_item_id=it.id, sequence_order=i,
                              qty_ordered=qty, qty_received=0.0, unit_price=Decimal(str(price))))
            if approved:
                p.status = POStatus.DISETUJUI
                p.reviewed_by_user_id = finance.id
                p.reviewed_at = NOW
            db.flush()
            return p

        def receive(it, o, p, qty, note):
            line = next(ln for ln in p.lines if ln.inventory_item_id == it.id)
            line.qty_received += qty
            p.status = POStatus.SELESAI if all(
                abs(ln.qty_received - ln.qty_ordered) < 1e-9 for ln in p.lines
            ) else POStatus.DITERIMA_SEBAGIAN
            it.current_stock += qty
            db.add(InventoryTransaction(
                inventory_item_id=it.id, client_id=it.client_id, order_id=o.id,
                transaction_type=TransactionType.IN, quantity=qty,
                performed_by_user_id=gudang.id, notes=note))
            db.flush()

        def hand(it, o, qty, received=True, req=None):
            it.current_stock -= qty
            db.add(InventoryTransaction(
                inventory_item_id=it.id, client_id=it.client_id, order_id=o.id,
                transaction_type=TransactionType.OUT, quantity=qty,
                performed_by_user_id=gudang.id, notes=f"Serah terima {o.order_number}"))
            db.flush()
            trx = db.scalars(select(InventoryTransaction).order_by(
                InventoryTransaction.transaction_time.desc())).first()
            ho = MaterialHandover(
                order_id=o.id, inventory_item_id=it.id,
                material_request_id=req.id if req else None,
                transaction_id=trx.id, client_id=o.client_id, quantity=qty,
                handed_by_user_id=gudang.id,
                received_by_user_id=mandor.id if received else None,
                received_at=NOW if received else None, notes="Demo10")
            db.add(ho)
            if req:
                req.qty_fulfilled += qty
                if req.qty_fulfilled >= req.qty_requested - 1e-9:
                    req.status = RequestStatus.DISERAHKAN
            db.flush()

        def out(o, comp, qty, verified, line=1):
            db.add(ProductionOutput(
                order_id=o.id, order_component_id=comp.id, operator_user_id=jahit.id,
                verified_by_user_id=mandor.id if verified else None,
                line_number=line, qty_completed=qty, is_verified=verified,
                time_window=NOW))
            db.flush()

        out_ids = {}

        # O1: A COMPLETED + LUNAS
        v = sample(ka.id, "SMP-DEMO-01", "Tas Demo 1", "TAS", 45000)
        it = item(ka.id, "KAIN-DEMO-A1", "Kanvas Demo A1", "RAK-A-01")
        o, c = order(ka.id, "ORD-DEMO-01", MaklonScheme.CMT, 200, v.id, OrderStatus.CUTTING)
        p = po("PO-DEMO-01", ka.id, o.id, "PT Sup", [(it, 500.0, 15000)])
        receive(it, o, p, 500.0, "SJ-D10-01")
        hand(it, o, 300.0)
        o.status = OrderStatus.SEWING
        out(o, c[0], 120, True)
        out(o, c[1], 80, True)
        o.status = OrderStatus.MENUNGGU_QC
        db.add(QCInspection(order_id=o.id, inspector_user_id=qc_u.id, status=QCStatus.LOLOS,
                            qty_inspected=150, repair_count=0, action_route="GUDANG_BARANG_JADI"))
        o.status = OrderStatus.COMPLETED
        inv = Invoice(invoice_number="INV-DEMO-01", client_id=ka.id, order_id=o.id,
                      amount_total=Decimal("9000000.00"), amount_paid=Decimal("9000000.00"),
                      status=InvoiceStatus.LUNAS, issued_by_user_id=finance.id,
                      approved_by_user_id=owner.id, approved_at=NOW, notes="Demo10")
        db.add(inv)
        db.flush()
        db.add(InvoicePayment(invoice_id=inv.id, amount=Decimal("9000000.00"),
                              recorded_by_user_id=finance.id, notes="Lunas"))
        out_ids["o1"] = str(o.id)

        # O2: B COMPLETED + BELUM_BAYAR
        v = sample(kb.id, "SMP-DEMO-02", "Hoodie Demo 2", "HOODIE", 120000)
        it = item(kb.id, "KAIN-DEMO-B1", "Fleece Demo B1", "RAK-B-01")
        o, c = order(kb.id, "ORD-DEMO-02", MaklonScheme.SEMI_CMT, 100, v.id, OrderStatus.CUTTING)
        p = po("PO-DEMO-02", kb.id, o.id, "PT Sup", [(it, 300.0, 20000)])
        receive(it, o, p, 300.0, "SJ-D10-02")
        hand(it, o, 200.0)
        o.status = OrderStatus.SEWING
        out(o, c[0], 70, True, 2)
        o.status = OrderStatus.MENUNGGU_QC
        db.add(QCInspection(order_id=o.id, inspector_user_id=qc_u.id, status=QCStatus.LOLOS,
                            qty_inspected=60, repair_count=0, action_route="GUDANG_BARANG_JADI"))
        o.status = OrderStatus.COMPLETED
        db.add(Invoice(invoice_number="INV-DEMO-02", client_id=kb.id, order_id=o.id,
                       amount_total=Decimal("12000000.00"), amount_paid=Decimal("0"),
                       status=InvoiceStatus.BELUM_BAYAR, issued_by_user_id=finance.id,
                       approved_by_user_id=owner.id, approved_at=NOW, notes="Demo10"))

        # O3: A SEWING verified
        v = sample(ka.id, "SMP-DEMO-03", "Jaket Demo 3", "JAKET", 80000)
        it = item(ka.id, "KAIN-DEMO-A2", "Drill Demo A2", "RAK-A-02")
        o, c = order(ka.id, "ORD-DEMO-03", MaklonScheme.FULL_PACKAGE, 300, v.id, OrderStatus.CUTTING)
        p = po("PO-DEMO-03", ka.id, o.id, "PT Sup", [(it, 400.0, 12000)])
        receive(it, o, p, 400.0, "SJ-D10-03")
        hand(it, o, 250.0)
        o.status = OrderStatus.SEWING
        out(o, c[0], 60, True)
        out(o, c[1], 30, False)
        out_ids["o3"] = str(o.id)

        # O4: B SEWING unverified
        v = sample(kb.id, "SMP-DEMO-04", "Tas Demo 4", "TAS", 50000)
        it = item(kb.id, "KAIN-DEMO-B2", "Kanvas Demo B2", "RAK-B-02")
        o, c = order(kb.id, "ORD-DEMO-04", MaklonScheme.CMT, 150, v.id, OrderStatus.CUTTING)
        p = po("PO-DEMO-04", kb.id, o.id, "PT Sup", [(it, 250.0, 25000)])
        receive(it, o, p, 250.0, "SJ-D10-04")
        hand(it, o, 150.0)
        o.status = OrderStatus.SEWING
        out(o, c[0], 45, False, 2)

        # O5: A CUTTING, handover pending
        v = sample(ka.id, "SMP-DEMO-05", "Kaos Demo 5", "KAOS", 35000)
        it = item(ka.id, "KAIN-DEMO-A3", "Combed Demo A3", "RAK-A-03")
        o, c = order(ka.id, "ORD-DEMO-05", MaklonScheme.CMT, 120, v.id, OrderStatus.CUTTING)
        p = po("PO-DEMO-05", ka.id, o.id, "PT Sup", [(it, 200.0, 10000)])
        receive(it, o, p, 200.0, "SJ-D10-05")
        req = MaterialRequest(order_id=o.id, inventory_item_id=it.id, client_id=ka.id,
                              qty_requested=120.0, qty_fulfilled=0.0,
                              status=RequestStatus.DISETUJUI,
                              requested_by_user_id=mandor.id,
                              reviewed_by_user_id=gudang.id, reviewed_at=NOW, notes="Demo10")
        db.add(req)
        db.flush()
        hand(it, o, 120.0, received=False, req=req)
        out_ids["o5"] = str(o.id)

        # O6: B CUTTING, PO partial
        v = sample(kb.id, "SMP-DEMO-06", "Celana Demo 6", "CELANA", 70000)
        it = item(kb.id, "KAIN-DEMO-B3", "Denim Demo B3", "RAK-B-03")
        o, c = order(kb.id, "ORD-DEMO-06", MaklonScheme.FULL_PACKAGE, 100, v.id, OrderStatus.CUTTING)
        p = po("PO-DEMO-06", kb.id, o.id, "PT Sup", [(it, 500.0, 18000)])
        receive(it, o, p, 200.0, "SJ-D10-06 termin 1")

        # O7: A SAMPLE fresh
        v = sample(ka.id, "SMP-DEMO-07", "Kemeja Demo 7", "KEMEJA", 55000)
        o, c = order(ka.id, "ORD-DEMO-07", MaklonScheme.CMT, 80, v.id, OrderStatus.SAMPLE)
        out_ids["o7"] = str(o.id)

        # O8: Snohund MENUNGGU_QC (assembled)
        v = sample(sn.id, "SMP-DEMO-08", "Hoodie Snøhund 8", "HOODIE", 150000)
        it = item(sn.id, "KAIN-DEMO-S1", "Fleece Snøhund", "RAK-S-01")
        o, c = order(sn.id, "ORD-DEMO-08", MaklonScheme.FULL_PACKAGE, 200, v.id, OrderStatus.CUTTING)
        p = po("PO-DEMO-08", sn.id, o.id, "PT Sup", [(it, 400.0, 22000)])
        receive(it, o, p, 400.0, "SJ-D10-08")
        hand(it, o, 300.0)
        o.status = OrderStatus.SEWING
        out(o, c[0], 150, True)
        out(o, c[1], 50, True)
        db.add(AssemblyBatch(order_id=o.id, client_id=sn.id, qty_assembled=180,
                             assembled_by_user_id=mandor.id, notes="Demo10"))
        o.status = OrderStatus.MENUNGGU_QC
        out_ids["o8"] = str(o.id)

        # O9: A QC partial
        v = sample(ka.id, "SMP-DEMO-09", "Tas Demo 9", "TAS", 60000)
        it = item(ka.id, "KAIN-DEMO-A4", "Kanvas Demo A4", "RAK-A-04")
        o, c = order(ka.id, "ORD-DEMO-09", MaklonScheme.SEMI_CMT, 150, v.id, OrderStatus.CUTTING)
        p = po("PO-DEMO-09", ka.id, o.id, "PT Sup", [(it, 300.0, 14000)])
        receive(it, o, p, 300.0, "SJ-D10-09")
        hand(it, o, 200.0)
        o.status = OrderStatus.SEWING
        out(o, c[0], 100, True)
        o.status = OrderStatus.MENUNGGU_QC
        db.add(AssemblyBatch(order_id=o.id, client_id=ka.id, qty_assembled=90,
                             assembled_by_user_id=mandor.id, notes="Demo10"))
        o.status = OrderStatus.QC
        db.add(QCInspection(order_id=o.id, inspector_user_id=qc_u.id, status=QCStatus.REPAIR,
                            qty_inspected=15, repair_count=1, defect_category="Jahitan loncat",
                            action_route="LINE_REPAIR"))

        # O10: B CUTTING, PO DRAFT
        v = sample(kb.id, "SMP-DEMO-10", "Topi Demo 10", "TOPI", 30000)
        it = item(kb.id, "KAIN-DEMO-B4", "Kanvas Demo B4", "RAK-B-04")
        o, c = order(kb.id, "ORD-DEMO-10", MaklonScheme.CMT, 60, v.id, OrderStatus.CUTTING)
        po("PO-DEMO-10", kb.id, o.id, "PT Sup", [(it, 100.0, 9000)], approved=False)

        db.commit()
        print("Seed demo10 selesai: ORD-DEMO-01..10.")
        return out_ids
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
