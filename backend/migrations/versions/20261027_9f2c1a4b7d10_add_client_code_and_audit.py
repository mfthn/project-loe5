"""add_client_code_and_code_change_audit

Mengubah ID Klien dari turunan UUID menjadi ``LOE5-<nomor HP>``.

- Menambah kolom ``clients.client_code`` (unik, wajib).
- Menormalkan ``clients.phone_number`` dan memberi unique index.
- Backfill data lama dari nomor HP, dengan fallback ``LOE5-<6 hex uuid>``.
- Membuat tabel audit ``client_code_changes``.

Revision ID: 9f2c1a4b7d10
Revises: b9c49d2e1f53
Create Date: 2026-10-27
"""
import re
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "9f2c1a4b7d10"
down_revision: str | None = "b9c49d2e1f53"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


CLIENT_CODE_MAX_LENGTH = 30


def _normalize_phone(raw: str | None) -> str:
    """Normalisasi nomor HP; mengembalikan string kosong jika tidak wajar."""
    digits = re.sub(r"\D", "", raw or "")
    if digits.startswith("62"):
        digits = "0" + digits[2:]
    elif digits.startswith("8"):
        digits = "0" + digits
    if not digits.startswith("0") or not (8 <= len(digits) <= 15):
        return ""
    return digits


def _fallback_client_code(client_id: object) -> str:
    clean_hex = str(client_id).replace("-", "")[:6].upper()
    return f"LOE5-{clean_hex}"


def upgrade() -> None:
    op.add_column(
        "clients",
        sa.Column("client_code", sa.String(length=CLIENT_CODE_MAX_LENGTH), nullable=True),
    )

    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT id, company_name, phone_number FROM clients")
    ).mappings().all()

    used_codes: dict[str, str] = {}
    used_phones: dict[str, str] = {}
    updates: list[dict[str, object]] = []

    for row in rows:
        client_id = row["id"]
        company_name = row["company_name"]
        normalized_phone = _normalize_phone(row["phone_number"])
        code = (
            f"LOE5-{normalized_phone}"
            if normalized_phone
            else _fallback_client_code(client_id)
        )

        if code in used_codes:
            raise RuntimeError(
                "Migrasi dibatalkan: ID Klien duplikat "
                f"{code} untuk '{used_codes[code]}' dan '{company_name}'. "
                "Perbaiki nomor HP yang kembar terlebih dahulu."
            )
        if normalized_phone and normalized_phone in used_phones:
            raise RuntimeError(
                "Migrasi dibatalkan: nomor HP duplikat "
                f"{normalized_phone} untuk '{used_phones[normalized_phone]}' "
                f"dan '{company_name}'. Perbaiki nomor HP yang kembar terlebih dahulu."
            )

        used_codes[code] = company_name
        if normalized_phone:
            used_phones[normalized_phone] = company_name

        updates.append(
            {
                "client_id": client_id,
                "client_code": code,
                "phone_number": normalized_phone or row["phone_number"],
            }
        )

    for item in updates:
        conn.execute(
            sa.text(
                "UPDATE clients "
                "SET client_code = :client_code, phone_number = :phone_number "
                "WHERE id = :client_id"
            ),
            item,
        )

    op.alter_column(
        "clients",
        "client_code",
        existing_type=sa.String(length=CLIENT_CODE_MAX_LENGTH),
        nullable=False,
    )
    op.create_index(
        "ix_clients_client_code", "clients", ["client_code"], unique=True
    )
    op.create_index(
        "ix_clients_phone_number", "clients", ["phone_number"], unique=True
    )

    op.create_table(
        "client_code_changes",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("client_id", sa.UUID(), nullable=False),
        sa.Column(
            "old_client_code", sa.String(length=CLIENT_CODE_MAX_LENGTH), nullable=False
        ),
        sa.Column(
            "new_client_code", sa.String(length=CLIENT_CODE_MAX_LENGTH), nullable=False
        ),
        sa.Column("old_phone", sa.String(length=50), nullable=True),
        sa.Column("new_phone", sa.String(length=50), nullable=True),
        sa.Column("changed_by", sa.UUID(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["client_id"], ["clients.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["changed_by"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_client_code_changes_client_id",
        "client_code_changes",
        ["client_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_client_code_changes_client_id", table_name="client_code_changes")
    op.drop_table("client_code_changes")
    op.drop_index("ix_clients_phone_number", table_name="clients")
    op.drop_index("ix_clients_client_code", table_name="clients")
    op.drop_column("clients", "client_code")
