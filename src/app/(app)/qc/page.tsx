import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Notice } from "@/components/Notice";
import { tanggalJam } from "@/lib/format";
import { recordQcAction } from "./actions";

const STATUS_LABEL: Record<string, string> = { LOLOS: "Lolos", REPAIR: "Repair", DEFECT: "Defect" };

export default async function QcPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireUser("qc");
  const sp = await searchParams;

  const [orders, records] = await Promise.all([
    db.productionOrder.findMany({ include: { client: true }, orderBy: { createdAt: "desc" } }),
    db.qcRecord.findMany({
      include: { order: true, inspector: true },
      orderBy: { checkedAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div>
      <h1>QC & Barang Jadi</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Setiap pemeriksaan dicatat sebagai riwayat yang tidak bisa diubah. Pcs LOLOS masuk ke pool bonus QC.
      </p>
      <Notice ok={sp.ok} error={sp.error} />

      <section className="card">
        <h2>Catat hasil pemeriksaan</h2>
        <form action={recordQcAction} className="form-grid">
          <label>Pesanan
            <select name="orderId" required defaultValue="">
              <option value="" disabled>Pilih pesanan</option>
              {orders.map((o) => <option key={o.id} value={o.id}>{o.code} · {o.client.name}</option>)}
            </select>
          </label>
          <label>Komponen<input name="component" required /></label>
          <label>Jumlah pcs<input name="qty" type="number" min="1" required /></label>
          <label>Status
            <select name="status" defaultValue="LOLOS">
              <option value="LOLOS">Lolos</option>
              <option value="REPAIR">Repair</option>
              <option value="DEFECT">Defect</option>
            </select>
          </label>
          <label>Kategori cacat (jika repair/defect)
            <select name="defectCategory" defaultValue="">
              <option value="">-</option>
              <option value="Jahitan">Jahitan</option>
              <option value="Noda">Noda</option>
              <option value="Ukuran">Ukuran</option>
              <option value="Bahan">Bahan</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </label>
          <label>Catatan<input name="note" /></label>
          <button className="btn" type="submit">Simpan hasil QC</button>
        </form>
      </section>

      <section className="card">
        <h2>Riwayat QC</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Waktu</th><th>Pesanan</th><th>Komponen</th><th>Pcs</th><th>Status</th><th>Kategori</th><th>Inspektor</th></tr></thead>
            <tbody>
              {records.length === 0 && <tr><td colSpan={7} className="muted">Belum ada data QC.</td></tr>}
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{tanggalJam(r.checkedAt)}</td>
                  <td>{r.order.code}</td>
                  <td>{r.component}</td>
                  <td>{r.qty}</td>
                  <td><span className={`badge ${r.status === "LOLOS" ? "ok" : r.status === "DEFECT" ? "danger" : ""}`}>{STATUS_LABEL[r.status]}</span></td>
                  <td>{r.defectCategory ?? "-"}</td>
                  <td>{r.inspector.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
