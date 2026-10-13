import { ChatBox } from "@/components/ChatBox";
import { askProspectAction } from "./actions";

// Halaman publik untuk calon klien. Tidak memerlukan login.
export default function CalonKlienPage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
      <h1>Konsultasi Maklon Garmen</h1>
      <p className="muted" style={{ marginBottom: 18 }}>
        Ceritakan kebutuhan produksi Anda. Asisten akan membantu memilih skema kerja sama yang sesuai.
      </p>
      <ChatBox
        title="Asisten calon klien"
        placeholder="Contoh: saya ingin produksi 500 kaos, bahan sudah saya siapkan"
        intro="Halo, selamat datang. Ceritakan jenis produk dan jumlah yang ingin Anda produksi, saya bantu carikan skema yang cocok."
        send={askProspectAction}
      />
    </main>
  );
}
