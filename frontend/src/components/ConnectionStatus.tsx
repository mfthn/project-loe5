import { fetchAiStatus } from "@/lib/api";
import { API_BASE_URL } from "@/lib/config";

// Komponen server: memeriksa status API backend saat halaman dirender.
export async function ConnectionStatus() {
  let apiLabel: { text: string; ok: boolean };

  try {
    const status = await fetchAiStatus();
    apiLabel = status.ok
      ? { text: "Terhubung", ok: true }
      : { text: "Tidak dapat dihubungi", ok: false };
  } catch {
    apiLabel = { text: "Tidak dapat dihubungi", ok: false };
  }

  return (
    <section className="card">
      <h2>Status koneksi</h2>
      <div className="status-row">
        <span>Backend FastAPI <span className="muted">({API_BASE_URL})</span></span>
        <span className={`badge ${apiLabel.ok ? "ok" : "error"}`}>{apiLabel.text}</span>
      </div>
    </section>
  );
}
