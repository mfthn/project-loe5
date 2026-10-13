"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { backWith, errorMessage, num, str } from "@/lib/action";
import { finalizePayroll } from "@/modules/payroll/service";

const PATH = "/payroll";

// Mengubah tanggal YYYY-MM-DD menjadi awal hari di zona waktu Jakarta (WIB, UTC+7)
function jakartaDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+07:00`);
}

export async function finalizeAction(fd: FormData) {
  await requireUser("payroll");
  try {
    await finalizePayroll(jakartaDate(str(fd, "mulai")), jakartaDate(str(fd, "selesai")));
  } catch (e) {
    backWith(PATH, "error", errorMessage(e));
  }
  revalidatePath(PATH);
  backWith(PATH, "ok", "Payroll periode ini difinalisasi dan disimpan sebagai snapshot.");
}

// Mengubah persentase uang makan dan nilai bonus per pcs. Hanya Finance.
export async function updateSettingAction(fd: FormData) {
  await requireUser("payroll");
  const mealPercent = num(fd, "mealPercent");
  const bonusPerPcs = num(fd, "bonusPerPcs");
  try {
    if (!(mealPercent >= 0 && mealPercent <= 100)) throw new Error("Persentase uang makan harus 0 sampai 100.");
    if (!(bonusPerPcs >= 0)) throw new Error("Nilai bonus tidak boleh negatif.");
    await db.payrollSetting.upsert({
      where: { id: 1 },
      update: { mealPercent, bonusPerPcs },
      create: { id: 1, mealPercent, bonusPerPcs },
    });
  } catch (e) {
    backWith(PATH, "error", errorMessage(e));
  }
  revalidatePath(PATH);
  backWith(PATH, "ok", "Pengaturan payroll diperbarui.");
}
