"use server";

import { requireUser } from "@/lib/auth";
import { askBedrock, type ChatTurn } from "@/lib/bedrock";
import { buildOwnerSnapshot } from "@/modules/ai/service";

// AI Business Tracker untuk Owner (BRD P1). Bersifat baca saja.
// Hanya peran yang punya modul "ai-owner" (Owner) yang bisa memanggil fungsi ini.
export async function askOwnerAction(history: ChatTurn[]): Promise<string> {
  await requireUser("ai-owner");

  // Data diambil dari server dan dikirim sebagai konteks. Model tidak menjalankan SQL.
  const snapshot = await buildOwnerSnapshot();

  const system = `Anda adalah AI Business Tracker untuk Owner platform project-loe5, sebuah sistem operasional pabrik garmen di Ciwidey.
Tugas Anda menjawab pertanyaan Owner tentang kondisi bisnis berdasarkan DATA di bawah.

Aturan:
- Jawab dalam Bahasa Indonesia yang singkat, jelas, dan profesional.
- Gunakan hanya angka yang ada di DATA. Jika data tidak tersedia, katakan dengan jujur bahwa datanya belum ada.
- Anda hanya bisa membaca data. Jangan menyatakan bahwa Anda sudah mengubah, menyetujui, atau menghapus sesuatu.
- Format rupiah dengan pemisah ribuan, misalnya Rp 1.250.000.

DATA (JSON, waktu server):
${snapshot}`;

  return askBedrock(system, history);
}
