"""Aturan bisnis autentikasi dan pencarian pengguna."""
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import verify_password
from app.modules.auth.models import User


def get_user_by_id(db: Session, user_id: uuid.UUID) -> User | None:
    """Mencari user berdasarkan ID."""
    return db.scalar(select(User).where(User.id == user_id))


def get_user_by_username(db: Session, username: str) -> User | None:
    """Mencari user berdasarkan username."""
    return db.scalar(select(User).where(User.username == username))


def authenticate_user(db: Session, username: str, password: str) -> User | None:
    """Memvalidasi kredensial pengguna (username dan password)."""
    user = get_user_by_username(db, username)
    if not user:
        return None
    if not user.is_active:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    return user
