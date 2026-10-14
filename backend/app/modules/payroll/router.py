"""Endpoint API untuk modul Payroll Engine & Penguncian Audit (FR-10).

Endpoint tersedia di /api/v1/payroll.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_user, require_roles
from app.modules.auth.models import User, UserRole
from app.modules.payroll.errors import (
    NoOutputsForPeriodError,
    PayrollPeriodOverlapError,
    PayrollRunLockedError,
    PayrollRunNotFoundError,
)
from app.modules.payroll.schemas import (
    PayrollLockResponse,
    PayrollPreviewResponse,
    PayrollRunCreate,
    PayrollRunDetailResponse,
    PayrollRunResponse,
)
from app.modules.payroll.service import (
    create_payroll_run,
    get_payroll_run,
    list_payroll_runs,
    lock_payroll_run,
    preview_payroll,
)

router = APIRouter(prefix="/payroll", tags=["payroll"])

_PAYROLL_ROLES = [UserRole.FINANCE_PAYROLL, UserRole.OWNER]
_VIEW_ROLES = [UserRole.FINANCE_PAYROLL, UserRole.OWNER, UserRole.MANDOR]


def _handle_error(exc: Exception) -> HTTPException:
    if isinstance(exc, PayrollRunNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, PayrollRunLockedError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, PayrollPeriodOverlapError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, NoOutputsForPeriodError):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ---------------------------------------------------------------------------
# PayrollRun endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/runs",
    response_model=list[PayrollRunResponse],
    dependencies=[Depends(require_roles(_VIEW_ROLES))],
)
def get_payroll_runs(
    db: Session = Depends(get_db),
) -> list[PayrollRunResponse]:
    """Mendapatkan daftar semua siklus penggajian, urut dari yang terbaru."""
    runs = list_payroll_runs(db)
    return [PayrollRunResponse.model_validate(r) for r in runs]


@router.get(
    "/runs/{run_id}",
    response_model=PayrollRunDetailResponse,
    dependencies=[Depends(require_roles(_VIEW_ROLES))],
)
def get_payroll_run_detail(
    run_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> PayrollRunDetailResponse:
    """Mendapatkan detail satu siklus penggajian beserta seluruh slip upah individu."""
    try:
        run = get_payroll_run(db, run_id)
    except PayrollRunNotFoundError as e:
        raise _handle_error(e) from e
    return PayrollRunDetailResponse.model_validate(run)


@router.post(
    "/preview",
    response_model=PayrollPreviewResponse,
    dependencies=[Depends(require_roles(_PAYROLL_ROLES))],
)
def preview_payroll_calculation(
    payload: PayrollRunCreate,
    db: Session = Depends(get_db),
) -> PayrollPreviewResponse:
    """Preview kalkulasi payroll — lihat slip upah sebelum dikonfirmasi & disimpan.

    Berguna untuk review sebelum data permanen masuk ke database.
    """
    try:
        return preview_payroll(db, payload)
    except (NoOutputsForPeriodError, ValueError) as e:
        raise _handle_error(e) from e


@router.post(
    "/runs",
    response_model=PayrollRunDetailResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(_PAYROLL_ROLES))],
)
def create_new_payroll_run(
    payload: PayrollRunCreate,
    db: Session = Depends(get_db),
) -> PayrollRunDetailResponse:
    """FR-10.1 & FR-10.2: Membuat siklus penggajian Sabtu dan menyimpan slip upah semua penjahit.

    - Upah borongan dihitung dari output 30 menit terverifikasi × rate sewing per komponen.
    - Uang makan = `meal_allowance_percentage%` × total upah borongan.
    - Bonus QC = total pcs LOLOS × rate ÷ jumlah MANDOR.
    - Headcount dinamis: penjahit baru otomatis masuk selama ada output terverifikasi.
    """
    try:
        run = create_payroll_run(db, payload)
    except (PayrollPeriodOverlapError, NoOutputsForPeriodError, ValueError) as e:
        raise _handle_error(e) from e
    return PayrollRunDetailResponse.model_validate(run)


@router.post(
    "/runs/{run_id}/lock",
    response_model=PayrollLockResponse,
    dependencies=[Depends(require_roles(_PAYROLL_ROLES))],
)
def lock_payroll(
    run_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> PayrollLockResponse:
    """FR-10 Audit Lock: Mengunci payroll run secara PERMANEN untuk keperluan audit keuangan.

    ⚠️ Setelah dikunci, data tidak dapat diubah oleh siapa pun — termasuk OWNER.
    Kunci ini bersifat ireversibel untuk menjaga integritas trail audit.
    """
    try:
        run = lock_payroll_run(db, run_id)
    except (PayrollRunNotFoundError, PayrollRunLockedError) as e:
        raise _handle_error(e) from e
    return PayrollLockResponse(
        run_id=run.id,
        is_locked=run.is_locked,
        message=f"Payroll run periode {run.period_start} – {run.period_end} berhasil dikunci. Data tidak dapat diubah.",
    )
