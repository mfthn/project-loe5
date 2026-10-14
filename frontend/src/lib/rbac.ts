import type { UserRole } from "../types/api";

export type AppModule =
  | "dashboard"
  | "sample"
  | "gudang"
  | "produksi"
  | "qc"
  | "payroll"
  | "rekap-gaji"
  | "portal-klien"
  | "ai-assistant";

// Matriks RBAC resmi sesuai dokumen SRS v2.0 & dokumen SOP autentikasi
export const ROLE_MODULES: Record<UserRole, AppModule[]> = {
  OWNER: [
    "dashboard",
    "sample",
    "gudang",
    "produksi",
    "qc",
    "payroll",
    "portal-klien",
    "ai-assistant",
  ],
  TIM_SAMPLE: ["dashboard", "sample"],
  GUDANG: ["dashboard", "gudang"],
  MANDOR: ["dashboard", "produksi", "qc"],
  PENJAHIT: ["dashboard"],
  QC_INSPECTOR: ["dashboard", "qc", "gudang"],
  FINANCE_PAYROLL: ["dashboard", "payroll"],
  KLIEN_MAKLON: ["dashboard", "portal-klien", "ai-assistant"],
};

export interface ModuleMetadata {
  id: AppModule;
  label: string;
  href: string;
  icon: string;
  badge?: string;
  description: string;
}

export const MODULE_REGISTRY: Record<AppModule, ModuleMetadata> = {
  dashboard: {
    id: "dashboard",
    label: "Dashboard Ringkasan",
    href: "/dashboard",
    icon: "📊",
    description: "Ringkasan operasional harian, statistik produksi, dan peringatan sistem.",
  },
  gudang: {
    id: "gudang",
    label: "Gudang Multi-Klien",
    href: "/gudang",
    icon: "📦",
    description: "Stok bahan baku, mutasi IN/OUT, dan proteksi anti-kontaminasi silang.",
  },
  sample: {
    id: "sample",
    label: "Sample & Stopwatch",
    href: "/sample",
    icon: "⏱️",
    description: "Katalog sampel, versi approval, dan stopwatch digital time study detik per komponen.",
  },
  produksi: {
    id: "produksi",
    label: "Lantai Produksi 30m",
    href: "/produksi",
    icon: "⚙️",
    description: "Order produksi, alur status, dan terminal touchscreen output per interval 30 menit.",
  },
  qc: {
    id: "qc",
    label: "Quality Control & Bonus",
    href: "/qc",
    icon: "🔍",
    description: "Inspeksi LOLOS / REPAIR / DEFECT dan kalkulator Pool Bonus QC Mandor.",
  },
  payroll: {
    id: "payroll",
    label: "Payroll Engine Sabtu",
    href: "/payroll",
    icon: "💰",
    badge: "Audit Lock",
    description: "Kalkulasi upah borongan mingguan, uang makan 10-15%, dan penguncian audit permanen.",
  },
  "rekap-gaji": {
    id: "rekap-gaji",
    label: "Rekap Gaji Mingguan",
    href: "/rekap-gaji",
    icon: "💵",
    description: "Slip gaji resmi mingguan, status pembayaran, dan catatan progres pribadi.",
  },
  "portal-klien": {
    id: "portal-klien",
    label: "Portal Klien Maklon",
    href: "/portal-klien",
    icon: "🏢",
    description: "Isolasi data pesanan, progres produksi real-time, dan status stok bahan milik klien.",
  },
  "ai-assistant": {
    id: "ai-assistant",
    label: "AI Dual-Assistant",
    href: "/ai-assistant",
    icon: "🤖",
    badge: "Bedrock RAG",
    description: "Asisten cerdas dual-persona: Owner Business Tracker & Konsultan Maklon Calon Klien.",
  },
};

export function canAccessModule(role: UserRole | undefined | null, moduleName: AppModule): boolean {
  if (!role) return false;
  const allowed = ROLE_MODULES[role];
  return allowed ? allowed.includes(moduleName) : false;
}

export function getAllowedModules(role: UserRole | undefined | null): ModuleMetadata[] {
  if (!role) return [];
  const allowed = ROLE_MODULES[role] || [];
  return allowed.map((modKey) => MODULE_REGISTRY[modKey]).filter(Boolean);
}
