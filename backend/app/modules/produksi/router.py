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
    OrderCreate,
    OrderDetailResponse,
    OrderFromSampleCreate,
    OrderOutputSummary,
    OrderResponse,
    OrderStatusUpdate,
    ProductionOutputCreate,
    ProductionOutputResponse,
    ProductionOutputVerify,
)
from app.modules.produksi.service import (
    create_order,
    create_order_from_sample,
    get_order,
    get_order_output_summary,
    list_orders,
    list_outputs,
    record_output,
    update_order_status,
    verify_output,
)

router = APIRouter(prefix="/produksi", tags=["produksi"])

_ORDER_MANAGE_ROLES = [UserRole.OWNER, UserRole.MANDOR, UserRole.TIM_SAMPLE]
_OUTPUT_RECORD_ROLES = [UserRole.PENJAHIT, UserRole.MANDOR, UserRole.OWNER]
_VERIFY_ROLES = [UserRole.MANDOR, UserRole.OWNER]


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

    orders = list_orders(db, client_id=client_id, status=status_filter)
    return [OrderDetailResponse.model_validate(o) for o in orders]


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
    try:
        order = get_order(db, order_id)
    except OrderNotFoundError as e:
        raise _handle_error(e) from e
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
    dependencies=[Depends(require_roles([UserRole.OWNER, UserRole.TIM_SAMPLE]))],
)
def convert_sample_to_order(
    version_id: uuid.UUID,
    payload: OrderFromSampleCreate,
    db: Session = Depends(get_db),
) -> OrderDetailResponse:
    """FR-4.1: Konversi versi sample APPROVED menjadi Order Produksi Massal.

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
    """Mendapatkan log output 30 menit. PENJAHIT hanya melihat output miliknya sendiri."""
    operator_id: uuid.UUID | None = None
    if current_user.role == UserRole.PENJAHIT:
        operator_id = current_user.id

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
    try:
        summary = get_order_output_summary(db, order_id)
    except OrderNotFoundError as e:
        raise _handle_error(e) from e
    return OrderOutputSummary(**summary)
