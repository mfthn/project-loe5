"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { backWith, errorMessage, num, str } from "@/lib/action";
import { allocateTailor, recordOutput, verifyOutput, updateUnverifiedOutput } from "@/modules/produksi/service";

const PATH = "/produksi";

// Hanya Kepala Produksi (mandor) dan Owner yang boleh mengatur line dan mencatat output.
export async function allocateAction(fd: FormData) {
  const user = await requireUser("produksi");
  if (!["KEPALA_PRODUKSI", "OWNER"].includes(user.role)) backWith(PATH, "error", "Hanya mandor yang bisa mengatur alokasi.");
  try {
    await allocateTailor({ tailorId: str(fd, "tailorId"), lineId: str(fd, "lineId") });
  } catch (e) {
    backWith(PATH, "error", errorMessage(e));
  }
  revalidatePath(PATH);
  backWith(PATH, "ok", "Penjahit berhasil dialokasikan ke line.");
}

export async function outputAction(fd: FormData) {
  const user = await requireUser("produksi");
  if (!["KEPALA_PRODUKSI", "OWNER"].includes(user.role)) backWith(PATH, "error", "Hanya mandor yang bisa mencatat output.");
  try {
    await recordOutput({
      orderId: str(fd, "orderId"),
      lineId: str(fd, "lineId"),
      tailorId: str(fd, "tailorId"),
      component: str(fd, "component"),
      pcs: num(fd, "pcs"),
    });
  } catch (e) {
    backWith(PATH, "error", errorMessage(e));
  }
  revalidatePath(PATH);
  backWith(PATH, "ok", "Output 30 menit tercatat.");
}

// Verifikasi oleh mandor. Setelah ini catatan terkunci.
export async function verifyAction(fd: FormData) {
  const user = await requireUser("produksi");
  if (!["KEPALA_PRODUKSI", "OWNER"].includes(user.role)) backWith(PATH, "error", "Hanya mandor yang bisa memverifikasi.");
  try {
    await verifyOutput(str(fd, "outputId"), user.id);
  } catch (e) {
    backWith(PATH, "error", errorMessage(e));
  }
  revalidatePath(PATH);
  backWith(PATH, "ok", "Output diverifikasi dan dikunci.");
}

// Penjahit hanya bisa mengubah catatan miliknya yang belum diverifikasi.
export async function editOutputAction(fd: FormData) {
  const user = await requireUser("produksi");
  const outputId = str(fd, "outputId");
  try {
    // db diimpor di bagian atas file
    const row = await db.outputRecord.findUnique({ where: { id: outputId } });
    if (!row || (user.role === "PENJAHIT" && row.tailorId !== user.id)) {
      throw new Error("Catatan ini bukan milik Anda.");
    }
    await updateUnverifiedOutput(outputId, num(fd, "pcs"));
  } catch (e) {
    backWith(PATH, "error", errorMessage(e));
  }
  revalidatePath(PATH);
  backWith(PATH, "ok", "Catatan output diperbarui.");
}
