"""Logika bisnis Payroll Engine Sabtu & Penguncian Transaksi Audit (FR-10).

Alur Skenario 2 (P0) — Payroll Headcount Dinamis:
  1. FINANCE_PAYROLL/OWNER membuat PayrollRun untuk periode (Minggu–Sabtu).
  2. Sistem menghitung upah borongan dari production_outputs yang terverifikasi
     dalam periode tersebut, dijumlah per penjahit dan per komponen (rate card sewing).
  3. Uang makan = meal_allowance_percentage% × total_sewing_fee.
  4. Bonus QC = total pcs LOLOS dalam periode × qc_bonus_rate_per_pcs ÷ jumlah MANDOR.
  5. Net salary = total_sewing_fee + meal_allowance + qc_bonus_share.
  6. Setelah dikonfirmasi, payroll dapat dikunci (is_locked = True) — PERMANEN, tidak bisa
     dibuka kembali oleh siapa pun termasuk OWNER. Menjaga integritas audit trail.

FR-10.1: Penjahit baru bisa ditambah di tengah minggu tanpa batasan slot.
FR-10.2: Upah dihitung otomatis dari output 30 menit terverifikasi × rate sewing per komponen.
"""
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import select, func as sa_func
from sqlalchemy.orm import Session, selectinload

from app.modules.auth.models import User, UserRole
from app.modules.payroll.errors import (
    NoOutputsForPeriodError,
    PayrollDetailNotFoundError,
    PayrollPeriodOverlapError,
    PayrollRunLockedError,
    PayrollRunNotFoundError,
)
from app.modules.payroll.models import PayrollDetail, PayrollRun
from app.modules.payroll.schemas import (
    PayrollPreviewResponse,
    PayrollRunCreate,
    SlipPreview,
)
from app.modules.produksi.models import OrderComponent, OrderStatus, ProductionOutput, RateCard
from app.modules.qc.models import QCInspection, QCStatus


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _round2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _get_or_raise(db: Session, run_id: uuid.UUID) -> PayrollRun:
    run = db.scalar(
        select(PayrollRun)
        .options(selectinload(PayrollRun.details))
        .where(PayrollRun.id == run_id)
    )
    if run is None:
        raise PayrollRunNotFoundError(run_id)
    return run


def _check_period_overlap(db: Session, period_start: date, period_end: date, exclude_id: uuid.UUID | None = None) -> None:
    stmt = select(PayrollRun).where(
        PayrollRun.period_start <= period_end,
        PayrollRun.period_end >= period_start,
    )
    if exclude_id:
        stmt = stmt.where(PayrollRun.id != exclude_id)
    existing = db.scalar(stmt)
    if existing:
        raise PayrollPeriodOverlapError(period_start, period_end)


def _period_datetimes(period_start: date, period_end: date) -> tuple[datetime, datetime]:
    """Konversi date ke datetime UTC untuk filter query."""
    start_dt = datetime(period_start.year, period_start.month, period_start.day, 0, 0, 0, tzinfo=timezone.utc)
    end_dt = datetime(period_end.year, period_end.month, period_end.day, 23, 59, 59, tzinfo=timezone.utc)
    return start_dt, end_dt


# ---------------------------------------------------------------------------
# Kalkulasi Upah (core logic)
# ---------------------------------------------------------------------------

def _calculate_slips(
    db: Session,
    period_start: date,
    period_end: date,
    meal_pct: Decimal,
    qc_bonus_rate: Decimal,
) -> tuple[list[SlipPreview], Decimal]:
    """Menghitung slip upah semua penjahit dalam periode.

    Returns: (list of SlipPreview, total_qc_bonus_pool)

    FR-10.1: Semua PENJAHIT aktif yang punya output terverifikasi masuk otomatis.
    FR-10.2: Upah = qty_completed × sewing_rate_per_pcs per komponen.
    """
    start_dt, end_dt = _period_datetimes(period_start, period_end)

    # Ambil semua output terverifikasi dalam periode, join dengan rate card
    outputs = db.scalars(
        select(ProductionOutput)
        .where(
            ProductionOutput.is_verified.is_(True),
            ProductionOutput.time_window >= start_dt,
            ProductionOutput.time_window <= end_dt,
        )
    ).all()

    # Hitung total QC bonus pool dari pcs LOLOS dalam periode
    qty_lolos_raw = db.scalar(
        select(sa_func.coalesce(sa_func.sum(QCInspection.qty_inspected), 0))
        .join(ProductionOutput, ProductionOutput.order_id == QCInspection.order_id, isouter=True)
        .where(
            QCInspection.status == QCStatus.LOLOS,
            QCInspection.inspected_at >= start_dt,
            QCInspection.inspected_at <= end_dt,
        )
    )
    qty_lolos = int(qty_lolos_raw or 0)
    total_qc_pool = _round2(Decimal(qty_lolos) * qc_bonus_rate)

    # Hitung bonus per MANDOR
    mandors = list(db.scalars(
        select(User).where(User.role == UserRole.MANDOR, User.is_active.is_(True))
    ).all())
    bonus_per_mandor = _round2(total_qc_pool / Decimal(len(mandors))) if mandors else Decimal("0.00")

    # Agregasi upah sewing per operator
    sewing_by_operator: dict[uuid.UUID, Decimal] = {}
    qty_by_operator: dict[uuid.UUID, int] = {}

    for out in outputs:
        rate_card = db.scalar(
            select(RateCard).where(RateCard.order_component_id == out.order_component_id)
        )
        rate = rate_card.sewing_rate_per_pcs if rate_card else Decimal("0.00")
        fee = _round2(Decimal(out.qty_completed) * rate)
        sewing_by_operator[out.operator_user_id] = sewing_by_operator.get(out.operator_user_id, Decimal("0.00")) + fee
        qty_by_operator[out.operator_user_id] = qty_by_operator.get(out.operator_user_id, 0) + out.qty_completed

    if not sewing_by_operator:
        raise NoOutputsForPeriodError(period_start, period_end)

    # Buat SlipPreview untuk setiap penjahit + mandor (bonus)
    all_user_ids = set(sewing_by_operator.keys()) | {m.id for m in mandors}
    users_map = {
        u.id: u for u in db.scalars(
            select(User).where(User.id.in_(list(all_user_ids)))
        ).all()
    }

    slips: list[SlipPreview] = []
    for uid in all_user_ids:
        user = users_map.get(uid)
        if user is None:
            continue
        sewing_fee = sewing_by_operator.get(uid, Decimal("0.00"))
        meal = _round2(sewing_fee * (meal_pct / Decimal("100")))
        qc_bonus = bonus_per_mandor if user.role == UserRole.MANDOR else Decimal("0.00")
        net = _round2(sewing_fee + meal + qc_bonus)

        slips.append(SlipPreview(
            user_id=uid,
            username=user.username,
            name=user.name,
            role=user.role.value,
            total_qty_completed=qty_by_operator.get(uid, 0),
            total_sewing_fee=sewing_fee,
            meal_allowance_amount=meal,
            qc_bonus_share=qc_bonus,
            net_salary=net,
        ))

    slips.sort(key=lambda s: s.username)
    return slips, total_qc_pool


