// Mesin Payroll (FR-10). Menghitung borongan mingguan, uang makan, dan pool bonus QC.
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export type PayrollResult = {
  periode: { mulai: string; selesai: string };
  borongan: { penjahitId: string; nama: string; pcs: number; upah: number; uangMakan: number; total: number }[];
  totalOngkosJahit: number;
  poolUangMakan: number;
  poolBonusQc: number;
  bonusPerPenerima: number;
  penerimaBonus: { nama: string; jumlah: number }[];
  peringatan: string[];
};

// Menghitung payroll untuk periode [mulai, selesai). Hanya output yang sudah diverifikasi yang dihitung.
export async function computePayroll(mulai: Date, selesai: Date): Promise<PayrollResult> {
  const setting = await db.payrollSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  const outputs = await db.outputRecord.findMany({
    where: { verifiedAt: { not: null }, intervalStart: { gte: mulai, lt: selesai } },
    include: { order: true, tailor: true },
  });

  // Tarif jahit per klien dan komponen, dimuat sekali agar tidak query berulang
  const rates = await db.rateCard.findMany();
  const rateMap = new Map(rates.map((r) => [`${r.clientId}|${r.component}`, r.sewingRate]));

  const peringatan: string[] = [];
  const perPenjahit = new Map<string, { nama: string; pcs: number; upah: number }>();

  // Borongan: pcs terverifikasi dikali tarif jahit per komponen (FR-10.1)
  for (const o of outputs) {
    const rate = rateMap.get(`${o.order.clientId}|${o.component}`);
    if (rate === undefined) {
      peringatan.push(`Tarif hilang untuk komponen "${o.component}" (pesanan ${o.order.code}).`);
      continue;
    }
    const row = perPenjahit.get(o.tailorId) ?? { nama: o.tailor.name, pcs: 0, upah: 0 };
    row.pcs += o.pcs;
    row.upah += o.pcs * rate;
    perPenjahit.set(o.tailorId, row);
  }

  const totalOngkosJahit = [...perPenjahit.values()].reduce((s, r) => s + r.upah, 0);

  // Uang makan: persentase dari total ongkos jahit periode (FR-10.2).
  // Dibagi ke penjahit sebanding dengan upah boronganya.
  const poolUangMakan = (setting.mealPercent / 100) * totalOngkosJahit;

  const borongan = [...perPenjahit.entries()].map(([id, r]) => {
    const uangMakan = totalOngkosJahit > 0 ? (r.upah / totalOngkosJahit) * poolUangMakan : 0;
    return { penjahitId: id, nama: r.nama, pcs: r.pcs, upah: r.upah, uangMakan, total: r.upah + uangMakan };
  });

  // Pool bonus QC: semua pcs berstatus LOLOS dikali nilai bonus per pcs (FR-10.3)
  const lolos = await db.qcRecord.aggregate({
    where: { status: "LOLOS", checkedAt: { gte: mulai, lt: selesai } },
    _sum: { qty: true },
  });
  const poolBonusQc = (lolos._sum.qty ?? 0) * setting.bonusPerPcs;

  // Pool dibagi rata ke semua penerima bonus yang terdaftar
  const recipients = await db.bonusRecipient.findMany({ include: { user: true } });
  if (recipients.length === 0) peringatan.push("Belum ada penerima bonus QC yang terdaftar.");
  const bonusPerPenerima = recipients.length ? poolBonusQc / recipients.length : 0;

  return {
    periode: { mulai: mulai.toISOString(), selesai: selesai.toISOString() },
    borongan,
    totalOngkosJahit,
    poolUangMakan,
    poolBonusQc,
    bonusPerPenerima,
    penerimaBonus: recipients.map((r) => ({ nama: r.user.name, jumlah: bonusPerPenerima })),
    peringatan,
  };
}

// Menyimpan hasil payroll sebagai snapshot yang tidak bisa diubah. Periode yang sama tidak bisa difinalisasi dua kali.
export async function finalizePayroll(mulai: Date, selesai: Date) {
  const existing = await db.payrollPeriod.findUnique({
    where: { startDate_endDate: { startDate: mulai, endDate: selesai } },
  });
  if (existing) throw new Error("Periode ini sudah difinalisasi.");
  const result = await computePayroll(mulai, selesai);
  return db.payrollPeriod.create({
    data: { startDate: mulai, endDate: selesai, result: result as unknown as Prisma.InputJsonValue },
  });
}
