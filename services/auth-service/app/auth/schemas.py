"""Skema Pydantic untuk autentikasi dan profil pengguna."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.auth.client_code import CLIENT_CODE_MAX_LENGTH, normalize_phone
from app.auth.models import UserRole


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, description="Username pengguna")
    password: str = Field(..., min_length=4, description="Password pengguna")


class _PhoneNumberMixin(BaseModel):
    """Validasi & normalisasi nomor HP agar ID Klien selalu konsisten."""

    @field_validator("phone_number", check_fields=False)
    @classmethod
    def _normalize_phone_number(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return normalize_phone(value)


class RegisterClientRequest(_PhoneNumberMixin):
    """Registrasi mandiri untuk klien maklon baru. Membuat Client + User KLIEN_MAKLON sekaligus."""
    # Data Akun
    username: str = Field(..., min_length=3, max_length=50, description="Username untuk login")
    password: str = Field(..., min_length=6, description="Password (min 6 karakter)")
    email: EmailStr = Field(..., description="Email klien")
    # Data Perusahaan Klien
    company_name: str = Field(..., min_length=2, max_length=255, description="Nama perusahaan / brand")
    contact_person: str = Field(..., min_length=2, max_length=255, description="Nama PIC/kontak klien")
    phone_number: str = Field(
        ...,
        min_length=8,
        max_length=30,
        description="Nomor WhatsApp/telepon aktif (ID Klien mengikuti nomor ini)",
    )


class ClientUpdateRequest(_PhoneNumberMixin):
    """Perubahan data klien oleh Owner. Nomor HP ikut mengubah ID Klien."""

    company_name: str | None = Field(None, min_length=2, max_length=255)
    contact_person: str | None = Field(None, min_length=2, max_length=255)
    phone_number: str | None = Field(None, min_length=8, max_length=30)


class ClientProfileResponse(BaseModel):
    id: uuid.UUID
    company_name: str
    contact_person: str | None = None
    phone_number: str | None = None
    client_code: str = Field(
        ...,
        max_length=CLIENT_CODE_MAX_LENGTH,
        description="Format LOE5-<nomor HP>, contoh LOE5-08123456789",
    )
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class ClientUpdateResponse(ClientProfileResponse):
    """Hasil perubahan data klien beserta peringatan dampak perubahan ID."""

    previous_client_code: str | None = None
    client_code_changed: bool = False
    warning: str | None = None


class ClientCodeChangeResponse(BaseModel):
    """Satu baris audit perubahan ID Klien."""

    id: uuid.UUID
    client_id: uuid.UUID
    old_client_code: str
    new_client_code: str
    old_phone: str | None = None
    new_phone: str | None = None
    changed_by: uuid.UUID | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RegisterClientResponse(BaseModel):
    """Response setelah registrasi klien berhasil."""
    message: str
    client_id: uuid.UUID
    client_code: str = Field(
        ...,
        max_length=CLIENT_CODE_MAX_LENGTH,
        description="Format LOE5-<nomor HP>, contoh LOE5-08123456789",
    )
    user: "UserResponse"

    model_config = ConfigDict(from_attributes=True)


class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    email: str | None = None
    name: str
    role: UserRole
    client_id: uuid.UUID | None = None
    client_code: str | None = None
    client: ClientProfileResponse | None = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


class UserCreateAdmin(BaseModel):
    """Owner membuat akun pekerja: username + password + peran + otorisasi modul."""

    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)
    name: str = Field(..., min_length=2, max_length=255)
    email: str | None = Field(None, max_length=255)
    role: UserRole
    client_id: uuid.UUID | None = Field(
        None, description="Wajib jika role KLIEN_MAKLON"
    )


class UserUpdateAdmin(BaseModel):
    """Owner mengedit akun: nama, peran, klien, status aktif."""

    name: str | None = Field(None, min_length=2, max_length=255)
    email: str | None = Field(None, max_length=255)
    role: UserRole | None = None
    client_id: uuid.UUID | None = None
    is_active: bool | None = None


RegisterClientResponse.model_rebuild()
