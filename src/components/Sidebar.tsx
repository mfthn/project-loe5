import type { Role } from "@prisma/client";
import { ROLE_MODULES, type Module } from "@/lib/rbac";
import { logoutAction } from "@/app/login/actions";

// Label menu untuk setiap modul
const LABELS: Record<Module, string> = {
  dashboard: "Dashboard",
  sample: "Sample & Time Study",
  gudang: "Gudang Multi-Klien",
  produksi: "Produksi & Output",
  qc: "QC & Barang Jadi",
  payroll: "Payroll",
  "portal-klien": "Portal Klien",
  "ai-owner": "AI Business Tracker",
};

// Menu hanya menampilkan modul yang boleh diakses peran pengguna (RBAC)
export function Sidebar({ name, role }: { name: string; role: Role }) {
  const modules = ROLE_MODULES[role];
  return (
    <aside className="sidebar">
      <div className="brand">project-loe5</div>
      <nav>
        {modules.map((m) => (
          <a key={m} href={`/${m}`}>
            {LABELS[m]}
          </a>
        ))}
      </nav>
      <div className="me">
        <div style={{ fontWeight: 600, fontSize: "0.9rem" }}>{name}</div>
        <div className="muted" style={{ marginBottom: 8 }}>{role.replaceAll("_", " ")}</div>
        <form action={logoutAction}>
          <button className="btn secondary" type="submit">Keluar</button>
        </form>
      </div>
    </aside>
  );
}
