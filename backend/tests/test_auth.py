"""Pengujian autentikasi dan penegakan peran RBAC."""
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def http_client():
    return TestClient(app)


def test_login_success(http_client):
    res = http_client.post(
        "/api/v1/auth/login",
        json={"username": "hendra_owner", "password": "Lukla@Owner2026"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["user"]["username"] == "hendra_owner"
    assert data["user"]["role"] == "OWNER"
    # Pastikan cookie access_token diset
    assert "access_token" in res.cookies


def test_login_wrong_password(http_client):
    res = http_client.post(
        "/api/v1/auth/login",
        json={"username": "hendra_owner", "password": "salahpassword"},
    )
    assert res.status_code == 401
    assert "salah" in res.json()["detail"].lower()


def test_login_user_not_found(http_client):
    res = http_client.post(
        "/api/v1/auth/login",
        json={"username": "tidakada", "password": "anypassword"},
    )
    assert res.status_code == 401


def test_get_me_authenticated_via_header(http_client):
    login_res = http_client.post(
        "/api/v1/auth/login",
        json={"username": "adis_sample", "password": "Lukla@Sample2026"},
    )
    token = login_res.json()["access_token"]

    me_res = http_client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_res.status_code == 200
    user_data = me_res.json()
    assert user_data["username"] == "adis_sample"
    assert user_data["role"] == "TIM_SAMPLE"


def test_get_me_authenticated_via_cookie(http_client):
    # Cookie otomatis tersimpan di session TestClient setelah login
    http_client.post(
        "/api/v1/auth/login",
        json={"username": "budi_gudang", "password": "Lukla@Gudang2026"},
    )

    me_res = http_client.get("/api/v1/auth/me")
    assert me_res.status_code == 200
    assert me_res.json()["username"] == "budi_gudang"
    assert me_res.json()["role"] == "GUDANG"


def test_get_me_unauthenticated(http_client):
    # Client baru tanpa cookie/header
    fresh_client = TestClient(app)
    res = fresh_client.get("/api/v1/auth/me")
    assert res.status_code == 401


def test_logout_clears_cookie(http_client):
    http_client.post(
        "/api/v1/auth/login",
        json={"username": "hendra_owner", "password": "Lukla@Owner2026"},
    )
    logout_res = http_client.post("/api/v1/auth/logout")
    assert logout_res.status_code == 200

    # Setelah logout, request tanpa header harus 401
    me_res = http_client.get("/api/v1/auth/me")
    assert me_res.status_code == 401


def test_client_b2b_has_client_id(http_client):
    login_res = http_client.post(
        "/api/v1/auth/login",
        json={"username": "klien_a", "password": "klien123"},
    )
    assert login_res.status_code == 200
    user_data = login_res.json()["user"]
    assert user_data["role"] == "KLIEN_MAKLON"
    assert user_data["client_id"] is not None
