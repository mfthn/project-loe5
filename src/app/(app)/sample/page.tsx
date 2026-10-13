import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Notice } from "@/components/Notice";
import { Stopwatch } from "@/components/Stopwatch";
import {
  createSampleAction,
  addVersionAction,
  approveVersionAction,
  convertAction,
  timeStudyAction,
  materialAction,
} from "./actions";

export default async function SamplePage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  await requireUser("sample");
  const sp = await searchParams;

  const [samples, clients, timeStudies] = await Promise.all([
    db.sample.findMany({
      include: { versions: { orderBy: { versionNumber: "asc" } }, timeStudies: true, materialUses: true },
      orderBy: { createdAt: "desc" },
    }),
    db.client.findMany({ orderBy: { name: "asc" } }),
    db.timeStudy.count(),
  ]);
  // Versi yang sudah disetujui, siap dikonversi menjadi order massal
  const approved = samples.flatMap((s) => s.versions.filter((v) => v.status === "APPROVED").map((v) => ({ v, s })));

  return (
    <div>
      <h1>Sample & Time Study</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Revisi sample membentuk versi berurutan. Versi yang disetujui bisa dikonversi menjadi order produksi massal.
      </p>
      <Notice ok={sp.ok} error={sp.error} />

      <div className="grid">
        <section className="card">
          <h2>Sample baru</h2>
          <form action={createSampleAction} className="form-grid">
            <label>Kode<input name="code" required placeholder="SMP-002" /></label>
            <label>Nama<input name="name" required placeholder="Hoodie Snøhund" /></label>
            <button className="btn" type="submit">Buat sample</button>
          </form>
        </section>

        <section className="card">
          <h2>Stopwatch time study</h2>
          <form action={timeStudyAction} className="form-grid">
            <label>Sample
              <select name="sampleId" required defaultValue="">
                <option value="" disabled>Pilih sample</option>
                {samples.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
              </select>
            </label>
            <label>Komponen<input name="componentName" required placeholder="Lengan kiri" /></label>
            <div style={{ gridColumn: "1 / -1" }}>
              <Stopwatch />
            </div>
            <button className="btn" type="submit">Simpan waktu</button>
          </form>
          <p className="muted" style={{ marginTop: 8 }}>Total catatan time study: {timeStudies}</p>
        </section>
      </div>

      <section className="card">
        <h2>Pemakaian bahan sample</h2>
        <form action={materialAction} className="form-grid">
          <label>Sample
            <select name="sampleId" required defaultValue="">
              <option value="" disabled>Pilih sample</option>
              {samples.map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
            </select>
          </label>
          <label>Bahan<input name="materialName" required /></label>
          <label>Jumlah<input name="quantity" type="number" step="0.01" min="0" required /></label>
          <label>Satuan<input name="unit" placeholder="meter" /></label>
          <button className="btn" type="submit">Catat pemakaian</button>
        </form>
      </section>

      <section className="card">
        <h2>Versi sample</h2>
        {samples.map((s) => (
          <div key={s.id} style={{ marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 6px" }}>{s.code} · {s.name}</h3>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Versi</th><th>Status</th><th>Catatan</th><th></th></tr></thead>
                <tbody>
                  {s.versions.length === 0 && <tr><td colSpan={4} className="muted">Belum ada versi.</td></tr>}
                  {s.versions.map((v) => (
                    <tr key={v.id}>
                      <td>v{v.versionNumber}</td>
                      <td><span className={`badge ${v.status === "APPROVED" ? "ok" : ""}`}>{v.status}</span></td>
                      <td>{String((v.specJson as Record<string, unknown>).catatan ?? "-")}</td>
                      <td>
                        {v.status === "DRAFT" && (
                          <form action={approveVersionAction}>
                            <input type="hidden" name="versionId" value={v.id} />
                            <button className="btn secondary" type="submit">Setujui</button>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form action={addVersionAction} className="row-actions" style={{ marginTop: 10 }}>
              <input type="hidden" name="sampleId" value={s.id} />
              <input name="spec" placeholder="Catatan revisi spesifikasi" required style={{ flex: "1 1 260px" }} />
              <button className="btn secondary" type="submit">Tambah revisi</button>
            </form>
          </div>
        ))}
      </section>

      <section className="card">
        <h2>Konversi ke order produksi massal</h2>
        {approved.length === 0 ? (
          <p className="muted">Belum ada versi yang disetujui.</p>
        ) : (
          <form action={convertAction} className="form-grid">
            <label>Versi disetujui
              <select name="versionId" required defaultValue="">
                <option value="" disabled>Pilih versi</option>
                {approved.map(({ v, s }) => <option key={v.id} value={v.id}>{s.code} v{v.versionNumber}</option>)}
              </select>
            </label>
            <label>Klien
              <select name="clientId" required defaultValue="">
                <option value="" disabled>Pilih klien</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>Skema
              <select name="scheme" defaultValue="CMT">
                <option value="CMT">CMT</option>
                <option value="SEMI_CMT">Semi-CMT</option>
                <option value="FULL_PACKAGE">CMT + Bahan</option>
              </select>
            </label>
            <label>Kode order<input name="code" required placeholder="ORD-2026-001" /></label>
            <label>Target pcs<input name="targetQty" type="number" min="1" required /></label>
            <label style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <input type="checkbox" name="confirmed" style={{ width: "auto" }} required /> Saya konfirmasi order ini
            </label>
            <button className="btn" type="submit">Buat order</button>
          </form>
        )}
      </section>
    </div>
  );
}
