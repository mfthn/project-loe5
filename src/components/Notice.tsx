// Menampilkan pesan sukses atau error yang dikirim lewat query string dari aksi server.
export function Notice({ ok, error }: { ok?: string; error?: string }) {
  if (error) return <div className="notice error">{error}</div>;
  if (ok) return <div className="notice ok">{ok}</div>;
  return null;
}
