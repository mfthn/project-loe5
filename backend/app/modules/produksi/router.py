"""Endpoint API untuk modul Produksi, Order Massal, dan Terminal 30 Menit (FR-7, FR-8, FR-9).

Endpoint tersedia di /api/v1/produksi.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_user, require_roles
from app.modules.auth.models import User, UserRole
from app.modules.produksi.errors import (
    InvalidOutputQuantityError,
    OrderComponentNotFoundError,
    OrderNotFoundError,
    OrderNumberDuplicateError,
    OrderStatusTransitionError,
    SampleVersionNotApprovedError,
)
from app.modules.produksi.models import OrderStatus
from app.modules.produksi.schemas import (
    AssemblyCreate,
    AssemblyResponse,
    LeaderboardEntry,
    OrderCreate,
    OrderDetailResponse,
    OrderFromSampleCreate,
    OrderOutputSummary,
    OrderResponse,
    OrderStatusUpdate,
    ProductionOutputCreate,
    ProductionOutputResponse,
    ProductionOutputVerify,
    RateCardChangeResponse,
    RateCardUpdate,
    WorkerDashboardResponse,
)
from app.modules.produksi.service import (
    assemble_order,
    create_order,
    create_order_from_sample,
    get_operator_leaderboard,
    get_order,
    get_order_output_summary,
    get_worker_dashboard_summary,
    list_assemblies,
    list_orders,
    list_outputs,
    list_rate_history,
    list_worker_orders,
    record_output,
    update_order_status,
    update_rate_card,
    verify_output,
    worker_has_output_for_order,
)

router = APIRouter(prefix="/produksi", tags=["produksi"])

# Pesanan massal: keputusan bisnis Owner / eksekusi Mandor.
# TIM_SAMPLE dikecualikan — tidak boleh menyetujui pesanan massal tanpa konfirmasi.
_ORDER_MANAGE_ROLES = [UserRole.OWNER, UserRole.MANDOR]
_FROM_SAMPLE_ROLES = [UserRole.OWNER, UserRole.MANDOR]
_OUTPUT_RECORD_ROLES = [UserRole.PENJAHIT, UserRole.MANDOR, UserRole.OWNER]
_VERIFY_ROLES = [UserRole.MANDOR, UserRole.OWNER]
_RATE_ROLES = [UserRole.OWNER, UserRole.MANDOR]


def _handle_error(exc: Exception) -> HTTPException:
    if isinstance(exc, (OrderNotFoundError, OrderComponentNotFoundError)):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, (OrderNumberDuplicateError, SampleVersionNotApprovedError)):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, OrderStatusTransitionError):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc))
    if isinstance(exc, InvalidOutputQuantityError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ---------------------------------------------------------------------------
# Order endpoints
# ---------------------------------------------------------------------------

@router.get("/orders", response_model=list[OrderDetailResponse])
def get_orders(
    client_id: uuid.UUID | None = Query(None, description="Filter per ID Klien"),
    status_filter: OrderStatus | None = Query(None, alias="status", description="Filter per status order"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[OrderDetailResponse]:
    """Mendapatkan daftar order produksi. KLIEN_MAKLON hanya melihat miliknya."""
    if current_user.role == UserRole.KLIEN_MAKLON:
        if not current_user.client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akun klien tidak terhubung dengan entitas klien yang valid.",
            )
        client_id = current_user.client_id

    if current_user.role == UserRole.PENJAHIT:
        orders = list_worker_orders(db, current_user.id, status=status_filter)
    else:
        orders = list_orders(db, client_id=client_id, status=status_filter)
    return [OrderDetailResponse.model_validate(o) for o in orders]


@router.get(
    "/leaderboard",
    response_model=list[LeaderboardEntry],
    dependencies=[Depends(require_roles([UserRole.OWNER, UserRole.MANDOR]))],
)
def get_leaderboard(
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[LeaderboardEntry]:
    """Peringkat kinerja penjahit global (total & terverifikasi pcs). Khusus OWNER & MANDOR."""
    return [LeaderboardEntry(**entry) for entry in get_operator_leaderboard(db, limit=limit)]


@router.get(
    "/my-dashboard",
    response_model=WorkerDashboardResponse,
    dependencies=[Depends(require_roles([UserRole.PENJAHIT]))],
)
def get_my_worker_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> WorkerDashboardResponse:
    """Ringkasan kerja pribadi Penjahit untuk Dashboard."""
    return get_worker_dashboard_summary(db, current_user.id)


@router.post(
    "/orders",
    response_model=OrderDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(_ORDER_MANAGE_ROLES))],
)
def create_new_order(
    payload: OrderCreate,
    db: Session = Depends(get_db),
) -> OrderDetailResponse:
    """Membuat Order Produksi Massal baru beserta komponen dan rate card upah borongan."""
    try:
        order = create_order(db, payload)
    except (OrderNumberDuplicateError, SampleVersionNotApprovedError, ValueError) as e:
        raise _handle_error(e) from e
    return OrderDetailResponse.model_validate(order)


@router.get("/orders/{order_id}", response_model=OrderDetailResponse)
def get_order_detail(
    order_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrderDetailResponse:
    """Detail lengkap sebuah order beserta komponen dan rate card."""
    if current_user.role == UserRole.PENJAHIT and not worker_has_output_for_order(
        db, current_user.id, order_id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order tidak ditemukan.")
    try:
        order = get_order(db, order_id)
    except OrderNotFoundError as e:
        raise _handle_error(e) from e
    # Isolasi Klien: hanya data client_id milik sendiri
    if current_user.role == UserRole.KLIEN_MAKLON and order.client_id != current_user.client_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order tidak ditemukan.")
    return OrderDetailResponse.model_validate(order)


@router.patch(
    "/orders/{order_id}/status",
    response_model=OrderResponse,
    dependencies=[Depends(require_roles(_ORDER_MANAGE_ROLES))],
)
def advance_order_status(
    order_id: uuid.UUID,
    payload: OrderStatusUpdate,
    db: Session = Depends(get_db),
) -> OrderResponse:
    """Memajukan status order ke tahap berikutnya dalam alur produksi.

    Alur wajib: SAMPLE → CUTTING → SEWING → MENUNGGU_QC → QC → COMPLETED.
    """
    try:
        order = update_order_status(db, order_id, payload.status)
    except (OrderNotFoundError, OrderStatusTransitionError) as e:
        raise _handle_error(e) from e
    return OrderResponse.model_validate(order)


# ---------------------------------------------------------------------------
# Konversi Sample → Order (Skenario 4 - FR-4.1)
# ---------------------------------------------------------------------------

@router.post(
    "/orders/from-sample/{version_id}",
    response_model=OrderDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(_FROM_SAMPLE_ROLES))],
)
def convert_sample_to_order(
    version_id: uuid.UUID,
    payload: OrderFromSampleCreate,
    db: Session = Depends(get_db),
) -> OrderDetailResponse:
    """FR-4.1: Konversi versi sample OWNER_APPROVED menjadi Order Produksi Massal.

    Hanya OWNER dan MANDOR — TIM_SAMPLE tidak dapat menyetujui pesanan massal.
    Komponen diambil otomatis dari SampleComponent versi tersebut.
    Status order langsung CUTTING setelah konversi berhasil.
    """
    try:
        order = create_order_from_sample(db, version_id, payload)
    except (SampleVersionNotApprovedError, OrderNumberDuplicateError, ValueError) as e:
        raise _handle_error(e) from e
    return OrderDetailResponse.model_validate(order)


# ---------------------------------------------------------------------------
# ProductionOutput (Terminal 30 Menit)
# ---------------------------------------------------------------------------

@router.get("/outputs", response_model=list[ProductionOutputResponse])
def get_outputs(
    order_id: uuid.UUID | None = Query(None, description="Filter per order"),
    line_number: int | None = Query(None, description="Filter per nomor line"),
    is_verified: bool | None = Query(None, description="Filter: sudah diverifikasi atau belum"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProductionOutputResponse]:
    """Mendapatkan log output 30 menit. PENJAHIT miliknya; KLIEN hanya order miliknya."""
    operator_id: uuid.UUID | None = None
    if current_user.role == UserRole.PENJAHIT:
        operator_id = current_user.id

    if current_user.role == UserRole.KLIEN_MAKLON:
        if not current_user.client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akun klien tidak terhubung dengan entitas klien yang valid.",
            )
        own_orders = list_orders(db, client_id=current_user.client_id)
        own_ids = {o.id for o in own_orders}
        if order_id is not None and order_id not in own_ids:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order tidak ditemukan.")
        outputs = []
        for oid in ([order_id] if order_id else list(own_ids)):
            outputs.extend(
                list_outputs(
                    db, order_id=oid, operator_user_id=None,
                    line_number=line_number, is_verified=is_verified,
                )
            )
        outputs.sort(key=lambda o: o.time_window, reverse=True)
        return [ProductionOutputResponse.model_validate(o) for o in outputs]

    outputs = list_outputs(
        db,
        order_id=order_id,
        operator_user_id=operator_id,
        line_number=line_number,
        is_verified=is_verified,
    )
    return [ProductionOutputResponse.model_validate(o) for o in outputs]


@router.post(
    "/outputs",
    response_model=ProductionOutputResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(_OUTPUT_RECORD_ROLES))],
)
def log_production_output(
    payload: ProductionOutputCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProductionOutputResponse:
    """FR-8: Penjahit mencatat jumlah output setiap 30 menit dari terminal tablet lantai pabrik."""
    try:
        out = record_output(db, payload, operator_user_id=current_user.id)
    except (
        OrderNotFoundError,
        OrderComponentNotFoundError,
        OrderStatusTransitionError,
        InvalidOutputQuantityError,
        ValueError,
    ) as e:
        raise _handle_error(e) from e
    return ProductionOutputResponse.model_validate(out)


@router.patch(
    "/outputs/{output_id}/verify",
    response_model=ProductionOutputResponse,
    dependencies=[Depends(require_roles(_VERIFY_ROLES))],
)
def verify_production_output(
    output_id: uuid.UUID,
    payload: ProductionOutputVerify,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProductionOutputResponse:
    """FR-8: Mandor memverifikasi log output 30 menit dari terminal pabrik."""
    try:
        out = verify_output(db, output_id, mandor_user_id=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e
    return ProductionOutputResponse.model_validate(out)


@router.get("/orders/{order_id}/summary", response_model=OrderOutputSummary)
def get_order_summary(
    order_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrderOutputSummary:
    """Ringkasan total output vs target pcs untuk satu order produksi."""
    if current_user.role == UserRole.PENJAHIT and not worker_has_output_for_order(
        db, current_user.id, order_id
    ):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order tidak ditemukan.")
    try:
        order = get_order(db, order_id)
    except OrderNotFoundError as e:
        raise _handle_error(e) from e
    if current_user.role == UserRole.KLIEN_MAKLON and order.client_id != current_user.client_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order tidak ditemukan.")
    try:
        summary = get_order_output_summary(db, order_id)
    except OrderNotFoundError as e:
        raise _handle_error(e) from e
    return OrderOutputSummary(**summary)


@router.put(
    "/components/{component_id}/rate-card",
    response_model=OrderDetailResponse,
    dependencies=[Depends(require_roles(_RATE_ROLES))],
)
def set_component_rate_card(
    component_id: uuid.UUID,
    payload: RateCardUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> OrderDetailResponse:
    """Ubah rate card upah borongan per komponen (khusus OWNER & MANDOR).

    Matriks RBAC: Owner boleh ubah rate card; Mandor menentukan rate komponen;
    peran lain (termasuk QC & Finance) tidak dapat mengubah formula upah.
    Setiap perubahan tercatat di riwayat (FR-7.2).
    """
    try:
        order = update_rate_card(
            db, component_id,
            cutting_rate_per_pcs=payload.cutting_rate_per_pcs,
            sewing_rate_per_pcs=payload.sewing_rate_per_pcs,
            changed_by_id=current_user.id,
        )
    except (OrderComponentNotFoundError, ValueError) as e:
        raise _handle_error(e) from e
    return OrderDetailResponse.model_validate(order)


@router.get(
    "/components/{component_id}/rate-history",
    response_model=list[RateCardChangeResponse],
)
def get_component_rate_history(
    component_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[RateCardChangeResponse]:
    """Riwayat perubahan rate card per komponen (FR-7.2)."""
    try:
        history = list_rate_history(db, component_id)
    except (OrderComponentNotFoundError, ValueError) as e:
        raise _handle_error(e) from e
    return [RateCardChangeResponse.model_validate(h) for h in history]


@router.post(
    "/orders/{order_id}/assemble",
    response_model=AssemblyResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(_RATE_ROLES))],
)
def assemble_order_to_qc(
    order_id: uuid.UUID,
    payload: AssemblyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AssemblyResponse:
    """Rakit komponen menjadi produk utuh → order SEWING → MENUNGGU_QC (FR-7.3/7.4)."""
    try:
        batch = assemble_order(
            db, order_id, payload.qty_assembled,
            assembler_id=current_user.id, notes=payload.notes,
        )
    except (OrderNotFoundError, OrderStatusTransitionError,
            InvalidOutputQuantityError, ValueError) as e:
        raise _handle_error(e) from e
    return AssemblyResponse.model_validate(batch)


@router.get("/assemblies", response_model=list[AssemblyResponse])
def get_assemblies(
    client_id: uuid.UUID | None = Query(None, description="Filter per Klien"),
    order_id: uuid.UUID | None = Query(None, description="Filter per Pesanan"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[AssemblyResponse]:
    """Riwayat rakitan produk utuh. Klien hanya melihat miliknya."""
    if current_user.role == UserRole.KLIEN_MAKLON:
        if not current_user.client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akun klien tidak terhubung dengan entitas klien yang valid.",
            )
        client_id = current_user.client_id
    batches = list_assemblies(db, client_id=client_id, order_id=order_id)
    return [AssemblyResponse.model_validate(b) for b in batches]
