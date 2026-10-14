"""Endpoint API untuk modul Gudang & Anti-Kontaminasi Silang (FR-5, FR-6)."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_user, require_roles
from app.modules.auth.models import User, UserRole
from app.modules.gudang.errors import CrossContaminationError
from app.modules.gudang.schemas import (
    InventoryItemCreate,
    InventoryItemResponse,
    InventoryTransactionResponse,
    MaterialIssueRequest,
    MaterialReceiptRequest,
)
from app.modules.gudang.service import (
    create_inventory_item,
    issue_material_to_cutting,
    list_inventory_items,
    list_transactions,
    receive_material,
)

router = APIRouter(prefix="/gudang", tags=["gudang"])


@router.get("/items", response_model=list[InventoryItemResponse])
def get_inventory_items(
    client_id: uuid.UUID | None = Query(None, description="Filter stok per ID Klien"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[InventoryItemResponse]:
    """Melihat daftar stok bahan di gudang.

    Jika pengguna adalah KLIEN_MAKLON, sistem otomatis mengisolasi hasil hanya untuk client_id miliknya.
    """
    # Isolasi multi-tenant mutlak: Klien maklon B2B hanya melihat miliknya sendiri
    if current_user.role == UserRole.KLIEN_MAKLON:
        if not current_user.client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akun klien tidak terhubung dengan entitas klien yang valid.",
            )
        client_id = current_user.client_id

    items = list_inventory_items(db, client_id=client_id)
    return [InventoryItemResponse.model_validate(it) for it in items]


@router.post(
    "/items",
    response_model=InventoryItemResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles([UserRole.GUDANG, UserRole.OWNER]))],
)
def add_inventory_item(
    payload: InventoryItemCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InventoryItemResponse:
    """Mendaftarkan item bahan baku baru dan mengikat kepemilikan ke klien (khusus Gudang & Owner)."""
    item = create_inventory_item(db, payload, user_id=current_user.id)
    return InventoryItemResponse.model_validate(item)


@router.post(
    "/receive",
    response_model=InventoryTransactionResponse,
    dependencies=[Depends(require_roles([UserRole.GUDANG, UserRole.OWNER]))],
)
def receive_material_entry(
    payload: MaterialReceiptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InventoryTransactionResponse:
    """Mencatat penerimaan bahan masuk (Transaksi IN)."""
    try:
        trx = receive_material(db, payload, user_id=current_user.id)
    except CrossContaminationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    return InventoryTransactionResponse.model_validate(trx)


@router.post(
    "/issue",
    response_model=InventoryTransactionResponse,
    dependencies=[Depends(require_roles([UserRole.GUDANG, UserRole.OWNER, UserRole.MANDOR]))],
)
def issue_material_exit(
    payload: MaterialIssueRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InventoryTransactionResponse:
    """Mengeluarkan bahan ke proses cutting (Transaksi OUT).

    SKENARIO 1 (PROTEKSI KONTAMINASI SILANG):
    Jika bahan Klien A dicoba dikeluarkan untuk pesanan Klien B,
    sistem MENOLAK transaksi dengan HTTP 400 sebelum stok berkurang!
    """
    try:
        trx = issue_material_to_cutting(db, payload, user_id=current_user.id)
    except CrossContaminationError as e:
        # Peringatan eksplisit sesuai kriteria penerimaan FR-6.2
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    return InventoryTransactionResponse.model_validate(trx)


@router.get("/transactions", response_model=list[InventoryTransactionResponse])
def get_inventory_transactions(
    client_id: uuid.UUID | None = Query(None, description="Filter mutasi per Klien"),
    item_id: uuid.UUID | None = Query(None, description="Filter mutasi per Item Bahan"),
    order_id: uuid.UUID | None = Query(None, description="Filter mutasi per Pesanan"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[InventoryTransactionResponse]:
    """Melihat riwayat mutasi stok masuk dan keluar."""
    if current_user.role == UserRole.KLIEN_MAKLON:
        if not current_user.client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akun klien tidak terhubung dengan entitas klien yang valid.",
            )
        client_id = current_user.client_id

    trxs = list_transactions(db, client_id=client_id, item_id=item_id, order_id=order_id)
    return [InventoryTransactionResponse.model_validate(t) for t in trxs]
