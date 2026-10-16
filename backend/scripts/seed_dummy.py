"""Seed data dummy operasional: 5 pesanan saling terhubung.

- ORD-DUMMY-01 (Klien A): COMPLETED + invoice LUNAS
- ORD-DUMMY-02 (Klien B): COMPLETED + invoice BELUM_BAYAR
- ORD-DUMMY-03 (Klien A): SEWING (pengerjaan, output terverifikasi)
- ORD-DUMMY-04 (Klien B): CUTTING (pengerjaan, handover menunggu mandor)
- ORD-DUMMY-05 (Klien A): CUTTING (PO disetujui, terima sebagian di gudang)

Jalankan: python scripts/seed_dummy.py
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


def _get(db, model, **kw):
    return db.scalar(select(model).filter_by(**kw))


def _user(db, username: str) -> User:
    u = _get(db, User, username=username)
    assert u is not None, f"User {username} tidak ada — jalankan scripts/seed.py dulu"
    return u


def _client(db, like: str) -> Client:
    c = db.scalar(select(Client).where(Client.company_name.like(like)))
    assert c is not None, f"Client {like} tidak ada — jalankan scripts/seed.py dulu"
    return c


def make_sample(db, client_id, code, article, category, price, owner_id, sample_id):
    s = Sample(client_id=client_id, sample_code=code, article_name=article,
               category=category)
    db.add(s)
    db.flush()
    v = SampleVersion(
        sample_id=s.id, version_number=1, status=SampleStatus.OWNER_APPROVED,
        tech_pack_notes="Dummy terhubung",
        agreed_price=Decimal(str(price)), currency="IDR",
        sample_approved_by=sample_id, sample_approved_at=NOW,
        owner_approved_by=owner_id, owner_approved_at=NOW,
    )
    db.add(v)
    db.flush()
    for name, usage, secs in (("Badan Depan", 1.2, 120.0), ("Lengan", 0.5, 60.0)):
        db.add(SampleComponent(
            sample_version_id=v.id, component_name=name,
            material_usage_est=usage, time_study_seconds=secs,
        ))
    db.flush()
    return s, v


def make_item(db, client_id, code, name, stock=0.0, unit="METER", loc=None):
    item = InventoryItem(
        client_id=client_id, material_code=code, material_name=name,
        current_stock=stock, unit_measure=unit, storage_location=loc,
    )
    db.add(item)
    db.flush()
    return item


def make_order(db, client_id, number, scheme, target, version_id, status):
    o = Order(
        client_id=client_id, order_number=number, scheme=scheme,
        target_quantity=target, sample_version_id=version_id, status=status,
    )
    db.add(o)
    db.flush()
    comps = []
    for i, (name, cut, sew) in enumerate(
        (("Badan Depan", 500, 2500), ("Lengan", 400, 1800)), start=1
    ):
        c = OrderComponent(order_id=o.id, component_name=name, sequence_order=i)
        db.add(c)
        db.flush()
        db.add(RateCard(order_component_id=c.id, cutting_rate_per_pcs=Decimal(str(cut)),
                        sewing_rate_per_pcs=Decimal(str(sew))))
        comps.append(c)
    db.flush()
    return o, comps


def make_po(db, number, client_id, order_id, supplier, lines, requester_id, approved=True,
            reviewer_id=None):
    po = PurchaseOrder(
        po_number=number, client_id=client_id, order_id=order_id,
        supplier_name=supplier, status=POStatus.DRAFT,
        requested_by_user_id=requester_id, notes="Dummy",
    )
    db.add(po)
    db.flush()
    for i, (item, qty, price) in enumerate(lines, start=1):
        db.add(POLine(po_id=po.id, inventory_item_id=item.id, sequence_order=i,
                      qty_ordered=qty, qty_received=0.0, unit_price=Decimal(str(price))))
    if approved:
        po.status = POStatus.DISETUJUI
        po.reviewed_by_user_id = reviewer_id
        po.reviewed_at = NOW
    db.flush()
    return po


def receive(db, item, order, po, qty, user_id, note):
    line = next(ln for ln in po.lines if ln.inventory_item_id == item.id)
    line.qty_received += qty
    if all(abs(ln.qty_received - ln.qty_ordered) < 1e-9 for ln in po.lines):
        po.status = POStatus.SELESAI
    else:
        po.status = POStatus.DITERIMA_SEBAGIAN
    item.current_stock += qty
    trx = InventoryTransaction(
        inventory_item_id=item.id, client_id=item.client_id, order_id=order.id,
        transaction_type=TransactionType.IN, quantity=qty,
        performed_by_user_id=user_id, notes=note,
    )
    db.add(trx)
    db.flush()
    return trx


def handover(db, order, item, qty, handed_by, request=None, received_by=None):
    item.current_stock -= qty
    trx = InventoryTransaction(
        inventory_item_id=item.id, client_id=item.client_id, order_id=order.id,
        transaction_type=TransactionType.OUT, quantity=qty,
        performed_by_user_id=handed_by.id,
        notes=f"Serah terima ke produksi untuk order {order.order_number}",
    )
    db.add(trx)
    db.flush()
    ho = MaterialHandover(
        order_id=order.id, inventory_item_id=item.id,
        material_request_id=request.id if request else None,
        transaction_id=trx.id, client_id=order.client_id, quantity=qty,
        handed_by_user_id=handed_by.id,
        received_by_user_id=received_by.id if received_by else None,
        received_at=NOW if received_by else None,
        notes="Dummy",
    )
    db.add(ho)
    if request:
        request.qty_fulfilled += qty
        if request.qty_fulfilled >= request.qty_requested - 1e-9:
            request.status = RequestStatus.DISERAHKAN
    db.flush()
    return ho


def output(db, order, comp, user, qty, verified, line=1, by=None):
    o = ProductionOutput(
        order_id=order.id, order_component_id=comp.id,
        operator_user_id=user.id,
        verified_by_user_id=by.id if (verified and by) else None,
        line_number=line, qty_completed=qty, is_verified=verified,
        time_window=NOW,
    )
    db.add(o)
    db.flush()
    return o


def seed() -> None:
    db = SessionLocal()
    try:
        if _get(db, Order, order_number="ORD-DUMMY-01") is not None:
            print("Dummy sudah ada — lewati.")
            return
        owner = _user(db, "hendra_owner")
        mandor = _user(db, "agus_mandor")
        jahit = _user(db, "siti_jahit")
        gudang = _user(db, "budi_gudang")
        sample_u = _user(db, "adis_sample")
        qc_u = _user(db, "dewi_qc")
        finance = _user(db, "rina_finance")
        ka, kb = _client(db, "%Klien A%"), _client(db, "%Klien B%")

        # ── O1: Klien A COMPLETED, invoice LUNAS ──
        s1, v1 = make_sample(db, ka.id, "SMP-DUMMY-01", "Kemeja Dummy A", "KEMEJA",
                             45000, owner.id, sample_u.id)
        it1 = make_item(db, ka.id, "KAIN-DUMMY-A1", "Katun Dummy A", loc="RAK-A-01")
        o1, c1 = make_order(db, ka.id, "ORD-DUMMY-01", MaklonScheme.CMT, 200,
                            v1.id, OrderStatus.CUTTING)
        po1 = make_po(db, "PO-DUMMY-01", ka.id, o1.id, "PT Supplier Dummy",
                      [(it1, 500.0, 15000)], sample_u.id, True, finance.id)
        receive(db, it1, o1, po1, 500.0, gudang.id, "SJ-DUMMY-01")
        handover(db, o1, it1, 300.0, gudang, received_by=mandor)
        o1.status = OrderStatus.SEWING
        output(db, o1, c1[0], jahit, 120, True, 1, mandor)
        output(db, o1, c1[1], jahit, 80, True, 1, mandor)
        o1.status = OrderStatus.MENUNGGU_QC
        db.add(QCInspection(order_id=o1.id, inspector_user_id=qc_u.id,
                            status=QCStatus.LOLOS, qty_inspected=150,
                            repair_count=0, action_route="GUDANG_BARANG_JADI"))
        o1.status = OrderStatus.COMPLETED
        inv1 = Invoice(invoice_number="INV-DUMMY-01", client_id=ka.id, order_id=o1.id,
                       amount_total=Decimal("9000000.00"), amount_paid=Decimal("9000000.00"),
                       status=InvoiceStatus.LUNAS, issued_by_user_id=finance.id,
                       approved_by_user_id=owner.id, approved_at=NOW, notes="Dummy")
        db.add(inv1)
        db.flush()
        db.add(InvoicePayment(invoice_id=inv1.id, amount=Decimal("9000000.00"),
                              recorded_by_user_id=finance.id, notes="Pelunasan dummy"))

        # ── O2: Klien B COMPLETED, invoice BELUM_BAYAR ──
        s2, v2 = make_sample(db, kb.id, "SMP-DUMMY-02", "Jaket Dummy B", "JAKET",
                             120000, owner.id, sample_u.id)
        it2 = make_item(db, kb.id, "KAIN-DUMMY-B1", "Drill Dummy B", loc="RAK-B-02")
        o2, c2 = make_order(db, kb.id, "ORD-DUMMY-02", MaklonScheme.SEMI_CMT, 100,
                            v2.id, OrderStatus.CUTTING)
        po2 = make_po(db, "PO-DUMMY-02", kb.id, o2.id, "PT Supplier Dummy",
                      [(it2, 300.0, 20000)], sample_u.id, True, finance.id)
        receive(db, it2, o2, po2, 300.0, gudang.id, "SJ-DUMMY-02")
        handover(db, o2, it2, 200.0, gudang, received_by=mandor)
        o2.status = OrderStatus.SEWING
        output(db, o2, c2[0], jahit, 70, True, 2, mandor)
        o2.status = OrderStatus.MENUNGGU_QC
        db.add(QCInspection(order_id=o2.id, inspector_user_id=qc_u.id,
                            status=QCStatus.LOLOS, qty_inspected=60,
                            repair_count=0, action_route="GUDANG_BARANG_JADI"))
        db.add(QCInspection(order_id=o2.id, inspector_user_id=qc_u.id,
                            status=QCStatus.REPAIR, qty_inspected=10, repair_count=1,
                            defect_category="Jahitan loncat",
                            action_route="LINE_REPAIR"))
        o2.status = OrderStatus.COMPLETED
        db.add(Invoice(invoice_number="INV-DUMMY-02", client_id=kb.id, order_id=o2.id,
                       amount_total=Decimal("12000000.00"), amount_paid=Decimal("0"),
                       status=InvoiceStatus.BELUM_BAYAR, issued_by_user_id=finance.id,
                       approved_by_user_id=owner.id, approved_at=NOW, notes="Dummy"))

        # ── O3: Klien A SEWING (pengerjaan) ──
        s3, v3 = make_sample(db, ka.id, "SMP-DUMMY-03", "Kaos Dummy A2", "KAOS",
                             35000, owner.id, sample_u.id)
        it3 = make_item(db, ka.id, "KAIN-DUMMY-A2", "Combed Dummy A2", loc="RAK-A-03")
        o3, c3 = make_order(db, ka.id, "ORD-DUMMY-03", MaklonScheme.CMT, 300,
                            v3.id, OrderStatus.CUTTING)
        po3 = make_po(db, "PO-DUMMY-03", ka.id, o3.id, "PT Supplier Dummy",
                      [(it3, 400.0, 12000)], sample_u.id, True, finance.id)
        receive(db, it3, o3, po3, 400.0, gudang.id, "SJ-DUMMY-03")
        handover(db, o3, it3, 250.0, gudang, received_by=mandor)
        o3.status = OrderStatus.SEWING
        output(db, o3, c3[0], jahit, 60, True, 1, mandor)
        output(db, o3, c3[1], jahit, 30, False, 1)

        # ── O4: Klien B CUTTING (pengerjaan, handover menunggu mandor) ──
        s4, v4 = make_sample(db, kb.id, "SMP-DUMMY-04", "Celana Dummy B2", "CELANA",
                             80000, owner.id, sample_u.id)
        it4 = make_item(db, kb.id, "KAIN-DUMMY-B2", "Denim Dummy B2", loc="RAK-B-04")
        o4, c4 = make_order(db, kb.id, "ORD-DUMMY-04", MaklonScheme.FULL_PACKAGE, 150,
                            v4.id, OrderStatus.CUTTING)
        po4 = make_po(db, "PO-DUMMY-04", kb.id, o4.id, "PT Supplier Dummy",
                      [(it4, 250.0, 25000)], sample_u.id, True, finance.id)
        receive(db, it4, o4, po4, 250.0, gudang.id, "SJ-DUMMY-04")
        req4 = MaterialRequest(
            order_id=o4.id, inventory_item_id=it4.id, client_id=kb.id,
            qty_requested=150.0, qty_fulfilled=0.0, status=RequestStatus.DISETUJUI,
            requested_by_user_id=mandor.id, reviewed_by_user_id=gudang.id,
            reviewed_at=NOW, notes="Dummy",
        )
        db.add(req4)
        db.flush()
        handover(db, o4, it4, 150.0, gudang, request=req4, received_by=None)

        # ── O5: Klien A CUTTING (PO disetujui, terima sebagian di gudang) ──
        s5, v5 = make_sample(db, ka.id, "SMP-DUMMY-05", "Hoodie Dummy A3", "HOODIE",
                             95000, owner.id, sample_u.id)
        it5 = make_item(db, ka.id, "KAIN-DUMMY-A3", "Fleece Dummy A3", loc="RAK-A-05")
        o5, c5 = make_order(db, ka.id, "ORD-DUMMY-05", MaklonScheme.FULL_PACKAGE, 120,
                            v5.id, OrderStatus.CUTTING)
        po5 = make_po(db, "PO-DUMMY-05", ka.id, o5.id, "PT Supplier Dummy",
                      [(it5, 500.0, 18000)], sample_u.id, True, finance.id)
        receive(db, it5, o5, po5, 200.0, gudang.id, "SJ-DUMMY-05 termin 1")

        db.commit()
        print("Seed dummy selesai: ORD-DUMMY-01..05 terhubung penuh.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
