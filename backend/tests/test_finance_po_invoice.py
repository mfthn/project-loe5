"""Pengujian Finance: PO bahan (sample → review → terima bertahap) & Invoice klien."""
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
        "jahit": _login(http_client, "siti_jahit", "Lukla@Jahit2026"),
        "klien_a": _login(http_client, "klien_a", "klien123"),
    }


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:6].upper()}"


@pytest.fixture
def po_setup(http_client, headers):
    """Order + item milik Klien A untuk skenario PO."""
    db = SessionLocal()
    try:
        klien = db.scalar(select(Client).where(Client.company_name.like("%Klien A%")))
        order = Order(
            client_id=klien.id, order_number=_uid("ORD-PO"), scheme=MaklonScheme.FULL_PACKAGE,
            target_quantity=200, status=OrderStatus.CUTTING,
        )
        db.add(order)
        db.flush()
        item = InventoryItem(
            client_id=klien.id, material_code=_uid("KAIN-PO"), material_name="Kain PO Uji",
            current_stock=0.0, unit_measure="METER",
        )
        db.add(item)
        db.commit()
        return {"order_id": str(order.id), "item_id": str(item.id)}
    finally:
        db.close()


def _create_po(http_client, headers, setup, po_number=None, qty=100.0, price="15000.00"):
    res = http_client.post(
        "/api/v1/finance/pos",
        json={"po_number": po_number or _uid("PO"), "order_id": setup["order_id"],
              "supplier_name": "PT Supplier Tekstil",
              "lines": [{"inventory_item_id": setup["item_id"],
                         "qty_ordered": qty, "unit_price": price}]},
        headers=headers["sample"],
    )
    assert res.status_code == 201, res.text
    return res.json()


class TestPOFlow:
    def test_sample_ajukan_finance_setujui(self, http_client, headers, po_setup):
        po = _create_po(http_client, headers, po_setup)
        assert po["status"] == "DRAFT"
        assert float(po["total_amount"]) == 100.0 * 15000.0

        rev = http_client.patch(
            f"/api/v1/finance/pos/{po['id']}/review",
            json={"approve": True, "notes": "Harga wajar, lanjut"},
            headers=headers["finance"],
        )
        assert rev.status_code == 200, rev.text
        assert rev.json()["status"] == "DISETUJUI"

    def test_terima_bertahap_majukan_status_otomatis(self, http_client, headers, po_setup):
        po = _create_po(http_client, headers, po_setup)
        http_client.patch(f"/api/v1/finance/pos/{po['id']}/review",
                          json={"approve": True}, headers=headers["finance"])

        r1 = http_client.post(
            "/api/v1/gudang/receive",
            json={"inventory_item_id": po_setup["item_id"], "quantity": 40.0,
                  "order_id": po_setup["order_id"], "po_id": po["id"],
                  "notes": "SJ-001 termin 1"},
            headers=headers["gudang"],
        )
        assert r1.status_code == 200, r1.text
        st1 = http_client.get("/api/v1/finance/pos", headers=headers["gudang"]).json()
        mine1 = next(p for p in st1 if p["id"] == po["id"])
        assert mine1["status"] == "DITERIMA_SEBAGIAN"
        assert mine1["lines"][0]["qty_received"] == 40.0

        r2 = http_client.post(
            "/api/v1/gudang/receive",
            json={"inventory_item_id": po_setup["item_id"], "quantity": 60.0,
                  "order_id": po_setup["order_id"], "po_id": po["id"],
                  "notes": "SJ-002 pelunasan"},
            headers=headers["gudang"],
        )
        assert r2.status_code == 200, r2.text
        st2 = http_client.get("/api/v1/finance/pos", headers=headers["gudang"]).json()
        assert next(p for p in st2 if p["id"] == po["id"])["status"] == "SELESAI"

    def test_terima_untuk_order_tanpa_po_ditolak(self, http_client, headers, po_setup):
        res = http_client.post(
            "/api/v1/gudang/receive",
            json={"inventory_item_id": po_setup["item_id"], "quantity": 10.0,
                  "order_id": po_setup["order_id"], "notes": "tanpa PO"},
            headers=headers["gudang"],
        )
        assert res.status_code == 400
        assert "po_id" in res.json()["detail"]

    def test_terima_melebihi_sisa_po_ditolak(self, http_client, headers, po_setup):
        po = _create_po(http_client, headers, po_setup, qty=10.0)
        http_client.patch(f"/api/v1/finance/pos/{po['id']}/review",
                          json={"approve": True}, headers=headers["finance"])
        res = http_client.post(
            "/api/v1/gudang/receive",
            json={"inventory_item_id": po_setup["item_id"], "quantity": 50.0,
                  "order_id": po_setup["order_id"], "po_id": po["id"]},
            headers=headers["gudang"],
        )
        assert res.status_code in (400, 422)

    def test_penjahit_tidak_bisa_buat_po(self, http_client, headers, po_setup):
        res = http_client.post(
            "/api/v1/finance/pos",
            json={"po_number": _uid("PO"), "order_id": po_setup["order_id"],
                  "supplier_name": "X",
                  "lines": [{"inventory_item_id": po_setup["item_id"],
                             "qty_ordered": 5, "unit_price": "1000.00"}]},
            headers=headers["jahit"],
        )
        assert res.status_code == 403


