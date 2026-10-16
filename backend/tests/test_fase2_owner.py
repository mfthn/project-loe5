"""Fase 2: harga jual per order, manajemen akun owner, view-only owner."""
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.core.database import SessionLocal
from app.main import app
from app.modules.auth.models import Client
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
        "gudang": _login(http_client, "budi_gudang", "Lukla@Gudang2026"),
        "qc": _login(http_client, "dewi_qc", "Lukla@QC2026"),
        "finance": _login(http_client, "rina_finance", "Lukla@Finance2026"),
        "jahit": _login(http_client, "siti_jahit", "Lukla@Jahit2026"),
    }


def _uid(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:6].upper()}"


@pytest.fixture
def order_id(http_client, headers):
    db = SessionLocal()
    try:
        klien = db.scalar(select(Client).where(Client.company_name.like("%Klien A%")))
        cid = str(klien.id)
    finally:
        db.close()
    res = http_client.post(
        "/api/v1/produksi/orders",
        json={"client_id": cid, "order_number": _uid("ORD-JUAL"),
              "scheme": "CMT", "target_quantity": 100, "components": []},
        headers=headers["mandor"],
    )
    assert res.status_code == 201, res.text
    return res.json()["id"]


class TestSellingPrice:
    def test_sample_usul_owner_setuju(self, http_client, headers, order_id):
        p = http_client.post(
            f"/api/v1/produksi/orders/{order_id}/selling-price",
            json={"selling_price": "5500000.00"},
            headers=headers["sample"],
        )
        assert p.status_code == 200, p.text
        assert p.json()["selling_price_status"] == "DIAJUKAN"

        a = http_client.post(
            f"/api/v1/produksi/orders/{order_id}/selling-price/review",
            json={"approve": True},
            headers=headers["owner"],
        )
        assert a.status_code == 200, a.text
        assert a.json()["selling_price_status"] == "DISETUJUI"
        assert float(a.json()["selling_price"]) == 5500000.0

    def test_mandor_tidak_bisa_approve_jual(self, http_client, headers, order_id):
        http_client.post(
            f"/api/v1/produksi/orders/{order_id}/selling-price",
            json={"selling_price": "1000000.00"},
            headers=headers["sample"],
        )
        res = http_client.post(
            f"/api/v1/produksi/orders/{order_id}/selling-price/review",
            json={"approve": True},
            headers=headers["mandor"],
        )
        assert res.status_code == 403

    def test_harga_nol_ditolak(self, http_client, headers, order_id):
        res = http_client.post(
            f"/api/v1/produksi/orders/{order_id}/selling-price",
            json={"selling_price": "0"},
            headers=headers["sample"],
        )
        assert res.status_code in (400, 422)


class TestUserManagement:
    def test_owner_crud_akun(self, http_client, headers):
        uname = _uid("pekerja").lower()
        c = http_client.post(
            "/api/v1/auth/users",
            json={"username": uname, "password": "Rahasia123", "name": "Pekerja Uji",
                  "role": "PENJAHIT"},
            headers=headers["owner"],
        )
        assert c.status_code == 201, c.text
        uid = c.json()["id"]

        lst = http_client.get("/api/v1/auth/users", headers=headers["owner"])
        assert lst.status_code == 200
        assert any(u["id"] == uid for u in lst.json())

        up = http_client.patch(
            f"/api/v1/auth/users/{uid}",
            json={"name": "Pekerja Uji Revisi", "is_active": False},
            headers=headers["owner"],
        )
        assert up.status_code == 200, up.text
        assert up.json()["name"] == "Pekerja Uji Revisi"
        assert up.json()["is_active"] is False

        up2 = http_client.patch(
            f"/api/v1/auth/users/{uid}", json={"is_active": True}, headers=headers["owner"]
        )
        assert up2.status_code == 200

        d = http_client.delete(f"/api/v1/auth/users/{uid}", headers=headers["owner"])
        assert d.status_code == 204, d.text

    def test_duplikat_username_ditolak(self, http_client, headers):
        res = http_client.post(
            "/api/v1/auth/users",
            json={"username": "siti_jahit", "password": "Rahasia123",
                  "name": "Duplikat", "role": "PENJAHIT"},
            headers=headers["owner"],
        )
        assert res.status_code == 409

    def test_mandor_diblokir_kelola_akun(self, http_client, headers):
        res = http_client.get("/api/v1/auth/users", headers=headers["mandor"])
        assert res.status_code == 403

    def test_hapus_akun_berriwayat_ditolak(self, http_client, headers):
        db = SessionLocal()
        try:
            from app.modules.auth.models import User

            siti = db.scalar(select(User).where(User.username == "siti_jahit"))
            uid = str(siti.id)
        finally:
            db.close()
        res = http_client.delete(f"/api/v1/auth/users/{uid}", headers=headers["owner"])
        assert res.status_code == 409


class TestOwnerViewOnly:
    def test_owner_tidak_bisa_receive(self, http_client, headers):
        db = SessionLocal()
        try:
            from app.modules.gudang.models import InventoryItem

            item = db.scalars(select(InventoryItem)).first()
            iid = str(item.id)
        finally:
            db.close()
        res = http_client.post(
            "/api/v1/gudang/receive",
            json={"inventory_item_id": iid, "quantity": 1.0},
            headers=headers["owner"],
        )
        assert res.status_code == 403

    def test_owner_tidak_bisa_issue(self, http_client, headers, order_id):
        db = SessionLocal()
        try:
            from app.modules.gudang.models import InventoryItem

            item = db.scalars(select(InventoryItem)).first()
            iid = str(item.id)
        finally:
            db.close()
        res = http_client.post(
            "/api/v1/gudang/issue",
            json={"inventory_item_id": iid, "order_id": order_id, "quantity": 1.0},
            headers=headers["owner"],
        )
        assert res.status_code == 403

    def test_owner_tidak_bisa_inspeksi_qc(self, http_client, headers, order_id):
        db = SessionLocal()
        try:
            o = db.scalar(select(Order).where(Order.id == order_id))
            from app.modules.produksi.models import OrderStatus

            o.status = OrderStatus.MENUNGGU_QC
            db.commit()
        finally:
            db.close()
        res = http_client.post(
            "/api/v1/qc/inspections",
            json={"order_id": order_id, "qty_inspected": 5, "status": "LOLOS"},
            headers=headers["owner"],
        )
        assert res.status_code == 403


