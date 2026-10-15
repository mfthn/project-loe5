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
    if po.status != POStatus.DRAFT:
        raise POTransitionError(po.status.value, "direview")
    po.status = POStatus.DISETUJUI if approve else POStatus.DITOLAK
    po.reviewed_by_user_id = reviewer_id
    po.reviewed_at = datetime.now(timezone.utc)
    if notes:
        po.notes = notes
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
