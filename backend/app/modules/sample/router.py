"""Endpoint API untuk modul Sample & Time Study Tracker (FR-3, FR-4).

Endpoint tersedia di /api/v1/sample.
"""
import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.auth.dependencies import get_current_user, require_roles
from app.modules.auth.models import User, UserRole
from app.modules.sample.errors import (
    SampleAlreadyApprovedError,
    SampleCodeDuplicateError,
    SampleNotFoundError,
    SampleOwnerApprovalError,
    SampleVersionNotFoundError,
)
from app.modules.sample.schemas import (
    OwnerApproveRequest,
    OwnerRejectRequest,
    SampleComponentCreate,
    SampleComponentResponse,
    SampleCreate,
    SampleVersionCreate,
    SampleVersionDetailResponse,
    SampleVersionResponse,
    SampleWithVersionsResponse,
)
from app.modules.sample.service import (
    add_component,
    presigned_design_url,
    approve_owner,
    approve_version,
    create_revision,
    create_sample,
    get_sample,
    get_version,
    list_components,
    list_samples,
    reject_owner,
    update_component,
    upload_design_image,
)

router = APIRouter(prefix="/sample", tags=["sample"])

_SAMPLE_ROLES = [UserRole.TIM_SAMPLE, UserRole.OWNER, UserRole.MANDOR]
_APPROVE_ROLES = [UserRole.TIM_SAMPLE, UserRole.OWNER]
_OWNER_ROLES = [UserRole.OWNER]


def _handle_sample_error(exc: Exception) -> HTTPException:
    if isinstance(exc, (SampleNotFoundError, SampleVersionNotFoundError)):
        return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    if isinstance(exc, SampleAlreadyApprovedError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, SampleCodeDuplicateError):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc))
    if isinstance(exc, SampleOwnerApprovalError):
        return HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc))
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


# ---------------------------------------------------------------------------
# Sample endpoints
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[SampleWithVersionsResponse])
def get_samples(
    client_id: uuid.UUID | None = Query(None, description="Filter sample per ID Klien"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[SampleWithVersionsResponse]:
    """Mendapatkan daftar sample beserta semua versinya."""
    # Isolasi multi-tenant untuk KLIEN_MAKLON
    if current_user.role == UserRole.KLIEN_MAKLON:
        if not current_user.client_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akun klien tidak terhubung dengan entitas klien yang valid.",
            )
        client_id = current_user.client_id

    samples = list_samples(db, client_id=client_id)
    return [SampleWithVersionsResponse.model_validate(s) for s in samples]


@router.post(
    "/",
    response_model=SampleWithVersionsResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(_SAMPLE_ROLES))],
)
def create_new_sample(
    payload: SampleCreate,
    db: Session = Depends(get_db),
) -> SampleWithVersionsResponse:
    """Membuat sample baru. Versi v1 DRAFT otomatis terbuat.

    FR-3.1: Setiap sample dimulai dengan versi pertama (v1 DRAFT).
    """
    try:
        sample = create_sample(db, payload)
    except (SampleCodeDuplicateError, ValueError) as e:
        raise _handle_sample_error(e) from e
    return SampleWithVersionsResponse.model_validate(sample)


@router.get("/{sample_id}", response_model=SampleWithVersionsResponse)
def get_sample_detail(
    sample_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SampleWithVersionsResponse:
    """Mendapatkan detail sample beserta semua versinya."""
    try:
        sample = get_sample(db, sample_id)
    except SampleNotFoundError as e:
        raise _handle_sample_error(e) from e
    return SampleWithVersionsResponse.model_validate(sample)


# ---------------------------------------------------------------------------
# SampleVersion endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/{sample_id}/revisi",
    response_model=SampleVersionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(_SAMPLE_ROLES))],
)
def create_sample_revision(
    sample_id: uuid.UUID,
    payload: SampleVersionCreate,
    db: Session = Depends(get_db),
) -> SampleVersionResponse:
    """Membuat versi revisi baru dari sample yang ada.

    FR-3.1: Nomor versi dihitung otomatis; status versi baru adalah REVISION.
    """
    try:
        version = create_revision(db, sample_id, payload)
    except (SampleNotFoundError, ValueError) as e:
        raise _handle_sample_error(e) from e
    return SampleVersionResponse.model_validate(version)


