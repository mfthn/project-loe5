import { ConnectionStatus } from "@/components/ConnectionStatus";

// Halaman awal sebagai bukti bahwa frontend, backend, dan database terhubung.
// Halaman fitur ditambahkan per modul pada tahap berikutnya.
export default function HomePage() {
  return (
    <main className="page">
      <h1>project-loe5</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Fondasi frontend Next.js, backend FastAPI, dan database PostgreSQL.
      </p>
      <ConnectionStatus />
    </main>
  );
}
