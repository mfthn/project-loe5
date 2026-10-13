import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";

// Layout untuk semua halaman yang butuh login. Memastikan user login lalu menampilkan sidebar sesuai peran.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <div className="app-shell">
      <Sidebar name={user.name} role={user.role} />
      <main className="content">{children}</main>
    </div>
  );
}
