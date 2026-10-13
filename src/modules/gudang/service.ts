// Logika Gudang Multi-Klien dan Anti-Kontaminasi Silang (FR-5, FR-6).
// Semua aturan keamanan stok ada di sini, bukan di halaman.
import { db } from "@/lib/db";
import type { StockType } from "@prisma/client";

// Error khusus agar UI bisa membedakan pemblokiran dari error biasa.
export class BlockedTransactionError extends Error {}

// FR-6.1: menerima bahan dengan Tag Klien dan ID Pesanan yang wajib diisi.
export async function receiveStock(input: {
  code: string;
  name: string;
  type: StockType;
  clientId: string;
  orderId: string;
  quantity: number;
  unit: string;
}) {
  if (!input.clientId || !input.orderId) {
    throw new Error("Tag ID Klien dan ID Pesanan wajib diisi sebelum bahan disimpan.");
  }
  if (!(input.quantity > 0)) throw new Error("Jumlah harus lebih dari 0.");

  // Pesanan harus ada dan benar-benar milik klien yang dipilih
  const order = await db.productionOrder.findUnique({ where: { id: input.orderId } });
  if (!order || order.clientId !== input.clientId) {
    throw new Error("Pesanan tidak ditemukan atau bukan milik klien yang dipilih.");
  }

  return db.$transaction(async (tx) => {
    const item = await tx.stockItem.create({
      data: {
        code: input.code,
        name: input.name,
        type: input.type,
        clientId: input.clientId,
        orderId: input.orderId,
        quantity: input.quantity,
        unit: input.unit,
      },
    });
    await tx.stockMovement.create({
      data: {
        itemId: item.id,
        direction: "IN",
        quantity: input.quantity,
        orderId: input.orderId,
        note: "Penerimaan bahan",
      },
    });
    return item;
  });
}

// FR-6.2: mengeluarkan bahan ke pesanan. Diblokir sebelum transaksi tercatat jika tag tidak cocok.
export async function issueStock(input: {
  userId: string;
  itemId: string;
  orderId: string;
  quantity: number;
}) {
  const item = await db.stockItem.findUnique({
    where: { id: input.itemId },
    include: { client: true },
  });
  const order = await db.productionOrder.findUnique({
    where: { id: input.orderId },
    include: { client: true },
  });
  if (!item) throw new Error("Item stok tidak ditemukan.");
  if (!order) throw new Error("Pesanan tujuan tidak ditemukan.");

  // Pemeriksaan kecocokan klien dan pesanan. Jika tidak cocok, catat percobaan lalu tolak.
  if (item.clientId !== order.clientId || item.orderId !== order.id) {
    await db.auditLog.create({
      data: {
        userId: input.userId,
        action: "BLOCKED_ISSUE",
        detail: {
          itemCode: item.code,
          itemOwner: item.client.name,
          targetOrder: order.code,
          targetClient: order.client.name,
        },
      },
    });
    throw new BlockedTransactionError(
      `Ditolak: bahan ${item.code} milik ${item.client.name} tidak boleh dikeluarkan untuk pesanan ${order.code} milik ${order.client.name}.`,
    );
  }

  if (!(input.quantity > 0)) throw new Error("Jumlah harus lebih dari 0.");
  if (input.quantity > item.quantity) {
    throw new Error(`Stok tidak cukup. Tersisa ${item.quantity} ${item.unit} untuk ${item.code}.`);
  }

  return db.$transaction(async (tx) => {
    await tx.stockItem.update({
      where: { id: item.id },
      data: { quantity: { decrement: input.quantity } },
    });
    await tx.stockMovement.create({
      data: {
        itemId: item.id,
        direction: "OUT",
        quantity: input.quantity,
        orderId: order.id,
        note: "Pengeluaran ke cutting",
      },
    });
  });
}