# ---------------------------------------------------------------------------
# PayrollRun CRUD
# ---------------------------------------------------------------------------

def list_payroll_runs(db: Session) -> list[PayrollRun]:
    return list(db.scalars(select(PayrollRun).order_by(PayrollRun.period_end.desc())).all())


def get_payroll_run(db: Session, run_id: uuid.UUID) -> PayrollRun:
    return _get_or_raise(db, run_id)


def preview_payroll(
    db: Session,
    payload: PayrollRunCreate,
) -> PayrollPreviewResponse:
    """Menghitung kalkulasi payroll tanpa menyimpan — untuk review sebelum konfirmasi."""
    slips, total_qc_pool = _calculate_slips(
        db,
        payload.period_start,
        payload.period_end,
        payload.meal_allowance_percentage,
        payload.qc_bonus_rate_per_pcs,
    )
    return PayrollPreviewResponse(
        period_start=payload.period_start,
        period_end=payload.period_end,
        meal_allowance_percentage=payload.meal_allowance_percentage,
        qc_bonus_rate_per_pcs=payload.qc_bonus_rate_per_pcs,
        total_qc_bonus_pool=total_qc_pool,
        total_penjahit=len([s for s in slips if s.role == "PENJAHIT"]),
        slips=slips,
    )


def create_payroll_run(db: Session, payload: PayrollRunCreate) -> PayrollRun:
    """Membuat PayrollRun dan menyimpan PayrollDetail per penjahit ke database.

    FR-10.1: Headcount dinamis — semua penjahit aktif dengan output terverifikasi
    dalam periode otomatis masuk tanpa perlu konfigurasi slot.
    FR-10.2: Upah borongan dihitung dari output terverifikasi × rate sewing per komponen.
    """
    _check_period_overlap(db, payload.period_start, payload.period_end)

    slips, total_qc_pool = _calculate_slips(
        db,
        payload.period_start,
        payload.period_end,
        payload.meal_allowance_percentage,
        payload.qc_bonus_rate_per_pcs,
    )

    run = PayrollRun(
        period_start=payload.period_start,
        period_end=payload.period_end,
        meal_allowance_percentage=payload.meal_allowance_percentage,
        qc_bonus_rate_per_pcs=payload.qc_bonus_rate_per_pcs,
        total_qc_bonus_pool=total_qc_pool,
        is_locked=False,
    )
    db.add(run)
    db.flush()

    for slip in slips:
        detail = PayrollDetail(
            payroll_run_id=run.id,
            user_id=slip.user_id,
            total_sewing_fee=slip.total_sewing_fee,
            meal_allowance_amount=slip.meal_allowance_amount,
            qc_bonus_share=slip.qc_bonus_share,
            net_salary=slip.net_salary,
        )
        db.add(detail)

    db.commit()
    db.refresh(run)
    return run


def lock_payroll_run(db: Session, run_id: uuid.UUID) -> PayrollRun:
    """FR-10 Audit Lock: Mengunci payroll run secara permanen.

    Setelah dikunci, tidak ada perubahan yang dapat dilakukan oleh siapa pun,
    termasuk OWNER. Ini memastikan integritas data untuk keperluan audit keuangan.
    """
    run = _get_or_raise(db, run_id)
    if run.is_locked:
        raise PayrollRunLockedError(run_id)

    run.is_locked = True
    db.commit()
    db.refresh(run)
    return run
