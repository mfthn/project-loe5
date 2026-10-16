"""Model ORM untuk modul Finance: Purchase Order bahan & Invoice klien (FR-11)."""
import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class POStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    TERKONFIRMASI = "TERKONFIRMASI"
    DISETUJUI = "DISETUJUI"
    DITOLAK = "DITOLAK"
    DITERIMA_SEBAGIAN = "DITERIMA_SEBAGIAN"
    SELESAI = "SELESAI"


class InvoiceStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    BELUM_BAYAR = "BELUM_BAYAR"
    SEBAGIAN = "SEBAGIAN"
    LUNAS = "LUNAS"
    DITOLAK = "DITOLAK"


class PurchaseOrder(Base):
    """PO bahan yang diajukan Tim Sample setelah kesepakatan produk dengan klien."""
    __tablename__ = "purchase_orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    po_number: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    supplier_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[POStatus] = mapped_column(
        Enum(POStatus, name="po_status_enum"), default=POStatus.DRAFT,
        nullable=False, index=True,
    )
    requested_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    reviewed_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    reviewed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    lines: Mapped[list["POLine"]] = relationship(
        "POLine", back_populates="po", cascade="all, delete-orphan",
        order_by="POLine.sequence_order",
    )

    @property
    def total_amount(self) -> Decimal:
        total = Decimal("0")
        for line in self.lines or []:
            total += Decimal(str(line.qty_ordered)) * Decimal(str(line.unit_price))
        return total


class POLine(Base):
    """Rincian bahan per PO: item gudang + qty dipesan + harga satuan + qty diterima."""
    __tablename__ = "po_lines"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    po_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    inventory_item_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("inventory_items.id", ondelete="RESTRICT"),
        nullable=False, index=True,
    )
    sequence_order: Mapped[int] = mapped_column(nullable=False, default=1)
    qty_ordered: Mapped[float] = mapped_column(Float, nullable=False)
    qty_received: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)

    po: Mapped[PurchaseOrder] = relationship("PurchaseOrder", back_populates="lines")


class Invoice(Base):
    """Tagihan harga keseluruhan ke klien maklon, hanya untuk order SELESAI."""
    __tablename__ = "invoices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_number: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False, unique=True, index=True,
    )
    amount_total: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    amount_paid: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), default=Decimal("0.00"), nullable=False
    )
    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus, name="invoice_status_enum"), default=InvoiceStatus.DRAFT,
        nullable=False, index=True,
    )
    issued_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    approved_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    payments: Mapped[list["InvoicePayment"]] = relationship(
        "InvoicePayment", back_populates="invoice", cascade="all, delete-orphan",
        order_by="InvoicePayment.paid_at",
    )


class InvoicePayment(Base):
    """Catatan pembayaran klien per invoice (mendukung bayar bertahap)."""
    __tablename__ = "invoice_payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    recorded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    paid_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    invoice: Mapped[Invoice] = relationship("Invoice", back_populates="payments")


class POPayment(Base):
    """Pembayaran ke supplier per PO (dilunasi bertahap oleh Finance)."""
    __tablename__ = "po_payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    po_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("purchase_orders.id", ondelete="CASCADE"),
        nullable=False, index=True,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    recorded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    paid_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
