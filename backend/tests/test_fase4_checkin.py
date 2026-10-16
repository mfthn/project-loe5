"""Fase 4: check-in penjahit + id operator output + batas mandor di gudang."""
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.main import app
from app.modules.auth.models import Client, User
from app.modules.produksi.models import MaklonScheme, Order, OrderComponent, OrderStatus, RateCard


@pytest.fixture
def http_client():
    return TestClient(app)


def _login(http_client, username: str, password: str) -> dict:
    res = http_client.post("/api/v1/auth/login", json={"username": username, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


@pytest.fixture
def headers(http_client):
    return {
        "owner": _login(http_client, "hendra_owner", "Lukla@Owner2026"),
        "mandor": _login(http_client, "agus_mandor", "Lukla@Mandor2026"),
        "gudang": _login(http_client, "budi_gudang", "Lukla@Gudang2026"),
        "jahit": _login(http_client, "siti_jahit", "Lukla@Jahit2026"),
    }


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:6].upper()}"


@pytest.fixture
def sewing_setup(http_client, headers):
    db = SessionLocal()
    try:
        klien = db.scalar(select(Client).where(Client.company_name.like("%Klien A%")))
        order = Order(
            client_id=klien.id, order_number=_uid("ORD-CI"), scheme=MaklonScheme.CMT,
            target_quantity=200, status=OrderStatus.SEWING,
        )
        db.add(order)
        db.flush()
        comp = OrderComponent(order_id=order.id, component_name="Badan", sequence_order=1)
        db.add(comp)
        db.flush()
        db.add(RateCard(order_component_id=comp.id, cutting_rate_per_pcs=500,
                        sewing_rate_per_pcs=2500))
        db.commit()
        siti = db.scalar(select(User).where(User.username == "siti_jahit"))
        return {"order_id": str(order.id), "comp_id": str(comp.id),
                "siti_id": str(siti.id)}
    finally:
        db.close()


class TestCheckin:
    def test_mandor_checkin_lalu_checkout(self, http_client, headers, sewing_setup):
        ci = http_client.post(
            "/api/v1/produksi/checkins",
            json={"user_id": sewing_setup["siti_id"], "order_id": sewing_setup["order_id"],
                  "line_number": 2, "task_category": "Badan Depan"},
            headers=headers["mandor"],
        )
        assert ci.status_code == 201, ci.text
        assert ci.json()["line_number"] == 2

        double = http_client.post(
            "/api/v1/produksi/checkins",
            json={"user_id": sewing_setup["siti_id"], "line_number": 2},
            headers=headers["mandor"],
        )
        assert double.status_code == 400

        out = http_client.get("/api/v1/produksi/checkins?only_open=true",
                              headers=headers["mandor"]).json()
        assert any(c["user_id"] == sewing_setup["siti_id"] for c in out)

        co = http_client.post(
            f"/api/v1/produksi/checkins/{ci.json()['id']}/checkout",
            headers=headers["mandor"],
        )
        assert co.status_code == 200, co.text
        assert co.json()["checkout_at"] is not None

    def test_penjahit_diblokir_checkin_orang(self, http_client, headers, sewing_setup):
        res = http_client.post(
            "/api/v1/produksi/checkins",
            json={"user_id": sewing_setup["siti_id"], "line_number": 1},
            headers=headers["jahit"],
        )
        assert res.status_code == 403

    def test_mandor_wajib_tunjuk_operator(self, http_client, headers, sewing_setup):
        res = http_client.post(
            "/api/v1/produksi/outputs",
            json={"order_id": sewing_setup["order_id"],
                  "order_component_id": sewing_setup["comp_id"],
                  "line_number": 2, "qty_completed": 10,
                  "time_window": "2026-10-16T08:00:00+00:00"},
            headers=headers["mandor"],
        )
        assert res.status_code in (400, 422)

    def test_output_mandor_tercatat_atas_penjahit(self, http_client, headers, sewing_setup):
        res = http_client.post(
            "/api/v1/produksi/outputs",
            json={"order_id": sewing_setup["order_id"],
                  "order_component_id": sewing_setup["comp_id"],
                  "line_number": 2, "qty_completed": 15,
                  "time_window": "2026-10-16T08:30:00+00:00",
                  "operator_user_id": sewing_setup["siti_id"]},
            headers=headers["mandor"],
        )
        assert res.status_code == 201, res.text
        assert res.json()["operator_user_id"] == sewing_setup["siti_id"]

    def test_penjahit_tetap_atas_nama_sendiri(self, http_client, headers, sewing_setup):
        res = http_client.post(
            "/api/v1/produksi/outputs",
            json={"order_id": sewing_setup["order_id"],
                  "order_component_id": sewing_setup["comp_id"],
                  "line_number": 1, "qty_completed": 12,
                  "time_window": "2026-10-16T09:00:00+00:00"},
            headers=headers["jahit"],
        )
        assert res.status_code == 201, res.text
        db = SessionLocal()
        try:
            siti = db.scalar(select(User).where(User.username == "siti_jahit"))
            assert res.json()["operator_user_id"] == str(siti.id)
        finally:
            db.close()
