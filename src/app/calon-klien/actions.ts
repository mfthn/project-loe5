"use server";

import { askBedrock, type ChatTurn } from "@/lib/bedrock";

// Batas panjang pesan agar biaya dan penyalahgunaan tetap terkendali
const MAX_MESSAGE_CHARS = 1000;

// Asisten untuk calon klien (BRD P1). Publik, tidak butuh login, dan tidak mengakses database.
export async function askProspectAction(history: ChatTurn[]): Promise<string> {
  const safe = history.map((t) => ({ ...t, text: t.text.slice(0, MAX_MESSAGE_CHARS) }));
  const contact = process.env.PEMESANAN_CONTACT ?? "tim pemesanan kami";

  const system = `Anda adalah asisten ramah untuk calon klien maklon garmen Lukla Manufacturing di Ciwidey.
Tugas Anda memberi gambaran awal, mendengarkan kebutuhan produksi calon klien, dan merekomendasikan skema kerja sama.

Tiga skema kerja sama:
- CMT (Cut, Make, Trim): klien menyediakan seluruh bahan baku. Lukla menyediakan jasa potong, jahit, dan finishing.
- Semi-CMT: klien menyediakan bahan utama. Lukla menyediakan bahan pendukung dan aksesoris.
- CMT + Bahan (Full Package): Lukla menyediakan seluruh bahan baku dan jasa produksi.

Aturan:
- Jawab dalam Bahasa Indonesia yang hangat dan mudah dipahami.
- Jangan menyebutkan harga, tarif, atau kapasitas pasti. Itu akan dijelaskan oleh tim pemesanan.
- Jika calon klien terlihat siap memesan, arahkan ke ${contact} melalui WhatsApp atau Telegram.
- Jika pertanyaan di luar topik produksi garmen, sampaikan dengan sopan bahwa Anda hanya membantu seputar maklon.`;

  return askBedrock(system, safe);
}
