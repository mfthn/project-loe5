import { fetchHealth } from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";

// Komponen server: memeriksa API dan database saat halaman dirender.
// Jika backend mati, komponen menampilkan pesan yang jelas, bukan halaman error.
export async function ConnectionStatus() {
  let apiLabel: { text: string; ok: boolean };
  let dbLabel: { text: string; ok: boolean };

  try {
    const { body } = await fetchHealth();
    apiLabel = { text: "Terhubung", ok: true };
    dbLabel = body.database === "ok"
      ? { text: "Terhubung", ok: true }
      : { text: "Tidak tersedia", ok: false };
  } catch {
    apiLabel = { text: "Tidak dapat dihubungi", ok: false };
    dbLabel = { text: "Tidak diketahui", ok: false };
  }

  return (
    <section className="card">
      <h2>Status koneksi</h2>
      <div className="status-row">
        <span>Backend FastAPI <span className="muted">({API_BASE_URL})</span></span>
        <span className={`badge ${apiLabel.ok ? "ok" : "error"}`}>{apiLabel.text}</span>
      </div>
      <div className="status-row">
        <span>Database PostgreSQL</span>
        <span className={`badge ${dbLabel.ok ? "ok" : "error"}`}>{dbLabel.text}</span>
      </div>
    </section>
  );
}
