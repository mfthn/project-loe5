"""Uji hardening RBAC: endpoint terkunci, isolasi Klien, dan peran massal."""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.main import app
from app.modules.auth.models import Client
from app.modules.gudang.models import InventoryItem
from app.modules.produksi.models import Order


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
        "jahit": _login(http_client, "siti_jahit", "Lukla@Jahit2026"),
        "gudang": _login(http_client, "budi_gudang", "Lukla@Gudang2026"),
        "qc": _login(http_client, "dewi_qc", "Lukla@QC2026"),
        "finance": _login(http_client, "rina_finance", "Lukla@Finance2026"),
        "klien_a": _login(http_client, "klien_a", "klien123"),
    }


def _seed_ids():
    from app.modules.produksi.models import MaklonScheme, OrderComponent, OrderStatus

    db = SessionLocal()
    try:
        klien_a = db.scalar(select(Client).where(Client.company_name.like("%Klien A%")))
        klien_b = db.scalar(select(Client).where(Client.company_name.like("%Klien B%")))
        assert klien_a is not None and klien_b is not None
        order_a = db.scalar(select(Order).where(Order.order_number == "ORD-MAKLON-A-001"))
        if order_a is None:
            order_a = Order(
                client_id=klien_a.id, order_number="ORD-MAKLON-A-001",
                scheme=MaklonScheme.CMT, target_quantity=500, status=OrderStatus.CUTTING,
            )
            db.add(order_a)
        order_b = db.scalar(select(Order).where(Order.order_number == "ORD-MAKLON-B-002"))
        if order_b is None:
            order_b = Order(
                client_id=klien_b.id, order_number="ORD-MAKLON-B-002",
                scheme=MaklonScheme.SEMI_CMT, target_quantity=300, status=OrderStatus.CUTTING,
            )
            db.add(order_b)
        db.commit()
        db.refresh(order_a)
        db.refresh(order_b)
        comp = None
        for o in (order_a, order_b):
            if o.components:
                comp = o.components[0]
                break
        if comp is None:
            comp = db.scalars(select(OrderComponent)).first()
        item = db.scalars(select(InventoryItem)).first()
        if item is None:
            item = InventoryItem(
                client_id=klien_a.id, material_code="KAIN-RBAC-01",
                material_name="Kain Uji RBAC", current_stock=100.0, unit_measure="METER",
            )
            db.add(item)
            db.commit()
        return {
            "order_a": str(order_a.id) if order_a else None,
            "order_b": str(order_b.id) if order_b else None,
            "comp": str(comp.id) if comp else None,
            "item": str(item.id) if item else None,
        }
    finally:
        db.close()


class TestAIAgentLockdown:
    def test_ask_agent_tanpa_token_401(self, http_client):
        res = http_client.post("/api/v1/ai/ask-agent", json={"question": "halo"})
        assert res.status_code in (401, 403)

    def test_ask_agent_klien_ditolak_403(self, http_client, headers):
        res = http_client.post(
            "/api/v1/ai/ask-agent", json={"question": "halo"}, headers=headers["klien_a"]
        )
        assert res.status_code == 403

    def test_reindex_hanya_owner(self, http_client, headers):
        res = http_client.post("/api/v1/ai/reindex", headers=headers["mandor"])
        assert res.status_code == 403

    def test_status_butuh_login(self, http_client):
        res = http_client.get("/api/v1/ai/status")
        assert res.status_code in (401, 403)


