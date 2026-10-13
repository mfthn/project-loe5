// Data awal untuk pengujian lokal. Semua akun memakai password: password123
import { PrismaClient, Role, Scheme } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  // Dua klien: brand internal dan klien maklon B2B
  const snohund = await db.client.upsert({
    where: { id: "client-snohund" },
    update: {},
    create: { id: "client-snohund", name: "Snøhund (internal)" },
  });
  const klienA = await db.client.upsert({
    where: { id: "client-klien-a" },
    update: {},
    create: { id: "client-klien-a", name: "Klien Maklon A" },
  });

  // Satu akun per peran, plus akun tambahan untuk pembagian bonus
  const users = [
    { email: "owner@loe.test", name: "Owner", role: Role.OWNER },
    { email: "sample@loe.test", name: "Tim Sample (Adis)", role: Role.TIM_SAMPLE },
    { email: "gudang@loe.test", name: "Petugas Gudang", role: Role.GUDANG },
    { email: "mandor1@loe.test", name: "Mandor 1", role: Role.KEPALA_PRODUKSI },
    { email: "mandor2@loe.test", name: "Mandor 2", role: Role.KEPALA_PRODUKSI },
    { email: "penjahit1@loe.test", name: "Penjahit 1", role: Role.PENJAHIT },
    { email: "penjahit2@loe.test", name: "Penjahit 2", role: Role.PENJAHIT },
    { email: "qc@loe.test", name: "QC Inspector", role: Role.QC_INSPECTOR },
    { email: "finance@loe.test", name: "Finance & Payroll", role: Role.FINANCE_PAYROLL },
    { email: "kepala@loe.test", name: "Kepala Operasional", role: Role.OWNER },
    { email: "klien@loe.test", name: "Klien Maklon A", role: Role.KLIEN_MAKLON, clientId: klienA.id },
  ];
  const created: Record<string, string> = {};
  for (const u of users) {
    const row = await db.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash, clientId: (u as { clientId?: string }).clientId ?? null },
    });
    created[u.email] = row.id;
  }

  // Tiga penerima bonus QC: 2 mandor dan 1 kepala operasional (FR-10.3)
  for (const email of ["mandor1@loe.test", "mandor2@loe.test", "kepala@loe.test"]) {
    await db.bonusRecipient.upsert({
      where: { userId: created[email] },
      update: {},
      create: { userId: created[email] },
    });
  }

  await db.payrollSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, mealPercent: 12.5, bonusPerPcs: 500 },
  });

  // Line produksi dan tarif contoh
  const line = await db.productionLine.upsert({
    where: { name: "Line A" },
    update: {},
    create: { name: "Line A" },
  });
  for (const [clientId, component, cut, sew] of [
    [klienA.id, "Badan depan", 1500, 4000],
    [klienA.id, "Lengan", 800, 2500],
    [snohund.id, "Badan depan", 1200, 3500],
  ] as const) {
    await db.rateCard.upsert({
      where: { clientId_component: { clientId, component } },
      update: {},
      create: { clientId, component, cuttingRate: cut, sewingRate: sew },
    });
  }

  // Penjahit 1 dialokasikan ke Line A
  const existing = await db.lineAllocation.findFirst({
    where: { tailorId: created["penjahit1@loe.test"], lineId: line.id, active: true },
  });
  if (!existing) {
    await db.lineAllocation.create({
      data: { lineId: line.id, tailorId: created["penjahit1@loe.test"] },
    });
  }

  // Contoh sample dengan satu versi yang sudah disetujui
  const sample = await db.sample.upsert({
    where: { code: "SMP-001" },
    update: {},
    create: { code: "SMP-001", name: "Kaos Basic Oversize" },
  });
  const existingVersion = await db.sampleVersion.findUnique({
    where: { sampleId_versionNumber: { sampleId: sample.id, versionNumber: 1 } },
  });
  if (!existingVersion) {
    await db.sampleVersion.create({
      data: {
        sampleId: sample.id,
        versionNumber: 1,
        specJson: { bahan: "Cotton combed 30s", warna: "Hitam", ukuran: "S-XL" },
        status: "APPROVED",
      },
    });
  }

  console.log("Seed selesai. Login dengan email di atas dan password: password123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
