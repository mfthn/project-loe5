"""Skema Pydantic untuk autentikasi dan profil pengguna."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.modules.auth.models import UserRole


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, description="Username pengguna")
    password: str = Field(..., min_length=4, description="Password pengguna")


class RegisterClientRequest(BaseModel):
    """Registrasi mandiri untuk klien maklon baru. Membuat Client + User KLIEN_MAKLON sekaligus."""
    # Data Akun
    username: str = Field(..., min_length=3, max_length=50, description="Username untuk login")
    password: str = Field(..., min_length=6, description="Password (min 6 karakter)")
    email: EmailStr = Field(..., description="Email klien")
    # Data Perusahaan Klien
    company_name: str = Field(..., min_length=2, max_length=255, description="Nama perusahaan / brand")
    contact_person: str = Field(..., min_length=2, max_length=255, description="Nama PIC/kontak klien")
    phone_number: str = Field(..., min_length=8, max_length=20, description="Nomor WhatsApp/telepon aktif")


class RegisterClientResponse(BaseModel):
    """Response setelah registrasi klien berhasil."""
    message: str
    client_id: uuid.UUID
    user: "UserResponse"

    model_config = ConfigDict(from_attributes=True)


class UserResponse(BaseModel):
    id: uuid.UUID
    username: str
    email: str | None = None
    name: str
    role: UserRole
    client_id: uuid.UUID | None = None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