@pytest.fixture
def completed_order(http_client, headers):
    """Order COMPLETED dari sample OWNER_APPROVED (untuk invoice auto-amount)."""
    db = SessionLocal()
    try:
        klien = db.scalar(select(Client).where(Client.company_name.like("%Klien A%")))
        cid = str(klien.id)
    finally:
        db.close()
    s = http_client.post(
        "/api/v1/sample/",
        json={"client_id": cid, "sample_code": _uid("SMP-INV"),
              "article_name": "Kemeja Invoice"},
        headers=headers["sample"],
    ).json()
    ver = s["versions"][0]["id"]
    http_client.post(
        f"/api/v1/sample/versions/{ver}/components",
        json={"component_name": "Badan", "material_usage_est": 1.5,
              "time_study_seconds": 200},
        headers=headers["sample"],
    )
    http_client.post(f"/api/v1/sample/versions/{ver}/approve", headers=headers["sample"])
    http_client.post(f"/api/v1/sample/versions/{ver}/approve-owner",
                     json={"agreed_price": 50000}, headers=headers["owner"])
    order = http_client.post(
        f"/api/v1/produksi/orders/from-sample/{ver}",
        json={"order_number": _uid("ORD-INV"), "scheme": "FULL_PACKAGE",
              "target_quantity": 100, "cutting_rate_per_pcs": 500,
              "sewing_rate_per_pcs": 2500},
        headers=headers["owner"],
    ).json()
    for st in ["SEWING", "MENUNGGU_QC", "QC", "COMPLETED"]:
        r = http_client.patch(f"/api/v1/produksi/orders/{order['id']}/status",
                              json={"status": st}, headers=headers["mandor"])
        assert r.status_code == 200, r.text
    return order


class TestInvoiceFlow:
    def test_terbit_approve_bayar_lunas(self, http_client, headers, completed_order):
        inv = http_client.post(
            "/api/v1/finance/invoices",
            json={"invoice_number": _uid("INV"), "order_id": completed_order["id"]},
            headers=headers["finance"],
        )
        assert inv.status_code == 201, inv.text
        body = inv.json()
        assert body["status"] == "DRAFT"
        # Otomatis: 50000 × 100 pcs
        assert float(body["amount_total"]) == 50000.0 * 100

        ap = http_client.post(f"/api/v1/finance/invoices/{body['id']}/approve",
                              headers=headers["owner"])
        assert ap.status_code == 200, ap.text
        assert ap.json()["status"] == "BELUM_BAYAR"

        p1 = http_client.post(f"/api/v1/finance/invoices/{body['id']}/payments",
                              json={"amount": "2000000.00", "notes": "DP 40%"},
                              headers=headers["finance"])
        assert p1.status_code == 201, p1.text
        assert p1.json()["status"] == "SEBAGIAN"

        p2 = http_client.post(f"/api/v1/finance/invoices/{body['id']}/payments",
                              json={"amount": "3000000.00", "notes": "Pelunasan"},
                              headers=headers["finance"])
        assert p2.status_code == 201, p2.text
        assert p2.json()["status"] == "LUNAS"
        assert float(p2.json()["amount_paid"]) == 50000.0 * 100

    def test_invoice_tolak_order_belum_selesai(self, http_client, headers, po_setup):
        res = http_client.post(
            "/api/v1/finance/invoices",
            json={"invoice_number": _uid("INV"), "order_id": po_setup["order_id"],
                  "amount_total": "1000000.00"},
            headers=headers["finance"],
        )
        assert res.status_code == 422

    def test_kelebihan_bayar_ditolak(self, http_client, headers, completed_order):
        inv = http_client.post(
            "/api/v1/finance/invoices",
            json={"invoice_number": _uid("INV"), "order_id": completed_order["id"],
                  "amount_total": "1000000.00"},
            headers=headers["finance"],
        ).json()
        http_client.post(f"/api/v1/finance/invoices/{inv['id']}/approve",
                         headers=headers["owner"])
        res = http_client.post(f"/api/v1/finance/invoices/{inv['id']}/payments",
                               json={"amount": "2000000.00"},
                               headers=headers["finance"])
        assert res.status_code == 422

    def test_mandor_tidak_bisa_approve_invoice(self, http_client, headers, completed_order):
        inv = http_client.post(
            "/api/v1/finance/invoices",
            json={"invoice_number": _uid("INV"), "order_id": completed_order["id"],
                  "amount_total": "500000.00"},
            headers=headers["finance"],
        ).json()
        res = http_client.post(f"/api/v1/finance/invoices/{inv['id']}/approve",
                               headers=headers["mandor"])
        assert res.status_code == 403

    def test_klien_hanya_lihat_invoice_sendiri(self, http_client, headers, completed_order):
        inv = http_client.post(
            "/api/v1/finance/invoices",
            json={"invoice_number": _uid("INV"), "order_id": completed_order["id"],
                  "amount_total": "750000.00"},
            headers=headers["finance"],
        ).json()
        mine = http_client.get("/api/v1/finance/invoices", headers=headers["klien_a"]).json()
        assert any(i["id"] == inv["id"] for i in mine)
        for i in mine:
            assert "amount_total" in i
