"""Model ORM untuk modul Sample dan Time Study (FR-1 s.d. FR-4)."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SampleStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    REVISION = "REVISION"
    APPROVED = "APPROVED"


class Sample(Base):
    """Spesifikasi artikel sample yang diajukan atau dirancang bersama klien."""
    __tablename__ = "samples"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sample_code: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False
    )
    article_name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relasi
    versions: Mapped[list["SampleVersion"]] = relationship(
        "SampleVersion", back_populates="sample", cascade="all, delete-orphan", order_by="SampleVersion.version_number"
    )


class SampleVersion(Base):
    """Histori revisi versi sample (v1, v2, dst.) untuk menelusuri perubahan spesifikasi."""
    __tablename__ = "sample_versions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sample_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("samples.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    status: Mapped[SampleStatus] = mapped_column(
        Enum(SampleStatus, name="sample_status_enum"),
        default=SampleStatus.DRAFT,
        nullable=False,
    )
    tech_pack_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relasi
    sample: Mapped[Sample] = relationship("Sample", back_populates="versions")
    components: Mapped[list["SampleComponent"]] = relationship(
        "SampleComponent", back_populates="version", cascade="all, delete-orphan"
    )


class SampleComponent(Base):
    """Komponen garmen (kerah, lengan, badan) beserta hasil stopwatch time study dan estimasi bahan."""
    __tablename__ = "sample_components"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    sample_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("sample_versions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    component_name: Mapped[str] = mapped_column(String(255), nullable=False)
    material_usage_est: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    time_study_seconds: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Relasi
    version: Mapped[SampleVersion] = relationship("SampleVersion", back_populates="components")
