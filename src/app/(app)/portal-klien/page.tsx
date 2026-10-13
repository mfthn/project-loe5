import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { clientScope } from "@/lib/rbac";
import { tanggalJam } from "@/lib/format";

export default async function PortalKlienPage() {
  const user = await requireUser("portal-klien");

  // Isolasi data: klien hanya melihat client_id miliknya. Owner melihat semua.
  const scope = clientScope(user);
  const where = scope ? { clientId: scope } : {};

  const [orders, stock, client] = await Promise.all([
    db.productionOrder.findMany({
      where,
      include: { _count: { select: { outputs: true, qcRecords: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.stockItem.findMany({ where, orderBy: { createdAt: "desc" } }),
    scope ? db.client.findUnique({ where: { id: scope } }) : Promise.resolve(null),
  ]);

  return (
    <div>
      <h1>Portal Klien{client ? ` · ${client.name}` : ""}</h1>
      <p className="muted" style={{ marginBottom: 18 }}>Pantau status pesanan dan stok bahan titipan Anda.</p>

      <section className="card">
        <h2>Status pesanan</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Kode</th><th>Skema</th><th>Target</th><th>Status</th><th>Dibuat</th></tr></thead>
            <tbody>
              {orders.length === 0 && <tr><td colSpan={5} className="muted">Belum ada pesanan.</td></tr>}
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>{o.code}</td>
                  <td>{o.scheme.replace("_", "-")}</td>
                  <td>{o.targetQty} pcs</td>
                  <td><span className="badge">{o.status}</span></td>
                  <td>{tanggalJam(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Stok bahan titipan</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Kode</th><th>Bahan</th><th>Jenis</th><th>Sisa</th></tr></thead>
            <tbody>
              {stock.length === 0 && <tr><td colSpan={4} className="muted">Belum ada stok.</td></tr>}
              {stock.map((s) => (
                <tr key={s.id}>
                  <td>{s.code}</td>
                  <td>{s.name}</td>
                  <td>{s.type}</td>
                  <td>{s.quantity} {s.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
