"""Endpoint API untuk modul Quality Control, Defect, dan Pool Bonus QC (FR-9, FR-10.3).

Endpoint tersedia di /api/v1/qc.
"""
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_user, require_roles
from app.modules.auth.models import User, UserRole
from app.modules.qc.errors import (
    InspectionNotFoundError,
    InvalidQCQuantityError,
    NoBonusRecipientsError,
    OrderNotInQCStatusError,
    QCBonusPoolEmptyError,
)
from app.modules.qc.models import QCStatus
from app.modules.qc.schemas import (
    QCBonusConfig,
    QCBonusPoolResponse,
    QCInspectionCreate,
    QCInspectionResponse,
    QCSummaryResponse,
)
from app.modules.qc.service import (
    calculate_qc_bonus_pool,
    get_inspection,
    get_qc_summary,
    list_escalations_to_sample,
    list_inspections,
    record_inspection,
)

router = APIRouter(prefix="/qc", tags=["qc"])

_INSPECTOR_ROLES = [UserRole.QC_INSPECTOR]
# Formula bonus milik Owner & Finance — Mandor tidak dapat mengubah formula gaji.
_BONUS_ROLES = [UserRole.OWNER, UserRole.FINANCE_PAYROLL]
_PREVIEW_ROLES = [UserRole.OWNER, UserRole.FINANCE_PAYROLL, UserRole.MANDOR, UserRole.QC_INSPECTOR]
_ESCALATION_ROLES = [UserRole.OWNER, UserRole.TIM_SAMPLE, UserRole.QC_INSPECTOR, UserRole.MANDOR]


