"""Pengujian cutting massal + HPP bahan terealisasi dari PO."""
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
        "mandor": _login(http_client, "agus_mandor", "Lukla@Mandor2026"),
        "gudang": _login(http_client, "budi_gudang", "Lukla@Gudang2026"),
        "finance": _login(http_client, "rina_finance", "Lukla@Finance2026"),
        "jahit": _login(http_client, "siti_jahit", "Lukla@Jahit2026"),
    }


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:6].upper()}"


@pytest.fixture
def cutting_setup():
    db = SessionLocal()
    try:
        klien = db.scalar(select(Client).where(Client.company_name.like("%Klien A%")))
        order = Order(
            client_id=klien.id, order_number=_uid("ORD-CUT"), scheme=MaklonScheme.CMT,
            target_quantity=300, status=OrderStatus.CUTTING,
        )
        db.add(order)
        db.flush()
        item = InventoryItem(
            client_id=klien.id, material_code=_uid("KAIN-CUT"), material_name="Kain Cutting Uji",
            current_stock=500.0, unit_measure="METER",
        )
        db.add(item)
        db.commit()
        return {"order_id": str(order.id), "item_id": str(item.id)}
    finally:
        db.close()


class TestCutting:
    def test_catat_cutting_di_status_cutting(self, http_client, headers, cutting_setup):
        res = http_client.post(
            "/api/v1/gudang/cutting",
            json={"order_id": cutting_setup["order_id"],
                  "inventory_item_id": cutting_setup["item_id"],
                  "qty_lapis": 50.0, "qty_potong_hasil": 240, "waste_qty": 2.5,
                  "notes": "Hamparan 1"},
            headers=headers["gudang"],
        )
        assert res.status_code == 201, res.text
        assert res.json()["qty_potong_hasil"] == 240

    def test_cutting_ditolak_setelah_qc(self, http_client, headers, cutting_setup):
        db = SessionLocal()
        try:
            order = db.scalar(select(Order).where(Order.id == cutting_setup["order_id"]))
            order.status = OrderStatus.QC
            db.commit()
        finally:
            db.close()
        res = http_client.post(
            "/api/v1/gudang/cutting",
            json={"order_id": cutting_setup["order_id"], "qty_lapis": 10.0,
                  "qty_potong_hasil": 40},
            headers=headers["mandor"],
        )
        assert res.status_code == 422

    def test_penjahit_tidak_bisa_catat_cutting(self, http_client, headers, cutting_setup):
        res = http_client.post(
            "/api/v1/gudang/cutting",
            json={"order_id": cutting_setup["order_id"], "qty_lapis": 10.0,
                  "qty_potong_hasil": 40},
            headers=headers["jahit"],
        )
        assert res.status_code == 403


@pytest.fixture
def hpp_setup(http_client, headers):
    """Order + PO 2 line, terima sebagian: line1 lunas, line2 setengah."""
    db = SessionLocal()
    try:
        klien = db.scalar(select(Client).where(Client.company_name.like("%Klien A%")))
        order = Order(
            client_id=klien.id, order_number=_uid("ORD-HPP"), scheme=MaklonScheme.FULL_PACKAGE,
            target_quantity=100, status=OrderStatus.CUTTING,
        )
        db.add(order)
        db.flush()
        item1 = InventoryItem(
            client_id=klien.id, material_code=_uid("KAIN-HPP1"), material_name="Kain HPP 1",
            current_stock=0.0, unit_measure="METER",
        )
        item2 = InventoryItem(
            client_id=klien.id, material_code=_uid("KAIN-HPP2"), material_name="Kain HPP 2",
            current_stock=0.0, unit_measure="METER",
        )
        db.add_all([item1, item2])
        db.commit()
        ids = {"order_id": str(order.id), "item1": str(item1.id), "item2": str(item2.id)}
    finally:
        db.close()
    po = http_client.post(
        "/api/v1/finance/pos",
        json={"po_number": _uid("PO-HPP"), "order_id": ids["order_id"],
              "supplier_name": "PT Uji",
              "lines": [{"inventory_item_id": ids["item1"], "qty_ordered": 100.0,
                         "unit_price": "20000.00"},
                        {"inventory_item_id": ids["item2"], "qty_ordered": 50.0,
                         "unit_price": "10000.00"}]},
        headers=headers["finance"],
    ).json()
    http_client.patch(f"/api/v1/finance/pos/{po['id']}/review",
                      json={"approve": True}, headers=headers["finance"])
    # line1 lunas 100×20000=2.000.000; line2 setengah 25×10000=250.000
    for qty in (100.0, 25.0):
        item = ids["item1"] if qty == 100.0 else ids["item2"]
        r = http_client.post(
            "/api/v1/gudang/receive",
            json={"inventory_item_id": item, "quantity": qty,
                  "order_id": ids["order_id"], "po_id": po["id"]},
            headers=headers["gudang"],
        )
        assert r.status_code == 200, r.text
    return ids


class TestRealizedHPP:
    def test_hpp_terealisasi_hanya_yang_diterima(self, http_client, headers, hpp_setup):
        res = http_client.get(f"/api/v1/finance/hpp/{hpp_setup['order_id']}",
                              headers=headers["finance"])
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["realized_material_cost"] == 2000000.0 + 250000.0
        assert body["po_count"] == 1

    def test_apply_mengisi_material_cost_hpp(self, http_client, headers, hpp_setup):
        res = http_client.post(
            f"/api/v1/finance/hpp/{hpp_setup['order_id']}/apply",
            json={"contract_revenue": "10000000.00", "overhead_cost": "1000000.00"},
            headers=headers["finance"],
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert float(body["material_cost"]) == 2250000.0
        assert float(body["total_hpp"]) == 2250000.0 + 1000000.0 + float(body["labor_cost"])

    def test_apply_tanpa_revenue_awal_ditolak(self, http_client, headers, cutting_setup):
        res = http_client.post(
            f"/api/v1/finance/hpp/{cutting_setup['order_id']}/apply",
            json={},
            headers=headers["finance"],
        )
        assert res.status_code == 422

    def test_penjahit_diblokir_hpp(self, http_client, headers, hpp_setup):
        res = http_client.get(f"/api/v1/finance/hpp/{hpp_setup['order_id']}",
                              headers=headers["jahit"])
        assert res.status_code == 403
