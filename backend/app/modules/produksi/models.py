"""Model ORM untuk modul Produksi, Order Massal, Rate Card, dan Terminal 30 Menit (FR-7)."""
import enum
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, Numeric, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class MaklonScheme(str, enum.Enum):
    """3 Skema Kerja Sama Maklon Garment."""
    CMT = "CMT"
    SEMI_CMT = "SEMI_CMT"
    FULL_PACKAGE = "FULL_PACKAGE"


class OrderStatus(str, enum.Enum):
    """Status tahapan progres pesanan produksi."""
    SAMPLE = "SAMPLE"
    CUTTING = "CUTTING"
    SEWING = "SEWING"
    MENUNGGU_QC = "MENUNGGU_QC"
    QC = "QC"
    COMPLETED = "COMPLETED"


class Order(Base):
    """Order Produksi Massal yang dihasilkan dari persetujuan sample atau PO resmi."""
    __tablename__ = "orders"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sample_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sample_versions.id", ondelete="SET NULL"),
        nullable=True,
    )
    order_number: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False
    )
    scheme: Mapped[MaklonScheme] = mapped_column(
        Enum(MaklonScheme, name="maklon_scheme_enum"), nullable=False
    )
    target_quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus, name="order_status_enum"),
        default=OrderStatus.SAMPLE,
        nullable=False,
        index=True,
    )
    start_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relasi
    components: Mapped[list["OrderComponent"]] = relationship(
        "OrderComponent", back_populates="order", cascade="all, delete-orphan", order_by="OrderComponent.sequence_order"
    )
    production_outputs: Mapped[list["ProductionOutput"]] = relationship(
        "ProductionOutput", back_populates="order", cascade="all, delete-orphan"
    )


class OrderComponent(Base):
    """Rincian bagian komponen yang harus dijahit untuk order ini."""
    __tablename__ = "order_components"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    component_name: Mapped[str] = mapped_column(String(255), nullable=False)
    sequence_order: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    # Relasi
    order: Mapped[Order] = relationship("Order", back_populates="components")
    rate_card: Mapped["RateCard | None"] = relationship(
        "RateCard", back_populates="component", uselist=False, cascade="all, delete-orphan"
    )


class RateCard(Base):
    """Tarif upah borongan potong (cutting) dan jahit (sewing) per komponen artikel."""
    __tablename__ = "rate_cards"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_component_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("order_components.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    cutting_rate_per_pcs: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0.00"), nullable=False
    )
    sewing_rate_per_pcs: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), default=Decimal("0.00"), nullable=False
    )
    effective_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relasi
    component: Mapped[OrderComponent] = relationship("OrderComponent", back_populates="rate_card")


class ProductionOutput(Base):
    """Log output penyelesaian komponen per interval 30 menit dari terminal tablet lantai pabrik."""
    __tablename__ = "production_outputs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    order_component_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("order_components.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    operator_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    verified_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    line_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    qty_completed: Mapped[int] = mapped_column(Integer, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    time_window: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relasi
    order: Mapped[Order] = relationship("Order", back_populates="production_outputs")
    component: Mapped[OrderComponent] = relationship("OrderComponent")
