"""Matriks RBAC menyeluruh: setiap peran × setiap aksi tulis.

Prinsip UI: tombol hanya tampil bila endpoint mengizinkan (tidak ada lagi 403 mengejutkan).
Tes ini mengunci matriks — gagal bila ada endpoint bocor ke peran yang salah.
"""
import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app

OID = str(uuid.uuid4())

CREDS = {
    "OWNER": ("hendra_owner", "Lukla@Owner2026"),
    "TIM_SAMPLE": ("adis_sample", "Lukla@Sample2026"),
    "GUDANG": ("budi_gudang", "Lukla@Gudang2026"),
    "MANDOR": ("agus_mandor", "Lukla@Mandor2026"),
    "PENJAHIT": ("siti_jahit", "Lukla@Jahit2026"),
    "QC": ("dewi_qc", "Lukla@QC2026"),
    "FINANCE": ("rina_finance", "Lukla@Finance2026"),
}


@pytest.fixture(scope="module")
def http_client():
    return TestClient(app)


@pytest.fixture(scope="module")
def H(http_client):
    out = {}
    for role, (u, p) in CREDS.items():
        res = http_client.post("/api/v1/auth/login", json={"username": u, "password": p})
        assert res.status_code == 200, (role, res.text)
        out[role] = {"Authorization": f"Bearer {res.json()['access_token']}"}
    return out


# (method, path, body, peran_dibolehkan)
MATRIX = [
    # Gudang
    ("POST", "/gudang/items", {"client_id": OID, "material_code": "X", "material_name": "X", "order_id": OID}, {"GUDANG"}),
    ("POST", "/gudang/receive", {"inventory_item_id": OID, "quantity": 1}, {"GUDANG"}),
    ("POST", "/gudang/issue", {"inventory_item_id": OID, "order_id": OID, "quantity": 1}, {"GUDANG", "MANDOR"}),
    ("POST", "/gudang/adjust", {"inventory_item_id": OID, "delta": 1, "notes": "uji"}, {"GUDANG"}),
    ("POST", "/gudang/requests", {"order_id": OID, "inventory_item_id": OID, "qty_requested": 1}, {"MANDOR"}),
    ("POST", "/gudang/handovers", {"order_id": OID, "inventory_item_id": OID, "quantity": 1}, {"GUDANG"}),
    ("POST", "/gudang/cutting", {"order_id": OID, "qty_lapis": 1, "qty_potong_hasil": 1, "waste_category": "SCRAP"}, {"GUDANG", "MANDOR"}),
    # Produksi
    ("POST", "/produksi/orders", {"client_id": OID, "order_number": "X", "scheme": "CMT", "target_quantity": 1}, {"OWNER", "MANDOR"}),
    ("POST", "/produksi/outputs", {"order_id": OID, "order_component_id": OID, "line_number": 1, "qty_completed": 1, "time_window": "2026-10-16T08:00:00+00:00"}, {"PENJAHIT", "MANDOR"}),
    ("POST", "/produksi/orders/{OID}/components".replace("{OID}", OID), {"component_name": "X", "cutting_rate_per_pcs": "1", "sewing_rate_per_pcs": "1"}, {"OWNER", "MANDOR"}),
    # Sample
    ("POST", "/sample/", {"client_id": OID, "article_name": "X", "category": "TAS"}, {"TIM_SAMPLE", "OWNER", "MANDOR"}),
    # QC
    ("POST", "/qc/inspections", {"order_id": OID, "qty_inspected": 1, "status": "LOLOS"}, {"QC"}),
    ("POST", "/qc/bonus/" + OID, {"bonus_rate_per_pcs": "100"}, {"OWNER", "FINANCE"}),
    # Payroll
    ("POST", "/payroll/preview", {"period_start": "2026-10-12", "period_end": "2026-10-17"}, {"FINANCE", "OWNER"}),
    ("POST", "/payroll/financials", {"order_id": OID, "contract_revenue": "1", "material_cost": "1", "overhead_cost": "1"}, {"FINANCE", "OWNER"}),
    # Finance
    ("POST", "/finance/pos", {"po_number": "X", "order_id": OID, "supplier_name": "X", "lines": []}, {"TIM_SAMPLE", "FINANCE", "OWNER", "GUDANG"}),
    ("POST", "/finance/invoices", {"invoice_number": "X", "order_id": OID}, {"FINANCE"}),
    # Auth/users
    ("GET", "/auth/users", None, {"OWNER"}),
    ("POST", "/auth/users", {"username": "x", "password": "Rahasia123", "name": "X", "role": "PENJAHIT"}, {"OWNER"}),
]


@pytest.mark.parametrize("case", range(len(MATRIX)))
def test_matrix(http_client, H, case):
    method, path, body, allowed = MATRIX[case]
    for role, headers in H.items():
        kwargs = {"headers": headers}
        if body is not None:
            kwargs["json"] = body
        res = http_client.request(method, f"/api/v1{path}", **kwargs)
        if role in allowed:
            # Boleh: bukan 403 (bisa 200/201/400/404/409/422 karena data dummy)
            assert res.status_code != 403, (method, path, role, res.text)
            assert res.status_code != 401, (method, path, role)
        else:
            assert res.status_code == 403, (method, path, role, res.status_code)
