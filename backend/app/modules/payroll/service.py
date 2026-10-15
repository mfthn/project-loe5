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
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo

from sqlalchemy import select, func as sa_func
from sqlalchemy.orm import Session, selectinload

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
from app.modules.payroll.models import (
    BatchFinancial,
    PayrollDetail,
    PayrollNotification,
    PayrollPayment,
    PayrollRun,
)
from app.modules.payroll.schemas import (
    BatchFinancialCreate,
    PayrollMonthlySummaryResponse,
    PayrollPreviewResponse,
    PayrollRunCreate,
    SlipPreview,
)
from app.modules.produksi.models import (
    Order,
    OrderComponent,
    OrderStatus,
    ProductionOutput,
    RateCard,
)
from app.modules.qc.models import QCInspection, QCStatus

_JAKARTA_TZ = ZoneInfo("Asia/Jakarta")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _round2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _get_or_raise(
    db: Session, run_id: uuid.UUID, *, for_update: bool = False
) -> PayrollRun:
    stmt = (
        select(PayrollRun)
        .options(
            selectinload(PayrollRun.details).selectinload(PayrollDetail.user),
            selectinload(PayrollRun.details).selectinload(PayrollDetail.payment),
        )
        .where(PayrollRun.id == run_id)
    )
    if for_update:
        stmt = stmt.with_for_update()
    run = db.scalar(stmt)
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
    """Konversi tanggal periode lokal Jakarta ke batas timestamp inklusif."""
    start_dt = datetime.combine(period_start, time.min, tzinfo=_JAKARTA_TZ)
    end_dt = datetime.combine(period_end, time.max, tzinfo=_JAKARTA_TZ)
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


