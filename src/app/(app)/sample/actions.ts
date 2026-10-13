"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { backWith, errorMessage, num, str } from "@/lib/action";
import {
  createSample,
  addSampleVersion,
  approveSampleVersion,
  convertToOrder,
  addTimeStudy,
  addMaterialUse,
} from "@/modules/sample/service";

const PATH = "/sample";

// Membungkus setiap aksi: cek akses, jalankan service, lalu kembali dengan pesan.
async function run(task: () => Promise<unknown>, okMessage: string) {
  await requireUser("sample");
  try {
    await task();
  } catch (e) {
    backWith(PATH, "error", errorMessage(e));
  }
  revalidatePath(PATH);
  backWith(PATH, "ok", okMessage);
}

export async function createSampleAction(fd: FormData) {
  return run(() => createSample({ code: str(fd, "code"), name: str(fd, "name") }), "Sample dibuat.");
}

// Spesifikasi dari form disimpan sebagai teks bebas di dalam JSON.
export async function addVersionAction(fd: FormData) {
  return run(
    () => addSampleVersion({ sampleId: str(fd, "sampleId"), spec: { catatan: str(fd, "spec") } }),
    "Versi baru dibuat sebagai DRAFT dan terhubung ke versi sebelumnya.",
  );
}

export async function approveVersionAction(fd: FormData) {
  return run(() => approveSampleVersion(str(fd, "versionId")), "Versi disetujui.");
}

// Checkbox konfirmasi dikirim sebagai "on" jika dicentang
export async function convertAction(fd: FormData) {
  return run(
    () =>
      convertToOrder({
        versionId: str(fd, "versionId"),
        code: str(fd, "code"),
        clientId: str(fd, "clientId"),
        scheme: str(fd, "scheme") as "CMT" | "SEMI_CMT" | "FULL_PACKAGE",
        targetQty: num(fd, "targetQty"),
        confirmed: fd.get("confirmed") === "on",
      }),
    "Order produksi massal dibuat dengan riwayat versi sample.",
  );
}

export async function timeStudyAction(fd: FormData) {
  return run(
    () =>
      addTimeStudy({
        sampleId: str(fd, "sampleId"),
        componentName: str(fd, "componentName"),
        seconds: num(fd, "seconds"),
      }),
    "Waktu pengerjaan dicatat.",
  );
}

export async function materialAction(fd: FormData) {
  return run(
    () =>
      addMaterialUse({
        sampleId: str(fd, "sampleId"),
        materialName: str(fd, "materialName"),
        quantity: num(fd, "quantity"),
        unit: str(fd, "unit") || "meter",
      }),
    "Pemakaian bahan sample dicatat.",
  );
}
