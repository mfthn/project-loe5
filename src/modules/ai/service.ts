// Konteks data untuk AI Business Tracker (Owner). Bersifat baca saja.
// Data dirangkum di server lalu dikirim sebagai konteks, sehingga model tidak mendapat akses tulis atau SQL bebas.
import { db } from "@/lib/db";

export async function buildOwnerSnapshot(): Promise<string> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [orders, stockByClient, outputToday, qcWeek, activeTailors, lastPayroll, clients] = await Promise.all([
    db.productionOrder.groupBy({ by: ["status"], _count: { _all: true } }),
    db.stockItem.groupBy({ by: ["clientId"], _sum: { quantity: true } }),
    db.outputRecord.aggregate({ where: { intervalStart: { gte: startOfDay } }, _sum: { pcs: true } }),
    db.qcRecord.groupBy({ by: ["status"], where: { checkedAt: { gte: sevenDaysAgo } }, _sum: { qty: true } }),
    db.lineAllocation.count({ where: { active: true } }),
    db.payrollPeriod.findFirst({ orderBy: { createdAt: "desc" } }),
    db.client.findMany({ select: { id: true, name: true } }),
  ]);
  const nameOf = new Map(clients.map((c) => [c.id, c.name]));

  const snapshot = {
    tanggalHariIni: new Date().toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" }),
    pesananPerStatus: orders.map((o) => ({ status: o.status, jumlah: o._count._all })),
    stokPerKlien: stockByClient.map((s) => ({ klien: nameOf.get(s.clientId), totalQty: s._sum.quantity ?? 0 })),
    outputPcsHariIni: outputToday._sum.pcs ?? 0,
    qc7HariTerakhir: qcWeek.map((q) => ({ status: q.status, totalQty: q._sum.qty ?? 0 })),
    lineAktifPenjahit: activeTailors,
    payrollTerakhir: lastPayroll
      ? { mulai: lastPayroll.startDate, selesai: lastPayroll.endDate, hasil: lastPayroll.result }
      : null,
  };
  return JSON.stringify(snapshot, null, 2);
}
