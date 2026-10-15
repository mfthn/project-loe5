import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        background: "#ffffff",
        padding: 24,
        textAlign: "center",
      }}
    >
      <img src="/Lukla.jpeg" alt="Logo Lukla" style={{ width: 56, height: 56, borderRadius: "var(--radius-lg)", objectFit: "cover", marginBottom: 12 }} />
      <h1 className="heading-editorial" style={{ fontSize: "2rem", marginBottom: 8, color: "var(--jadoo-navy)" }}>
        404 - Halaman Tidak Ditemukan
      </h1>
      <p style={{ color: "var(--jadoo-text)", marginBottom: 24, maxWidth: 440 }}>
        Halaman yang Anda tuju tidak tersedia atau telah dipindahkan.
      </p>
      <Link href="/" className="btn btn-primary">
        Kembali ke Beranda →
      </Link>
    </div>
  );
}
