"""Logika bisnis Quality Control, Manajemen Defect, dan Pool Bonus QC (FR-9, FR-10.3).

Alur Skenario 3 (P0) — Pembagian Pool Bonus QC 3-Arah:
  1. QC Inspector mencatat hasil inspeksi: LOLOS / REPAIR / DEFECT per batch pcs.
  2. Hanya pcs LOLOS yang mengakumulasi pool bonus.
  3. Total pool = qty_lolos × bonus_rate_per_pcs.
  4. Pool dibagi RATA kepada semua MANDOR + Kepala Operasional (role MANDOR).
  5. Hasil kalkulasi dikembalikan sebagai response (tidak disimpan — perhitungan on-demand).
"""
import uuid
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import select, func as sa_func
from sqlalchemy.orm import Session

from app.modules.auth.models import User, UserRole
from app.modules.produksi.models import Order, OrderStatus
from app.modules.qc.errors import (
    InvalidQCQuantityError,
    NoBonusRecipientsError,
    OrderNotInQCStatusError,
    QCBonusPoolEmptyError,
    InspectionNotFoundError,
)
from app.modules.qc.models import QCInspection, QCStatus
from app.modules.qc.schemas import (
    BonusRecipient,
    QCBonusPoolResponse,
    QCInspectionCreate,
    QCSummaryResponse,
)

# Status order yang diperbolehkan untuk inspeksi QC
_QC_ALLOWED_STATUSES = {OrderStatus.MENUNGGU_QC, OrderStatus.QC}


# ---------------------------------------------------------------------------
# QC Inspection CRUD
# ---------------------------------------------------------------------------

def list_inspections(
    db: Session,
    order_id: uuid.UUID | None = None,
    inspector_user_id: uuid.UUID | None = None,
    status: QCStatus | None = None,
) -> list[QCInspection]:
    """Mengambil daftar catatan inspeksi QC dengan filter opsional."""
    stmt = select(QCInspection).order_by(QCInspection.inspected_at.desc())
    if order_id is not None:
        stmt = stmt.where(QCInspection.order_id == order_id)
    if inspector_user_id is not None:
        stmt = stmt.where(QCInspection.inspector_user_id == inspector_user_id)
    if status is not None:
        stmt = stmt.where(QCInspection.status == status)
    return list(db.scalars(stmt).all())


def get_inspection(db: Session, inspection_id: uuid.UUID) -> QCInspection:
    ins = db.scalar(select(QCInspection).where(QCInspection.id == inspection_id))
    if ins is None:
        raise InspectionNotFoundError(inspection_id)
    return ins


def record_inspection(
    db: Session,
    payload: QCInspectionCreate,
    inspector_user_id: uuid.UUID,
) -> QCInspection:
    """FR-9: QC Inspector mencatat hasil inspeksi produk.

    Validasi:
    - Order harus ada dan statusnya MENUNGGU_QC atau QC.
    - qty_inspected > 0.
    - Jika status DEFECT atau REPAIR, defect_category wajib diisi.
    """
    if payload.qty_inspected <= 0:
        raise InvalidQCQuantityError(payload.qty_inspected)

    order = db.scalar(select(Order).where(Order.id == payload.order_id))
    if order is None:
        raise ValueError(f"Order {payload.order_id} tidak ditemukan.")
    if order.status not in _QC_ALLOWED_STATUSES:
        raise OrderNotInQCStatusError(payload.order_id, order.status.value)

    # Otomatis majukan status ke QC jika masih MENUNGGU_QC
    if order.status == OrderStatus.MENUNGGU_QC:
        order.status = OrderStatus.QC

    # Cek apakah sudah 3 kali perbaikan (Activity Diagram: Sudah 3 Kali Perbaikan? -> Lapor Tim Sampel)
    escalate = payload.repair_count >= 3 and payload.status in (QCStatus.REPAIR, QCStatus.DEFECT)

    inspection = QCInspection(
        order_id=payload.order_id,
        production_output_id=payload.production_output_id,
        inspector_user_id=inspector_user_id,
        status=payload.status,
        qty_inspected=payload.qty_inspected,
        repair_count=payload.repair_count,
        escalated_to_sample=escalate,
        defect_category=payload.defect_category,
        notes=payload.notes,
    )
    db.add(inspection)
    db.commit()
    db.refresh(inspection)
    return inspection


