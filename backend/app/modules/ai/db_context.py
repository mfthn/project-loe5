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
from app.modules.sample.models import Sample, SampleStatus

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
        .filter(Order.status.notin_([OrderStatus.SELESAI, OrderStatus.DIBATALKAN]))
        .order_by(Order.order_date.desc())
        .limit(_TOP_N)
        .all()
    )
    active_lines = "\n".join(
        f"  [{o.id}] {o.client_name} | {o.product_name} | {o.quantity} pcs | {o.status} | deadline: {o.deadline}"
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
        .filter(ProductionOutput.output_date >= since)
        .order_by(ProductionOutput.output_date.desc())
        .limit(_TOP_N)
        .all()
    )
    if not rows:
        return "=== OUTPUT PRODUKSI ===\nTidak ada data output produksi dalam 30 hari terakhir."

    lines = "\n".join(
        f"  {r.output_date} | Order #{r.order_id} | {r.quantity_produced} pcs diproduksi | reject: {r.quantity_rejected}"
        for r in rows
    )
    total_produced = sum(r.quantity_produced for r in rows)
    total_rejected = sum(r.quantity_rejected for r in rows)
    return (
        f"=== OUTPUT PRODUKSI (30 hari terakhir — {len(rows)} record) ===\n"
        f"Total diproduksi: {total_produced} pcs | Total reject: {total_rejected} pcs\n"
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
        db.query(func.sum(PayrollDetail.net_pay))
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
    return (
        f"=== PAYROLL TERBARU ===\n"
        f"  Periode: {latest_run.period_start} s/d {latest_run.period_end}\n"
        f"  Status: {latest_run.status}\n"
        f"  Jumlah karyawan: {detail_count}\n"
        f"  Total net pay: Rp {total_net:,.0f}"
    )


def _inventory_summary(db: Session) -> str:
    """Item inventaris yang stoknya menipis (<= 20% dari stok minimum) atau habis."""
    items = db.query(InventoryItem).order_by(InventoryItem.stock_quantity.asc()).limit(10).all()
    if not items:
        return "=== INVENTARIS ===\nBelum ada data inventaris."

    low_stock = [i for i in items if i.stock_quantity <= i.minimum_stock]
    low_lines = "\n".join(
        f"  [{i.sku}] {i.name}: stok {i.stock_quantity} {i.unit} (min: {i.minimum_stock})"
        for i in low_stock
    ) or "  Semua stok dalam kondisi aman."

    return (
        f"=== INVENTARIS ===\n"
        f"Item dengan stok rendah / di bawah minimum ({len(low_stock)} item):\n{low_lines}"
    )


def _qc_summary(db: Session) -> str:
    """Ringkasan hasil QC 30 hari terakhir."""
    since = _recent_date()
    rows = (
        db.query(QCInspection.result, func.count(QCInspection.id).label("cnt"))
        .filter(QCInspection.inspected_at >= since)
        .group_by(QCInspection.result)
        .all()
    )
    if not rows:
        return "=== QC ===\nTidak ada data QC dalam 30 hari terakhir."

    lines = "\n".join(f"  - {r.result}: {r.cnt} inspeksi" for r in rows)
    total = sum(r.cnt for r in rows)
    passed = next((r.cnt for r in rows if r.result == QCStatus.PASSED), 0)
    pass_rate = (passed / total * 100) if total else 0
    return (
        f"=== QC (30 hari terakhir) ===\n"
        f"  Total inspeksi: {total} | Pass rate: {pass_rate:.1f}%\n"
        f"  Distribusi:\n{lines}"
    )


def _sample_summary(db: Session) -> str:
    """Status sample aktif."""
    rows = (
        db.query(Sample.status, func.count(Sample.id).label("cnt"))
        .group_by(Sample.status)
        .all()
    )
    if not rows:
        return "=== SAMPLE ===\nBelum ada data sample."

    lines = "\n".join(f"  - {r.status}: {r.cnt} sample" for r in rows)
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
