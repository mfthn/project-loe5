// Alamat dasar API. Diambil dari environment agar mudah berpindah antara development dan server.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api/v1";

/**
 * Format ID Klien dibatasi menjadi tepat 10 karakter dengan template (LOE-id_client):
 * Contoh: "LOE-A1B2C3" (4 karakter prefix + 6 karakter hex/alfanumerik unik = 10 karakter)
 */
export function formatClientId10(rawId?: string | null): string {
  if (!rawId) return "LOE-000000";
  const str = String(rawId).trim();
  if (str.toUpperCase().startsWith("LOE-")) {
    const afterPrefix = str.slice(4).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    return `LOE-${afterPrefix.slice(0, 6).padEnd(6, "0")}`;
  }
  const clean = str.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const hexPart = clean.slice(0, 6).padEnd(6, "0");
  return `LOE-${hexPart}`;
}
