"""Pengambil konteks database live untuk Owner Tracker (/ask-agent).

Modul ini query tabel-tabel operasional (orders, production_outputs,
payroll_runs, inventory_items, qc_inspections, samples) lalu
memformat hasilnya sebagai blok teks yang dapat diinjeksikan
ke dalam prompt LLM.

Semua kueri dibuat **read-only** dan dibatasi secara eksplisit
agar tidak membebani database saat analisis realtime.
"""
from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func, text
from sqlalchemy.orm import Session

# ── Model imports ──────────────────────────────────────────────────────────────
from app.modules.gudang.models import InventoryItem, InventoryTransaction
from app.modules.payroll.models import BatchFinancial, PayrollDetail, PayrollRun
from app.modules.produksi.models import Order, OrderStatus, ProductionOutput
from app.modules.qc.models import QCInspection, QCStatus
from app.modules.sample.models import Sample, SampleStatus, SampleVersion

# Jumlah hari ke belakang untuk ringkasan "recent"
_RECENT_DAYS = 30
_TOP_N = 5  # batas row untuk tabel ringkasan


def _recent_date() -> date:
    return date.today() - timedelta(days=_RECENT_DAYS)


# ── Per-domain helpers ─────────────────────────────────────────────────────────


def _orders_summary(db: Session) -> str:
    """Ringkasan status pesanan & revenue."""
    rows = (
        db.query(Order.status, func.count(Order.id).label("cnt"))
        .group_by(Order.status)
        .all()
    )
    status_lines = "\n".join(f"  - {r.status}: {r.cnt} order" for r in rows)

    active_orders = (
        db.query(Order)
        .filter(Order.status.notin_([OrderStatus.COMPLETED]))
        .order_by(Order.created_at.desc())
        .limit(_TOP_N)
        .all()
    )
    active_lines = "\n".join(
        f"  [{o.order_number}] {o.target_quantity} pcs | {o.status} | deadline: {o.deadline}"
        for o in active_orders
    ) or "  (tidak ada order aktif)"

    return (
        "=== RINGKASAN PESANAN ===\n"
        f"Status distribusi:\n{status_lines}\n\n"
        f"Order aktif terbaru:\n{active_lines}"
    )


def _production_summary(db: Session) -> str:
    """Output produksi 30 hari terakhir."""
    since = _recent_date()
    rows = (
        db.query(ProductionOutput)
        .filter(ProductionOutput.time_window >= since)
        .order_by(ProductionOutput.time_window.desc())
        .limit(_TOP_N)
        .all()
    )
    if not rows:
        return "=== OUTPUT PRODUKSI ===\nTidak ada data output produksi dalam 30 hari terakhir."

    lines = "\n".join(
        f"  {r.time_window} | Order #{r.order_id} | {r.qty_completed} pcs "
        f"| line {r.line_number} | {'terverifikasi' if r.is_verified else 'belum verifikasi'}"
        for r in rows
    )
    total_completed = sum(r.qty_completed for r in rows)
    return (
        f"=== OUTPUT PRODUKSI (30 hari terakhir — {len(rows)} record) ===\n"
        f"Total diselesaikan: {total_completed} pcs\n"
        f"Detail:\n{lines}"
    )


def _payroll_summary(db: Session) -> str:
    """Ringkasan payroll run terbaru."""
    latest_run = (
        db.query(PayrollRun).order_by(PayrollRun.period_start.desc()).first()
    )
    if not latest_run:
        return "=== PAYROLL ===\nBelum ada data payroll."

    total_net = (
        db.query(func.sum(PayrollDetail.net_salary))
        .filter(PayrollDetail.payroll_run_id == latest_run.id)
        .scalar()
        or 0
    )
    detail_count = (
        db.query(func.count(PayrollDetail.id))
        .filter(PayrollDetail.payroll_run_id == latest_run.id)
        .scalar()
        or 0
    )
    lock_label = "TERKUNCI (audit lock)" if latest_run.is_locked else "terbuka"
    return (
        f"=== PAYROLL TERBARU ===\n"
        f"  Periode: {latest_run.period_start} s/d {latest_run.period_end}\n"
        f"  Status: {lock_label}\n"
        f"  Jumlah karyawan: {detail_count}\n"
        f"  Total net pay: Rp {total_net:,.0f}"
    )


def _inventory_summary(db: Session) -> str:
    """Item inventaris dengan stok terendah (10 terbawah)."""
    items = db.query(InventoryItem).order_by(InventoryItem.current_stock.asc()).limit(10).all()
    if not items:
        return "=== INVENTARIS ===\nBelum ada data inventaris."

    lines = "\n".join(
        f"  [{i.material_code}] {i.material_name}: stok {i.current_stock} {i.unit_measure}"
        for i in items
    )

    return (
        f"=== INVENTARIS (10 stok terendah) ===\n{lines}"
    )


def _qc_summary(db: Session) -> str:
    """Ringkasan hasil QC 30 hari terakhir."""
    since = _recent_date()
    rows = (
        db.query(QCInspection.status, func.count(QCInspection.id).label("cnt"))
        .filter(QCInspection.inspected_at >= since)
        .group_by(QCInspection.status)
        .all()
    )
    if not rows:
        return "=== QC ===\nTidak ada data QC dalam 30 hari terakhir."

    lines = "\n".join(f"  - {r.status}: {r.cnt} inspeksi" for r in rows)
    total = sum(r.cnt for r in rows)
    passed = next((r.cnt for r in rows if r.status == QCStatus.LOLOS), 0)
    pass_rate = (passed / total * 100) if total else 0
    return (
        f"=== QC (30 hari terakhir) ===\n"
        f"  Total inspeksi: {total} | Pass rate: {pass_rate:.1f}%\n"
        f"  Distribusi:\n{lines}"
    )


def _sample_summary(db: Session) -> str:
    """Status versi sample (DRAFT/REVISION/APPROVED)."""
    rows = (
        db.query(SampleVersion.status, func.count(SampleVersion.id).label("cnt"))
        .group_by(SampleVersion.status)
        .all()
    )
    if not rows:
        return "=== SAMPLE ===\nBelum ada data sample."

    lines = "\n".join(f"  - {r.status}: {r.cnt} versi sample" for r in rows)
    return f"=== STATUS SAMPLE ===\n{lines}"


# ── Public API ─────────────────────────────────────────────────────────────────


def build_db_context(db: Session) -> str:
    """Kumpulkan semua ringkasan operasional dan gabungkan menjadi satu blok teks konteks.

    Dipanggil oleh RagService.ask_agent() sebelum memanggil LLM,
    sehingga Owner Tracker bisa menjawab pertanyaan berbasis data live.
    Jika ada error pada satu domain, domain lain tetap dikumpulkan.
    """
    sections: list[str] = []
    collectors = [
        _orders_summary,
        _production_summary,
        _payroll_summary,
        _inventory_summary,
        _qc_summary,
        _sample_summary,
    ]
    for fn in collectors:
        try:
            sections.append(fn(db))
        except Exception as exc:  # noqa: BLE001
            sections.append(f"=== {fn.__name__.upper()} ===\n  [Error mengambil data: {exc}]")

    return "\n\n".join(sections)