def list_escalations_to_sample(db: Session) -> list[QCInspection]:
    """Mengambil daftar inspeksi cacat yang sudah 3x perbaikan dan perlu dianalisa oleh Tim Sampel."""
    stmt = (
        select(QCInspection)
        .where(QCInspection.escalated_to_sample.is_(True))
        .order_by(QCInspection.inspected_at.desc())
    )
    return list(db.scalars(stmt).all())


# ---------------------------------------------------------------------------
# QC Summary
# ---------------------------------------------------------------------------

def get_qc_summary(db: Session, order_id: uuid.UUID) -> QCSummaryResponse:
    """Menghitung ringkasan QC per order: total inspected, lolos, repair, defect, persentase."""
    order = db.scalar(select(Order).where(Order.id == order_id))
    if order is None:
        raise ValueError(f"Order {order_id} tidak ditemukan.")

    def _count(status: QCStatus) -> int:
        result = db.scalar(
            select(sa_func.coalesce(sa_func.sum(QCInspection.qty_inspected), 0))
            .where(QCInspection.order_id == order_id, QCInspection.status == status)
        )
        return int(result or 0)

    lolos = _count(QCStatus.LOLOS)
    repair = _count(QCStatus.REPAIR)
    defect = _count(QCStatus.DEFECT)
    total = lolos + repair + defect

    lolos_pct = round((lolos / total) * 100, 2) if total else 0.0
    defect_pct = round(((repair + defect) / total) * 100, 2) if total else 0.0

    return QCSummaryResponse(
        order_id=order_id,
        total_inspected=total,
        qty_lolos=lolos,
        qty_repair=repair,
        qty_defect=defect,
        lolos_pct=lolos_pct,
        defect_pct=defect_pct,
    )


# ---------------------------------------------------------------------------
# Pool Bonus QC 3-Arah (Skenario 3 — FR-10.3)
# ---------------------------------------------------------------------------

def calculate_qc_bonus_pool(
    db: Session,
    order_id: uuid.UUID,
    bonus_rate_per_pcs: Decimal,
) -> QCBonusPoolResponse:
    """FR-10.3: Menghitung dan membagi pool bonus QC secara rata kepada MANDOR + Kepala Ops.

    Skenario 3 (P0):
    - Total pool = jumlah pcs LOLOS × bonus_rate_per_pcs.
    - Dibagi RATA kepada semua pengguna berperan MANDOR (termasuk Kepala Operasional).
    - Pembulatan ke bawah ke 2 desimal (ROUND_HALF_UP).
    - Tidak menyimpan ke DB — kalkulasi on-demand untuk fleksibilitas.
    """
    order = db.scalar(select(Order).where(Order.id == order_id))
    if order is None:
        raise ValueError(f"Order {order_id} tidak ditemukan.")

    # Hitung total pcs LOLOS
    qty_lolos_raw = db.scalar(
        select(sa_func.coalesce(sa_func.sum(QCInspection.qty_inspected), 0))
        .where(QCInspection.order_id == order_id, QCInspection.status == QCStatus.LOLOS)
    )
    qty_lolos = int(qty_lolos_raw or 0)

    if qty_lolos == 0:
        raise QCBonusPoolEmptyError(order_id)

    total_pool = Decimal(qty_lolos) * bonus_rate_per_pcs

    # Ambil semua MANDOR (termasuk Kepala Operasional yang juga berperan MANDOR)
    recipients_db = list(
        db.scalars(
            select(User)
            .where(User.role == UserRole.MANDOR, User.is_active.is_(True))
            .order_by(User.username)
        ).all()
    )

    if not recipients_db:
        raise NoBonusRecipientsError()

    bonus_per_recipient = (total_pool / Decimal(len(recipients_db))).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )

    recipients = [
        BonusRecipient(
            user_id=u.id,
            username=u.username,
            name=u.name,
            role=u.role.value,
            bonus_amount=bonus_per_recipient,
        )
        for u in recipients_db
    ]

    return QCBonusPoolResponse(
        order_id=order_id,
        qty_lolos=qty_lolos,
        bonus_rate_per_pcs=bonus_rate_per_pcs,
        total_pool=total_pool,
        recipient_count=len(recipients),
        bonus_per_recipient=bonus_per_recipient,
        recipients=recipients,
    )
