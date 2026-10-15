"""Pengujian modul Gudang dan Skenario Pengujian 1: Proteksi Kontaminasi Silang (FR-6.2)."""
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


@pytest.fixture
def gudang_auth_headers(http_client):
    """Login sebagai Petugas Gudang dan mengembalikan Authorization header."""
    res = http_client.post(
        "/api/v1/auth/login",
        json={"username": "budi_gudang", "password": "Lukla@Gudang2026"},
    )
    assert res.status_code == 200
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def setup_clients_and_orders():
    """Menyiapkan 2 klien dan 1 order untuk Klien B guna pengujian kontaminasi silang."""
    db = SessionLocal()
    try:
        # Ambil klien A dan B dari seed
        klien_a = db.scalar(select(Client).where(Client.company_name.like("%Klien A%")))
        klien_b = db.scalar(select(Client).where(Client.company_name.like("%Klien B%")))
        assert klien_a is not None, "Klien A harus ada dari seed"
        assert klien_b is not None, "Klien B harus ada dari seed"

        # Buat order untuk Klien B jika belum ada
        order_b = db.scalar(select(Order).where(Order.order_number == "ORD-TEST-KLIEN-B"))
        if not order_b:
            order_b = Order(
                client_id=klien_b.id,
                order_number="ORD-TEST-KLIEN-B",
                scheme=MaklonScheme.CMT,
                target_quantity=500,
                status=OrderStatus.CUTTING,
            )
            db.add(order_b)
            db.commit()
            db.refresh(order_b)

        # Buat order untuk Klien A jika belum ada
        order_a = db.scalar(select(Order).where(Order.order_number == "ORD-TEST-KLIEN-A"))
        if not order_a:
            order_a = Order(
                client_id=klien_a.id,
                order_number="ORD-TEST-KLIEN-A",
                scheme=MaklonScheme.CMT,
                target_quantity=300,
                status=OrderStatus.CUTTING,
            )
            db.add(order_a)
            db.commit()
            db.refresh(order_a)

        return {
            "klien_a_id": klien_a.id,
            "klien_b_id": klien_b.id,
            "order_a_id": order_a.id,
            "order_b_id": order_b.id,
        }
    finally:
        db.close()


def test_add_inventory_item_with_tag_client(http_client, gudang_auth_headers, setup_clients_and_orders):
    data = setup_clients_and_orders
    payload = {
        "client_id": str(data["klien_a_id"]),
        "material_code": "KAIN-COMBED-NAVY-01",
        "material_name": "Cotton Combed 30s Navy",
        "initial_stock": 500.0,
        "unit_measure": "METER",
    }
    res = http_client.post(
        "/api/v1/gudang/items",
        json=payload,
        headers=gudang_auth_headers,
    )
    assert res.status_code == 201
    item = res.json()
    assert item["material_code"] == "KAIN-COMBED-NAVY-01"
    assert item["current_stock"] == 500.0
    assert item["client_id"] == str(data["klien_a_id"])


def test_receive_material_in(http_client, gudang_auth_headers, setup_clients_and_orders):
    data = setup_clients_and_orders
    # Buat item
    create_res = http_client.post(
        "/api/v1/gudang/items",
        json={
            "client_id": str(data["klien_a_id"]),
            "material_code": "BENANG-POLY-01",
            "material_name": "Benang Jahit Poliester",
            "initial_stock": 10.0,
            "unit_measure": "CONE",
        },
        headers=gudang_auth_headers,
    )
    item_id = create_res.json()["id"]

    # Penerimaan tambahan
    rec_res = http_client.post(
        "/api/v1/gudang/receive",
        json={
            "inventory_item_id": item_id,
            "quantity": 25.0,
            "notes": "Surat Jalan SJ-9988",
        },
        headers=gudang_auth_headers,
    )
    assert rec_res.status_code == 200
    trx = rec_res.json()
    assert trx["transaction_type"] == "IN"
    assert trx["quantity"] == 25.0

    # Cek stok bertambah
    items = http_client.get(f"/api/v1/gudang/items?client_id={data['klien_a_id']}", headers=gudang_auth_headers).json()
    updated_item = next(it for it in items if it["id"] == item_id)
    assert updated_item["current_stock"] == 35.0


