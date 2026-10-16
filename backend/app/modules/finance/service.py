"""Logika bisnis Finance: PO bahan (sample → finance/owner → gudang) & Invoice klien.

Alur PO:
  1. Tim Sample mengajukan PO (DRAFT) setelah kesepakatan produk dengan klien.
  2. Finance/Owner mereview: DISETUJUI / DITOLAK.
  3. Gudang menerima barang menunjuk PO (qty_received terakumulasi):
     DISETUJUI → DITERIMA_SEBAGIAN → SELESAI (otomatis).

Alur Invoice:
  1. Finance menerbitkan DRAFT hanya untuk order COMPLETED (satu invoice per order).
  2. Owner menyetujui → BELUM_BAYAR (atau menolak → DITOLAK).
  3. Pembayaran bertahap tercatat → SEBAGIAN → LUNAS (otomatis, tolak kelebihan bayar).
"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.modules.finance.errors import (
    InvoiceNotFoundError,
    InvoiceNumberDuplicateError,
    InvoiceOrderError,
    InvoicePaymentError,
    PONotFoundError,
    PONumberDuplicateError,
    POTransitionError,
)
from app.modules.finance.models import (
    Invoice,
    InvoicePayment,
    InvoiceStatus,
    POLine,
    POStatus,
    PurchaseOrder,
)
from app.modules.finance.schemas import InvoiceCreate, InvoicePaymentCreate, POCreate
from app.modules.gudang.models import InventoryItem
from app.modules.produksi.models import Order, OrderStatus
from app.modules.sample.models import SampleVersion


def _get_po(db: Session, po_id: uuid.UUID) -> PurchaseOrder:
    po = db.scalar(
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.lines))
        .where(PurchaseOrder.id == po_id)
    )
    if po is None:
        raise PONotFoundError(po_id)
    return po


def create_po(db: Session, payload: POCreate, requester_id: uuid.UUID | None = None) -> PurchaseOrder:
    if db.scalar(select(PurchaseOrder).where(PurchaseOrder.po_number == payload.po_number.strip().upper())):
        raise PONumberDuplicateError(payload.po_number)
    order = db.scalar(select(Order).where(Order.id == payload.order_id))
    if order is None:
        raise ValueError(f"Order dengan ID {payload.order_id} tidak ditemukan.")
    for line in payload.lines:
        item = db.scalar(select(InventoryItem).where(InventoryItem.id == line.inventory_item_id))
        if item is None:
            raise ValueError(f"Item bahan {line.inventory_item_id} tidak ditemukan.")
        if item.client_id != order.client_id:
            raise ValueError(
                f"Bahan '{item.material_name}' bukan milik klien order {order.order_number}."
            )
    po = PurchaseOrder(
        po_number=payload.po_number.strip().upper(),
        client_id=order.client_id,
        order_id=order.id,
        supplier_name=payload.supplier_name.strip(),
        status=POStatus.DRAFT,
        requested_by_user_id=requester_id,
        notes=payload.notes,
    )
    db.add(po)
    db.flush()
    for i, line in enumerate(payload.lines, start=1):
        db.add(
            POLine(
                po_id=po.id,
                inventory_item_id=line.inventory_item_id,
                sequence_order=i,
                qty_ordered=line.qty_ordered,
                qty_received=0.0,
                unit_price=line.unit_price,
            )
        )
    db.commit()
    db.refresh(po)
    return po


def list_pos(
    db: Session,
    client_id: uuid.UUID | None = None,
    order_id: uuid.UUID | None = None,
    status: POStatus | None = None,
) -> list[PurchaseOrder]:
    stmt = (
        select(PurchaseOrder)
        .options(selectinload(PurchaseOrder.lines))
        .order_by(PurchaseOrder.created_at.desc())
    )
    if client_id is not None:
        stmt = stmt.where(PurchaseOrder.client_id == client_id)
    if order_id is not None:
        stmt = stmt.where(PurchaseOrder.order_id == order_id)
    if status is not None:
        stmt = stmt.where(PurchaseOrder.status == status)
    return list(db.scalars(stmt).all())


def review_po(
    db: Session,
    po_id: uuid.UUID,
    approve: bool,
    reviewer_id: uuid.UUID | None = None,
    notes: str | None = None,
) -> PurchaseOrder:
    po = _get_po(db, po_id)
    if po.status not in (POStatus.DRAFT, POStatus.TERKONFIRMASI):
        raise POTransitionError(po.status.value, "direview")
    po.status = POStatus.DISETUJUI if approve else POStatus.DITOLAK
    po.reviewed_by_user_id = reviewer_id
    po.reviewed_at = datetime.now(timezone.utc)
    if notes:
        po.notes = notes
    db.commit()
    db.refresh(po)
    return po


def confirm_po(
    db: Session,
    po_id: uuid.UUID,
    confirmer_id: uuid.UUID | None = None,
) -> PurchaseOrder:
    """Gudang mengonfirmasi kebutuhan pengadaan (DRAFT → TERKONFIRMASI).

    Alur: Sample kirim kebutuhan (DRAFT) → Gudang konfirmasi → Finance setujui/bayar.
    """
    po = _get_po(db, po_id)
    if po.status != POStatus.DRAFT:
        raise POTransitionError(po.status.value, "dikonfirmasi gudang")
    po.status = POStatus.TERKONFIRMASI
    po.reviewed_by_user_id = confirmer_id
    po.reviewed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(po)
    return po


def record_po_receipt(
    db: Session, po_id: uuid.UUID, inventory_item_id: uuid.UUID, quantity: float,
    order_id: uuid.UUID | None = None,
) -> PurchaseOrder:
    """Akumulasi penerimaan gudang ke line PO + majukan status otomatis."""
    po = _get_po(db, po_id)
    if po.status not in (POStatus.DISETUJUI, POStatus.DITERIMA_SEBAGIAN):
        raise POTransitionError(po.status.value, "diterima barangnya")
    if order_id is not None and po.order_id != order_id:
        raise POTransitionError(po.status.value, f"dipakai untuk order lain ({order_id})")
    line = next((ln for ln in po.lines if ln.inventory_item_id == inventory_item_id), None)
    if line is None:
        raise ValueError("Item bahan tidak tercantum dalam PO ini.")
    remaining = line.qty_ordered - line.qty_received
    if quantity - remaining > 1e-9:
        raise ValueError(
            f"Kuantitas terima ({quantity}) melebihi sisa PO ({remaining})."
        )
    line.qty_received += quantity
    if all(ln.qty_received - ln.qty_ordered >= -1e-9 for ln in po.lines):
        po.status = POStatus.SELESAI
    else:
        po.status = POStatus.DITERIMA_SEBAGIAN
    db.commit()
    db.refresh(po)
    return po


# ---------------------------------------------------------------------------
# Invoice
# ---------------------------------------------------------------------------

def _suggested_amount(db: Session, order: Order) -> Decimal | None:
    # Prioritas: harga jual disetujui owner; fallback agreed_price × target qty.
    if order.selling_price_status == "DISETUJUI" and order.selling_price is not None:
        return Decimal(str(order.selling_price))
    if order.sample_version_id is None:
        return None
    sv = db.scalar(select(SampleVersion).where(SampleVersion.id == order.sample_version_id))
    if sv is None or sv.agreed_price is None:
        return None
    return Decimal(str(sv.agreed_price)) * Decimal(order.target_quantity)


def create_invoice(
    db: Session, payload: InvoiceCreate, issuer_id: uuid.UUID | None = None
) -> Invoice:
    if db.scalar(select(Invoice).where(Invoice.invoice_number == payload.invoice_number.strip().upper())):
        raise InvoiceNumberDuplicateError(payload.invoice_number)
    order = db.scalar(select(Order).where(Order.id == payload.order_id))
    if order is None:
        raise InvoiceOrderError(f"Order dengan ID {payload.order_id} tidak ditemukan.")
    if order.status != OrderStatus.COMPLETED:
        raise InvoiceOrderError(
            f"Invoice hanya untuk order SELESAI (COMPLETED). Status kini: {order.status.value}."
        )
    if db.scalar(select(Invoice).where(Invoice.order_id == order.id)) is not None:
        raise InvoiceOrderError(f"Order {order.order_number} sudah memiliki invoice.")
    if payload.amount_total is not None:
        amount = Decimal(str(payload.amount_total))
    else:
        auto = _suggested_amount(db, order)
        if auto is None:
            raise InvoiceOrderError(
                "Tidak ada harga kesepakatan (agreed_price) pada order ini; "
                "isi amount_total secara manual."
            )
        amount = auto
    if amount <= 0:
        raise InvoiceOrderError("Nilai invoice wajib lebih besar dari 0.")
    inv = Invoice(
        invoice_number=payload.invoice_number.strip().upper(),
        client_id=order.client_id,
        order_id=order.id,
        amount_total=amount,
        amount_paid=Decimal("0.00"),
        status=InvoiceStatus.DRAFT,
        issued_by_user_id=issuer_id,
        notes=payload.notes,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv


def list_invoices(
    db: Session,
    client_id: uuid.UUID | None = None,
    order_id: uuid.UUID | None = None,
    status: InvoiceStatus | None = None,
) -> list[Invoice]:
    stmt = select(Invoice).order_by(Invoice.created_at.desc())
    if client_id is not None:
        stmt = stmt.where(Invoice.client_id == client_id)
    if order_id is not None:
        stmt = stmt.where(Invoice.order_id == order_id)
    if status is not None:
        stmt = stmt.where(Invoice.status == status)
    return list(db.scalars(stmt).all())


def _get_invoice(db: Session, invoice_id: uuid.UUID) -> Invoice:
    inv = db.scalar(
        select(Invoice)
        .options(selectinload(Invoice.payments))
        .where(Invoice.id == invoice_id)
    )
    if inv is None:
        raise InvoiceNotFoundError(invoice_id)
    return inv


def approve_invoice(
    db: Session, invoice_id: uuid.UUID, approver_id: uuid.UUID | None = None
) -> Invoice:
    inv = _get_invoice(db, invoice_id)
    if inv.status != InvoiceStatus.DRAFT:
        raise InvoiceOrderError(f"Invoice berstatus {inv.status.value} tidak bisa disetujui.")
    inv.status = InvoiceStatus.BELUM_BAYAR
    inv.approved_by_user_id = approver_id
    inv.approved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(inv)
    return inv


def reject_invoice(
    db: Session, invoice_id: uuid.UUID, approver_id: uuid.UUID | None = None
) -> Invoice:
    inv = _get_invoice(db, invoice_id)
    if inv.status != InvoiceStatus.DRAFT:
        raise InvoiceOrderError(f"Invoice berstatus {inv.status.value} tidak bisa ditolak.")
    inv.status = InvoiceStatus.DITOLAK
    inv.approved_by_user_id = approver_id
    inv.approved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(inv)
    return inv


def record_payment(
    db: Session,
    invoice_id: uuid.UUID,
    payload: InvoicePaymentCreate,
    recorder_id: uuid.UUID | None = None,
) -> Invoice:
    inv = _get_invoice(db, invoice_id)
    if inv.status not in (InvoiceStatus.BELUM_BAYAR, InvoiceStatus.SEBAGIAN):
        raise InvoicePaymentError(
            f"Invoice berstatus {inv.status.value} tidak bisa dibayar. "
            "Minta approval owner terlebih dahulu."
        )
    amount = Decimal(str(payload.amount))
    remaining = Decimal(str(inv.amount_total)) - Decimal(str(inv.amount_paid))
    if amount - remaining > Decimal("0.001"):
        raise InvoicePaymentError(
            f"Pembayaran Rp {amount:,.0f} melebihi sisa Rp {remaining:,.0f}."
        )
    db.add(
        InvoicePayment(
            invoice_id=inv.id,
            amount=amount,
            recorded_by_user_id=recorder_id,
            notes=payload.notes,
        )
    )
    inv.amount_paid = Decimal(str(inv.amount_paid)) + amount
    if Decimal(str(inv.amount_paid)) >= Decimal(str(inv.amount_total)) - Decimal("0.001"):
        inv.status = InvoiceStatus.LUNAS
    else:
        inv.status = InvoiceStatus.SEBAGIAN
    db.commit()
    db.refresh(inv)
    return inv


def realized_material_cost(db: Session, order_id: uuid.UUID) -> dict:
    """Jumlahkan biaya bahan terealisasi: Σ qty_received × unit_price PO non-batal.

    Hanya PO DISETUJUI / DITERIMA_SEBAGIAN / SELESAI yang dihitung.
    """
    order = db.scalar(select(Order).where(Order.id == order_id))
    if order is None:
        raise ValueError(f"Order dengan ID {order_id} tidak ditemukan.")
    pos = list_pos(db, order_id=order_id)
    breakdown = []
    total = Decimal("0")
    counted = 0
    for po in pos:
        if po.status in (POStatus.DRAFT, POStatus.DITOLAK):
            continue
        po_total = Decimal("0")
        for line in po.lines:
            line_cost = Decimal(str(line.qty_received)) * Decimal(str(line.unit_price))
            po_total += line_cost
        total += po_total
        counted += 1
        breakdown.append(
            {
                "po_id": str(po.id),
                "po_number": po.po_number,
                "status": po.status.value,
                "realized_cost": float(po_total),
            }
        )
    return {
        "order_id": str(order.id),
        "order_number": order.order_number,
        "realized_material_cost": float(total),
        "po_count": counted,
        "breakdown": breakdown,
    }


def update_po_draft(
    db: Session,
    po_id: uuid.UUID,
    supplier_name: str | None = None,
    line_prices: dict | None = None,
) -> PurchaseOrder:
    """Finance melengkapi PO DRAFT (supplier + harga satuan) sebelum review."""
    po = _get_po(db, po_id)
    if po.status != POStatus.DRAFT:
        raise POTransitionError(po.status.value, "diubah (hanya DRAFT)")
    if supplier_name:
        po.supplier_name = supplier_name.strip()
    if line_prices:
        for line in po.lines:
            key = str(line.inventory_item_id)
            if key in line_prices:
                price = Decimal(str(line_prices[key]))
                if price < 0:
                    raise ValueError("Harga satuan tidak boleh negatif.")
                line.unit_price = price
    db.commit()
    db.refresh(po)
    return po


def record_po_payment(
    db: Session,
    po_id: uuid.UUID,
    amount: Decimal,
    recorder_id: uuid.UUID | None = None,
    notes: str | None = None,
) -> dict:
    """Finance membayar supplier bertahap. Menolak kelebihan dari total PO."""
    from app.modules.finance.models import POPayment

    po = _get_po(db, po_id)
    if po.status in (POStatus.DRAFT, POStatus.DITOLAK):
        raise POTransitionError(po.status.value, "dibayar (PO belum disetujui)")
    amount = Decimal(str(amount))
    if amount <= 0:
        raise ValueError("Nominal pembayaran wajib lebih dari 0.")
    paid = sum(
        (Decimal(str(p.amount)) for p in db.scalars(
            select(POPayment).where(POPayment.po_id == po.id)
        ).all()),
        start=Decimal("0"),
    )
    if amount - (po.total_amount - paid) > Decimal("0.001"):
        raise ValueError(
            f"Pembayaran Rp {amount:,.0f} melebihi sisa Rp {(po.total_amount - paid):,.0f}."
        )
    db.add(POPayment(
        po_id=po.id, amount=amount, recorded_by_user_id=recorder_id, notes=notes,
    ))
    db.commit()
    total_paid = paid + amount
    return {
        "po_id": str(po.id),
        "po_number": po.po_number,
        "total_amount": float(po.total_amount),
        "total_paid": float(total_paid),
        "remaining": float(po.total_amount - total_paid),
        "lunas": total_paid >= po.total_amount - Decimal("0.001"),
    }


def production_needs(
    db: Session,
    client_id: uuid.UUID | None = None,
    order_id: uuid.UUID | None = None,
) -> list[dict]:
    """Status kebutuhan produksi per (order, item): diminta vs terpenuhi + stok.

    TERPENUHI bila qty_terpenuhi + stok_saat_ini >= qty_diminta pada order aktif.
    """
    reqs = list_material_requests_like(db, client_id, order_id)
    out = []
    for req, item, order in reqs:
        need = req.qty_requested - req.qty_fulfilled
        covered = (item.current_stock or 0.0) >= need - 1e-9
        done = req.qty_fulfilled >= req.qty_requested - 1e-9
        out.append({
            "request_id": str(req.id),
            "order_id": str(order.id),
            "order_number": order.order_number,
            "order_status": order.status.value,
            "inventory_item_id": str(item.id),
            "material_code": item.material_code,
            "material_name": item.material_name,
            "qty_requested": req.qty_requested,
            "qty_fulfilled": req.qty_fulfilled,
            "current_stock": item.current_stock,
            "request_status": req.status.value,
            "need_status": "TERPENUHI" if (done or covered) else "BELUM",
        })
    return out


def list_material_requests_like(db: Session, client_id, order_id):
    from app.modules.gudang.models import InventoryItem, MaterialRequest

    stmt = (
        select(MaterialRequest, InventoryItem, Order)
        .join(InventoryItem, InventoryItem.id == MaterialRequest.inventory_item_id)
        .join(Order, Order.id == MaterialRequest.order_id)
        .order_by(MaterialRequest.created_at.desc())
    )
    if client_id is not None:
        stmt = stmt.where(MaterialRequest.client_id == client_id)
    if order_id is not None:
        stmt = stmt.where(MaterialRequest.order_id == order_id)
    return list(db.execute(stmt).all())
