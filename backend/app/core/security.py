"""Utilitas keamanan: hashing password (bcrypt) dan token JWT."""
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from app.core.config import get_settings

settings = get_settings()

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24


def hash_password(password: str) -> str:
    """Melakukan hashing password menggunakan bcrypt."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Memverifikasi kecocokan password teks polos dengan hash bcrypt."""
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"), hashed_password.encode("utf-8")
        )
    except Exception:
        return False


def create_access_token(
    subject: str,
    claims: dict[str, Any] | None = None,
    expires_delta: timedelta | None = None,
) -> str:
    """Membuat JWT token yang ditandatangani dengan AUTH_SECRET."""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)

    to_encode: dict[str, Any] = {"sub": str(subject), "exp": expire}
    if claims:
        to_encode.update(claims)

    encoded_jwt = jwt.encode(to_encode, settings.auth_secret, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Mendekode dan memvalidasi JWT token. Mengembalikan payload jika valid."""
    try:
        payload = jwt.decode(token, settings.auth_secret, algorithms=[ALGORITHM])
        return payload
    except (jwt.PyJWTError, Exception):
        return None
