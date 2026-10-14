"""Model ORM untuk modul Payroll Engine & Penguncian Transaksi (FR-10)."""
import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class PayrollRun(Base):
    """Siklus penggajian mingguan (Sabtu) dengan persentase uang makan dan pool bonus QC 3-arah."""
    __tablename__ = "payroll_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    meal_allowance_percentage: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("12.00"), nullable=False
    )
    qc_bonus_rate_per_pcs: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), default=Decimal("500.00"), nullable=False
    )
    total_qc_bonus_pool: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    # is_locked = True: data terkunci permanen, tidak dapat diubah oleh peran apa pun (termasuk Owner)
    is_locked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relasi
    details: Mapped[list["PayrollDetail"]] = relationship(
        "PayrollDetail", back_populates="payroll_run", cascade="all, delete-orphan"
    )


class PayrollDetail(Base):
    """Rincian slip upah per penjahit/mandor/ka. ops untuk periode penggajian."""
    __tablename__ = "payroll_details"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    payroll_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("payroll_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    total_sewing_fee: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    meal_allowance_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    qc_bonus_share: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    net_salary: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )

    # Relasi
    payroll_run: Mapped[PayrollRun] = relationship("PayrollRun", back_populates="details")


class BatchFinancial(Base):
    """Ringkasan finansial laba/rugi batch produksi (HPP, Biaya Material, Overhead, Upah, Net Profit).

    Sesuai Activity Diagram Alur Final:
    - Hitung Material Cost & Overhead
    - Hitung Total HPP Batch
    - Hitung Net Profit Owner
    - Akses Dashboard Laba/Rugi (Net Profit Batch) bagi Owner
    """
    __tablename__ = "batch_financials"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    contract_revenue: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    material_cost: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    overhead_cost: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    labor_cost: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    total_hpp: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    net_profit: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(50), default="DRAFT", nullable=False
    )  # DRAFT | LOCKED
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
