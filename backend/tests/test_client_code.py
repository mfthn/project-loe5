"""Pengujian ID Klien berbasis nomor HP: ``LOE5-<nomor HP>``."""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modules.auth.client_code import (
    InvalidPhoneNumberError,
    build_client_code,
    normalize_phone,
)


_CREATED_CLIENT_IDS: list[str] = []


@pytest.fixture(autouse=True)
def _cleanup_created_clients():
    """Hapus klien yang dibuat pengujian agar database dev tetap bersih."""
    yield
    if not _CREATED_CLIENT_IDS:
        return

    from sqlalchemy import delete

    from app.core.database import SessionLocal
    from app.modules.auth.models import Client, User

    db = SessionLocal()
    try:
        ids = [uuid.UUID(value) for value in _CREATED_CLIENT_IDS]
        db.execute(delete(User).where(User.client_id.in_(ids)))
        db.execute(delete(Client).where(Client.id.in_(ids)))
        db.commit()
    finally:
        db.close()
        _CREATED_CLIENT_IDS.clear()


@pytest.fixture
def http_client():
    return TestClient(app)


def _unique_phone() -> str:
    """Nomor HP lokal unik 10 digit untuk pengujian."""
    digits = str(uuid.uuid4().int % 10**8).zfill(8)
    return f"08{digits}"


def _owner_headers(http_client) -> dict:
    res = http_client.post(
        "/api/v1/auth/login",
        json={"username": "hendra_owner", "password": "Lukla@Owner2026"},
    )
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def _register(http_client, phone: str, suffix: str):
    res = http_client.post(
        "/api/v1/auth/register",
        json={
            "username": f"klien_{suffix}",
            "password": "rahasia123",
            "email": f"klien_{suffix}@contoh.id",
            "company_name": f"PT Uji {suffix}",
            "contact_person": f"PIC {suffix}",
            "phone_number": phone,
        },
    )
    if res.status_code == 201:
        _CREATED_CLIENT_IDS.append(res.json()["client_id"])
    return res


class TestNormalisasiNomor:
    def test_format_lokal(self):
        assert normalize_phone("0812-3456-7890") == "081234567890"

    def test_format_kode_negara(self):
        assert normalize_phone("+62 812 3456 7890") == "081234567890"

    def test_tanpa_nol_di_depan(self):
        assert normalize_phone("81234567890") == "081234567890"

    def test_nomor_tidak_valid(self):
        with pytest.raises(InvalidPhoneNumberError):
            normalize_phone("123")
        with pytest.raises(InvalidPhoneNumberError):
            normalize_phone("")

    def test_build_client_code(self):
        assert build_client_code("+62 812-3456-7890") == "LOE5-081234567890"


class TestRegistrasiKlien:
    def test_client_code_mengikuti_nomor_hp(self, http_client):
        phone = _unique_phone()
        suffix = uuid.uuid4().hex[:6]
        res = _register(http_client, phone, suffix)
        assert res.status_code == 201, res.text
        data = res.json()
        assert data["client_code"] == f"LOE5-{phone}"
        assert data["user"]["role"] == "KLIEN_MAKLON"
        assert data["user"]["client_code"] == f"LOE5-{phone}"

    def test_nomor_hp_dinormalisasi_saat_registrasi(self, http_client):
        phone = _unique_phone()
        suffix = uuid.uuid4().hex[:6]
        formatted = f"+62 {phone[1:4]}-{phone[4:8]}-{phone[8:]}"
        res = _register(http_client, formatted, suffix)
        assert res.status_code == 201, res.text
        assert res.json()["client_code"] == f"LOE5-{phone}"

    def test_nomor_hp_duplikat_ditolak(self, http_client):
        phone = _unique_phone()
        first = _register(http_client, phone, uuid.uuid4().hex[:6])
        assert first.status_code == 201, first.text

        second = _register(http_client, phone, uuid.uuid4().hex[:6])
        assert second.status_code == 409
        assert "sudah terdaftar" in second.json()["detail"]


class TestPerubahanNomorKlien:
    def test_owner_mengubah_nomor_dan_id_tersimpan_di_audit(self, http_client):
        phone = _unique_phone()
        suffix = uuid.uuid4().hex[:6]
        created = _register(http_client, phone, suffix)
        assert created.status_code == 201, created.text
        client_id = created.json()["client_id"]

        headers = _owner_headers(http_client)
        new_phone = _unique_phone()
        res = http_client.patch(
            f"/api/v1/auth/clients/{client_id}",
            json={"phone_number": new_phone},
            headers=headers,
        )
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["client_code_changed"] is True
        assert data["previous_client_code"] == f"LOE5-{phone}"
        assert data["client_code"] == f"LOE5-{new_phone}"
        assert data["warning"]

        history = http_client.get(
            f"/api/v1/auth/clients/{client_id}/code-history", headers=headers
        )
        assert history.status_code == 200, history.text
        rows = history.json()
        assert len(rows) == 1
        assert rows[0]["old_client_code"] == f"LOE5-{phone}"
        assert rows[0]["new_client_code"] == f"LOE5-{new_phone}"

    def test_bukan_owner_tidak_boleh_mengubah_klien(self, http_client):
        phone = _unique_phone()
        suffix = uuid.uuid4().hex[:6]
        created = _register(http_client, phone, suffix)
        client_id = created.json()["client_id"]

        login = http_client.post(
            "/api/v1/auth/login",
            json={"username": "budi_gudang", "password": "Lukla@Gudang2026"},
        )
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
        res = http_client.patch(
            f"/api/v1/auth/clients/{client_id}",
            json={"phone_number": _unique_phone()},
            headers=headers,
        )
        assert res.status_code == 403
