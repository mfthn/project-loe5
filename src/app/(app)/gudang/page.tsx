import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Notice } from "@/components/Notice";
import { tanggalJam } from "@/lib/format";
import { receiveAction, issueAction } from "./actions";

export default async function GudangPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireUser("gudang");
  const sp = await searchParams;

  const [items, orders, clients, blocked] = await Promise.all([
    db.stockItem.findMany({
      include: { client: true, order: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.productionOrder.findMany({ include: { client: true }, orderBy: { createdAt: "desc" } }),
    db.client.findMany({ orderBy: { name: "asc" } }),
    // Riwayat percobaan yang diblokir, untuk audit (FR-6.2)
    db.auditLog.findMany({
      where: { action: "BLOCKED_ISSUE" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  return (
    <div>
      <h1>Gudang Multi-Klien</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Setiap bahan wajib terikat Tag Klien dan ID Pesanan. Pengeluaran yang tidak cocok akan diblokir.
      </p>
      <Notice ok={sp.ok} error={sp.error} />

      <div className="grid">
        <section className="card">
          <h2>Penerimaan bahan</h2>
          <form action={receiveAction} className="form-grid">
            <label>Nama bahan<input name="name" required placeholder="Kain cotton combed 30s" /></label>
            <label>Jenis
              <select name="type" defaultValue="RAW">
                <option value="RAW">Bahan baku</option>
                <option value="WIP">WIP</option>
                <option value="FINISHED">Barang jadi</option>
              </select>
            </label>
            <label>Klien
              <select name="clientId" required defaultValue="">
                <option value="" disabled>Pilih klien</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>Pesanan
              <select name="orderId" required defaultValue="">
                <option value="" disabled>Pilih pesanan</option>
                {orders.map((o) => <option key={o.id} value={o.id}>{o.code} · {o.client.name}</option>)}
              </select>
            </label>
            <label>Jumlah<input name="quantity" type="number" step="0.01" min="0" required /></label>
            <label>Satuan<input name="unit" placeholder="meter / kg / pcs" /></label>
            <button className="btn" type="submit">Simpan penerimaan</button>
          </form>
        </section>

        <section className="card">
          <h2>Pengeluaran ke cutting</h2>
          <form action={issueAction} className="form-grid">
            <label>Item stok
              <select name="itemId" required defaultValue="">
                <option value="" disabled>Pilih item</option>
                {items.filter((i) => i.quantity > 0).map((i) => (
                  <option key={i.id} value={i.id}>{i.code} · {i.name} · {i.client.name} · sisa {i.quantity} {i.unit}</option>
                ))}
              </select>
            </label>
            <label>Pesanan tujuan
              <select name="orderId" required defaultValue="">
                <option value="" disabled>Pilih pesanan</option>
                {orders.map((o) => <option key={o.id} value={o.id}>{o.code} · {o.client.name}</option>)}
              </select>
            </label>
            <label>Jumlah<input name="quantity" type="number" step="0.01" min="0" required /></label>
            <button className="btn" type="submit">Keluarkan bahan</button>
          </form>
        </section>
      </div>

      <section className="card">
        <h2>Inventaris per klien</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Kode</th><th>Bahan</th><th>Jenis</th><th>Klien</th><th>Pesanan</th><th>Sisa</th><th>Diterima</th></tr>
            </thead>
            <tbody>
              {items.length === 0 && <tr><td colSpan={7} className="muted">Belum ada stok.</td></tr>}
              {items.map((i) => (
                <tr key={i.id}>
                  <td>{i.code}</td>
                  <td>{i.name}</td>
                  <td><span className="badge">{i.type}</span></td>
                  <td>{i.client.name}</td>
                  <td>{i.order.code}</td>
                  <td>{i.quantity} {i.unit}</td>
                  <td>{tanggalJam(i.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Percobaan pengeluaran yang diblokir</h2>
        {blocked.length === 0 && <p className="muted">Tidak ada percobaan yang diblokir.</p>}
        {blocked.map((b) => (
          <div key={b.id} className="notice error" style={{ marginBottom: 8 }}>
            {tanggalJam(b.createdAt)} · Bahan {(b.detail as Record<string, string>).itemCode} milik{" "}
            {(b.detail as Record<string, string>).itemOwner} ditolak untuk pesanan{" "}
            {(b.detail as Record<string, string>).targetOrder}.
          </div>
        ))}
      </section>
    </div>
  );
}
