"""Logika bisnis gudang, mutasi stok, dan penjagaan anti-kontaminasi silang (FR-5, FR-6)."""
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.gudang.errors import CrossContaminationError
from app.modules.gudang.models import InventoryItem, InventoryTransaction, TransactionType
from app.modules.gudang.schemas import (
    InventoryItemCreate,
    MaterialIssueRequest,
    MaterialReceiptRequest,
)
from app.modules.produksi.models import Order


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
    """Mendaftarkan item bahan baku baru dan mengikat kepemilikannya ke client_id."""
    item = InventoryItem(
        client_id=payload.client_id,
        material_code=payload.material_code.strip().upper(),
        material_name=payload.material_name.strip(),
        current_stock=payload.initial_stock,
        unit_measure=payload.unit_measure.strip().upper(),
    )
    db.add(item)
    db.flush()

    # Jika ada stok awal, catat sebagai transaksi IN perdana
    if payload.initial_stock > 0:
        trx = InventoryTransaction(
            inventory_item_id=item.id,
            client_id=item.client_id,
            order_id=None,
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
    """Penerimaan bahan masuk (Transaksi IN) terikat dengan Tag ID Klien."""
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
