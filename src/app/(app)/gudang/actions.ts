"use server";

import { revalidatePath } from "next/cache";
import type { StockType } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import { backWith, errorMessage, num, str } from "@/lib/action";
import { receiveStock, issueStock } from "@/modules/gudang/service";

const PATH = "/gudang";

// Penerimaan bahan. Tag klien dan pesanan diambil dari form dan divalidasi di service.
export async function receiveAction(fd: FormData) {
  await requireUser("gudang");
  try {
    await receiveStock({
      code: `LOT-${Date.now()}`,
      name: str(fd, "name"),
      type: str(fd, "type") as StockType,
      clientId: str(fd, "clientId"),
      orderId: str(fd, "orderId"),
      quantity: num(fd, "quantity"),
      unit: str(fd, "unit") || "pcs",
    });
  } catch (e) {
    backWith(PATH, "error", errorMessage(e));
  }
  revalidatePath(PATH);
  backWith(PATH, "ok", "Bahan diterima dan sudah diberi Tag Klien serta ID Pesanan.");
}

// Pengeluaran bahan. Jika klien atau pesanan tidak cocok, service menolak dan percobaan dicatat di audit log.
export async function issueAction(fd: FormData) {
  const user = await requireUser("gudang");
  try {
    await issueStock({
      userId: user.id,
      itemId: str(fd, "itemId"),
      orderId: str(fd, "orderId"),
      quantity: num(fd, "quantity"),
    });
  } catch (e) {
    backWith(PATH, "error", errorMessage(e));
  }
  revalidatePath(PATH);
  backWith(PATH, "ok", "Pengeluaran bahan berhasil dicatat.");
}