class TestMassOrderRoles:
    def test_tim_sample_tidak_bisa_buat_order(self, http_client, headers):
        db = SessionLocal()
        try:
            klien = db.scalar(select(Client).where(Client.company_name.like("%Klien A%")))
            cid = str(klien.id)
        finally:
            db.close()
        res = http_client.post(
            "/api/v1/produksi/orders",
            json={"client_id": cid, "order_number": "ORD-RBAC-X", "scheme": "CMT",
                  "target_quantity": 10, "components": []},
            headers=headers["sample"],
        )
        assert res.status_code == 403

    def test_tim_sample_tidak_bisa_ubah_status(self, http_client, headers):
        ids = _seed_ids()
        res = http_client.patch(
            f"/api/v1/produksi/orders/{ids['order_a']}/status",
            json={"status": "SEWING"},
            headers=headers["sample"],
        )
        assert res.status_code == 403

    def test_mandor_tidak_bisa_hitung_bonus(self, http_client, headers):
        ids = _seed_ids()
        res = http_client.post(
            f"/api/v1/qc/bonus/{ids['order_a']}",
            json={"bonus_rate_per_pcs": "500"},
            headers=headers["mandor"],
        )
        assert res.status_code == 403


class TestOwnerPayrollAccess:
    def test_owner_bisa_preview_tanpa_403(self, http_client, headers):
        res = http_client.post(
            "/api/v1/payroll/preview",
            json={"period_start": "2026-10-05", "period_end": "2026-10-10",
                  "meal_allowance_percentage": "12.00", "qc_bonus_rate_per_pcs": "500.00"},
            headers=headers["owner"],
        )
        assert res.status_code != 403

    def test_mandor_tetap_diblokir_payroll(self, http_client, headers):
        res = http_client.post(
            "/api/v1/payroll/preview",
            json={"period_start": "2026-10-05", "period_end": "2026-10-10"},
            headers=headers["mandor"],
        )
        assert res.status_code == 403


class TestKlienIsolation:
    def test_klien_tidak_bisa_intip_order_lain(self, http_client, headers):
        ids = _seed_ids()
        res = http_client.get(
            f"/api/v1/produksi/orders/{ids['order_b']}", headers=headers["klien_a"]
        )
        assert res.status_code == 404

    def test_klien_tidak_bisa_summary_order_lain(self, http_client, headers):
        ids = _seed_ids()
        res = http_client.get(
            f"/api/v1/produksi/orders/{ids['order_b']}/summary", headers=headers["klien_a"]
        )
        assert res.status_code == 404

    def test_klien_tidak_bisa_summary_qc_lain(self, http_client, headers):
        ids = _seed_ids()
        res = http_client.get(
            f"/api/v1/qc/summary/{ids['order_b']}", headers=headers["klien_a"]
        )
        assert res.status_code == 404


class TestRateCardAndOpname:
    def test_owner_bisa_ubah_rate(self, http_client, headers):
        ids = _seed_ids()
        res = http_client.put(
            f"/api/v1/produksi/components/{ids['comp']}/rate-card",
            json={"cutting_rate_per_pcs": "600.00", "sewing_rate_per_pcs": "2600.00"},
            headers=headers["owner"],
        )
        assert res.status_code == 200, res.text

    def test_qc_tidak_bisa_ubah_rate(self, http_client, headers):
        ids = _seed_ids()
        res = http_client.put(
            f"/api/v1/produksi/components/{ids['comp']}/rate-card",
            json={"cutting_rate_per_pcs": "1.00", "sewing_rate_per_pcs": "1.00"},
            headers=headers["qc"],
        )
        assert res.status_code == 403

    def test_gudang_bisa_opname_penjahit_tidak(self, http_client, headers):
        ids = _seed_ids()
        ok_res = http_client.post(
            "/api/v1/gudang/adjust",
            json={"inventory_item_id": ids["item"], "delta": 1.0,
                  "notes": "Opname rutin shift pagi"},
            headers=headers["gudang"],
        )
        assert ok_res.status_code == 200, ok_res.text
        bad_res = http_client.post(
            "/api/v1/gudang/adjust",
            json={"inventory_item_id": ids["item"], "delta": 1.0,
                  "notes": "Opname rutin shift pagi"},
            headers=headers["jahit"],
        )
        assert bad_res.status_code == 403

    def test_eskalasi_ditolak_untuk_penjahit(self, http_client, headers):
        res = http_client.get("/api/v1/qc/escalations", headers=headers["jahit"])
        assert res.status_code == 403
