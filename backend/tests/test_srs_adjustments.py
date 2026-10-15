"""Pengujian penyesuaian SRS: waste berkategori, riwayat rate, assembly, rute QC, overhead/unit."""
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.main import app
from app.modules.auth.models import Client
from app.modules.gudang.models import InventoryItem
from app.modules.produksi.models import MaklonScheme, Order, OrderComponent, OrderStatus, ProductionOutput, RateCard


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
        "qc": _login(http_client, "dewi_qc", "Lukla@QC2026"),
    }


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:6].upper()}"


@pytest.fixture
def adj_setup():
    db = SessionLocal()
    try:
        klien = db.scalar(select(Client).where(Client.company_name.like("%Klien A%")))
        order = Order(
            client_id=klien.id, order_number=_uid("ORD-ADJ"), scheme=MaklonScheme.CMT,
            target_quantity=200, status=OrderStatus.CUTTING,
        )
        db.add(order)
        db.flush()
        item = InventoryItem(
            client_id=klien.id, material_code=_uid("KAIN-ADJ"), material_name="Kain Adj Uji",
            current_stock=500.0, unit_measure="METER",
        )
        db.add(item)
        db.commit()
        return {"order_id": str(order.id), "item_id": str(item.id)}
    finally:
        db.close()


class TestWasteCategory:
    def test_cutting_dengan_kategori_scrap(self, http_client, headers, adj_setup):
        res = http_client.post(
            "/api/v1/gudang/cutting",
            json={"order_id": adj_setup["order_id"], "inventory_item_id": adj_setup["item_id"],
                  "qty_lapis": 20.0, "qty_potong_hasil": 90,
                  "waste_qty": 3.0, "waste_category": "SCRAP"},
            headers=headers["gudang"],
        )
        assert res.status_code == 201, res.text
        assert res.json()["waste_category"] == "SCRAP"

    def test_kategori_waste_tidak_valid_ditolak(self, http_client, headers, adj_setup):
        res = http_client.post(
            "/api/v1/gudang/cutting",
            json={"order_id": adj_setup["order_id"], "qty_lapis": 5.0,
                  "qty_potong_hasil": 20, "waste_qty": 1.0, "waste_category": "SAMPAH"},
            headers=headers["gudang"],
        )
        assert res.status_code == 422


class TestRateHistory:
    def test_perubahan_rate_tercatat(self, http_client, headers, adj_setup):
        db = SessionLocal()
        try:
            comp = OrderComponent(order_id=uuid.UUID(adj_setup["order_id"]),
                                  component_name="Badan", sequence_order=1)
            db.add(comp)
            db.flush()
            db.add(RateCard(order_component_id=comp.id, cutting_rate_per_pcs=500,
                            sewing_rate_per_pcs=2500))
            db.commit()
            comp_id = str(comp.id)
        finally:
            db.close()
        r1 = http_client.put(
            f"/api/v1/produksi/components/{comp_id}/rate-card",
            json={"cutting_rate_per_pcs": "600.00", "sewing_rate_per_pcs": "2700.00"},
            headers=headers["owner"],
        )
        assert r1.status_code == 200, r1.text
        hist = http_client.get(
            f"/api/v1/produksi/components/{comp_id}/rate-history",
            headers=headers["owner"],
        )
        assert hist.status_code == 200, hist.text
        assert len(hist.json()) >= 1
        assert hist.json()[0]["new_sewing_rate"] == 2700.0


