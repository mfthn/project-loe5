import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_MODULES } from "@/lib/rbac";
import { Notice } from "@/components/Notice";
import { floorTo30Min } from "@/lib/format";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser("dashboard");
  const sp = await searchParams;

  // Ringkasan singkat. Setiap peran hanya melihat angka dari modul yang boleh diakses.
  const [orderCount, outputToday, pendingVerify] = await Promise.all([
    user.role === "KLIEN_MAKLON"
      ? db.productionOrder.count({ where: { clientId: user.clientId ?? "" } })
      : db.productionOrder.count(),
    db.outputRecord.aggregate({
      where: { intervalStart: { gte: floorTo30Min(new Date(new Date().setHours(0, 0, 0, 0))) } },
      _sum: { pcs: true },
    }),
    db.outputRecord.count({ where: { verifiedAt: null } }),
  ]);

  const modules = ROLE_MODULES[user.role].filter((m) => m !== "dashboard");

  return (
    <div>
      <h1>Halo, {user.name}</h1>
      <p className="muted" style={{ marginBottom: 18 }}>Ringkasan operasional hari ini</p>
      <Notice error={sp.error} />

      <div className="stats">
        <div className="card stat"><div className="label">Total pesanan</div><div className="value">{orderCount}</div></div>
        <div className="card stat"><div className="label">Output pcs hari ini</div><div className="value">{outputToday._sum.pcs ?? 0}</div></div>
        <div className="card stat"><div className="label">Output menunggu verifikasi</div><div className="value">{pendingVerify}</div></div>
      </div>

      <div className="grid">
        {modules.map((m) => (
          <Link key={m} href={`/${m}`} className="card" style={{ color: "inherit" }}>
            <h2 style={{ color: "var(--accent)" }}>Buka {m.replaceAll("-", " ")}</h2>
            <p className="muted">Modul {m} sesuai peran Anda.</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
