"""Endpoint API untuk modul Gudang & Anti-Kontaminasi Silang (FR-5, FR-6)."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_user, require_roles
from app.modules.auth.models import User, UserRole
from app.modules.gudang.errors import (
    CrossContaminationError,
    InvalidRequestTransitionError,
    MaterialHandoverNotFoundError,
    MaterialRequestNotFoundError,
)
from app.modules.gudang.models import RequestStatus
from app.modules.gudang.schemas import (
    CuttingCreate,
    CuttingResponse,
    HandoverCreate,
    HandoverResponse,
    InventoryItemCreate,
    InventoryItemResponse,
    InventoryTransactionResponse,
    MaterialIssueRequest,
    MaterialReceiptRequest,
    MaterialRequestCreate,
    MaterialRequestResponse,
    MaterialRequestReview,
    StockAdjustRequest,
    StorageLocationUpdate,
)
from app.modules.gudang.service import (
    adjust_stock,
    confirm_handover_receipt,
    list_cutting_results,
    record_cutting_result,
    create_handover,
    create_inventory_item,
    create_material_request,
    issue_material_to_cutting,
    list_handovers,
    list_inventory_items,
    list_material_requests,
    list_transactions,
    receive_material,
    review_material_request,
    update_storage_location,
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
    dependencies=[Depends(require_roles([UserRole.GUDANG]))],
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
    dependencies=[Depends(require_roles([UserRole.GUDANG]))],
)
def receive_material_entry(
    payload: MaterialReceiptRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InventoryTransactionResponse:
    """Mencatat penerimaan bahan masuk (Transaksi IN). Untuk pesanan wajib tunjuk PO disetujui."""
    try:
        trx = receive_material(db, payload, user_id=current_user.id)
    except CrossContaminationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except ValueError as e:
        from app.modules.finance.errors import POTransitionError as _POTransitionError

        if isinstance(e, _POTransitionError):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(e)
            ) from e
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    return InventoryTransactionResponse.model_validate(trx)


@router.post(
    "/issue",
    response_model=InventoryTransactionResponse,
    dependencies=[Depends(require_roles([UserRole.GUDANG, UserRole.MANDOR]))],
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


@router.post(
    "/adjust",
    response_model=InventoryTransactionResponse,
    dependencies=[Depends(require_roles([UserRole.GUDANG]))],
)
def adjust_stock_opname(
    payload: StockAdjustRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InventoryTransactionResponse:
    """Stok opname: koreksi selisih fisik vs sistem dengan berita acara wajib (khusus Gudang & Owner)."""
    try:
        trx = adjust_stock(
            db, payload.inventory_item_id, payload.delta,
            user_id=current_user.id, notes=payload.notes,
        )
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


def _resolve_client_filter(
    current_user: User, client_id: uuid.UUID | None
) -> uuid.UUID | None:
    if current_user.role == UserRole.KLIEN_MAKLON:
        if not current_user.client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akun klien tidak terhubung dengan entitas klien yang valid.",
            )
        return current_user.client_id
    return client_id


@router.patch(
    "/items/{item_id}/location",
    response_model=InventoryItemResponse,
    dependencies=[Depends(require_roles([UserRole.GUDANG]))],
)
def set_storage_location(
    item_id: uuid.UUID,
    payload: StorageLocationUpdate,
    db: Session = Depends(get_db),
) -> InventoryItemResponse:
    """Penyimpanan: catat lokasi rak/bin bahan (khusus Gudang & Owner)."""
    try:
        item = update_storage_location(db, item_id, payload.storage_location)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    return InventoryItemResponse.model_validate(item)


@router.post(
    "/requests",
    response_model=MaterialRequestResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles([UserRole.MANDOR]))],
)
def create_request(
    payload: MaterialRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MaterialRequestResponse:
    """Mandor mengajukan kebutuhan bahan ke gudang."""
    try:
        req = create_material_request(db, payload, requester_id=current_user.id)
    except CrossContaminationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    return MaterialRequestResponse.model_validate(req)


@router.get("/requests", response_model=list[MaterialRequestResponse])
def get_requests(
    client_id: uuid.UUID | None = Query(None, description="Filter per Klien"),
    order_id: uuid.UUID | None = Query(None, description="Filter per Pesanan"),
    status_filter: RequestStatus | None = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[MaterialRequestResponse]:
    """Daftar pengajuan bahan. Klien hanya melihat miliknya."""
    client_id = _resolve_client_filter(current_user, client_id)
    reqs = list_material_requests(db, client_id=client_id, order_id=order_id, status=status_filter)
    return [MaterialRequestResponse.model_validate(r) for r in reqs]


@router.patch(
    "/requests/{request_id}/review",
    response_model=MaterialRequestResponse,
    dependencies=[Depends(require_roles([UserRole.GUDANG, UserRole.OWNER]))],
)
def review_request(
    request_id: uuid.UUID,
    payload: MaterialRequestReview,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MaterialRequestResponse:
    """Gudang verifikasi: cek milik klien + ketersediaan stok, lalu setujui/tolak."""
    try:
        req = review_material_request(
            db, request_id, approve=payload.approve,
            reviewer_id=current_user.id, notes=payload.notes,
        )
    except (MaterialRequestNotFoundError, InvalidRequestTransitionError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, MaterialRequestNotFoundError) else status.HTTP_422_UNPROCESSABLE_CONTENT
        raise HTTPException(status_code=code, detail=str(e)) from e
    except CrossContaminationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    return MaterialRequestResponse.model_validate(req)


@router.post(
    "/handovers",
    response_model=HandoverResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles([UserRole.GUDANG]))],
)
def create_handover_entry(
    payload: HandoverCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> HandoverResponse:
    """Gudang menyerahkan bahan ke mandor (potong stok + OUT + update request)."""
    try:
        handover = create_handover(db, payload, handed_by_id=current_user.id)
    except (MaterialRequestNotFoundError, InvalidRequestTransitionError) as e:
        code = status.HTTP_404_NOT_FOUND if isinstance(e, MaterialRequestNotFoundError) else status.HTTP_422_UNPROCESSABLE_CONTENT
        raise HTTPException(status_code=code, detail=str(e)) from e
    except CrossContaminationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    return HandoverResponse.model_validate(handover)


@router.get("/handovers", response_model=list[HandoverResponse])
def get_handovers(
    client_id: uuid.UUID | None = Query(None, description="Filter per Klien"),
    order_id: uuid.UUID | None = Query(None, description="Filter per Pesanan"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[HandoverResponse]:
    """Riwayat serah terima gudang → produksi. Klien hanya melihat miliknya."""
    client_id = _resolve_client_filter(current_user, client_id)
    handovers = list_handovers(db, client_id=client_id, order_id=order_id)
    return [HandoverResponse.model_validate(h) for h in handovers]


@router.post(
    "/handovers/{handover_id}/receive",
    response_model=HandoverResponse,
    dependencies=[Depends(require_roles([UserRole.MANDOR, UserRole.OWNER]))],
)
def receive_handover(
    handover_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> HandoverResponse:
    """Mandor konfirmasi terima bahan → order CUTTING→SEWING (sedang dikerjakan)."""
    try:
        handover = confirm_handover_receipt(db, handover_id, receiver_id=current_user.id)
    except MaterialHandoverNotFoundError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    except InvalidRequestTransitionError as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(e)) from e
    return HandoverResponse.model_validate(handover)


@router.post(
    "/cutting",
    response_model=CuttingResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles([UserRole.GUDANG, UserRole.MANDOR]))],
)
def record_cutting(
    payload: CuttingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CuttingResponse:
    """Catat hasil cutting massal (lapis → pcs + waste). Order wajib CUTTING/SEWING."""
    try:
        result = record_cutting_result(db, payload, user_id=current_user.id)
    except CrossContaminationError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(e)
        ) from e
    return CuttingResponse.model_validate(result)


@router.get("/cutting", response_model=list[CuttingResponse])
def get_cutting_results(
    client_id: uuid.UUID | None = Query(None, description="Filter per Klien"),
    order_id: uuid.UUID | None = Query(None, description="Filter per Pesanan"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CuttingResponse]:
    """Riwayat hasil cutting massal. Klien hanya melihat miliknya."""
    client_id = _resolve_client_filter(current_user, client_id)
    results = list_cutting_results(db, client_id=client_id, order_id=order_id)
    return [CuttingResponse.model_validate(r) for r in results]