class TestAssembly:
    def _to_sewing_with_output(self, http_client, headers, setup):
        db = SessionLocal()
        try:
            order = db.scalar(select(Order).where(Order.id == setup["order_id"]))
            order.status = OrderStatus.SEWING
            comp = OrderComponent(order_id=order.id, component_name="Badan", sequence_order=1)
            db.add(comp)
            db.flush()
            db.add(RateCard(order_component_id=comp.id, cutting_rate_per_pcs=500,
                            sewing_rate_per_pcs=2500))
            db.commit()
            comp_id, sewer = str(comp.id), None
            from app.modules.auth.models import User

            sewer = db.scalar(select(User).where(User.username == "siti_jahit"))
            assert sewer is not None
            db.add(ProductionOutput(
                order_id=order.id, order_component_id=comp.id,
                operator_user_id=sewer.id, line_number=1,
                qty_completed=120, is_verified=True,
                time_window=__import__("datetime").datetime.now(__import__("datetime").timezone.utc),
            ))
            db.commit()
        finally:
            db.close()
        return comp_id

    def test_rakit_majukan_ke_menunggu_qc(self, http_client, headers, adj_setup):
        self._to_sewing_with_output(http_client, headers, adj_setup)
        res = http_client.post(
            f"/api/v1/produksi/orders/{adj_setup['order_id']}/assemble",
            json={"qty_assembled": 100, "notes": "Batch 1 utuh"},
            headers=headers["mandor"],
        )
        assert res.status_code == 201, res.text
        assert res.json()["qty_assembled"] == 100
        db = SessionLocal()
        try:
            order = db.scalar(select(Order).where(Order.id == adj_setup["order_id"]))
            assert order.status == OrderStatus.MENUNGGU_QC
        finally:
            db.close()

    def test_rakit_melebihi_verified_ditolak(self, http_client, headers, adj_setup):
        self._to_sewing_with_output(http_client, headers, adj_setup)
        res = http_client.post(
            f"/api/v1/produksi/orders/{adj_setup['order_id']}/assemble",
            json={"qty_assembled": 99999},
            headers=headers["mandor"],
        )
        assert res.status_code in (400, 422)


class TestQCRoute:
    def test_lolos_rute_gudang_barang_jadi(self, http_client, headers, adj_setup):
        db = SessionLocal()
        try:
            order = db.scalar(select(Order).where(Order.id == adj_setup["order_id"]))
            order.status = OrderStatus.MENUNGGU_QC
            db.commit()
        finally:
            db.close()
        res = http_client.post(
            "/api/v1/qc/inspections",
            json={"order_id": adj_setup["order_id"], "qty_inspected": 50, "status": "LOLOS"},
            headers=headers["qc"],
        )
        assert res.status_code == 201, res.text
        assert res.json()["action_route"] == "GUDANG_BARANG_JADI"


class TestOverheadPerUnit:
    def test_monthly_summary_ada_overhead_per_unit(self, http_client, headers):
        import datetime

        now = datetime.datetime.now()
        res = http_client.get(
            f"/api/v1/payroll/monthly-summary?year={now.year}&month={now.month}",
            headers=headers["finance"],
        )
        assert res.status_code == 200, res.text
        assert "overhead_per_unit" in res.json()


class TestLeaderboard:
    def test_owner_lihat_peringkat_penjahit(self, http_client, headers, adj_setup):
        db = SessionLocal()
        try:
            order = db.scalar(select(Order).where(Order.id == adj_setup["order_id"]))
            order.status = OrderStatus.SEWING
            comp = OrderComponent(order_id=order.id, component_name="Badan", sequence_order=1)
            db.add(comp)
            db.flush()
            db.add(RateCard(order_component_id=comp.id, cutting_rate_per_pcs=500,
                            sewing_rate_per_pcs=2500))
            db.commit()
            comp_id = str(comp.id)
        finally:
            db.close()
        jahit = _login(http_client, "siti_jahit", "Lukla@Jahit2026")
        out = http_client.post(
            "/api/v1/produksi/outputs",
            json={"order_id": adj_setup["order_id"], "order_component_id": comp_id,
                  "line_number": 2, "qty_completed": 60,
                  "time_window": "2026-10-15T08:00:00+00:00"},
            headers=jahit,
        )
        assert out.status_code == 201, out.text
        http_client.patch(f"/api/v1/produksi/outputs/{out.json()['id']}/verify",
                          json={"is_verified": True}, headers=headers["mandor"])
        res = http_client.get("/api/v1/produksi/leaderboard", headers=headers["owner"])
        assert res.status_code == 200, res.text
        names = [e["name"] for e in res.json()]
        assert any("Siti" in n for n in names)
        entry = next(e for e in res.json() if "Siti" in e["name"])
        assert entry["verified_qty"] >= 60

    def test_penjahit_diblokir_leaderboard(self, http_client, headers):
        jahit = _login(http_client, "siti_jahit", "Lukla@Jahit2026")
        res = http_client.get("/api/v1/produksi/leaderboard", headers=jahit)
        assert res.status_code == 403
