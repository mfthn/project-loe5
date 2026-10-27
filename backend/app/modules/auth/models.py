"""Model ORM untuk autentikasi, pengguna, peran (RBAC), dan data klien maklon."""
import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.modules.auth.client_code import CLIENT_CODE_MAX_LENGTH, fallback_client_code


class UserRole(str, enum.Enum):
    """8 Peran Pengguna sesuai Matriks RBAC di SRS v2.0."""
    OWNER = "OWNER"
    TIM_SAMPLE = "TIM_SAMPLE"
    GUDANG = "GUDANG"
    MANDOR = "MANDOR"
    PENJAHIT = "PENJAHIT"
    QC_INSPECTOR = "QC_INSPECTOR"
    FINANCE_PAYROLL = "FINANCE_PAYROLL"
    KLIEN_MAKLON = "KLIEN_MAKLON"


class Client(Base):
    """Perusahaan klien maklon B2B atau brand internal (misal Snøhund)."""
    __tablename__ = "clients"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_person: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Nomor HP disimpan ternormalisasi (08xxxx) dan unik untuk mencegah ID ganda.
    phone_number: Mapped[str | None] = mapped_column(
        String(50), nullable=True, unique=True, index=True
    )
    # ID Klien resmi: LOE5-<nomor HP>, contoh LOE5-08123456789.
    client_code: Mapped[str] = mapped_column(
        String(CLIENT_CODE_MAX_LENGTH), nullable=False, unique=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relasi
    users: Mapped[list["User"]] = relationship("User", back_populates="client")


class User(Base):
    """Pengguna sistem dengan salah satu dari 8 peran operasional."""
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    username: Mapped[str] = mapped_column(
        String(100), unique=True, index=True, nullable=False
    )
    email: Mapped[str | None] = mapped_column(
        String(255), unique=True, index=True, nullable=True
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role_enum"), nullable=False, index=True
    )
    # client_id hanya diisi jika peran adalah KLIEN_MAKLON untuk isolasi multi-tenant
    client_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relasi
    client: Mapped[Client | None] = relationship("Client", back_populates="users")

    @property
    def client_code(self) -> str | None:
        """ID Klien resmi jika user terikat ke entitas klien."""
        if not self.client_id:
            return None
        if self.client is not None:
            return self.client.client_code
        return fallback_client_code(self.client_id)


class ClientCodeChange(Base):
    """Audit log perubahan nomor HP yang berdampak pada ID Klien."""

    __tablename__ = "client_code_changes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("clients.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    old_client_code: Mapped[str] = mapped_column(
        String(CLIENT_CODE_MAX_LENGTH), nullable=False
    )
    new_client_code: Mapped[str] = mapped_column(
        String(CLIENT_CODE_MAX_LENGTH), nullable=False
    )
    old_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    new_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    changed_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
