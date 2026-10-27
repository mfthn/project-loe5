"""Aturan bisnis autentikasi dan pencarian pengguna."""
import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.modules.auth.client_code import build_client_code, normalize_phone
from app.modules.auth.models import Client, ClientCodeChange, User, UserRole
from app.modules.auth.schemas import ClientUpdateRequest, RegisterClientRequest


class DuplicatePhoneError(ValueError):
    """Nomor HP sudah dipakai klien lain."""


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
        DuplicatePhoneError: jika nomor HP sudah terdaftar (ID Klien akan ganda).
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

    # Nomor HP menjadi dasar ID Klien, jadi wajib unik.
    phone_number = normalize_phone(payload.phone_number)
    existing_phone = db.scalar(
        select(Client).where(Client.phone_number == phone_number)
    )
    if existing_phone:
        raise DuplicatePhoneError(
            f"Nomor HP '{phone_number}' sudah terdaftar sebagai klien "
            f"{existing_phone.company_name} ({existing_phone.client_code})."
        )

    # Buat record Client baru
    client = Client(
        company_name=payload.company_name,
        contact_person=payload.contact_person,
        phone_number=phone_number,
        client_code=build_client_code(phone_number),
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


def update_client(
    db: Session,
    client: Client,
    payload: ClientUpdateRequest,
    changed_by: uuid.UUID | None,
) -> tuple[bool, str, str | None]:
    """Perbarui data klien. Nomor HP baru otomatis mengubah ID Klien.

    Returns:
        (client_code_changed, previous_client_code, previous_phone)

    Raises:
        DuplicatePhoneError: jika nomor HP baru sudah dipakai klien lain.
    """
    previous_client_code = client.client_code
    previous_phone = client.phone_number

    if payload.company_name is not None:
        client.company_name = payload.company_name.strip()
    if payload.contact_person is not None:
        client.contact_person = payload.contact_person.strip()

    code_changed = False
    if payload.phone_number is not None:
        new_phone = normalize_phone(payload.phone_number)
        if new_phone != previous_phone:
            duplicate = db.scalar(
                select(Client).where(
                    Client.phone_number == new_phone,
                    Client.id != client.id,
                )
            )
            if duplicate:
                raise DuplicatePhoneError(
                    f"Nomor HP '{new_phone}' sudah terdaftar sebagai klien "
                    f"{duplicate.company_name} ({duplicate.client_code})."
                )

            new_client_code = build_client_code(new_phone)
            client.phone_number = new_phone
            client.client_code = new_client_code
            db.add(
                ClientCodeChange(
                    client_id=client.id,
                    old_client_code=previous_client_code,
                    new_client_code=new_client_code,
                    old_phone=previous_phone,
                    new_phone=new_phone,
                    changed_by=changed_by,
                )
            )
            code_changed = True

    db.flush()
    return code_changed, previous_client_code, previous_phone
