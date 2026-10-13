import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Notice } from "@/components/Notice";
import { computePayroll } from "@/modules/payroll/service";
import { rupiah } from "@/lib/format";
import { finalizeAction, updateSettingAction } from "./actions";

// Format tanggal untuk input HTML: YYYY-MM-DD
const ymd = (d: Date) => d.toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" });

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string; mulai?: string; selesai?: string }>;
}) {
  await requireUser("payroll");
  const sp = await searchParams;

  // Default: 7 hari terakhir (periode mingguan)
  const today = new Date();
  const defaultStart = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const mulai = sp.mulai ?? ymd(defaultStart);
  const selesai = sp.selesai ?? ymd(new Date(today.getTime() + 24 * 60 * 60 * 1000));

  const setting = await db.payrollSetting.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  const result = await computePayroll(new Date(`${mulai}T00:00:00+07:00`), new Date(`${selesai}T00:00:00+07:00`));

  return (
    <div>
      <h1>Payroll & Rekap</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Borongan dihitung dari output yang sudah diverifikasi mandor. Pool bonus QC dibagi rata ke penerima terdaftar.
      </p>
      <Notice ok={sp.ok} error={sp.error} />

      <section className="card">
        <h2>Periode perhitungan</h2>
        <form className="form-grid" method="get">
          <label>Mulai<input type="date" name="mulai" defaultValue={mulai} /></label>
          <label>Selesai (tidak termasuk)<input type="date" name="selesai" defaultValue={selesai} /></label>
          <button className="btn secondary" type="submit">Hitung</button>
        </form>
      </section>

      <div className="stats">
        <div className="card stat"><div className="label">Total ongkos jahit</div><div className="value">{rupiah(result.totalOngkosJahit)}</div></div>
        <div className="card stat"><div className="label">Pool uang makan ({setting.mealPercent}%)</div><div className="value">{rupiah(result.poolUangMakan)}</div></div>
        <div className="card stat"><div className="label">Pool bonus QC</div><div className="value">{rupiah(result.poolBonusQc)}</div></div>
      </div>

      <section className="card">
        <h2>Borongan dan uang makan per penjahit</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Penjahit</th><th>Pcs</th><th>Upah borongan</th><th>Uang makan</th><th>Total</th></tr></thead>
            <tbody>
              {result.borongan.length === 0 && <tr><td colSpan={5} className="muted">Belum ada output terverifikasi pada periode ini.</td></tr>}
              {result.borongan.map((r) => (
                <tr key={r.penjahitId}>
                  <td>{r.nama}</td>
                  <td>{r.pcs}</td>
                  <td>{rupiah(r.upah)}</td>
                  <td>{rupiah(r.uangMakan)}</td>
                  <td><strong>{rupiah(r.total)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Bonus QC (dibagi rata)</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Penerima</th><th>Bonus</th></tr></thead>
            <tbody>
              {result.penerimaBonus.map((p) => (
                <tr key={p.nama}><td>{p.nama}</td><td>{rupiah(p.jumlah)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {result.peringatan.map((p, i) => (
          <div key={i} className="notice error" style={{ marginTop: 10, marginBottom: 0 }}>{p}</div>
        ))}
        <form action={finalizeAction} className="row-actions" style={{ marginTop: 14 }}>
          <input type="hidden" name="mulai" value={mulai} />
          <input type="hidden" name="selesai" value={selesai} />
          <button className="btn" type="submit">Finalisasi periode</button>
          <span className="muted">Setelah difinalisasi, hasil tidak bisa diubah.</span>
        </form>
      </section>

      <section className="card">
        <h2>Pengaturan</h2>
        <form action={updateSettingAction} className="form-grid">
          <label>Uang makan (% dari ongkos jahit)
            <input name="mealPercent" type="number" step="0.1" min="0" max="100" defaultValue={setting.mealPercent} />
          </label>
          <label>Bonus per pcs LOLOS (Rp)
            <input name="bonusPerPcs" type="number" step="1" min="0" defaultValue={setting.bonusPerPcs} />
          </label>
          <button className="btn secondary" type="submit">Simpan pengaturan</button>
        </form>
      </section>
    </div>
  );
}