@router.post(
    "/versions/{version_id}/approve",
    response_model=SampleVersionResponse,
    dependencies=[Depends(require_roles(_APPROVE_ROLES))],
)
def approve_sample_version(
    version_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SampleVersionResponse:
    """Tahap 1: tim sample menyetujui produk (DRAFT/REVISION → APPROVED).

    FR-4.1: Hanya TIM_SAMPLE dan OWNER yang dapat menyetujui tahap ini.
    Versi terkunci tidak bisa diubah kembali.
    """
    try:
        version = approve_version(db, version_id, user_id=current_user.id)
    except (SampleVersionNotFoundError, SampleAlreadyApprovedError) as e:
        raise _handle_sample_error(e) from e
    return SampleVersionResponse.model_validate(version)


@router.post(
    "/versions/{version_id}/approve-owner",
    response_model=SampleVersionResponse,
    dependencies=[Depends(require_roles(_OWNER_ROLES))],
)
def approve_sample_owner(
    version_id: uuid.UUID,
    payload: OwnerApproveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SampleVersionResponse:
    """Tahap 2: owner menyetujui produk + harga (APPROVED → OWNER_APPROVED).

    Hanya OWNER. Harga wajib > 0. Hasilnya mengunci versi dan
    membuka konversi menjadi order produksi massal.
    """
    try:
        version = approve_owner(
            db, version_id,
            agreed_price=payload.agreed_price,  # type: ignore[arg-type]
            user_id=current_user.id,
            costing_notes=payload.costing_notes,
            currency=payload.currency,
        )
    except (SampleVersionNotFoundError, SampleOwnerApprovalError) as e:
        raise _handle_sample_error(e) from e
    return SampleVersionResponse.model_validate(version)


@router.post(
    "/versions/{version_id}/reject-owner",
    response_model=SampleVersionResponse,
    dependencies=[Depends(require_roles(_OWNER_ROLES))],
)
def reject_sample_owner(
    version_id: uuid.UUID,
    payload: OwnerRejectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SampleVersionResponse:
    """Owner menolak versi (APPROVED → OWNER_REJECTED). Buat revisi baru untuk lanjut."""
    try:
        version = reject_owner(db, version_id, user_id=current_user.id, reason=payload.reason)
    except (SampleVersionNotFoundError, SampleOwnerApprovalError) as e:
        raise _handle_sample_error(e) from e
    return SampleVersionResponse.model_validate(version)


@router.post(
    "/versions/{version_id}/design-image",
    response_model=SampleVersionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(_SAMPLE_ROLES))],
)
async def upload_version_design_image(
    version_id: uuid.UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
) -> SampleVersionResponse:
    """Upload gambar design untuk versi sample (JPG/PNG/WebP ≤5MB, versi terkunci ditolak)."""
    try:
        content = await file.read()
        version = upload_design_image(
            db, version_id,
            filename=file.filename or "design",
            content_type=file.content_type or "",
            data=content,
        )
    except (SampleVersionNotFoundError, SampleAlreadyApprovedError, ValueError) as e:
        raise _handle_sample_error(e) from e
    resp = SampleVersionResponse.model_validate(version)
    resp.design_image_url = presigned_design_url(version.design_image_key)
    return resp


@router.get("/versions/{version_id}", response_model=SampleVersionDetailResponse)
def get_version_detail(
    version_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SampleVersionDetailResponse:
    """Mendapatkan detail versi sample lengkap dengan komponen time study dan ringkasan waktu & bahan."""
    try:
        version = get_version(db, version_id)
        components = list_components(db, version_id)
    except (SampleVersionNotFoundError, ValueError) as e:
        raise _handle_sample_error(e) from e

    total_time = sum(c.time_study_seconds for c in components)
    total_material = sum(c.material_usage_est for c in components)

    detail = SampleVersionDetailResponse(
        id=version.id,
        sample_id=version.sample_id,
        version_number=version.version_number,
        status=version.status,
        order_id=version.order_id,
        tech_pack_notes=version.tech_pack_notes,
        agreed_price=version.agreed_price,
        currency=version.currency,
        costing_notes=version.costing_notes,
        sample_approved_by=version.sample_approved_by,
        sample_approved_at=version.sample_approved_at,
        owner_approved_by=version.owner_approved_by,
        owner_approved_at=version.owner_approved_at,
        created_at=version.created_at,
        components=[SampleComponentResponse.model_validate(c) for c in components],
        total_time_seconds=total_time,
        total_material_est=total_material,
    )
    detail.design_image_url = presigned_design_url(version.design_image_key)
    return detail


# ---------------------------------------------------------------------------
# SampleComponent (Time Study) endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/versions/{version_id}/components",
    response_model=SampleComponentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(_SAMPLE_ROLES))],
)
def add_time_study_component(
    version_id: uuid.UUID,
    payload: SampleComponentCreate,
    db: Session = Depends(get_db),
) -> SampleComponentResponse:
    """Menambahkan komponen garmen beserta hasil stopwatch time study.

    FR-3.1: Versi APPROVED tidak dapat dimodifikasi.
    """
    try:
        comp = add_component(db, version_id, payload)
    except (SampleVersionNotFoundError, SampleAlreadyApprovedError, ValueError) as e:
        raise _handle_sample_error(e) from e
    return SampleComponentResponse.model_validate(comp)


@router.put(
    "/components/{component_id}",
    response_model=SampleComponentResponse,
    dependencies=[Depends(require_roles(_SAMPLE_ROLES))],
)
def update_time_study_component(
    component_id: uuid.UUID,
    payload: SampleComponentCreate,
    db: Session = Depends(get_db),
) -> SampleComponentResponse:
    """Memperbarui data komponen garmen (nama, estimasi bahan, hasil stopwatch).

    Versi APPROVED tidak dapat dimodifikasi.
    """
    try:
        comp = update_component(db, component_id, payload)
    except (SampleAlreadyApprovedError, ValueError) as e:
        raise _handle_sample_error(e) from e
    return SampleComponentResponse.model_validate(comp)


@router.get("/designs/{file_path:path}", summary="Akses Gambar Desain Sampel")
def get_design_image_file(file_path: str):
    """Menyajikan file gambar desain sampel yang tersimpan."""
    candidates = [
        os.path.abspath(os.path.join(os.getcwd(), "uploads", file_path)),
        os.path.abspath(os.path.join(os.getcwd(), "uploads", "designs", file_path)),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "uploads", file_path)),
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "uploads", "designs", file_path)),
    ]
    for p in candidates:
        if os.path.isfile(p):
            return FileResponse(p)
    raise HTTPException(status_code=404, detail="File gambar desain tidak ditemukan.")
