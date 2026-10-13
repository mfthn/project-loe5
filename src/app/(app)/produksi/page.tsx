import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Notice } from "@/components/Notice";
import { tanggalJam } from "@/lib/format";
import { allocateAction, outputAction, verifyAction, editOutputAction } from "./actions";

// Halaman ini memuat ulang sendiri setiap 30 detik agar dashboard line tetap segar (FR-7.3).
export default async function ProduksiPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const user = await requireUser("produksi");
  const sp = await searchParams;
  const isMandor = user.role === "KEPALA_PRODUKSI" || user.role === "OWNER";

  const [lines, tailors, orders, outputs] = await Promise.all([
    db.productionLine.findMany({
      include: { allocations: { where: { active: true }, include: { tailor: true } } },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({ where: { role: "PENJAHIT" }, orderBy: { name: "asc" } }),
    db.productionOrder.findMany({ include: { client: true }, orderBy: { createdAt: "desc" } }),
    db.outputRecord.findMany({
      // Penjahit hanya melihat catatannya sendiri, mandor melihat semua
      where: user.role === "PENJAHIT" ? { tailorId: user.id } : undefined,
      include: { order: true, line: true, tailor: true },
      orderBy: { intervalStart: "desc" },
      take: 60,
    }),
  ]);

  return (
    <div>
      <meta httpEquiv="refresh" content="30" />
      <h1>Produksi & Output 30 Menit</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Kapasitas dinamis hingga ±70 mesin. Halaman diperbarui otomatis setiap 30 detik.
      </p>
      <Notice ok={sp.ok} error={sp.error} />

      <div className="grid">
        {lines.map((l) => (
          <section key={l.id} className="card">
            <h2>{l.name}</h2>
            <p className="muted">{l.allocations.length} penjahit aktif</p>
            <ul style={{ paddingLeft: 18, margin: "8px 0 0" }}>
              {l.allocations.map((a) => <li key={a.id}>{a.tailor.name}</li>)}
            </ul>
          </section>
        ))}
      </div>

      {isMandor && (
        <div className="grid">
          <section className="card">
            <h2>Alokasi penjahit</h2>
            <form action={allocateAction} className="form-grid">
              <label>Penjahit
                <select name="tailorId" required defaultValue="">
                  <option value="" disabled>Pilih penjahit</option>
                  {tailors.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <label>Line
                <select name="lineId" required defaultValue="">
                  <option value="" disabled>Pilih line</option>
                  {lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </label>
              <button className="btn" type="submit">Alokasikan</button>
            </form>
          </section>

          <section className="card">
            <h2>Input output 30 menit</h2>
            <form action={outputAction} className="form-grid">
              <label>Pesanan
                <select name="orderId" required defaultValue="">
                  <option value="" disabled>Pilih pesanan</option>
                  {orders.map((o) => <option key={o.id} value={o.id}>{o.code} · {o.client.name}</option>)}
                </select>
              </label>
              <label>Line
                <select name="lineId" required defaultValue="">
                  <option value="" disabled>Pilih line</option>
                  {lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </label>
              <label>Penjahit
                <select name="tailorId" required defaultValue="">
                  <option value="" disabled>Pilih penjahit</option>
                  {tailors.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </label>
              <label>Komponen<input name="component" required placeholder="Badan depan" /></label>
              <label>Pcs selesai<input name="pcs" type="number" min="1" required /></label>
              <button className="btn" type="submit">Catat output</button>
            </form>
          </section>
        </div>
      )}

      <section className="card">
        <h2>Riwayat output</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Interval</th><th>Penjahit</th><th>Line</th><th>Pesanan</th><th>Komponen</th><th>Pcs</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {outputs.length === 0 && <tr><td colSpan={8} className="muted">Belum ada output.</td></tr>}
              {outputs.map((o) => {
                const locked = Boolean(o.verifiedAt);
                const canEdit = !locked && (user.role === "PENJAHIT" ? o.tailorId === user.id : isMandor);
                return (
                  <tr key={o.id}>
                    <td>{tanggalJam(o.intervalStart)}</td>
                    <td>{o.tailor.name}</td>
                    <td>{o.line.name}</td>
                    <td>{o.order.code}</td>
                    <td>{o.component}</td>
                    <td>{o.pcs}</td>
                    <td>{locked ? <span className="badge ok">Terverifikasi</span> : <span className="badge">Menunggu</span>}</td>
                    <td>
                      <div className="row-actions">
                        {!locked && isMandor && (
                          <form action={verifyAction}>
                            <input type="hidden" name="outputId" value={o.id} />
                            <button className="btn secondary" type="submit">Verifikasi</button>
                          </form>
                        )}
                        {canEdit && (
                          <form action={editOutputAction} className="row-actions">
                            <input type="hidden" name="outputId" value={o.id} />
                            <input name="pcs" type="number" min="1" defaultValue={o.pcs} style={{ width: 80 }} />
                            <button className="btn secondary" type="submit">Ubah</button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