class TestPayrollAdjustment:
    def _make_run(self, http_client, headers):
        from datetime import datetime, timezone

        # Pastikan order dummy ada (test dapat jalan berulang setelah cleanup+seed)
        db = SessionLocal()
        try:
            order = db.scalar(select(Order).where(Order.order_number == "ORD-DUMMY-03"))
            assert order is not None
        finally:
            db.close()
        # Pilih pekan kosong pertama (Senin–Sabtu) agar dapat diulang
        from datetime import date as _date, timedelta as _td

        existing = http_client.get("/api/v1/payroll/runs", headers=headers["finance"]).json()
        taken = {(r["period_start"][:10], r["period_end"][:10]) for r in existing}
        run = None
        base = _date(2026, 10, 12)
        for week in range(0, 52):
            monday_d = base + _td(days=7 * week)
            saturday_d = monday_d + _td(days=5)
            monday, saturday = monday_d.isoformat(), saturday_d.isoformat()
            if (monday, saturday) in taken:
                continue
            ts = datetime.combine(monday_d + _td(days=2), datetime.min.time(),
                                  tzinfo=timezone.utc)
            db2 = SessionLocal()
            try:
                from app.modules.auth.models import User as _User
                from app.modules.produksi.models import OrderComponent as _Comp
                from app.modules.produksi.models import ProductionOutput as _Out

                _order = db2.scalar(select(Order).where(Order.order_number == "ORD-DUMMY-03"))
                _comp = db2.scalars(
                    select(_Comp).where(_Comp.order_id == _order.id)).first()
                _siti = db2.scalar(select(_User).where(_User.username == "siti_jahit"))
                _exists = db2.scalar(select(_Out).where(
                    _Out.order_id == _order.id, _Out.time_window == ts))
                if _exists is None:
                    db2.add(_Out(
                        order_id=_order.id, order_component_id=_comp.id,
                        operator_user_id=_siti.id, line_number=1, qty_completed=40,
                        is_verified=True, time_window=ts,
                    ))
                    db2.commit()
            finally:
                db2.close()
            preview = http_client.post(
                "/api/v1/payroll/preview",
                json={"period_start": monday, "period_end": saturday},
                headers=headers["finance"],
            )
            if preview.status_code != 200:
                continue
            attempt = http_client.post(
                "/api/v1/payroll/runs",
                json={"period_start": monday, "period_end": saturday},
                headers=headers["finance"],
            )
            if attempt.status_code == 201:
                run = attempt.json()
                break
        assert run is not None, "tidak ada pekan kosong untuk run uji"
        return run

    def test_koreksi_ubah_net_dan_terkunci_ditolak(self, http_client, headers):
        run = self._make_run(http_client, headers)
        detail = run["details"][0]
        base_net = float(detail["net_salary"])
        adj = http_client.patch(
            f"/api/v1/payroll/runs/{run['id']}/details/{detail['id']}/adjustment",
            json={"manual_adjustment": "25000.00"},
            headers=headers["finance"],
        )
        assert adj.status_code == 200, adj.text
        assert float(adj.json()["net_salary"]) == base_net + 25000.0
        assert float(adj.json()["manual_adjustment"]) == 25000.0

        lock = http_client.post(
            f"/api/v1/payroll/runs/{run['id']}/finance-review",
            json={"available_funds": "999999999.00"},
            headers=headers["finance"],
        )
        assert lock.status_code == 200, lock.text
        assert lock.json()["is_locked"] is True

        again = http_client.patch(
            f"/api/v1/payroll/runs/{run['id']}/details/{detail['id']}/adjustment",
            json={"manual_adjustment": "1.00"},
            headers=headers["finance"],
        )
        assert again.status_code == 409


class TestOverheadBulanan:
    def test_catat_masuk_ringkasan_per_unit(self, http_client, headers):
        import datetime

        now = datetime.datetime.now()
        c = http_client.post(
            "/api/v1/payroll/overhead",
            json={"year": now.year, "month": now.month, "category": "Listrik",
                  "amount": "1500000.00", "notes": "Uji"},
            headers=headers["finance"],
        )
        assert c.status_code == 201, c.text
        exp_id = c.json()["id"]

        lst = http_client.get(
            f"/api/v1/payroll/overhead?year={now.year}&month={now.month}",
            headers=headers["finance"],
        )
        assert lst.status_code == 200
        assert any(e["id"] == exp_id for e in lst.json())

        summary = http_client.get(
            f"/api/v1/payroll/monthly-summary?year={now.year}&month={now.month}",
            headers=headers["finance"],
        )
        assert summary.status_code == 200, summary.text
        assert float(summary.json()["overhead_cost"]) >= 1500000.0

        denied = http_client.post(
            "/api/v1/payroll/overhead",
            json={"year": now.year, "month": now.month, "category": "Air",
                  "amount": "100.00"},
            headers=headers["jahit"],
        )
        assert denied.status_code == 403

        d = http_client.delete(f"/api/v1/payroll/overhead/{exp_id}",
                               headers=headers["finance"])
        assert d.status_code == 204, d.text
