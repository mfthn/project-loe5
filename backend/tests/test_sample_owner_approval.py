"""Pengujian approval owner dua tahap: sample → owner+hbarga → order massal."""
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.main import app
from app.modules.auth.models import Client


@pytest.fixture
def http_client():
    return TestClient(app)


def _login(http_client, username: str, password: str) -> dict:
    res = http_client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest.fixture
def sample_headers(http_client):
    return _login(http_client, "adis_sample", "Lukla@Sample2026")


@pytest.fixture
def owner_headers(http_client):
    return _login(http_client, "hendra_owner", "Lukla@Owner2026")


@pytest.fixture
def mandor_headers(http_client):
    return _login(http_client, "agus_mandor", "Lukla@Mandor2026")


def _client_a_id() -> str:
    db = SessionLocal()
    try:
        klien = db.scalar(select(Client).where(Client.company_name.like("%Klien A%")))
        assert klien is not None
        return str(klien.id)
    finally:
        db.close()


def _make_sample(http_client, sample_headers, code: str) -> dict:
    unique_code = f"{code}-{uuid.uuid4().hex[:6].upper()}"
    res = http_client.post(
        "/api/v1/sample/",
        json={"client_id": _client_a_id(), "sample_code": unique_code,
              "article_name": "Kemeja Uji Owner", "tech_pack_notes": "uji dua tahap"},
        headers=sample_headers,
    )
    assert res.status_code == 201, res.text
    sample = res.json()
    assert sample["versions"][0]["status"] == "DRAFT"
    return sample


def _unique_order(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:6].upper()}"


def test_two_stage_approval_gates_mass_order(http_client, sample_headers, owner_headers):
    s = _make_sample(http_client, sample_headers, "SMP-OWNER-001")
    version_id = s["versions"][0]["id"]

    # Tambah komponen sebelum approve
    comp = http_client.post(
        f"/api/v1/sample/versions/{version_id}/components",
        json={"component_name": "Badan Depan", "material_usage_est": 1.2,
              "time_study_seconds": 120},
        headers=sample_headers,
    )
    assert comp.status_code == 201, comp.text

    # Tahap 1: tim sample approve → APPROVED
    ap1 = http_client.post(f"/api/v1/sample/versions/{version_id}/approve", headers=sample_headers)
    assert ap1.status_code == 200, ap1.text
    assert ap1.json()["status"] == "APPROVED"
    assert ap1.json()["sample_approved_by"] is not None

    # Versi APPROVED terkunci dari ubahan komponen
    blocked = http_client.post(
        f"/api/v1/sample/versions/{version_id}/components",
        json={"component_name": "Lengan", "material_usage_est": 0.5,
              "time_study_seconds": 60},
        headers=sample_headers,
    )
    assert blocked.status_code == 409

    # Order massal DITOLAK sebelum approval owner (gate OWNER_APPROVED)
    conv_blocked = http_client.post(
        f"/api/v1/produksi/orders/from-sample/{version_id}",
        json={"order_number": _unique_order("ORD-OWNER-BLOCKED"), "scheme": "CMT",
              "target_quantity": 100, "cutting_rate_per_pcs": 500,
              "sewing_rate_per_pcs": 2500},
        headers=owner_headers,
    )
    assert conv_blocked.status_code == 409
    assert "OWNER_APPROVED" in conv_blocked.json()["detail"]

    # Tahap 2: owner approve + harga → OWNER_APPROVED
    ap2 = http_client.post(
        f"/api/v1/sample/versions/{version_id}/approve-owner",
        json={"agreed_price": 45000, "currency": "IDR",
              "costing_notes": "Deal CMT 45rb/pcs"},
        headers=owner_headers,
    )
    assert ap2.status_code == 200, ap2.text
    body = ap2.json()
    assert body["status"] == "OWNER_APPROVED"
    assert float(body["agreed_price"]) == 45000.0
    assert body["owner_approved_by"] is not None

    # Konversi kini BERHASIL
    conv = http_client.post(
        f"/api/v1/produksi/orders/from-sample/{version_id}",
        json={"order_number": _unique_order("ORD-OWNER-OK"), "scheme": "CMT",
              "target_quantity": 100, "cutting_rate_per_pcs": 500,
              "sewing_rate_per_pcs": 2500},
        headers=owner_headers,
    )
    assert conv.status_code == 201, conv.text
    assert conv.json()["order_number"].startswith("ORD-OWNER-OK")


def test_owner_reject_returns_to_revision_flow(http_client, sample_headers, owner_headers):
    s = _make_sample(http_client, sample_headers, "SMP-OWNER-002")
    version_id = s["versions"][0]["id"]
    http_client.post(f"/api/v1/sample/versions/{version_id}/approve", headers=sample_headers)

    rej = http_client.post(
        f"/api/v1/sample/versions/{version_id}/reject-owner",
        json={"reason": "Harga kemahalan, revisi costing"},
        headers=owner_headers,
    )
    assert rej.status_code == 200, rej.text
    assert rej.json()["status"] == "OWNER_REJECTED"

    # Versi ditolak tidak bisa di-approve owner
    ap2 = http_client.post(
        f"/api/v1/sample/versions/{version_id}/approve-owner",
        json={"agreed_price": 40000},
        headers=owner_headers,
    )
    assert ap2.status_code == 422


def test_rbac_mandor_cannot_owner_approve(http_client, sample_headers, mandor_headers):
    s = _make_sample(http_client, sample_headers, "SMP-OWNER-003")
    version_id = s["versions"][0]["id"]
    http_client.post(f"/api/v1/sample/versions/{version_id}/approve", headers=sample_headers)
    res = http_client.post(
        f"/api/v1/sample/versions/{version_id}/approve-owner",
        json={"agreed_price": 40000},
        headers=mandor_headers,
    )
    assert res.status_code == 403


def test_owner_approve_requires_approved_first(http_client, sample_headers, owner_headers):
    s = _make_sample(http_client, sample_headers, "SMP-OWNER-004")
    version_id = s["versions"][0]["id"]
    # Langsung tahap 2 tanpa tahap 1 → 422
    res = http_client.post(
        f"/api/v1/sample/versions/{version_id}/approve-owner",
        json={"agreed_price": 40000},
        headers=owner_headers,
    )
    assert res.status_code == 422
