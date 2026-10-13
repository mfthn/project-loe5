import { redirect } from "next/navigation";

// Mengubah error apa pun menjadi pesan yang aman ditampilkan ke pengguna.
export function errorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "Terjadi kesalahan tak terduga.";
}

// Redirect ke halaman dengan pesan sukses atau error lewat query string.
// Dipanggil di luar blok try agar tidak tertangkap sebagai error.
export function backWith(path: string, kind: "ok" | "error", message: string): never {
  redirect(`${path}?${kind}=${encodeURIComponent(message)}`);
}

// Membaca nilai string dari FormData dengan aman.
export function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

// Membaca nilai angka dari FormData. Mengembalikan NaN jika bukan angka.
export function num(fd: FormData, key: string): number {
  return Number(str(fd, key));
}
