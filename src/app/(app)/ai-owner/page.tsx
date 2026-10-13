import { requireUser } from "@/lib/auth";
import { ChatBox } from "@/components/ChatBox";
import { askOwnerAction } from "./actions";

export default async function AiOwnerPage() {
  await requireUser("ai-owner");
  return (
    <div>
      <h1>AI Business Tracker</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Tanyakan kondisi pesanan, stok, output, QC, atau payroll. Asisten hanya membaca data.
      </p>
      <ChatBox
        title="Tanya data bisnis"
        placeholder="Contoh: berapa output pcs hari ini?"
        intro="Halo. Saya bisa membantu melacak data bisnis: pesanan, stok per klien, output hari ini, hasil QC 7 hari terakhir, dan payroll terakhir."
        send={askOwnerAction}
      />
    </div>
  );
}
