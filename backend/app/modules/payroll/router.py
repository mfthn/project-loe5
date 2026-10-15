"""Endpoint API untuk modul Payroll Engine & Penguncian Audit (FR-10).

Endpoint tersedia di /api/v1/payroll.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_user, require_roles
from app.modules.auth.models import User, UserRole
from app.modules.payroll.errors import (
    NoOutputsForPeriodError,
    PayrollDetailNotFoundError,
    PayrollPaymentAlreadyRecordedError,
    PayrollPeriodOverlapError,
    PayrollRunNotLockedError,
    PayrollRunLockedError,
    PayrollRunNotFoundError,
)
from app.modules.payroll.schemas import (
    BatchFinancialCreate,
    BatchFinancialResponse,
    PayrollFinanceReview,
    PayrollMonthlySummaryResponse,
    PayrollNotificationResponse,
    PayrollPaymentResponse,
    PayrollPreviewResponse,
    PayrollRunCreate,
    PayrollRunDetailResponse,
    PayrollRunResponse,
    WorkerPayrollSummaryResponse,
)
from app.modules.payroll.service import (
    calculate_and_save_batch_financial,
    create_payroll_run,
    get_batch_financial,
    get_monthly_summary,
    get_payroll_run,
    list_batch_financials,
    list_payroll_notifications,
    list_payroll_runs,
    list_worker_payroll_summaries,
    mark_payroll_detail_paid,
    preview_payroll,
    review_payroll_funding,
)

router = APIRouter(prefix="/payroll", tags=["payroll"])

# Finance mengeksekusi, Owner mengawasi & dapat menjalankan (konfigurasi sistem).
# Penguncian audit permanen tetap berlaku untuk semua peran.
_FINANCE_ROLES = [UserRole.FINANCE_PAYROLL, UserRole.OWNER]
_VIEW_ROLES = [UserRole.FINANCE_PAYROLL, UserRole.OWNER]


def _handle_error(exc: Exception) -> HTTPException:
    if isinstance(exc, PayrollRunNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, PayrollRunLockedError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, (PayrollRunNotLockedError, PayrollPaymentAlreadyRecordedError)):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, PayrollDetailNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, PayrollPeriodOverlapError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, NoOutputsForPeriodError):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@router.get(
    "/my-summary",
    response_model=list[WorkerPayrollSummaryResponse],
    dependencies=[Depends(require_roles([UserRole.PENJAHIT]))],
)
def get_my_payroll_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[WorkerPayrollSummaryResponse]:
    """Rekap payroll resmi dan catatan progres hanya milik Penjahit aktif."""
    summaries = list_worker_payroll_summaries(db, current_user.id)
    return [WorkerPayrollSummaryResponse.model_validate(summary) for summary in summaries]


@router.get(
    "/notifications",
    response_model=list[PayrollNotificationResponse],
    dependencies=[Depends(require_roles([UserRole.MANDOR]))],
)
def get_my_payroll_notifications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[PayrollNotificationResponse]:
    notifications = list_payroll_notifications(db, current_user.id)
    return [PayrollNotificationResponse.model_validate(item) for item in notifications]


@router.get(
    "/monthly-summary",
    response_model=PayrollMonthlySummaryResponse,
    dependencies=[Depends(require_roles(_VIEW_ROLES))],
)
def get_owner_monthly_summary(
    year: int = Query(..., ge=2000, le=2100),
    month: int = Query(..., ge=1, le=12),
    db: Session = Depends(get_db),
) -> PayrollMonthlySummaryResponse:
    return get_monthly_summary(db, year, month)


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
    dependencies=[Depends(require_roles(_FINANCE_ROLES))],
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
    dependencies=[Depends(require_roles(_FINANCE_ROLES))],
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
    "/runs/{run_id}/finance-review",
    response_model=PayrollRunDetailResponse,
    dependencies=[Depends(require_roles(_FINANCE_ROLES))],
)
def review_payroll(
    run_id: uuid.UUID,
    payload: PayrollFinanceReview,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PayrollRunDetailResponse:
    """Finance mencatat ketersediaan dana; payroll terkunci hanya jika dana mencukupi."""
    try:
        run = review_payroll_funding(
            db,
            run_id,
            payload.available_funds,
            current_user.id,
            payload.review_note,
        )
    except (PayrollRunNotFoundError, PayrollRunLockedError) as e:
        raise _handle_error(e) from e
    return PayrollRunDetailResponse.model_validate(run)


@router.post(
    "/runs/{run_id}/details/{detail_id}/payment",
    response_model=PayrollPaymentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(_FINANCE_ROLES))],
)
def confirm_payroll_payment(
    run_id: uuid.UUID,
    detail_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> PayrollPaymentResponse:
    """Catat pembayaran aktual untuk satu slip payroll yang sudah terkunci."""
    try:
        payment = mark_payroll_detail_paid(
            db,
            run_id=run_id,
            detail_id=detail_id,
            paid_by_user_id=current_user.id,
        )
    except (
        PayrollDetailNotFoundError,
        PayrollPaymentAlreadyRecordedError,
        PayrollRunNotLockedError,
    ) as exc:
        raise _handle_error(exc) from exc
    return PayrollPaymentResponse.model_validate(payment)


# ---------------------------------------------------------------------------
# Batch Financials endpoints (Activity Diagram: HPP & Net Profit Batch)
# ---------------------------------------------------------------------------

@router.post(
    "/financials",
    response_model=BatchFinancialResponse,
    dependencies=[Depends(require_roles(_FINANCE_ROLES))],
)
def calculate_batch_financial_endpoint(
    payload: BatchFinancialCreate,
    db: Session = Depends(get_db),
) -> BatchFinancialResponse:
    """Menghitung dan memperbarui rincian HPP, Material Cost, Overhead, dan Net Profit Owner."""
    try:
        fin = calculate_and_save_batch_financial(db, payload)
    except Exception as exc:
        raise _handle_error(exc) from exc
    return BatchFinancialResponse.model_validate(fin)


@router.get(
    "/financials",
    response_model=list[BatchFinancialResponse],
    dependencies=[Depends(require_roles(_VIEW_ROLES))],
)
def get_all_batch_financials_endpoint(
    db: Session = Depends(get_db),
) -> list[BatchFinancialResponse]:
    """Daftar ringkasan finansial seluruh batch produksi."""
    fins = list_batch_financials(db)
    return [BatchFinancialResponse.model_validate(f) for f in fins]


@router.get(
    "/financials/{order_id}",
    response_model=BatchFinancialResponse,
    dependencies=[Depends(require_roles(_VIEW_ROLES))],
)
def get_batch_financial_endpoint(
    order_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> BatchFinancialResponse:
    """Detail analisis laba/rugi batch untuk order tertentu."""
    try:
        fin = get_batch_financial(db, order_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return BatchFinancialResponse.model_validate(fin)