def mark_payroll_detail_paid(
    db: Session,
    run_id: uuid.UUID,
    detail_id: uuid.UUID,
    paid_by_user_id: uuid.UUID,
) -> PayrollPayment:
    """Catat pembayaran aktual untuk satu slip setelah payroll dikunci."""
    detail = db.scalar(
        select(PayrollDetail)
        .where(
            PayrollDetail.id == detail_id,
            PayrollDetail.payroll_run_id == run_id,
        )
        .with_for_update()
    )
    if detail is None:
        raise PayrollDetailNotFoundError(detail_id)
    if not detail.payroll_run.is_locked:
        raise PayrollRunNotLockedError(run_id)
    if detail.payment is not None:
        raise PayrollPaymentAlreadyRecordedError(detail_id)

    payment = PayrollPayment(
        payroll_detail_id=detail.id,
        paid_by_user_id=paid_by_user_id,
        paid_at=datetime.now(timezone.utc),
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return payment


def list_worker_payroll_summaries(db: Session, user_id: uuid.UUID) -> list[dict]:
    """Ambil payroll terkunci dan catatan output milik Penjahit yang sedang login."""
    runs = db.scalars(
        select(PayrollRun)
        .join(PayrollDetail, PayrollDetail.payroll_run_id == PayrollRun.id)
        .options(
            selectinload(PayrollRun.details).selectinload(PayrollDetail.payment)
        )
        .where(
            PayrollRun.is_locked.is_(True),
            PayrollDetail.user_id == user_id,
        )
        .order_by(PayrollRun.period_end.desc())
    ).unique().all()

    summaries: list[dict] = []
    for run in runs:
        detail = next(d for d in run.details if d.user_id == user_id)
        start_dt, end_dt = _period_datetimes(run.period_start, run.period_end)
        notes = db.execute(
            select(ProductionOutput, Order.order_number, OrderComponent.component_name)
            .join(Order, Order.id == ProductionOutput.order_id)
            .join(OrderComponent, OrderComponent.id == ProductionOutput.order_component_id)
            .where(
                ProductionOutput.operator_user_id == user_id,
                ProductionOutput.time_window >= start_dt,
                ProductionOutput.time_window <= end_dt,
            )
            .order_by(ProductionOutput.time_window.desc())
        ).all()
        scheduled_payment_date = run.period_end + timedelta(
            days=(5 - run.period_end.weekday()) % 7
        )
        summaries.append(
            {
                "run_id": run.id,
                "period_start": run.period_start,
                "period_end": run.period_end,
                "net_salary": detail.net_salary,
                "payment_status": "PAID" if detail.payment else "SCHEDULED",
                "scheduled_payment_date": scheduled_payment_date,
                "paid_at": detail.payment.paid_at if detail.payment else None,
                "production_notes": [
                    {
                        "id": output.id,
                        "order_id": output.order_id,
                        "order_number": order_number,
                        "component_name": component_name,
                        "line_number": output.line_number,
                        "qty_completed": output.qty_completed,
                        "is_verified": output.is_verified,
                        "time_window": output.time_window,
                    }
                    for output, order_number, component_name in notes
                ],
            }
        )
    return summaries


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


def review_payroll_funding(
    db: Session,
    run_id: uuid.UUID,
    available_funds: Decimal,
    reviewed_by_user_id: uuid.UUID,
    review_note: str | None = None,
) -> PayrollRun:
    """Finance locks payroll only after confirming sufficient funds."""
    run = _get_or_raise(db, run_id, for_update=True)
    if run.is_locked:
        raise PayrollRunLockedError(run_id)

    payroll_total = sum(
        (detail.net_salary for detail in run.details), start=Decimal("0.00")
    )
    run.available_funds = _round2(available_funds)
    run.reviewed_by_user_id = reviewed_by_user_id
    run.reviewed_at = datetime.now(timezone.utc)
    run.review_note = review_note

    if run.available_funds >= payroll_total:
        run.funding_status = "SUFFICIENT"
        run.is_locked = True
    else:
        run.funding_status = "INSUFFICIENT"
        message = (
            f"Dana payroll periode {run.period_start} s/d {run.period_end} belum mencukupi. "
            f"Kekurangan Rp {_round2(payroll_total - run.available_funds):,.2f}. "
            "Mohon Mandor meninjau progres dan berkoordinasi dengan Finance."
        )
        mandor_ids = db.scalars(
            select(User.id).where(User.role == UserRole.MANDOR, User.is_active.is_(True))
        ).all()
        for recipient_user_id in mandor_ids:
            db.add(
                PayrollNotification(
                    payroll_run_id=run.id,
                    recipient_user_id=recipient_user_id,
                    message=message,
                )
            )

    db.commit()
    return _get_or_raise(db, run_id)


def list_payroll_notifications(
    db: Session, recipient_user_id: uuid.UUID
) -> list[PayrollNotification]:
    return list(
        db.scalars(
            select(PayrollNotification)
            .where(PayrollNotification.recipient_user_id == recipient_user_id)
            .order_by(PayrollNotification.created_at.desc())
        ).all()
    )


def get_monthly_summary(
    db: Session, year: int, month: int
) -> PayrollMonthlySummaryResponse:
    month_start = datetime(year, month, 1, tzinfo=_JAKARTA_TZ)
    next_month = date(year + (month == 12), (month % 12) + 1, 1)
    month_end = datetime.combine(next_month, time.min, tzinfo=_JAKARTA_TZ)

    orders_created = db.scalar(
        select(sa_func.count(Order.id)).where(
            Order.created_at >= month_start, Order.created_at < month_end
        )
    ) or 0
    active_orders = db.scalar(
        select(sa_func.count(Order.id)).where(Order.status != OrderStatus.COMPLETED)
    ) or 0
    output_row = db.execute(
        select(
            sa_func.count(ProductionOutput.id),
            sa_func.coalesce(sa_func.sum(ProductionOutput.qty_completed), 0),
        ).where(
            ProductionOutput.is_verified.is_(True),
            ProductionOutput.time_window >= month_start,
            ProductionOutput.time_window < month_end,
        )
    ).one()
    qc_totals = {
        status: int(qty or 0)
        for status, qty in db.execute(
            select(
                QCInspection.status,
                sa_func.coalesce(sa_func.sum(QCInspection.qty_inspected), 0),
            )
            .where(
                QCInspection.inspected_at >= month_start,
                QCInspection.inspected_at < month_end,
            )
            .group_by(QCInspection.status)
        ).all()
    }
    financial_totals = db.execute(
        select(
            sa_func.coalesce(sa_func.sum(BatchFinancial.contract_revenue), 0),
            sa_func.coalesce(sa_func.sum(BatchFinancial.material_cost), 0),
            sa_func.coalesce(sa_func.sum(BatchFinancial.overhead_cost), 0),
            sa_func.coalesce(sa_func.sum(BatchFinancial.total_hpp), 0),
            sa_func.coalesce(sa_func.sum(BatchFinancial.net_profit), 0),
        ).where(
            BatchFinancial.updated_at >= month_start,
            BatchFinancial.updated_at < month_end,
        )
    ).one()
    runs = db.scalars(
        select(PayrollRun)
        .options(
            selectinload(PayrollRun.details).selectinload(PayrollDetail.payment)
        )
        .where(
            PayrollRun.is_locked.is_(True),
            PayrollRun.period_end >= month_start.date(),
            PayrollRun.period_end < month_end.date(),
        )
    ).all()
    payroll_total = sum(
        (detail.net_salary for run in runs for detail in run.details),
        start=Decimal("0.00"),
    )
    payroll_paid_total = sum(
        (
            detail.net_salary
            for run in runs
            for detail in run.details
            if detail.payment is not None
        ),
        start=Decimal("0.00"),
    )

    verified_pcs = int(output_row[1] or 0)
    overhead_total = _round2(Decimal(financial_totals[2]))
    overhead_per_unit = (
        _round2(overhead_total / Decimal(verified_pcs)) if verified_pcs > 0 else Decimal("0.00")
    )

    return PayrollMonthlySummaryResponse(
        year=year,
        month=month,
        orders_created=int(orders_created),
        active_orders_now=int(active_orders),
        verified_output_entries=int(output_row[0] or 0),
        verified_output_pcs=verified_pcs,
        qc_pass_pcs=qc_totals.get(QCStatus.LOLOS, 0),
        qc_repair_pcs=qc_totals.get(QCStatus.REPAIR, 0),
        qc_defect_pcs=qc_totals.get(QCStatus.DEFECT, 0),
        payroll_total=_round2(payroll_total),
        payroll_paid_total=_round2(payroll_paid_total),
        contract_revenue=_round2(Decimal(financial_totals[0])),
        material_cost=_round2(Decimal(financial_totals[1])),
        overhead_cost=_round2(Decimal(financial_totals[2])),
        total_hpp=_round2(Decimal(financial_totals[3])),
        net_profit=_round2(Decimal(financial_totals[4])),
        overhead_per_unit=overhead_per_unit,
    )


# ---------------------------------------------------------------------------
# Batch Financials (HPP & Laba Rugi Batch - Activity Diagram)
# ---------------------------------------------------------------------------

def calculate_and_save_batch_financial(
    db: Session,
    payload: BatchFinancialCreate,
) -> BatchFinancial:
    """Hitung Material Cost, Overhead, Labor Cost, Total HPP, dan Net Profit Owner sesuai Activity Diagram."""
    # Ambil total labor cost dari output terverifikasi order ini
    outputs = db.scalars(
        select(ProductionOutput)
        .where(
            ProductionOutput.order_id == payload.order_id,
            ProductionOutput.is_verified.is_(True),
        )
    ).all()

    total_labor = Decimal("0.00")
    for out in outputs:
        rate_card = db.scalar(
            select(RateCard).where(RateCard.order_component_id == out.order_component_id)
        )
        rate = rate_card.sewing_rate_per_pcs if rate_card else Decimal("0.00")
        total_labor += _round2(Decimal(out.qty_completed) * rate)

    total_hpp = _round2(payload.material_cost + payload.overhead_cost + total_labor)
    net_profit = _round2(payload.contract_revenue - total_hpp)

    existing = db.scalar(
        select(BatchFinancial).where(BatchFinancial.order_id == payload.order_id)
    )
    if existing:
        existing.contract_revenue = payload.contract_revenue
        existing.material_cost = payload.material_cost
        existing.overhead_cost = payload.overhead_cost
        existing.labor_cost = total_labor
        existing.total_hpp = total_hpp
        existing.net_profit = net_profit
        fin = existing
    else:
        fin = BatchFinancial(
            order_id=payload.order_id,
            contract_revenue=payload.contract_revenue,
            material_cost=payload.material_cost,
            overhead_cost=payload.overhead_cost,
            labor_cost=total_labor,
            total_hpp=total_hpp,
            net_profit=net_profit,
            status="DRAFT",
        )
        db.add(fin)

    db.commit()
    db.refresh(fin)
    return fin


def list_batch_financials(db: Session) -> list[BatchFinancial]:
    return list(db.scalars(select(BatchFinancial).order_by(BatchFinancial.created_at.desc())).all())


def get_batch_financial(db: Session, order_id: uuid.UUID) -> BatchFinancial:
    fin = db.scalar(select(BatchFinancial).where(BatchFinancial.order_id == order_id))
    if not fin:
        raise ValueError(f"Finansial batch untuk order {order_id} belum dihitung.")
    return fin