def _handle_error(exc: Exception) -> HTTPException:
    if isinstance(exc, InspectionNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, OrderNotInQCStatusError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, InvalidQCQuantityError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    if isinstance(exc, (QCBonusPoolEmptyError, NoBonusRecipientsError)):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ---------------------------------------------------------------------------
# QC Inspection endpoints
# ---------------------------------------------------------------------------

@router.get("/inspections", response_model=list[QCInspectionResponse])
def get_inspections(
    order_id: uuid.UUID | None = Query(None, description="Filter per order"),
    status_filter: QCStatus | None = Query(None, alias="status", description="Filter per status QC"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[QCInspectionResponse]:
    """Mendapatkan daftar catatan inspeksi QC. KLIEN hanya data miliknya."""
    inspector_id: uuid.UUID | None = None
    # QC Inspector hanya bisa melihat inspeksinya sendiri
    if current_user.role == UserRole.QC_INSPECTOR:
        inspector_id = current_user.id

    if current_user.role == UserRole.KLIEN_MAKLON:
        if not current_user.client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akun klien tidak terhubung dengan entitas klien yang valid.",
            )
        from app.modules.produksi.models import Order as _Order

        own_order_ids = set(
            db.scalars(
                select(_Order.id).where(_Order.client_id == current_user.client_id)
            ).all()
        )
        if order_id is not None and order_id not in own_order_ids:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order tidak ditemukan.")
        inspections = []
        for oid in ([order_id] if order_id else list(own_order_ids)):
            inspections.extend(list_inspections(db, order_id=oid, status=status_filter))
        inspections.sort(key=lambda i: i.inspected_at, reverse=True)
        return [QCInspectionResponse.model_validate(i) for i in inspections]

    inspections = list_inspections(
        db, order_id=order_id, inspector_user_id=inspector_id, status=status_filter
    )
    return [QCInspectionResponse.model_validate(i) for i in inspections]


@router.get(
    "/escalations",
    response_model=list[QCInspectionResponse],
    dependencies=[Depends(require_roles(_ESCALATION_ROLES))],
)
def get_defect_escalations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[QCInspectionResponse]:
    """Mengambil daftar laporan barang cacat yang sudah 3x perbaikan (eskalasi ke Tim Sampel)."""
    escalations = list_escalations_to_sample(db)
    return [QCInspectionResponse.model_validate(e) for e in escalations]


@router.post(
    "/inspections",
    response_model=QCInspectionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(_INSPECTOR_ROLES))],
)
def create_inspection(
    payload: QCInspectionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QCInspectionResponse:
    """FR-9: QC Inspector mencatat hasil pemeriksaan produk (LOLOS / REPAIR / DEFECT).

    - Jika status MENUNGGU_QC, order otomatis bergerak ke status QC.
    - Pcs LOLOS akan mengakumulasi pool bonus QC (dihitung via GET /qc/bonus/{order_id}).
    """
    try:
        inspection = record_inspection(db, payload, inspector_user_id=current_user.id)
    except (OrderNotInQCStatusError, InvalidQCQuantityError, ValueError) as e:
        raise _handle_error(e) from e
    return QCInspectionResponse.model_validate(inspection)


@router.get("/inspections/{inspection_id}", response_model=QCInspectionResponse)
def get_inspection_detail(
    inspection_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QCInspectionResponse:
    """Mendapatkan detail satu catatan inspeksi QC. KLIEN hanya data miliknya."""
    try:
        inspection = get_inspection(db, inspection_id)
    except InspectionNotFoundError as e:
        raise _handle_error(e) from e
    if current_user.role == UserRole.KLIEN_MAKLON:
        from app.modules.produksi.models import Order as _Order

        order = db.scalar(select(_Order).where(_Order.id == inspection.order_id))
        if order is None or order.client_id != current_user.client_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inspeksi tidak ditemukan.")
    return QCInspectionResponse.model_validate(inspection)


# ---------------------------------------------------------------------------
# QC Summary
# ---------------------------------------------------------------------------

@router.get("/summary/{order_id}", response_model=QCSummaryResponse)
def get_order_qc_summary(
    order_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> QCSummaryResponse:
    """Ringkasan QC untuk satu order: total inspeksi, lolos, repair, defect, dan persentase."""
    if current_user.role == UserRole.KLIEN_MAKLON:
        from app.modules.produksi.models import Order as _Order

        order = db.scalar(select(_Order).where(_Order.id == order_id))
        if order is None or order.client_id != current_user.client_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order tidak ditemukan.")
    try:
        return get_qc_summary(db, order_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e


# ---------------------------------------------------------------------------
# Pool Bonus QC 3-Arah (Skenario 3 — FR-10.3)
# ---------------------------------------------------------------------------

@router.post(
    "/bonus/{order_id}",
    response_model=QCBonusPoolResponse,
    dependencies=[Depends(require_roles(_BONUS_ROLES))],
)
def calculate_bonus_pool(
    order_id: uuid.UUID,
    payload: QCBonusConfig,
    db: Session = Depends(get_db),
) -> QCBonusPoolResponse:
    """FR-10.3: Kalkulasi dan pembagian pool bonus QC secara rata kepada Mandor + Kepala Ops.

    **Skenario 3 (P0):**
    - Total pool = `qty_lolos × bonus_rate_per_pcs`
    - Dibagi RATA kepada semua pengguna berperan MANDOR (termasuk Kepala Operasional).
    - Hasil kalkulasi dikembalikan sebagai response (on-demand, tidak disimpan ke DB).

    Contoh: 500 pcs lolos × Rp 500/pcs = Rp 250.000 ÷ 3 penerima = Rp 83.334/orang.
    """
    try:
        return calculate_qc_bonus_pool(db, order_id, payload.bonus_rate_per_pcs)
    except (QCBonusPoolEmptyError, NoBonusRecipientsError, ValueError) as e:
        raise _handle_error(e) from e


@router.get(
    "/bonus-preview",
    response_model=QCBonusPoolResponse,
    dependencies=[Depends(require_roles(_PREVIEW_ROLES))],
)
def preview_bonus_pool(
    order_id: uuid.UUID = Query(..., description="ID Order"),
    bonus_rate_per_pcs: Decimal = Query(..., gt=0, description="Rate bonus per pcs (Rp)"),
    db: Session = Depends(get_db),
) -> QCBonusPoolResponse:
    """Pratinjau pool bonus QC per order (baca saja, untuk kalkulator halaman QC)."""
    try:
        return calculate_qc_bonus_pool(db, order_id, bonus_rate_per_pcs)
    except (QCBonusPoolEmptyError, NoBonusRecipientsError, ValueError) as e:
        raise _handle_error(e) from e
