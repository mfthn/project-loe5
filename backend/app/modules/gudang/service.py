"""Logika bisnis gudang, mutasi stok, dan penjagaan anti-kontaminasi silang (FR-5, FR-6)."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.gudang.errors import (
    CrossContaminationError,
    InvalidRequestTransitionError,
    MaterialHandoverNotFoundError,
    MaterialRequestNotFoundError,
)
from app.modules.gudang.models import (
    InventoryItem,
    InventoryTransaction,
    MaterialHandover,
    MaterialRequest,
    RequestStatus,
    TransactionType,
)
from app.modules.gudang.schemas import (
    HandoverCreate,
    InventoryItemCreate,
    MaterialIssueRequest,
    MaterialReceiptRequest,
    MaterialRequestCreate,
)
from app.modules.produksi.models import Order, OrderStatus


def list_inventory_items(
    db: Session, client_id: uuid.UUID | None = None
) -> list[InventoryItem]:
    """Mendapatkan daftar item stok bahan baku, opsional filter per klien."""
    stmt = select(InventoryItem).order_by(InventoryItem.created_at.desc())
    if client_id is not None:
        stmt = stmt.where(InventoryItem.client_id == client_id)
    return list(db.scalars(stmt).all())


def get_inventory_item(db: Session, item_id: uuid.UUID) -> InventoryItem | None:
    """Mengambil detail satu item inventaris."""
    return db.scalar(select(InventoryItem).where(InventoryItem.id == item_id))


def create_inventory_item(
    db: Session,
    payload: InventoryItemCreate,
    user_id: uuid.UUID | None = None,
) -> InventoryItem:
    """Mendaftarkan item bahan baku baru, terikat client_id + order_id (FR-6.1)."""
    order = db.scalar(select(Order).where(Order.id == payload.order_id))
    if order is None:
        raise ValueError(f"Order dengan ID {payload.order_id} tidak ditemukan.")
    if order.client_id != payload.client_id:
        raise ValueError(
            f"Bahan milik klien {payload.client_id} tidak boleh didaftarkan "
            f"untuk pesanan {order.order_number} milik klien {order.client_id}."
        )
    item = InventoryItem(
        client_id=payload.client_id,
        material_code=payload.material_code.strip().upper(),
        material_name=payload.material_name.strip(),
        current_stock=payload.initial_stock,
        unit_measure=payload.unit_measure.strip().upper(),
    )
    db.add(item)
    db.flush()

    # Jika ada stok awal, catat sebagai transaksi IN perdana terikat order
    if payload.initial_stock > 0:
        trx = InventoryTransaction(
            inventory_item_id=item.id,
            client_id=item.client_id,
            order_id=order.id,
            transaction_type=TransactionType.IN,
            quantity=payload.initial_stock,
            performed_by_user_id=user_id,
            notes="Saldo awal pendaftaran material baru",
        )
        db.add(trx)

    db.commit()
    db.refresh(item)
    return item


def receive_material(
    db: Session,
    payload: MaterialReceiptRequest,
    user_id: uuid.UUID | None = None,
) -> InventoryTransaction:
    """Penerimaan bahan masuk (Transaksi IN) terikat dengan Tag ID Klien.

    Jika order_id diisi, po_id WAJIB menunjuk PO yang sudah DISETUJUI
    (atau DITERIMA_SEBAGIAN) untuk order + item yang sama.
    """
    item = get_inventory_item(db, payload.inventory_item_id)
    if not item:
        raise ValueError(f"Item bahan dengan ID {payload.inventory_item_id} tidak ditemukan.")

    if payload.order_id:
        order = db.scalar(select(Order).where(Order.id == payload.order_id))
        if not order:
            raise ValueError(f"Order dengan ID {payload.order_id} tidak ditemukan.")
        # Validasi: order harus milik klien yang sama dengan bahan
        if order.client_id != item.client_id:
            raise CrossContaminationError(
                item_id=item.id,
                item_client_id=item.client_id,
                order_id=order.id,
                order_client_id=order.client_id,
                material_name=item.material_name,
                order_number=order.order_number,
            )
        if not payload.po_id:
            raise ValueError(
                "Penerimaan untuk pesanan wajib menunjuk PO yang sudah disetujui (po_id)."
            )
        from app.modules.finance.service import record_po_receipt

        record_po_receipt(db, payload.po_id, item.id, payload.quantity, order_id=order.id)

    item.current_stock += payload.quantity

    trx = InventoryTransaction(
        inventory_item_id=item.id,
        client_id=item.client_id,
        order_id=payload.order_id,
        transaction_type=TransactionType.IN,
        quantity=payload.quantity,
        performed_by_user_id=user_id,
        notes=payload.notes,
    )
    db.add(trx)
    db.commit()
    db.refresh(trx)
    return trx


def issue_material_to_cutting(
    db: Session,
    payload: MaterialIssueRequest,
    user_id: uuid.UUID | None = None,
) -> InventoryTransaction:
    """Pengeluaran bahan ke lantai cutting (Transaksi OUT).

    ATURAN ANTI-KONTAMINASI SILANG (FR-6.2):
    Sistem wajib memblokir jika item.client_id != order.client_id sebelum stok berubah!
    """
    item = get_inventory_item(db, payload.inventory_item_id)
    if not item:
        raise ValueError(f"Item bahan dengan ID {payload.inventory_item_id} tidak ditemukan.")

    order = db.scalar(select(Order).where(Order.id == payload.order_id))
    if not order:
        raise ValueError(f"Order dengan ID {payload.order_id} tidak ditemukan.")

    # 1. PENEGAKAN ANTI-KONTAMINASI SILANG
    if item.client_id != order.client_id:
        raise CrossContaminationError(
            item_id=item.id,
            item_client_id=item.client_id,
            order_id=order.id,
            order_client_id=order.client_id,
            material_name=item.material_name,
            order_number=order.order_number,
        )

    # 2. VALIDASI KECUKUPAN STOK
    if item.current_stock < payload.quantity:
        raise ValueError(
            f"Stok bahan tidak mencukupi. Tersedia: {item.current_stock} {item.unit_measure}, "
            f"diminta: {payload.quantity} {item.unit_measure}."
        )

    # 3. PEMOTONGAN STOK & PENCATATAN TRANSAKSI
    item.current_stock -= payload.quantity

    trx = InventoryTransaction(
        inventory_item_id=item.id,
        client_id=item.client_id,
        order_id=order.id,
        transaction_type=TransactionType.OUT,
        quantity=payload.quantity,
        performed_by_user_id=user_id,
        notes=payload.notes or f"Pengeluaran ke cutting untuk order {order.order_number}",
    )
    db.add(trx)
    db.commit()
    db.refresh(trx)
    return trx


def list_transactions(
    db: Session,
    client_id: uuid.UUID | None = None,
    item_id: uuid.UUID | None = None,
    order_id: uuid.UUID | None = None,
) -> list[InventoryTransaction]:
    """Mengambil riwayat mutasi stok, dapat difilter per klien / item / order."""
    stmt = select(InventoryTransaction).order_by(InventoryTransaction.transaction_time.desc())
    if client_id is not None:
        stmt = stmt.where(InventoryTransaction.client_id == client_id)
    if item_id is not None:
        stmt = stmt.where(InventoryTransaction.inventory_item_id == item_id)
    if order_id is not None:
        stmt = stmt.where(InventoryTransaction.order_id == order_id)
    return list(db.scalars(stmt).all())


def update_storage_location(
    db: Session, item_id: uuid.UUID, storage_location: str
) -> InventoryItem:
    """Penyimpanan: catat lokasi rak/bin bahan di gudang."""
    item = get_inventory_item(db, item_id)
    if not item:
        raise ValueError(f"Item bahan dengan ID {item_id} tidak ditemukan.")
    item.storage_location = storage_location.strip().upper()
    db.commit()
    db.refresh(item)
    return item


def adjust_stock(
    db: Session,
    item_id: uuid.UUID,
    delta: float,
    user_id: uuid.UUID | None = None,
    notes: str | None = None,
) -> InventoryTransaction:
    """Stok opname: koreksi selisih fisik vs sistem dengan berita acara wajib.

    delta > 0 → IN; delta < 0 → OUT (cek kecukupan stok).
    """
    if delta == 0:
        raise ValueError("Delta koreksi tidak boleh 0.")
    if not notes or len(notes.strip()) < 3:
        raise ValueError("Berita acara opname wajib diisi (minimal 3 karakter).")
    item = get_inventory_item(db, item_id)
    if not item:
        raise ValueError(f"Item bahan dengan ID {item_id} tidak ditemukan.")
    if delta < 0 and item.current_stock + delta < -1e-9:
        raise ValueError(
            f"Stok tidak mencukupi untuk koreksi. Tersedia: {item.current_stock} "
            f"{item.unit_measure}, koreksi: {delta} {item.unit_measure}."
        )
    item.current_stock += delta
    trx = InventoryTransaction(
        inventory_item_id=item.id,
        client_id=item.client_id,
        order_id=None,
        transaction_type=TransactionType.IN if delta > 0 else TransactionType.OUT,
        quantity=abs(delta),
        performed_by_user_id=user_id,
        notes=f"[OPNAME] {notes.strip()}",
    )
    db.add(trx)
    db.commit()
    db.refresh(trx)
    return trx


def _get_order_or_raise(db: Session, order_id: uuid.UUID) -> Order:
    order = db.scalar(select(Order).where(Order.id == order_id))
    if not order:
        raise ValueError(f"Order dengan ID {order_id} tidak ditemukan.")
    return order


def _assert_same_client(item: InventoryItem, order: Order) -> None:
    if item.client_id != order.client_id:
        raise CrossContaminationError(
            item_id=item.id,
            item_client_id=item.client_id,
            order_id=order.id,
            order_client_id=order.client_id,
            material_name=item.material_name,
            order_number=order.order_number,
        )


def create_material_request(
    db: Session, payload: MaterialRequestCreate, requester_id: uuid.UUID | None = None
) -> MaterialRequest:
    """Mandor mengajukan kebutuhan bahan untuk sebuah order."""
    item = get_inventory_item(db, payload.inventory_item_id)
    if not item:
        raise ValueError(f"Item bahan dengan ID {payload.inventory_item_id} tidak ditemukan.")
    order = _get_order_or_raise(db, payload.order_id)
    _assert_same_client(item, order)
    req = MaterialRequest(
        order_id=order.id,
        inventory_item_id=item.id,
        client_id=order.client_id,
        qty_requested=payload.qty_requested,
        qty_fulfilled=0.0,
        status=RequestStatus.DIAJUKAN,
        requested_by_user_id=requester_id,
        notes=payload.notes,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


def list_material_requests(
    db: Session,
    client_id: uuid.UUID | None = None,
    order_id: uuid.UUID | None = None,
    status: RequestStatus | None = None,
) -> list[MaterialRequest]:
    stmt = select(MaterialRequest).order_by(MaterialRequest.created_at.desc())
    if client_id is not None:
        stmt = stmt.where(MaterialRequest.client_id == client_id)
    if order_id is not None:
        stmt = stmt.where(MaterialRequest.order_id == order_id)
    if status is not None:
        stmt = stmt.where(MaterialRequest.status == status)
    return list(db.scalars(stmt).all())


def review_material_request(
    db: Session,
    request_id: uuid.UUID,
    approve: bool,
    reviewer_id: uuid.UUID | None = None,
    notes: str | None = None,
) -> MaterialRequest:
    """Gudang memverifikasi pengajuan: cek milik klien + ketersediaan stok."""
    req = db.scalar(select(MaterialRequest).where(MaterialRequest.id == request_id))
    if not req:
        raise MaterialRequestNotFoundError(request_id)
    if req.status != RequestStatus.DIAJUKAN:
        raise InvalidRequestTransitionError(req.status.value, "review")
    item = get_inventory_item(db, req.inventory_item_id)
    order = _get_order_or_raise(db, req.order_id)
    if not approve:
        req.status = RequestStatus.DITOLAK
    else:
        _assert_same_client(item, order)
        if item.current_stock < req.qty_requested:
            raise ValueError(
                f"Stok bahan tidak mencukupi. Tersedia: {item.current_stock} {item.unit_measure}, "
                f"diminta: {req.qty_requested} {item.unit_measure}."
            )
        req.status = RequestStatus.DISETUJUI
    req.reviewed_by_user_id = reviewer_id
    req.reviewed_at = datetime.now(timezone.utc)
    if notes:
        req.notes = notes
    db.commit()
    db.refresh(req)
    return req


def create_handover(
    db: Session, payload: HandoverCreate, handed_by_id: uuid.UUID | None = None
) -> MaterialHandover:
    """Gudang menyerahkan bahan ke mandor: potong stok + catat OUT + update request."""
    item = get_inventory_item(db, payload.inventory_item_id)
    if not item:
        raise ValueError(f"Item bahan dengan ID {payload.inventory_item_id} tidak ditemukan.")
    order = _get_order_or_raise(db, payload.order_id)
    _assert_same_client(item, order)
    if item.current_stock < payload.quantity:
        raise ValueError(
            f"Stok bahan tidak mencukupi. Tersedia: {item.current_stock} {item.unit_measure}, "
            f"diminta: {payload.quantity} {item.unit_measure}."
        )
    req: MaterialRequest | None = None
    if payload.material_request_id:
        req = db.scalar(
            select(MaterialRequest).where(MaterialRequest.id == payload.material_request_id)
        )
        if not req:
            raise MaterialRequestNotFoundError(payload.material_request_id)
        if req.status not in (RequestStatus.DISETUJUI, RequestStatus.DIAJUKAN):
            raise InvalidRequestTransitionError(req.status.value, "handover")
        if req.order_id != order.id or req.inventory_item_id != item.id:
            raise ValueError("Request tidak cocok dengan order/item handover.")
        remaining = req.qty_requested - req.qty_fulfilled
        if payload.quantity - remaining > 1e-9:
            raise ValueError(
                f"Kuantitas serah terima ({payload.quantity}) melebihi sisa pengajuan ({remaining})."
            )
        # Auto-setujui jika masih DIAJUKAN agar alur tetap jalan
        if req.status == RequestStatus.DIAJUKAN:
            req.status = RequestStatus.DISETUJUI
            req.reviewed_by_user_id = handed_by_id
            req.reviewed_at = datetime.now(timezone.utc)

    item.current_stock -= payload.quantity
    trx = InventoryTransaction(
        inventory_item_id=item.id,
        client_id=item.client_id,
        order_id=order.id,
        transaction_type=TransactionType.OUT,
        quantity=payload.quantity,
        performed_by_user_id=handed_by_id,
        notes=payload.notes or f"Serah terima ke produksi untuk order {order.order_number}",
    )
    db.add(trx)
    db.flush()

    handover = MaterialHandover(
        order_id=order.id,
        inventory_item_id=item.id,
        material_request_id=payload.material_request_id,
        transaction_id=trx.id,
        client_id=order.client_id,
        quantity=payload.quantity,
        handed_by_user_id=handed_by_id,
        notes=payload.notes,
    )
    db.add(handover)
    db.flush()

    if req:
        req.qty_fulfilled += payload.quantity
        if req.qty_fulfilled - req.qty_requested >= -1e-9:
            req.status = RequestStatus.DISERAHKAN
    db.commit()
    db.refresh(handover)
    return handover


def list_handovers(
    db: Session,
    client_id: uuid.UUID | None = None,
    order_id: uuid.UUID | None = None,
) -> list[MaterialHandover]:
    stmt = select(MaterialHandover).order_by(MaterialHandover.handed_at.desc())
    if client_id is not None:
        stmt = stmt.where(MaterialHandover.client_id == client_id)
    if order_id is not None:
        stmt = stmt.where(MaterialHandover.order_id == order_id)
    return list(db.scalars(stmt).all())


def confirm_handover_receipt(
    db: Session, handover_id: uuid.UUID, receiver_id: uuid.UUID | None = None
) -> MaterialHandover:
    """Mandor mengonfirmasi bahan diterima → order lanjut produksi + gudang tercatat."""
    handover = db.scalar(select(MaterialHandover).where(MaterialHandover.id == handover_id))
    if not handover:
        raise MaterialHandoverNotFoundError(handover_id)
    if handover.received_at is not None:
        raise InvalidRequestTransitionError("SUDAH_DITERIMA", "konfirmasi-duplikat")
    handover.received_by_user_id = receiver_id
    handover.received_at = datetime.now(timezone.utc)

    order = _get_order_or_raise(db, handover.order_id)
    if order.status == OrderStatus.CUTTING:
        order.status = OrderStatus.SEWING
    elif order.status == OrderStatus.SAMPLE:
        order.status = OrderStatus.CUTTING
    db.commit()
    db.refresh(handover)
    return handover


def record_cutting_result(
    db: Session, payload, user_id: uuid.UUID | None = None
):
    """Catat hasil cutting massal. Order wajib dalam status CUTTING/SEWING."""
    from app.modules.gudang.models import CuttingResult

    order = _get_order_or_raise(db, payload.order_id)
    if order.status not in (OrderStatus.CUTTING, OrderStatus.SEWING):
        raise ValueError(
            f"Hasil cutting hanya bisa dicatat saat order CUTTING/SEWING. "
            f"Status kini: {order.status.value}."
        )
    item = None
    if payload.inventory_item_id:
        item = get_inventory_item(db, payload.inventory_item_id)
        if not item:
            raise ValueError(f"Item bahan dengan ID {payload.inventory_item_id} tidak ditemukan.")
        _assert_same_client(item, order)
    waste_category = None
    if not payload.waste_category:
        raise ValueError("Kategori waste wajib diisi: SISA_POTONG / SCRAP / BS_REJECT.")
    if payload.waste_category:
        from app.modules.gudang.models import WasteCategory as _WasteCategory

        try:
            waste_category = _WasteCategory(payload.waste_category.strip().upper())
        except ValueError:
            raise ValueError(
                "Kategori waste tidak valid. Pilihan: SISA_POTONG / SCRAP / BS_REJECT."
            ) from None
    result = CuttingResult(
        order_id=order.id,
        inventory_item_id=item.id if item else None,
        client_id=order.client_id,
        qty_lapis=payload.qty_lapis,
        qty_potong_hasil=payload.qty_potong_hasil,
        waste_qty=payload.waste_qty,
        waste_category=waste_category,
        cut_by_user_id=user_id,
        notes=payload.notes,
    )
    db.add(result)
    db.commit()
    db.refresh(result)
    return result


def list_cutting_results(
    db: Session,
    client_id: uuid.UUID | None = None,
    order_id: uuid.UUID | None = None,
):
    """Riwayat hasil cutting, filter per klien / order."""
    from app.modules.gudang.models import CuttingResult

    stmt = select(CuttingResult).order_by(CuttingResult.cut_at.desc())
    if client_id is not None:
        stmt = stmt.where(CuttingResult.client_id == client_id)
    if order_id is not None:
        stmt = stmt.where(CuttingResult.order_id == order_id)
    return list(db.scalars(stmt).all())
