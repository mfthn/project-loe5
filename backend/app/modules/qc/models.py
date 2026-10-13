"""Model ORM untuk modul Quality Control & Manajemen Defect (FR-8, FR-9)."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class QCStatus(str, enum.Enum):
    """Status hasil inspeksi QC."""
    MENUNGGU_QC = "MENUNGGU_QC"
    LOLOS = "LOLOS"
    REPAIR = "REPAIR"
    DEFECT = "DEFECT"


class QCInspection(Base):
    """Catatan inspeksi QC produk jadi. Produk lolos mengakumulasi pool bonus QC."""
    __tablename__ = "qc_inspections"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    order_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    production_output_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("production_outputs.id", ondelete="SET NULL"),
        nullable=True,
    )
    inspector_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    status: Mapped[QCStatus] = mapped_column(
        Enum(QCStatus, name="qc_status_enum"),
        nullable=False,
        index=True,
    )
    defect_category: Mapped[str | None] = mapped_column(String(255), nullable=True)
    qty_inspected: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    inspected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
