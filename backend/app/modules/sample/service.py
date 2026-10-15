"""Logika bisnis Sample & Time Study Tracker (FR-3, FR-4).

Alur Skenario 4 (P0) + approval owner dua tahap:
  1. Buat Sample baru → versi v1 DRAFT otomatis terbuat.
  2. Catat komponen garmen + hasil stopwatch time study pada versi.
  3. Revisi sample → buat versi baru (v2, v3, dst.) dari versi sebelumnya.
  4. Approve tahap 1 (tim sample): DRAFT/REVISION → APPROVED.
  5. Approve tahap 2 (owner): APPROVED → OWNER_APPROVED (wajib harga disepakati).
     Tolak owner: APPROVED → OWNER_REJECTED (dengan alasan, lalu buat revisi baru).
  6. Hanya versi OWNER_APPROVED yang dapat dikonversi menjadi Order Produksi Massal.
"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.sample.errors import (
    SampleAlreadyApprovedError,
    SampleCodeDuplicateError,
    SampleNotFoundError,
    SampleOwnerApprovalError,
    SampleVersionNotFoundError,
)
from app.modules.sample.models import Sample, SampleComponent, SampleStatus, SampleVersion
from app.modules.sample.schemas import SampleComponentCreate, SampleCreate, SampleVersionCreate

# Status versi yang terkunci (tidak boleh tambah/ubah komponen)
_LOCKED_STATUSES = frozenset(
    {SampleStatus.APPROVED, SampleStatus.OWNER_APPROVED, SampleStatus.OWNER_REJECTED}
)


# ---------------------------------------------------------------------------
# Sample CRUD
# ---------------------------------------------------------------------------

def list_samples(db: Session, client_id: uuid.UUID | None = None) -> list[Sample]:
    """Mengambil daftar sample, opsional filter per klien."""
    stmt = select(Sample).order_by(Sample.created_at.desc())
    if client_id is not None:
        stmt = stmt.where(Sample.client_id == client_id)
    return list(db.scalars(stmt).all())


def get_sample(db: Session, sample_id: uuid.UUID) -> Sample:
    """Mengambil satu sample beserta seluruh versinya. Melempar SampleNotFoundError jika tidak ada."""
    s = db.scalar(select(Sample).where(Sample.id == sample_id))
    if s is None:
        raise SampleNotFoundError(sample_id)
    return s


def create_sample(db: Session, payload: SampleCreate) -> Sample:
    """Membuat sample baru. Versi v1 dengan status DRAFT otomatis dibuat bersamaan.

    FR-3.1: Setiap sample dimulai dengan satu versi initial (v1 DRAFT).
    """
    # Pastikan kode sample belum dipakai
    existing = db.scalar(select(Sample).where(Sample.sample_code == payload.sample_code.strip().upper()))
    if existing is not None:
        raise SampleCodeDuplicateError(payload.sample_code)

    sample = Sample(
        client_id=payload.client_id,
        sample_code=payload.sample_code.strip().upper(),
        article_name=payload.article_name.strip(),
    )
    db.add(sample)
    db.flush()  # dapat sample.id sebelum commit

    # Buat versi pertama secara otomatis
    v1 = SampleVersion(
        sample_id=sample.id,
        version_number=1,
        status=SampleStatus.DRAFT,
        tech_pack_notes=payload.tech_pack_notes,
    )
    db.add(v1)
    db.commit()
    db.refresh(sample)
    return sample


# ---------------------------------------------------------------------------
# SampleVersion
# ---------------------------------------------------------------------------

def get_version(db: Session, version_id: uuid.UUID) -> SampleVersion:
    """Mengambil versi sample. Melempar SampleVersionNotFoundError jika tidak ada."""
    v = db.scalar(select(SampleVersion).where(SampleVersion.id == version_id))
    if v is None:
        raise SampleVersionNotFoundError(version_id)
    return v


def create_revision(db: Session, sample_id: uuid.UUID, payload: SampleVersionCreate) -> SampleVersion:
    """Membuat versi revisi baru dari sample yang ada.

    FR-3.1: Nomor versi dihitung otomatis (+1 dari versi tertinggi yang ada).
    Versi APPROVED pun boleh direvisi — hasilnya versi baru dengan status REVISION.
    """
    sample = get_sample(db, sample_id)

    # Hitung nomor versi berikutnya
    max_ver = max((v.version_number for v in sample.versions), default=0)

    new_version = SampleVersion(
        sample_id=sample.id,
        version_number=max_ver + 1,
        status=SampleStatus.REVISION,
        tech_pack_notes=payload.tech_pack_notes,
    )
    db.add(new_version)
    db.commit()
    db.refresh(new_version)
    return new_version


def approve_version(
    db: Session, version_id: uuid.UUID, user_id: uuid.UUID | None = None
) -> SampleVersion:
    """Tahap 1: tim sample menyetujui versi (DRAFT/REVISION → APPROVED).

    FR-4.1: Versi yang sudah APPROVED / OWNER_APPROVED / OWNER_REJECTED
    tidak dapat disetujui ulang.
    """
    version = get_version(db, version_id)
    if version.status in _LOCKED_STATUSES:
        raise SampleAlreadyApprovedError(version_id)

    version.status = SampleStatus.APPROVED
    version.sample_approved_by = user_id
    version.sample_approved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(version)
    return version


def approve_owner(
    db: Session,
    version_id: uuid.UUID,
    agreed_price: Decimal,
    user_id: uuid.UUID | None = None,
    costing_notes: str | None = None,
    currency: str = "IDR",
) -> SampleVersion:
    """Tahap 2: owner menyetujui produk + harga (APPROVED → OWNER_APPROVED).

    Harga wajib > 0. Hanya versi yang sudah lolos tahap 1 yang bisa diproses.
    """
    version = get_version(db, version_id)
    if version.status != SampleStatus.APPROVED:
        raise SampleOwnerApprovalError(
            f"Versi {version_id} berstatus {version.status.value}, "
            "hanya versi APPROVED (lolos tim sample) yang bisa disetujui owner."
        )
    try:
        price = Decimal(str(agreed_price))
    except Exception:
        raise SampleOwnerApprovalError("Harga kesepakatan tidak valid.") from None
    if price <= 0:
        raise SampleOwnerApprovalError("Harga kesepakatan wajib lebih besar dari 0.")

    version.status = SampleStatus.OWNER_APPROVED
    version.agreed_price = price
    version.currency = (currency or "IDR").strip().upper()[:3]
    if costing_notes is not None:
        version.costing_notes = costing_notes
    version.owner_approved_by = user_id
    version.owner_approved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(version)
    return version


def reject_owner(
    db: Session,
    version_id: uuid.UUID,
    user_id: uuid.UUID | None = None,
    reason: str | None = None,
) -> SampleVersion:
    """Owner menolak versi (APPROVED → OWNER_REJECTED). Buat revisi baru untuk lanjut."""
    version = get_version(db, version_id)
    if version.status != SampleStatus.APPROVED:
        raise SampleOwnerApprovalError(
            f"Versi {version_id} berstatus {version.status.value}, "
            "hanya versi APPROVED yang bisa ditolak owner."
        )
    version.status = SampleStatus.OWNER_REJECTED
    if reason:
        version.costing_notes = reason
    version.owner_approved_by = user_id
    version.owner_approved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(version)
    return version


# ---------------------------------------------------------------------------
# SampleComponent (Time Study)
# ---------------------------------------------------------------------------

def list_components(db: Session, version_id: uuid.UUID) -> list[SampleComponent]:
    """Mengambil semua komponen garmen dan hasil time study dari sebuah versi sample."""
    get_version(db, version_id)  # validasi keberadaan versi
    stmt = select(SampleComponent).where(SampleComponent.sample_version_id == version_id)
    return list(db.scalars(stmt).all())


def add_component(
    db: Session,
    version_id: uuid.UUID,
    payload: SampleComponentCreate,
) -> SampleComponent:
    """Menambahkan komponen garmen beserta hasil stopwatch time study ke versi sample.

    FR-3.1: Versi terkunci (APPROVED / OWNER_APPROVED / OWNER_REJECTED)
    tidak dapat dimodifikasi — lempar SampleAlreadyApprovedError.
    """
    version = get_version(db, version_id)
    if version.status in _LOCKED_STATUSES:
        raise SampleAlreadyApprovedError(version_id)

    component = SampleComponent(
        sample_version_id=version_id,
        component_name=payload.component_name.strip(),
        material_usage_est=payload.material_usage_est,
        time_study_seconds=payload.time_study_seconds,
    )
    db.add(component)
    db.commit()
    db.refresh(component)
    return component


def update_component(
    db: Session,
    component_id: uuid.UUID,
    payload: SampleComponentCreate,
) -> SampleComponent:
    """Memperbarui data komponen (nama, estimasi bahan, hasil stopwatch).

    Versi terkunci (APPROVED / OWNER_APPROVED / OWNER_REJECTED) tidak dapat dimodifikasi.
    """
    comp = db.scalar(select(SampleComponent).where(SampleComponent.id == component_id))
    if comp is None:
        raise ValueError(f"Komponen dengan ID {component_id} tidak ditemukan.")

    version = get_version(db, comp.sample_version_id)
    if version.status in _LOCKED_STATUSES:
        raise SampleAlreadyApprovedError(version.id)

    comp.component_name = payload.component_name.strip()
    comp.material_usage_est = payload.material_usage_est
    comp.time_study_seconds = payload.time_study_seconds
    db.commit()
    db.refresh(comp)
    return comp
