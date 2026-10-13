"use server";

import { revalidatePath } from "next/cache";
import type { QcStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { backWith, errorMessage, num, str } from "@/lib/action";
import { recordQc } from "@/modules/qc/service";

const PATH = "/qc";

export async function recordQcAction(fd: FormData) {
  const user = await requireUser("qc");
  try {
    await recordQc({
      orderId: str(fd, "orderId"),
      inspectorId: user.id,
      component: str(fd, "component"),
      qty: num(fd, "qty"),
      status: str(fd, "status") as QcStatus,
      defectCategory: str(fd, "defectCategory") || undefined,
      note: str(fd, "note") || undefined,
    });
  } catch (e) {
    backWith(PATH, "error", errorMessage(e));
  }
  revalidatePath(PATH);
  backWith(PATH, "ok", "Hasil QC tersimpan dan terkunci.");
}
