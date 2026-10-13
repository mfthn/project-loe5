import type { Role } from "@prisma/client";

// Daftar modul sistem. Dipakai untuk menu dan pengecekan akses.
export const MODULES = [
  "dashboard",
  "sample",
  "gudang",
  "produksi",
  "qc",
  "payroll",
  "portal-klien",
  "ai-owner",
] as const;

export type Module = (typeof MODULES)[number];

// Hak akses per peran, mengikuti matriks RBAC pada SRS v2.0.
// Dashboard bisa diakses semua peran yang sudah login.
export const ROLE_MODULES: Record<Role, readonly Module[]> = {
  OWNER: ["dashboard", "sample", "gudang", "produksi", "qc", "payroll", "portal-klien", "ai-owner"],
  TIM_SAMPLE: ["dashboard", "sample"],
  GUDANG: ["dashboard", "gudang"],
  KEPALA_PRODUKSI: ["dashboard", "produksi"],
  PENJAHIT: ["dashboard", "produksi"],
  QC_INSPECTOR: ["dashboard", "qc", "gudang"],
  FINANCE_PAYROLL: ["dashboard", "payroll"],
  KLIEN_MAKLON: ["dashboard", "portal-klien"],
};

export function canAccessModule(role: Role, module: Module): boolean {
  return ROLE_MODULES[role].includes(module);
}

// Peran klien hanya boleh melihat data dengan client_id miliknya sendiri.
// Mengembalikan null jika peran tidak dibatasi.
export function clientScope(user: { role: Role; clientId: string | null }): string | null {
  if (user.role === "KLIEN_MAKLON") {
    if (!user.clientId) throw new Error("Akun klien tidak terhubung ke client_id.");
    return user.clientId;
  }
  return null;
}
