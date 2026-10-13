// Logika Sample, Versioning, dan Konversi ke Order Produksi Massal (FR-1 s.d. FR-4).
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

export async function createSample(input: { code: string; name: string }) {
  if (!input.code || !input.name) throw new Error("Kode dan nama sample wajib diisi.");
  return db.sample.create({ data: input });
}

// Membuat versi baru. Versi pertama berstatus DRAFT, revisi berikutnya terhubung ke versi sebelumnya.
export async function addSampleVersion(input: { sampleId: string; spec: Prisma.InputJsonValue }) {
  const latest = await db.sampleVersion.findFirst({
    where: { sampleId: input.sampleId },
    orderBy: { versionNumber: "desc" },
  });
  return db.sampleVersion.create({
    data: {
      sampleId: input.sampleId,
      versionNumber: (latest?.versionNumber ?? 0) + 1,
      parentId: latest?.id ?? null,
      specJson: input.spec,
      status: "DRAFT",
    },
  });
}

export async function approveSampleVersion(versionId: string) {
  const v = await db.sampleVersion.findUnique({ where: { id: versionId } });
  if (!v) throw new Error("Versi sample tidak ditemukan.");
  if (v.status !== "DRAFT") throw new Error("Hanya versi berstatus DRAFT yang bisa disetujui.");
  return db.sampleVersion.update({ where: { id: versionId }, data: { status: "APPROVED" } });
}

// Mengonversi versi yang disetujui menjadi order produksi massal (Story 2.2).
// Syarat: versi harus APPROVED dan user harus mengonfirmasi. Riwayat versi ikut disimpan.
export async function convertToOrder(input: {
  versionId: string;
  code: string;
  clientId: string;
  scheme: "CMT" | "SEMI_CMT" | "FULL_PACKAGE";
  targetQty: number;
  confirmed: boolean;
}) {
  if (!input.confirmed) throw new Error("Konfirmasi diperlukan sebelum order massal disetujui.");
  if (!(input.targetQty > 0)) throw new Error("Target jumlah harus lebih dari 0.");

  const version = await db.sampleVersion.findUnique({
    where: { id: input.versionId },
    include: { sample: { include: { versions: { orderBy: { versionNumber: "asc" } } } } },
  });
  if (!version) throw new Error("Versi sample tidak ditemukan.");
  if (version.status !== "APPROVED") throw new Error("Versi harus APPROVED sebelum dikonversi.");

  // Riwayat versi sampai versi yang dikonversi, supaya spesifikasi tidak hilang
  const history = version.sample.versions
    .filter((v) => v.versionNumber <= version.versionNumber)
    .map((v) => ({ versi: v.versionNumber, status: v.status, spec: v.specJson }));

  return db.$transaction(async (tx) => {
    const order = await tx.productionOrder.create({
      data: {
        code: input.code,
        clientId: input.clientId,
        sampleVersionId: version.id,
        scheme: input.scheme,
        targetQty: input.targetQty,
        specJson: { sampel: version.sample.code, versiDikonversi: version.versionNumber, riwayat: history },
      },
    });
    await tx.sampleVersion.update({ where: { id: version.id }, data: { status: "CONVERTED" } });
    return order;
  });
}

// Mencatat waktu pengerjaan per komponen (time study, Story 2.1).
export async function addTimeStudy(input: { sampleId: string; componentName: string; seconds: number }) {
  if (!input.componentName) throw new Error("Nama komponen wajib diisi.");
  if (!(input.seconds > 0)) throw new Error("Waktu harus lebih dari 0 detik.");
  return db.timeStudy.create({ data: input });
}

// Mencatat pemakaian bahan sample (Story 2.1).
export async function addMaterialUse(input: {
  sampleId: string;
  materialName: string;
  quantity: number;
  unit: string;
}) {
  if (!input.materialName) throw new Error("Nama bahan wajib diisi.");
  if (!(input.quantity > 0)) throw new Error("Jumlah pemakaian harus lebih dari 0.");
  return db.sampleMaterialUse.create({ data: input });
}
