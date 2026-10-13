// Format angka rupiah untuk tampilan.
export const rupiah = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);

// Format tanggal dan jam singkat dalam zona waktu Indonesia.
export const tanggalJam = (d: Date | string) =>
  new Date(d).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" });

// Membulatkan waktu ke bawah ke interval 30 menit (dasar pencatatan output FR-7.3).
export function floorTo30Min(d: Date): Date {
  const out = new Date(d);
  out.setSeconds(0, 0);
  out.setMinutes(out.getMinutes() < 30 ? 0 : 30);
  return out;
}
