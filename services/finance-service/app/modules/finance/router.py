"""Endpoint API untuk modul Finance: PO bahan & Invoice klien (FR-11)."""
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_user, require_roles
from app.modules.auth.models import User, UserRole
from app.modules.finance.errors import (
    InvoiceNotFoundError,
    InvoiceNumberDuplicateError,
    InvoiceOrderError,
    InvoicePaymentError,
    PONotFoundError,
    PONumberDuplicateError,
    POTransitionError,
)
from app.modules.finance.models import InvoiceStatus, POStatus
from app.modules.finance.schemas import (
    HPPApplyRequest,
    HPPRealizedResponse,
    POPaymentCreate,
    POPaymentResponse,
    POUpdate,
    ProductionNeedResponse,
    InvoiceCreate,
    InvoicePaymentCreate,
    InvoicePaymentResponse,
    InvoiceResponse,
    POCreate,
    POResponse,
    POReview,
)
from app.modules.finance.service import (
    approve_invoice,
    confirm_po,
    create_invoice,
    create_po,
    list_invoices,
    list_pos,
    production_needs,
    realized_material_cost,
    record_po_payment,
    record_payment,
    reject_invoice,
    review_po,
    update_po_draft,
)

router = APIRouter(prefix="/finance", tags=["finance"])

_PO_CREATE_ROLES = [UserRole.TIM_SAMPLE, UserRole.FINANCE_PAYROLL, UserRole.OWNER, UserRole.GUDANG]
_PO_REVIEW_ROLES = [UserRole.FINANCE_PAYROLL, UserRole.OWNER]
_PO_CONFIRM_ROLES = [UserRole.GUDANG, UserRole.OWNER]
_INVOICE_CREATE_ROLES = [UserRole.FINANCE_PAYROLL]
_INVOICE_APPROVE_ROLES = [UserRole.OWNER]
_PAYMENT_ROLES = [UserRole.FINANCE_PAYROLL, UserRole.OWNER]


def _handle_po_error(exc: Exception) -> HTTPException:
    if isinstance(exc, PONotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, PONumberDuplicateError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, POTransitionError):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


def _handle_inv_error(exc: Exception) -> HTTPException:
    if isinstance(exc, InvoiceNotFoundError):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, InvoiceNumberDuplicateError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, (InvoiceOrderError, InvoicePaymentError)):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


def _resolve_client(current_user: User, client_id: uuid.UUID | None) -> uuid.UUID | None:
    if current_user.role == UserRole.KLIEN_MAKLON:
        if not current_user.client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akun klien tidak terhubung dengan entitas klien yang valid.",
            )
        return current_user.client_id
    return client_id


