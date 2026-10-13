"""Skema Pydantic untuk autentikasi dan profil pengguna."""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.modules.auth.models import UserRole


class LoginRequest(BaseModel):
    username: str = Field(..., min_length=3, description="Username pengguna")
    password: str = Field(..., min_length=4, description="Password pengguna")


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
