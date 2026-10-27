"""Utilitas pembentukan ID Klien resmi berbasis nomor HP.

ID Klien mengikuti nomor HP pendaftar dengan prefix ``LOE5-`` supaya staf
bisa langsung mengenali sekaligus menghubungi klien.

Contoh: ``0812-3456-7890`` -> ``LOE5-08123456789``.
"""
import re
import uuid

CLIENT_CODE_PREFIX = "LOE5-"
CLIENT_CODE_MAX_LENGTH = 30
PHONE_MIN_DIGITS = 8
PHONE_MAX_DIGITS = 15


class InvalidPhoneNumberError(ValueError):
    """Nomor HP tidak valid setelah dinormalisasi."""


def normalize_phone(raw: str | None) -> str:
    """Normalisasi nomor HP Indonesia ke bentuk lokal ``08xxxxxxxxxx``.

    - Membuang spasi, tanda hubung, kurung, dan karakter non-digit.
    - Mengubah awalan ``62`` menjadi ``0``.
    - Menambahkan ``0`` bila nomor diawali ``8``.

    Raises:
        InvalidPhoneNumberError: bila nomor kosong atau panjangnya tidak wajar.
    """
    if raw is None:
        raise InvalidPhoneNumberError("Nomor HP wajib diisi.")

    digits = re.sub(r"\D", "", str(raw))
    if not digits:
        raise InvalidPhoneNumberError("Nomor HP wajib berisi angka.")

    if digits.startswith("62"):
        digits = "0" + digits[2:]
    elif digits.startswith("8"):
        digits = "0" + digits

    if not digits.startswith("0"):
        raise InvalidPhoneNumberError("Nomor HP harus diawali 0, 8, atau +62.")
    if not (PHONE_MIN_DIGITS <= len(digits) <= PHONE_MAX_DIGITS):
        raise InvalidPhoneNumberError(
            f"Nomor HP harus terdiri dari {PHONE_MIN_DIGITS}-{PHONE_MAX_DIGITS} digit."
        )
    return digits


def build_client_code(phone_number: str | None) -> str:
    """Membentuk ID Klien ``LOE5-<nomor HP ternormalisasi>``."""
    return f"{CLIENT_CODE_PREFIX}{normalize_phone(phone_number)}"


def fallback_client_code(client_id: uuid.UUID | str) -> str:
    """ID cadangan untuk data lama yang belum punya nomor HP."""
    clean_hex = str(client_id).replace("-", "")[:6].upper()
    return f"{CLIENT_CODE_PREFIX}{clean_hex}"
