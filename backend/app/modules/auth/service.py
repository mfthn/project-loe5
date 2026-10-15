"""Aturan bisnis autentikasi dan pencarian pengguna."""
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.modules.auth.models import Client, User, UserRole
from app.modules.auth.schemas import RegisterClientRequest


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


def register_client(
    db: Session, payload: RegisterClientRequest
) -> tuple[Client, User]:
    """Registrasi mandiri klien baru: buat Client + User KLIEN_MAKLON sekaligus.

    Returns:
        (client, user) — kedua objek ORM yang sudah di-flush ke DB.

    Raises:
        ValueError: jika username atau email sudah dipakai.
    """
    # Validasi duplikat username
    if get_user_by_username(db, payload.username):
        raise ValueError(f"Username '{payload.username}' sudah digunakan.")

    # Validasi duplikat email
    existing_email = db.scalar(
        select(User).where(User.email == payload.email)
    )
    if existing_email:
        raise ValueError(f"Email '{payload.email}' sudah terdaftar.")

    # Buat record Client baru
    client = Client(
        company_name=payload.company_name,
        contact_person=payload.contact_person,
        phone_number=payload.phone_number,
    )
    db.add(client)
    db.flush()  # Dapatkan client.id sebelum buat user

    # Buat User KLIEN_MAKLON terikat ke Client tersebut
    user = User(
        username=payload.username,
        email=payload.email,
        name=payload.contact_person,
        hashed_password=hash_password(payload.password),
        role=UserRole.KLIEN_MAKLON,
        client_id=client.id,
        is_active=True,
    )
    db.add(user)
    db.flush()

    return client, user