@router.post(
    "/pos",
    response_model=POResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(_PO_CREATE_ROLES))],
)
def create_new_po(
    payload: POCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> POResponse:
    """Tim Sample mengajukan PO bahan setelah kesepakatan produk dengan klien."""
    try:
        po = create_po(db, payload, requester_id=current_user.id)
    except (PONumberDuplicateError, ValueError) as e:
        raise _handle_po_error(e) from e
    return POResponse.model_validate(po)


@router.get("/pos", response_model=list[POResponse])
def get_pos(
    client_id: uuid.UUID | None = Query(None),
    order_id: uuid.UUID | None = Query(None),
    status_filter: POStatus | None = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[POResponse]:
    """Daftar PO. Klien hanya melihat miliknya."""
    client_id = _resolve_client(current_user, client_id)
    return [POResponse.model_validate(po) for po in list_pos(db, client_id, order_id, status_filter)]


@router.patch(
    "/pos/{po_id}/review",
    response_model=POResponse,
    dependencies=[Depends(require_roles(_PO_REVIEW_ROLES))],
)
def review_po_entry(
    po_id: uuid.UUID,
    payload: POReview,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> POResponse:
    """Finance/Owner menyetujui atau menolak PO (DRAFT → DISETUJUI/DITOLAK)."""
    try:
        po = review_po(db, po_id, payload.approve, current_user.id, payload.notes)
    except (PONotFoundError, POTransitionError) as e:
        raise _handle_po_error(e) from e
    return POResponse.model_validate(po)


@router.post(
    "/invoices",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(_INVOICE_CREATE_ROLES))],
)
def create_new_invoice(
    payload: InvoiceCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InvoiceResponse:
    """Finance menerbitkan invoice harga keseluruhan untuk order SELESAI."""
    try:
        inv = create_invoice(db, payload, issuer_id=current_user.id)
    except (InvoiceNumberDuplicateError, InvoiceOrderError, ValueError) as e:
        raise _handle_inv_error(e) from e
    return InvoiceResponse.model_validate(inv)


@router.get("/invoices", response_model=list[InvoiceResponse])
def get_invoices(
    client_id: uuid.UUID | None = Query(None),
    order_id: uuid.UUID | None = Query(None),
    status_filter: InvoiceStatus | None = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[InvoiceResponse]:
    """Daftar invoice (total keseluruhan per order). Klien hanya miliknya."""
    client_id = _resolve_client(current_user, client_id)
    return [InvoiceResponse.model_validate(i) for i in list_invoices(db, client_id, order_id, status_filter)]


@router.post(
    "/invoices/{invoice_id}/approve",
    response_model=InvoiceResponse,
    dependencies=[Depends(require_roles(_INVOICE_APPROVE_ROLES))],
)
def approve_invoice_entry(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InvoiceResponse:
    """Owner menyetujui invoice (DRAFT → BELUM_BAYAR)."""
    try:
        inv = approve_invoice(db, invoice_id, approver_id=current_user.id)
    except (InvoiceNotFoundError, InvoiceOrderError) as e:
        raise _handle_inv_error(e) from e
    return InvoiceResponse.model_validate(inv)


@router.post(
    "/invoices/{invoice_id}/reject",
    response_model=InvoiceResponse,
    dependencies=[Depends(require_roles(_INVOICE_APPROVE_ROLES))],
)
def reject_invoice_entry(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InvoiceResponse:
    """Owner menolak invoice (DRAFT → DITOLAK)."""
    try:
        inv = reject_invoice(db, invoice_id, approver_id=current_user.id)
    except (InvoiceNotFoundError, InvoiceOrderError) as e:
        raise _handle_inv_error(e) from e
    return InvoiceResponse.model_validate(inv)


@router.post(
    "/invoices/{invoice_id}/payments",
    response_model=InvoiceResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(_PAYMENT_ROLES))],
)
def record_invoice_payment(
    invoice_id: uuid.UUID,
    payload: InvoicePaymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> InvoiceResponse:
    """Catat pembayaran bertahap (BELUM_BAYAR → SEBAGIAN → LUNAS otomatis)."""
    try:
        inv = record_payment(db, invoice_id, payload, recorder_id=current_user.id)
    except (InvoiceNotFoundError, InvoicePaymentError) as e:
        raise _handle_inv_error(e) from e
    return InvoiceResponse.model_validate(inv)


@router.get(
    "/invoices/{invoice_id}/payments",
    response_model=list[InvoicePaymentResponse],
)
def get_invoice_payments(
    invoice_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[InvoicePaymentResponse]:
    """Riwayat pembayaran satu invoice. Klien hanya miliknya."""
    from app.modules.finance.service import _get_invoice

    try:
        inv = _get_invoice(db, invoice_id)
    except InvoiceNotFoundError as e:
        raise _handle_inv_error(e) from e
    if current_user.role == UserRole.KLIEN_MAKLON and inv.client_id != current_user.client_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invoice tidak ditemukan.")
    return [InvoicePaymentResponse.model_validate(p) for p in inv.payments]


@router.get(
    "/hpp/{order_id}",
    response_model=HPPRealizedResponse,
    dependencies=[Depends(require_roles([UserRole.FINANCE_PAYROLL, UserRole.OWNER]))],
)
def get_realized_hpp(
    order_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> HPPRealizedResponse:
    """Biaya bahan terealisasi per order dari PO (Σ qty_received × unit_price)."""
    try:
        return HPPRealizedResponse(**realized_material_cost(db, order_id))
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e


@router.post(
    "/hpp/{order_id}/apply",
    dependencies=[Depends(require_roles([UserRole.FINANCE_PAYROLL, UserRole.OWNER]))],
)
def apply_realized_hpp(
    order_id: uuid.UUID,
    payload: HPPApplyRequest,
    db: Session = Depends(get_db),
):
    """Terapkan biaya bahan terealisasi sebagai material_cost HPP (revenue/overhead tetap manual).

    Jika HPP batch sudah ada, revenue & overhead diambil dari data tersimpan
    kecuali dioverride. Jika belum ada, keduanya wajib diisi.
    """
    from decimal import Decimal as _Decimal

    from app.modules.payroll.schemas import BatchFinancialCreate, BatchFinancialResponse
    from app.modules.payroll.service import calculate_and_save_batch_financial
    from app.modules.payroll.models import BatchFinancial as _BatchFinancial

    try:
        realized = realized_material_cost(db, order_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e)) from e

    existing = db.scalar(
        select(_BatchFinancial).where(_BatchFinancial.order_id == order_id)
    )
    revenue = payload.contract_revenue
    overhead = payload.overhead_cost
    if existing is not None:
        if revenue is None:
            revenue = existing.contract_revenue
        if overhead is None:
            overhead = existing.overhead_cost
    if revenue is None or overhead is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="HPP batch belum ada: contract_revenue dan overhead_cost wajib diisi.",
        )
    fin = calculate_and_save_batch_financial(
        db,
        BatchFinancialCreate(
            order_id=order_id,
            contract_revenue=_Decimal(str(revenue)),
            material_cost=_Decimal(str(realized["realized_material_cost"])),
            overhead_cost=_Decimal(str(overhead)),
        ),
    )
    return BatchFinancialResponse.model_validate(fin)


@router.post(
    "/pos/{po_id}/confirm",
    response_model=POResponse,
    dependencies=[Depends(require_roles(_PO_CONFIRM_ROLES))],
)
def confirm_po_entry(
    po_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> POResponse:
    """Gudang mengonfirmasi kebutuhan pengadaan (DRAFT → TERKONFIRMASI)."""
    try:
        po = confirm_po(db, po_id, confirmer_id=current_user.id)
    except (PONotFoundError, POTransitionError) as e:
        raise _handle_po_error(e) from e
    return POResponse.model_validate(po)


@router.patch(
    "/pos/{po_id}",
    response_model=POResponse,
    dependencies=[Depends(require_roles(_PO_REVIEW_ROLES))],
)
def update_po_draft_entry(
    po_id: uuid.UUID,
    payload: POUpdate,
    db: Session = Depends(get_db),
) -> POResponse:
    """Finance melengkapi PO DRAFT (supplier + harga) sebelum review."""
    try:
        po = update_po_draft(db, po_id, payload.supplier_name, payload.line_prices)
    except (PONotFoundError, POTransitionError, ValueError) as e:
        raise _handle_po_error(e) from e
    return POResponse.model_validate(po)


@router.post(
    "/pos/{po_id}/payments",
    response_model=POPaymentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(_PO_REVIEW_ROLES))],
)
def record_po_payment_entry(
    po_id: uuid.UUID,
    payload: POPaymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> POPaymentResponse:
    """Finance membayar supplier bertahap (menolak kelebihan dari total PO)."""
    try:
        result = record_po_payment(
            db, po_id, payload.amount,
            recorder_id=current_user.id, notes=payload.notes,
        )
    except (PONotFoundError, POTransitionError, ValueError) as e:
        raise _handle_po_error(e) from e
    return POPaymentResponse(**result)


@router.get("/needs", response_model=list[ProductionNeedResponse])
def get_production_needs(
    client_id: uuid.UUID | None = Query(None),
    order_id: uuid.UUID | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProductionNeedResponse]:
    """Status kebutuhan produksi per pengajuan (TERPENUHI/BELUM). Klien hanya miliknya."""
    client_id = _resolve_client(current_user, client_id)
    return [ProductionNeedResponse(**n) for n in production_needs(db, client_id, order_id)]
