"""Verifikasi alur bisnis 10 pesanan demo via HTTP API. Laporkan per order per tahap."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from fastapi.testclient import TestClient

from app.main import app

c = TestClient(app)
report = []


def check(order, tahap, ok, detail=""):
    report.append((order, tahap, "OK" if ok else "GAGAL", detail))
    return ok


def login(u, p):
    r = c.post("/api/v1/auth/login", json={"username": u, "password": p})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


H = {
    "owner": login("hendra_owner", "Lukla@Owner2026"),
    "mandor": login("agus_mandor", "Lukla@Mandor2026"),
    "gudang": login("budi_gudang", "Lukla@Gudang2026"),
    "jahit": login("siti_jahit", "Lukla@Jahit2026"),
    "qc": login("dewi_qc", "Lukla@QC2026"),
    "finance": login("rina_finance", "Lukla@Finance2026"),
    "sample": login("adis_sample", "Lukla@Sample2026"),
}

orders = {o["order_number"]: o for o in c.get("/api/v1/produksi/orders", headers=H["owner"]).json()}
check("-", "10 order terbaca owner", len(orders) == 10, f"ketemu {len(orders)}")

# O7 SAMPLE baru: majukan ke CUTTING (mandor)
o7 = orders["ORD-DEMO-07"]
r = c.patch(f"/api/v1/produksi/orders/{o7['id']}/status", json={"status": "CUTTING"}, headers=H["mandor"])
check("ORD-DEMO-07", "SAMPLE→CUTTING via API", r.status_code == 200, r.text[:80])
# kembalikan ke SAMPLE agar peta 10 tahap tetap
from app.core.database import SessionLocal
from sqlalchemy import select
from app.modules.produksi.models import Order, OrderStatus
db = SessionLocal()
o = db.scalar(select(Order).where(Order.order_number == "ORD-DEMO-07"))
o.status = OrderStatus.SAMPLE
db.commit()
db.close()

# O6 CUTTING + PO partial: terima sisa via API (gudang menunjuk PO)
o6 = orders["ORD-DEMO-06"]
pos = [p for p in c.get("/api/v1/finance/pos", headers=H["gudang"]).json() if p["order_id"] == o6["id"]]
po = pos[0]
item_id = po["lines"][0]["inventory_item_id"]
sisa = po["lines"][0]["qty_ordered"] - po["lines"][0]["qty_received"]
r = c.post("/api/v1/gudang/receive",
           json={"inventory_item_id": item_id, "quantity": sisa, "order_id": o6["id"], "po_id": po["id"]},
           headers=H["gudang"])
check("ORD-DEMO-06", f"terima sisa {sisa} via API→SELESAI", r.status_code == 200, r.text[:80])
po2 = [p for p in c.get("/api/v1/finance/pos", headers=H["gudang"]).json() if p["id"] == po["id"]][0]
check("ORD-DEMO-06", "PO otomatis SELESAI", po2["status"] == "SELESAI", po2["status"])

# O4 SEWING: catat output (jahit) + verifikasi (mandor)
o4 = orders["ORD-DEMO-04"]
comp = o4["components"][0]["id"]
r = c.post("/api/v1/produksi/outputs",
           json={"order_id": o4["id"], "order_component_id": comp, "line_number": 2,
                 "qty_completed": 20, "time_window": "2026-10-16T08:00:00+00:00"},
           headers=H["jahit"])
check("ORD-DEMO-04", "catat output penjahit", r.status_code == 201, r.text[:80])
if r.status_code == 201:
    oid = r.json()["id"]
    v = c.patch(f"/api/v1/produksi/outputs/{oid}/verify", json={"is_verified": True}, headers=H["mandor"])
    check("ORD-DEMO-04", "verifikasi mandor", v.status_code == 200, v.text[:80])

# O8 MENUNGGU_QC: inspeksi QC via API
o8 = orders["ORD-DEMO-08"]
r = c.post("/api/v1/qc/inspections",
           json={"order_id": o8["id"], "qty_inspected": 40, "status": "LOLOS"},
           headers=H["qc"])
check("ORD-DEMO-08", "inspeksi QC LOLOS", r.status_code == 201, r.text[:80])

# O2 COMPLETED: invoice BELUM_BAYAR terlihat + bayar sebagian via API
inv = [i for i in c.get("/api/v1/finance/invoices", headers=H["finance"]).json()
       if i["order_id"] == orders["ORD-DEMO-02"]["id"]][0]
check("ORD-DEMO-02", "invoice BELUM_BAYAR", inv["status"] == "BELUM_BAYAR", inv["invoice_number"])
r = c.post(f"/api/v1/finance/invoices/{inv['id']}/payments",
           json={"amount": "2000000.00", "notes": "Verifikasi alur"},
           headers=H["finance"])
check("ORD-DEMO-02", "bayar bertahap→SEBAGIAN", r.status_code == 201 and r.json()["status"] == "SEBAGIAN", r.text[:80])

# O5 CUTTING: handover pending → mandor terima via API
hos = [h for h in c.get("/api/v1/gudang/handovers", headers=H["mandor"]).json()
       if h["order_id"] == orders["ORD-DEMO-05"]["id"] and not h["received_at"]]
if hos:
    r = c.post(f"/api/v1/gudang/handovers/{hos[0]['id']}/receive", headers=H["mandor"])
    check("ORD-DEMO-05", "serah terima→SEWING", r.status_code == 200, r.text[:80])
    # kembalikan ke CUTTING + batal terima agar peta tahap tetap
    db = SessionLocal()
    o = db.scalar(select(Order).where(Order.order_number == "ORD-DEMO-05"))
    o.status = OrderStatus.CUTTING
    from app.modules.gudang.models import MaterialHandover
    h = db.scalar(select(MaterialHandover).where(MaterialHandover.id == hos[0]["id"]))
    h.received_at = None
    h.received_by_user_id = None
    db.commit()
    db.close()
else:
    check("ORD-DEMO-05", "handover pending ada", False, "tidak ketemu")

# Payroll preview minggu berjalan (butuh output terverifikasi minggu ini)
import datetime
today = datetime.date.today()
monday = today - datetime.timedelta(days=today.weekday())
saturday = monday + datetime.timedelta(days=5)
r = c.post("/api/v1/payroll/preview",
           json={"period_start": monday.isoformat(), "period_end": saturday.isoformat()},
           headers=H["finance"])
check("-", "payroll preview minggu ini", r.status_code == 200,
      r.text[:100] if r.status_code != 200 else f"{r.json()['total_penjahit']} penjahit")

# Klien isolasi: klien_a hanya lihat miliknya
ka = login("klien_a", "klien123")
mine = c.get("/api/v1/produksi/orders", headers=ka).json()
others = [o for o in mine if o["order_number"] in ("ORD-DEMO-02", "ORD-DEMO-04", "ORD-DEMO-06", "ORD-DEMO-10")]
check("-", "isolasi klien (B tak terlihat A)", len(others) == 0, f"bocor {len(others)}")

# AI agent konteks (tanpa LLM): build_db_context bersih
from app.modules.ai.db_context import build_db_context
db = SessionLocal()
ctx = build_db_context(db)
db.close()
check("-", "konteks AI bersih error", "Error mengambil data" not in ctx, f"{len(ctx)} chars")

print(f"\n{'ORDER':<14}{'TAHAP':<38}{'HASIL':<7}DETAIL")
fails = 0
for order, tahap, hasil, detail in report:
    if hasil == "GAGAL":
        fails += 1
    print(f"{order:<14}{tahap:<38}{hasil:<7}{detail}")
print(f"\n{fails} GAGAL dari {len(report)} cek")
