"""Fase 3: kebutuhan produksi, konfirmasi pengadaan, bayar supplier, kategori waste wajib."""
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.main import app
from app.modules.auth.models import Client
from app.modules.gudang.models import InventoryItem
from app.modules.produksi.models import MaklonScheme, Order, OrderStatus


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
        "sample": _login(http_client, "adis_sample", "Lukla@Sample2026"),
        "mandor": _login(http_client, "agus_mandor", "Lukla@Mandor2026"),
        "gudang": _login(http_client, "budi_gudang", "Lukla@Gudang2026"),
        "finance": _login(http_client, "rina_finance", "Lukla@Finance2026"),
    }


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:6].upper()}"


@pytest.fixture
def need_setup(http_client, headers):
    db = SessionLocal()
    try:
        klien = db.scalar(select(Client).where(Client.company_name.like("%Klien A%")))
        order = Order(
            client_id=klien.id, order_number=_uid("ORD-NEED"), scheme=MaklonScheme.FULL_PACKAGE,
            target_quantity=100, status=OrderStatus.CUTTING,
        )
        db.add(order)
        db.flush()
        item = InventoryItem(
            client_id=klien.id, material_code=_uid("KAIN-NEED"), material_name="Kain Need Uji",
            current_stock=10.0, unit_measure="METER",
        )
        db.add(item)
        db.commit()
        ids = {"order_id": str(order.id), "item_id": str(item.id)}
    finally:
        db.close()
    req = http_client.post(
        "/api/v1/gudang/requests",
        json={"order_id": ids["order_id"], "inventory_item_id": ids["item_id"],
              "qty_requested": 100.0},
        headers=headers["mandor"],
    )
    assert req.status_code == 201, req.text
    ids["request_id"] = req.json()["id"]
    return ids


class TestNeedsAndProcurement:
    def test_status_belum_lalu_terpenuhi(self, http_client, headers, need_setup):
        n1 = http_client.get("/api/v1/finance/needs", headers=headers["gudang"]).json()
        mine1 = next(n for n in n1 if n["request_id"] == need_setup["request_id"])
        assert mine1["need_status"] == "BELUM"

        po = http_client.post(
            "/api/v1/finance/pos",
            json={"po_number": _uid("PO-NEED"), "order_id": need_setup["order_id"],
                  "supplier_name": "PT Uji",
                  "lines": [{"inventory_item_id": need_setup["item_id"],
                             "qty_ordered": 100.0, "unit_price": "10000.00"}]},
            headers=headers["gudang"],
        )
        assert po.status_code == 201, po.text
        po_id = po.json()["id"]

        # Gudang konfirmasi → Finance setujui → terima penuh
        c = http_client.post(f"/api/v1/finance/pos/{po_id}/confirm", headers=headers["gudang"])
        assert c.status_code == 200, c.text
        assert c.json()["status"] == "TERKONFIRMASI"
        http_client.patch(f"/api/v1/finance/pos/{po_id}/review",
                          json={"approve": True}, headers=headers["finance"])
        r = http_client.post(
            "/api/v1/gudang/receive",
            json={"inventory_item_id": need_setup["item_id"], "quantity": 100.0,
                  "order_id": need_setup["order_id"], "po_id": po_id},
            headers=headers["gudang"],
        )
        assert r.status_code == 200, r.text
        n2 = http_client.get("/api/v1/finance/needs", headers=headers["gudang"]).json()
        assert next(n for n in n2 if n["request_id"] == need_setup["request_id"])["need_status"] == "TERPENUHI"

    def test_confirm_hanya_dari_draft(self, http_client, headers, need_setup):
        po = http_client.post(
            "/api/v1/finance/pos",
            json={"po_number": _uid("PO-NEED"), "order_id": need_setup["order_id"],
                  "supplier_name": "PT Uji",
                  "lines": [{"inventory_item_id": need_setup["item_id"],
                             "qty_ordered": 10.0, "unit_price": "1000.00"}]},
            headers=headers["sample"],
        ).json()
        http_client.post(f"/api/v1/finance/pos/{po['id']}/confirm", headers=headers["gudang"])
        again = http_client.post(
            f"/api/v1/finance/pos/{po['id']}/confirm", headers=headers["gudang"]
        )
        assert again.status_code == 422

    def test_finance_lengkapi_draft_lalu_bayar(self, http_client, headers, need_setup):
        po = http_client.post(
            "/api/v1/finance/pos",
            json={"po_number": _uid("PO-NEED"), "order_id": need_setup["order_id"],
                  "supplier_name": "PT Uji",
                  "lines": [{"inventory_item_id": need_setup["item_id"],
                             "qty_ordered": 20.0, "unit_price": "0.00"}]},
            headers=headers["gudang"],
        ).json()
        up = http_client.patch(
            f"/api/v1/finance/pos/{po['id']}",
            json={"line_prices": {need_setup["item_id"]: 5000.0}},
            headers=headers["finance"],
        )
        assert up.status_code == 200, up.text
        assert float(up.json()["total_amount"]) == 20.0 * 5000.0

        http_client.post(f"/api/v1/finance/pos/{po['id']}/confirm", headers=headers["gudang"])
        http_client.patch(f"/api/v1/finance/pos/{po['id']}/review",
                          json={"approve": True}, headers=headers["finance"])
        pay = http_client.post(
            f"/api/v1/finance/pos/{po['id']}/payments",
            json={"amount": "40000.00", "notes": "Termin 1"},
            headers=headers["finance"],
        )
        assert pay.status_code == 201, pay.text
        assert pay.json()["total_paid"] == 40000.0
        assert pay.json()["remaining"] == 60000.0

        over = http_client.post(
            f"/api/v1/finance/pos/{po['id']}/payments",
            json={"amount": "999999.00"},
            headers=headers["finance"],
        )
        assert over.status_code in (400, 422)

    def test_cutting_tanpa_kategori_ditolak(self, http_client, headers, need_setup):
        res = http_client.post(
            "/api/v1/gudang/cutting",
            json={"order_id": need_setup["order_id"], "qty_lapis": 5.0,
                  "qty_potong_hasil": 20},
            headers=headers["gudang"],
        )
        assert res.status_code == 422
