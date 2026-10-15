"""Pengujian alur handover gudang: request → review → serah → terima (dua arah)."""
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
def gudang_headers(http_client):
    return _login(http_client, "budi_gudang", "Lukla@Gudang2026")


@pytest.fixture
def mandor_headers(http_client):
    return _login(http_client, "agus_mandor", "Lukla@Mandor2026")


@pytest.fixture
def setup_order_item():
    db = SessionLocal()
    try:
        klien = db.scalar(select(Client).where(Client.company_name.like("%Klien A%")))
        assert klien is not None
        order = db.scalar(select(Order).where(Order.order_number == "ORD-HANDOVER-001"))
        if not order:
            order = Order(
                client_id=klien.id, order_number="ORD-HANDOVER-001",
                scheme=MaklonScheme.CMT, target_quantity=100, status=OrderStatus.CUTTING,
            )
            db.add(order)
            db.commit()
            db.refresh(order)
        else:
            order.status = OrderStatus.CUTTING
            db.commit()
        item = db.scalar(
            select(InventoryItem).where(InventoryItem.material_code == "KAIN-HANDOVER-01")
        )
        if not item:
            item = InventoryItem(
                client_id=klien.id, material_code="KAIN-HANDOVER-01",
                material_name="Kain Uji Handover", current_stock=500.0, unit_measure="METER",
            )
            db.add(item)
            db.commit()
            db.refresh(item)
        else:
            item.current_stock = 500.0
            db.commit()
        return {"order_id": str(order.id), "item_id": str(item.id), "client_id": str(klien.id)}
    finally:
        db.close()


def test_full_handover_flow(http_client, mandor_headers, gudang_headers, setup_order_item):
    data = setup_order_item

    # 1. Mandor mengajukan request
    req_res = http_client.post(
        "/api/v1/gudang/requests",
        json={"order_id": data["order_id"], "inventory_item_id": data["item_id"],
              "qty_requested": 100.0, "notes": "Butuh untuk cutting batch 1"},
        headers=mandor_headers,
    )
    assert req_res.status_code == 201, req_res.text
    req = req_res.json()
    assert req["status"] == "DIAJUKAN"
    req_id = req["id"]

    # 2. Gudang verifikasi + setujui (cek stok & milik klien)
    rev_res = http_client.patch(
        f"/api/v1/gudang/requests/{req_id}/review",
        json={"approve": True, "notes": "Stok tersedia, milik klien cocok"},
        headers=gudang_headers,
    )
    assert rev_res.status_code == 200, rev_res.text
    assert rev_res.json()["status"] == "DISETUJUI"

    # 3. Gudang serah terima (potong stok + OUT)
    ho_res = http_client.post(
        "/api/v1/gudang/handovers",
        json={"order_id": data["order_id"], "inventory_item_id": data["item_id"],
              "quantity": 100.0, "material_request_id": req_id,
              "notes": "Serah ke mandor line 1"},
        headers=gudang_headers,
    )
    assert ho_res.status_code == 201, ho_res.text
    handover = ho_res.json()
    assert handover["transaction_id"] is not None
    ho_id = handover["id"]

    # Stok berkurang 500 -> 400
    db = SessionLocal()
    try:
        item = db.scalar(select(InventoryItem).where(InventoryItem.material_code == "KAIN-HANDOVER-01"))
        assert item.current_stock == 500.0 - 100.0
    finally:
        db.close()

    # Request menjadi DISERAHKAN
    req_list = http_client.get("/api/v1/gudang/requests", headers=gudang_headers).json()
    mine = next(r for r in req_list if r["id"] == req_id)
    assert mine["status"] == "DISERAHKAN"
    assert mine["qty_fulfilled"] == 100.0

    # 4. Mandor konfirmasi terima → order CUTTING → SEWING
    recv_res = http_client.post(
        f"/api/v1/gudang/handovers/{ho_id}/receive", headers=mandor_headers
    )
    assert recv_res.status_code == 200, recv_res.text
    assert recv_res.json()["received_by_user_id"] is not None

    db = SessionLocal()
    try:
        order = db.scalar(select(Order).where(Order.order_number == "ORD-HANDOVER-001"))
        assert order.status == OrderStatus.SEWING
    finally:
        db.close()


def test_cross_client_request_blocked(http_client, mandor_headers, setup_order_item):
    """Request bahan klien A untuk order klien B wajib ditolak."""
    db = SessionLocal()
    try:
        klien_b = db.scalar(select(Client).where(Client.company_name.like("%Klien B%")))
        order_b = db.scalar(select(Order).where(Order.order_number == "ORD-HANDOVER-B"))
        if not order_b:
            order_b = Order(
                client_id=klien_b.id, order_number="ORD-HANDOVER-B",
                scheme=MaklonScheme.CMT, target_quantity=50, status=OrderStatus.CUTTING,
            )
            db.add(order_b)
            db.commit()
            db.refresh(order_b)
        order_b_id = str(order_b.id)
    finally:
        db.close()

    res = http_client.post(
        "/api/v1/gudang/requests",
        json={"order_id": order_b_id, "inventory_item_id": setup_order_item["item_id"],
              "qty_requested": 10.0},
        headers=mandor_headers,
    )
    assert res.status_code == 400
    assert "KONTAMINASI" in res.json()["detail"]


def test_review_rejects_insufficient_stock(http_client, mandor_headers, gudang_headers, setup_order_item):
    data = setup_order_item
    req_res = http_client.post(
        "/api/v1/gudang/requests",
        json={"order_id": data["order_id"], "inventory_item_id": data["item_id"],
              "qty_requested": 99999.0},
        headers=mandor_headers,
    )
    assert req_res.status_code == 201
    req_id = req_res.json()["id"]
    rev_res = http_client.patch(
        f"/api/v1/gudang/requests/{req_id}/review",
        json={"approve": True},
        headers=gudang_headers,
    )
    assert rev_res.status_code == 400
    assert "tidak mencukupi" in rev_res.json()["detail"].lower()


def test_storage_location_update(http_client, gudang_headers, setup_order_item):
    res = http_client.patch(
        f"/api/v1/gudang/items/{setup_order_item['item_id']}/location",
        json={"storage_location": "RAK-A-01"},
        headers=gudang_headers,
    )
    assert res.status_code == 200, res.text
    assert res.json()["storage_location"] == "RAK-A-01"


def test_rbac_penjahit_cannot_request(http_client, setup_order_item):
    headers = _login(http_client, "siti_jahit", "Lukla@Jahit2026")
    res = http_client.post(
        "/api/v1/gudang/requests",
        json={"order_id": setup_order_item["order_id"],
              "inventory_item_id": setup_order_item["item_id"], "qty_requested": 5.0},
        headers=headers,
    )
    assert res.status_code == 403
