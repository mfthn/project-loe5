// Logika QC dan Barang Jadi (FR-8, FR-9).
import { db } from "@/lib/db";
import type { QcStatus } from "@prisma/client";

// Mencatat hasil QC. Catatan bersifat append-only, tidak ada fungsi edit.
export async function recordQc(input: {
  orderId: string;
  inspectorId: string;
  component: string;
  qty: number;
  status: QcStatus;
  defectCategory?: string;
  note?: string;
}) {
  if (!(input.qty > 0)) throw new Error("Jumlah harus lebih dari 0.");
  // Status REPAIR atau DEFECT wajib disertai kategori cacat (FR-9)
  if (input.status !== "LOLOS" && !input.defectCategory) {
    throw new Error("Kategori cacat wajib diisi untuk status Repair atau Defect.");
  }
  return db.qcRecord.create({
    data: {
      orderId: input.orderId,
      inspectorId: input.inspectorId,
      component: input.component,
      qty: input.qty,
      status: input.status,
      defectCategory: input.status === "LOLOS" ? null : input.defectCategory,
      note: input.note || null,
    },
  });
}