def test_skenario_1_cross_contamination_blocked(http_client, gudang_auth_headers, setup_clients_and_orders):
    """SKENARIO PENGUJIAN 1 (SRS Slide 6 & 10):

    Coba keluarkan bahan atas nama Klien A untuk pesanan Klien B.
    Sistem harus menolak transaksi dan menampilkan peringatan eksplisit ketidakcocokan pemilik.
    Stok bahan TIDAK BOLEH berubah!
    """
    data = setup_clients_and_orders

    # 1. Daftarkan bahan milik Klien A dengan stok 200 meter
    create_res = http_client.post(
        "/api/v1/gudang/items",
        json={
            "client_id": str(data["klien_a_id"]),
            "material_code": "KAIN-KATUN-EXCLUSIVE-A",
            "material_name": "Katun Rayon Klien A",
            "initial_stock": 200.0,
            "unit_measure": "METER",
        },
        headers=gudang_auth_headers,
    )
    assert create_res.status_code == 201
    item_a_id = create_res.json()["id"]

    # 2. Coba keluarkan bahan Klien A untuk Pesanan Klien B
    issue_res = http_client.post(
        "/api/v1/gudang/issue",
        json={
            "inventory_item_id": item_a_id,
            "order_id": str(data["order_b_id"]),  # Order milik Klien B!
            "quantity": 50.0,
            "notes": "Percobaan pengeluaran salah klien",
        },
        headers=gudang_auth_headers,
    )

    # 3. VERIFIKASI: Sistem menolak dengan HTTP 400 dan pesan peringatan eksplisit
    assert issue_res.status_code == 400
    err_detail = issue_res.json()["detail"]
    assert "BLOKIR KONTAMINASI SILANG" in err_detail
    assert "TIDAK BOLEH dikeluarkan" in err_detail

    # 4. VERIFIKASI: Stok tetap utuh (200.0), tidak berkurang sama sekali
    db = SessionLocal()
    try:
        item = db.scalar(select(InventoryItem).where(InventoryItem.id == item_a_id))
        assert item.current_stock == 200.0
    finally:
        db.close()


def test_issue_material_success_when_matching(http_client, gudang_auth_headers, setup_clients_and_orders):
    """Pengeluaran berhasil saat bahan dan pesanan berasal dari klien yang sama."""
    data = setup_clients_and_orders

    create_res = http_client.post(
        "/api/v1/gudang/items",
        json={
            "client_id": str(data["klien_a_id"]),
            "material_code": "KAIN-DRILL-A",
            "material_name": "Kain Drill Klien A",
            "initial_stock": 100.0,
            "unit_measure": "METER",
        },
        headers=gudang_auth_headers,
    )
    item_a_id = create_res.json()["id"]

    # Keluarkan untuk Order Klien A
    issue_res = http_client.post(
        "/api/v1/gudang/issue",
        json={
            "inventory_item_id": item_a_id,
            "order_id": str(data["order_a_id"]),  # Cocok!
            "quantity": 30.0,
        },
        headers=gudang_auth_headers,
    )
    assert issue_res.status_code == 200
    assert issue_res.json()["transaction_type"] == "OUT"
    assert issue_res.json()["quantity"] == 30.0

    # Cek sisa stok
    db = SessionLocal()
    try:
        item = db.scalar(select(InventoryItem).where(InventoryItem.id == item_a_id))
        assert item.current_stock == 70.0
    finally:
        db.close()


def test_insufficient_stock_rejected(http_client, gudang_auth_headers, setup_clients_and_orders):
    data = setup_clients_and_orders
    create_res = http_client.post(
        "/api/v1/gudang/items",
        json={
            "client_id": str(data["klien_a_id"]),
            "material_code": "KAIN-MINI-STOCK",
            "material_name": "Sisa Kain",
            "initial_stock": 5.0,
            "unit_measure": "METER",
        },
        headers=gudang_auth_headers,
    )
    item_id = create_res.json()["id"]

    # Minta 50 meter saat stok cuma 5 meter
    issue_res = http_client.post(
        "/api/v1/gudang/issue",
        json={
            "inventory_item_id": item_id,
            "order_id": str(data["order_a_id"]),
            "quantity": 50.0,
        },
        headers=gudang_auth_headers,
    )
    assert issue_res.status_code == 400
    assert "tidak mencukupi" in issue_res.json()["detail"].lower()


def test_b2b_client_portal_data_isolation(http_client, setup_clients_and_orders):
    """Pengujian isolasi multi-tenant: Klien A hanya bisa melihat stok miliknya sendiri."""
    data = setup_clients_and_orders

    # Login sebagai Klien A
    login_a = http_client.post(
        "/api/v1/auth/login",
        json={"username": "klien_a", "password": "klien123"},
    )
    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Ambil stok (meskipun mencoba mem-pass filter orang lain, backend harus mengunci ke client_a)
    res = http_client.get(
        f"/api/v1/gudang/items?client_id={data['klien_b_id']}",
        headers=headers_a,
    )
    assert res.status_code == 200
    items = res.json()
    # Pastikan seluruh item yang diterima hanya milik Klien A!
    for it in items:
        assert it["client_id"] == str(data["klien_a_id"])
