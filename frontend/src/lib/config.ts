export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "https://project-loe5-backend.onrender.com/api/v1";

// AI Agent Service — fallback ke API_BASE_URL agar otomatis bekerja di production Vercel & Render
export const AI_AGENT_BASE_URL =
  process.env.NEXT_PUBLIC_AI_AGENT_URL ||
  API_BASE_URL;

/**
 * Normalisasi nomor HP Indonesia ke bentuk lokal `08xxxxxxxxxx`.
 * `+62 812-3456-7890`, `6281234567890`, dan `081234567890` menghasilkan nilai sama.
 */
export function normalizePhone(raw?: string | null): string {
  if (!raw) return "";
  let digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("62")) {
    digits = `0${digits.slice(2)}`;
  } else if (digits.startsWith("8")) {
    digits = `0${digits}`;
  }
  return digits;
}

/**
 * ID Klien resmi: `LOE5-<nomor HP>`, contoh `LOE5-08123456789`.
 * Nomor HP pendaftar dipakai agar staf bisa langsung mengenali & menghubungi klien.
 */
export function formatClientCode(raw?: string | null): string {
  if (!raw) return "-";
  const str = String(raw).trim();
  if (!str) return "-";

  // Nilai dari backend sudah berbentuk kode final.
  if (/^LOE/i.test(str)) return str.toUpperCase();

  const phone = normalizePhone(str);
  if (phone.length >= 8) return `LOE5-${phone}`;

  // Fallback data lama: potong 6 karakter alfanumerik.
  const clean = str.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  return `LOE5-${clean.slice(0, 6).padEnd(6, "0")}`;
}
