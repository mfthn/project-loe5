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
                  "qty_lapis": 20.0, "qty_potong_hasil": 90, "waste_category": "SISA_POTONG",
                  "waste_qty": 3.0, "waste_category": "SCRAP"},
            headers=headers["gudang"],
        )
        assert res.status_code == 201, res.text
        assert res.json()["waste_category"] == "SCRAP"

    def test_kategori_waste_tidak_valid_ditolak(self, http_client, headers, adj_setup):
        res = http_client.post(
            "/api/v1/gudang/cutting",
            json={"order_id": adj_setup["order_id"], "qty_lapis": 5.0,
                  "qty_potong_hasil": 20, "waste_category": "SISA_POTONG", "waste_qty": 1.0, "waste_category": "SAMPAH"},
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


class TestSampleCategoryAutoCode:
    def _login(self, http_client, username, password):
        res = http_client.post("/api/v1/auth/login", json={"username": username, "password": password})
        assert res.status_code == 200, res.text
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    def _client_a(self):
        db = SessionLocal()
        try:
            from app.modules.auth.models import Client as _Client

            return str(db.scalar(select(_Client).where(_Client.company_name.like("%Klien A%"))).id)
        finally:
            db.close()

    def test_buat_sample_tanpa_kode_digenerate(self, http_client):
        sample_h = self._login(http_client, "adis_sample", "Lukla@Sample2026")
        r1 = http_client.post(
            "/api/v1/sample/",
            json={"client_id": self._client_a(), "article_name": "Hoodie Uji",
                  "category": "HOODIE"},
            headers=sample_h,
        )
        assert r1.status_code == 201, r1.text
        body = r1.json()
        code1 = body["sample_code"]
        assert code1.startswith("SMP-HOODIE-")
        assert body["versions"][0]["status"] == "DRAFT"

        r2 = http_client.post(
            "/api/v1/sample/",
            json={"client_id": self._client_a(), "article_name": "Hoodie Uji 2",
                  "category": "HOODIE"},
            headers=sample_h,
        )
        assert r2.status_code == 201, r2.text
        code2 = r2.json()["sample_code"]
        seq1 = int(code1.rsplit("-", 1)[-1])
        seq2 = int(code2.rsplit("-", 1)[-1])
        assert seq2 == seq1 + 1

    def test_kategori_baru_custom_diterima(self, http_client):
        sample_h = self._login(http_client, "adis_sample", "Lukla@Sample2026")
        res = http_client.post(
            "/api/v1/sample/",
            json={"client_id": self._client_a(), "article_name": "Topi Uji",
                  "category": "TOPI"},
            headers=sample_h,
        )
        assert res.status_code == 201, res.text
        assert res.json()["sample_code"].startswith("SMP-TOPI-")

    def test_revisi_tertaut_order(self, http_client):
        sample_h = self._login(http_client, "adis_sample", "Lukla@Sample2026")
        mandor_h = self._login(http_client, "agus_mandor", "Lukla@Mandor2026")
        s = http_client.post(
            "/api/v1/sample/",
            json={"client_id": self._client_a(), "article_name": "Jaket Uji",
                  "category": "JAKET"},
            headers=sample_h,
        ).json()
        order = http_client.post(
            "/api/v1/produksi/orders",
            json={"client_id": self._client_a(), "order_number": f"ORD-REV-{s['sample_code'][-3:]}",
                  "scheme": "CMT", "target_quantity": 50, "components": []},
            headers=mandor_h,
        )
        assert order.status_code == 201, order.text
        rev = http_client.post(
            f"/api/v1/sample/{s['id']}/revisi",
            json={"tech_pack_notes": "Ganti design kerah sesuai pemesan",
                  "order_id": order.json()["id"]},
            headers=sample_h,
        )
        assert rev.status_code == 201, rev.text
        assert rev.json()["order_id"] == order.json()["id"]
        assert rev.json()["status"] == "REVISION"


class TestContractAlignment:
    def test_auth_clients_terdaftar(self, http_client):
        sample_h = _login(http_client, "adis_sample", "Lukla@Sample2026")
        res = http_client.get("/api/v1/auth/clients", headers=sample_h)
        assert res.status_code == 200, res.text
        assert len(res.json()) >= 1

    def test_klien_hanya_lihat_miliknya_di_clients(self, http_client):
        klien = _login(http_client, "klien_a", "klien123")
        res = http_client.get("/api/v1/auth/clients", headers=klien)
        assert res.status_code == 200, res.text
        assert len(res.json()) == 1

    def test_bonus_preview_per_order(self, http_client, headers, adj_setup):
        qc_h = _login(http_client, "dewi_qc", "Lukla@QC2026")
        db = SessionLocal()
        try:
            order = db.scalar(select(Order).where(Order.id == adj_setup["order_id"]))
            order.status = OrderStatus.MENUNGGU_QC
            db.commit()
        finally:
            db.close()
        http_client.post(
            "/api/v1/qc/inspections",
            json={"order_id": adj_setup["order_id"], "qty_inspected": 80, "status": "LOLOS"},
            headers=qc_h,
        )
        res = http_client.get(
            f"/api/v1/qc/bonus-preview?order_id={adj_setup['order_id']}&bonus_rate_per_pcs=150",
            headers=headers["owner"],
        )
        assert res.status_code == 200, res.text
        assert float(res.json()["total_pool"]) == 80 * 150


class TestOrderComponents:
    def test_mandor_tambah_komponen_ke_order(self, http_client, headers, adj_setup):
        res = http_client.post(
            f"/api/v1/produksi/orders/{adj_setup['order_id']}/components",
            json={"component_name": "Lengan", "sequence_order": 1,
                  "cutting_rate_per_pcs": "400.00", "sewing_rate_per_pcs": "1800.00"},
            headers=headers["mandor"],
        )
        assert res.status_code == 201, res.text
        comps = res.json()["components"]
        assert any(c["component_name"] == "Lengan" for c in comps)
        lengan = next(c for c in comps if c["component_name"] == "Lengan")
        assert float(lengan["rate_card"]["sewing_rate_per_pcs"]) == 1800.0

    def test_penjahit_diblokir_tambah_komponen(self, http_client, headers, adj_setup):
        jahit = _login(http_client, "siti_jahit", "Lukla@Jahit2026")
        res = http_client.post(
            f"/api/v1/produksi/orders/{adj_setup['order_id']}/components",
            json={"component_name": "X", "cutting_rate_per_pcs": "1.00",
                  "sewing_rate_per_pcs": "1.00"},
            headers=jahit,
        )
        assert res.status_code == 403


class TestDesignImage:
    def _login(self, http_client, username, password):
        res = http_client.post("/api/v1/auth/login", json={"username": username, "password": password})
        assert res.status_code == 200, res.text
        return {"Authorization": f"Bearer {res.json()['access_token']}"}

    def _client_a(self):
        db = SessionLocal()
        try:
            from app.modules.auth.models import Client as _Client

            return str(db.scalar(select(_Client).where(_Client.company_name.like("%Klien A%"))).id)
        finally:
            db.close()

    def test_upload_tolak_bukan_gambar(self, http_client):
        from unittest.mock import MagicMock, patch

        sample_h = self._login(http_client, "adis_sample", "Lukla@Sample2026")
        s = http_client.post(
            "/api/v1/sample/",
            json={"client_id": self._client_a(), "article_name": "Tas Uji",
                  "category": "TAS"},
            headers=sample_h,
        ).json()
        ver = s["versions"][0]["id"]
        with patch("boto3.client") as mock_boto:
            mock_boto.return_value.put_object.return_value = {}
            res = http_client.post(
                f"/api/v1/sample/versions/{ver}/design-image",
                files={"file": ("notes.txt", b"hello", "text/plain")},
                headers=sample_h,
            )
        assert res.status_code in (400, 422), res.text

    def test_upload_gambar_ok_dan_masuk_detail(self, http_client):
        from unittest.mock import MagicMock, patch

        sample_h = self._login(http_client, "adis_sample", "Lukla@Sample2026")
        s = http_client.post(
            "/api/v1/sample/",
            json={"client_id": self._client_a(), "article_name": "Tas Uji 2",
                  "category": "TAS"},
            headers=sample_h,
        ).json()
        ver = s["versions"][0]["id"]
        tiny_png = (
            b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
            b"\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00"
            b"\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82"
        )
        with patch("boto3.client") as mock_boto:
            mock_boto.return_value.put_object.return_value = {}
            mock_boto.return_value.generate_presigned_url.return_value = "https://cdn/contoh.png"
            res = http_client.post(
                f"/api/v1/sample/versions/{ver}/design-image",
                files={"file": ("design.png", tiny_png, "image/png")},
                headers=sample_h,
            )
        assert res.status_code == 201, res.text
        assert res.json()["design_image_url"] == "https://cdn/contoh.png"
