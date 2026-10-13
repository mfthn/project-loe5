// Logika Produksi: alokasi penjahit ke line dan input output setiap 30 menit (FR-7).
import { db } from "@/lib/db";
import { floorTo30Min } from "@/lib/format";

// Memindahkan penjahit ke line baru. Alokasi aktif sebelumnya dinonaktifkan.
export async function allocateTailor(input: { tailorId: string; lineId: string }) {
  return db.$transaction(async (tx) => {
    await tx.lineAllocation.updateMany({
      where: { tailorId: input.tailorId, active: true },
      data: { active: false },
    });
    return tx.lineAllocation.create({ data: { tailorId: input.tailorId, lineId: input.lineId } });
  });
}

// Mandor menginput pcs selesai untuk satu interval 30 menit.
export async function recordOutput(input: {
  orderId: string;
  lineId: string;
  tailorId: string;
  component: string;
  pcs: number;
  now?: Date;
}) {
  if (!(input.pcs > 0)) throw new Error("Jumlah pcs harus lebih dari 0.");

  // Penjahit harus sedang dialokasikan ke line tersebut
  const alloc = await db.lineAllocation.findFirst({
    where: { tailorId: input.tailorId, lineId: input.lineId, active: true },
  });
  if (!alloc) throw new Error("Penjahit tidak dialokasikan ke line ini.");

  // Komponen harus punya tarif di rate card klien pesanan, agar payroll bisa dihitung
  const order = await db.productionOrder.findUnique({ where: { id: input.orderId } });
  if (!order) throw new Error("Pesanan tidak ditemukan.");
  const rate = await db.rateCard.findUnique({
    where: { clientId_component: { clientId: order.clientId, component: input.component } },
  });
  if (!rate) throw new Error(`Rate card untuk komponen "${input.component}" belum diatur.`);

  return db.outputRecord.create({
    data: {
      orderId: input.orderId,
      lineId: input.lineId,
      tailorId: input.tailorId,
      component: input.component,
      pcs: input.pcs,
      intervalStart: floorTo30Min(input.now ?? new Date()),
    },
  });
}

// Mandor memverifikasi output. Setelah diverifikasi, catatan terkunci dan masuk perhitungan payroll.
export async function verifyOutput(outputId: string, mandorId: string) {
  const out = await db.outputRecord.findUnique({ where: { id: outputId } });
  if (!out) throw new Error("Catatan output tidak ditemukan.");
  if (out.verifiedAt) throw new Error("Catatan ini sudah diverifikasi.");
  return db.outputRecord.update({
    where: { id: outputId },
    data: { verifiedById: mandorId, verifiedAt: new Date() },
  });
}

// Penjahit hanya bisa mengubah catatan yang belum diverifikasi (Story 1.2).
export async function updateUnverifiedOutput(outputId: string, pcs: number) {
  const out = await db.outputRecord.findUnique({ where: { id: outputId } });
  if (!out) throw new Error("Catatan output tidak ditemukan.");
  if (out.verifiedAt) throw new Error("Catatan sudah diverifikasi dan terkunci.");
  if (!(pcs > 0)) throw new Error("Jumlah pcs harus lebih dari 0.");
  return db.outputRecord.update({ where: { id: outputId }, data: { pcs } });
}
