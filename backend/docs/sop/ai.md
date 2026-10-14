# SOP Fitur: Asisten AI (AI Business Tracker dan Calon Klien)

| | |
|---|---|
| Modul | AI Business Tracker (`/ai-owner`) dan Asisten Calon Klien (`/calon-klien`, publik) |
| Kebutuhan | P1: dua asisten berbasis Amazon Bedrock (Converse API) |
| Peran utama | OWNER (Business Tracker), publik tanpa login (calon klien) |
| Versi dokumen | 1.0 |
| Tanggal | 13 Oktober 2026 |
| Status | Draft, berbasis perilaku kode saat ini |

Sumber kebenaran: `src/lib/bedrock.ts`, `src/modules/ai/service.ts`, `src/app/(app)/ai-owner/*`, `src/app/calon-klien/*`, `src/components/ChatBox.tsx`, `prisma/schema/ai.prisma`.

---

## 1. Tujuan dan ruang lingkup

SOP ini mengatur:

1. AI Business Tracker: asisten baca-saja untuk Owner yang menjawab pertanyaan bisnis berdasarkan ringkasan data dari server.
2. Asisten calon klien: asisten publik tanpa login yang memberi gambaran skema kerja sama maklon.
3. Konfigurasi kredensial dan model Amazon Bedrock.
4. Batasan keamanan kedua asisten (baca-saja, tanpa SQL bebas, tanpa akses database untuk asisten calon klien).
5. Penanganan saat layanan AI belum dikonfigurasi atau sedang bermasalah.

---

## 2. Peran dan hak akses

| Kanal | Akses | Sumber data |
|---|---|---|
| OWNER_TRACKER (`/ai-owner`) | Hanya peran dengan modul `ai-owner` (OWNER) | Ringkasan JSON yang disusun server dari database |
| PROSPECT (`/calon-klien`) | Publik, tanpa login | Tidak ada; hanya instruksi sistem dan riwayat percakapan |

Kedua asisten bersifat **baca-saja**. Model tidak pernah diberi kemampuan menulis, mengubah, atau menghapus data.

---

## 3. Alur bisnis

### 3.1 AI Business Tracker

1. Owner membuka `/ai-owner` dan mengetik pertanyaan (contoh: "berapa output pcs hari ini?").
2. Server menyusun **snapshot data** terkini lewat `buildOwnerSnapshot()`: pesanan per status, stok per klien, total output pcs hari ini, rekap QC 7 hari terakhir, jumlah penjahit aktif, dan payroll terakhir.
3. Snapshot (JSON) dimasukkan ke instruksi sistem bersama aturan jawaban: Bahasa Indonesia singkat, hanya memakai angka dari data, tidak boleh menyatakan mengubah data, format rupiah dengan pemisah ribuan.
4. Percakapan dikirim ke model lewat Converse API (temperatur 0.2, maksimum 800 token, 10 giliran terakhir).
5. Jawaban model ditampilkan di kotak chat.

### 3.2 Asisten calon klien

1. Siapa pun membuka http://localhost:3000/calon-klien tanpa login.
2. Pengguna menjelaskan kebutuhan produksinya.
3. Instruksi sistem memuat tiga skema kerja sama (CMT, Semi-CMT, CMT + Bahan), melarang penyebutan harga dan kapasitas pasti, dan mengarahkan calon klien yang siap memesan ke kontak pemesanan (`PEMESANAN_CONTACT`).
4. Setiap giliran percakapan dipotong maksimal 1.000 karakter sebelum dikirim.
5. Asisten tidak mengakses database apa pun.

---

## 4. Langkah operasional

### 4.1 Konfigurasi (admin)

1. Siapkan variabel di `.env`:

   | Variabel | Contoh | Keterangan |
   |---|---|---|
   | `AWS_REGION` | `ap-southeast-1` | Region Bedrock; default `us-east-1` bila kosong |
   | `AWS_BEARER_TOKEN_BEDROCK` | (API key) | Dibaca otomatis AWS SDK; jangan commit atau bagikan |
   | `BEDROCK_MODEL_ID` | `us.anthropic.claude-3-5-haiku-20241022-v1:0` | Default bila kosong |
   | `PEMESANAN_CONTACT` | `+62 8xx-xxxx-xxxx (WhatsApp)` | Kontak yang disebut asisten calon klien |

2. Aktifkan akses model di konsol AWS Bedrock (menu Model access) pada region yang sama dengan `AWS_REGION`.
3. Jalankan ulang aplikasi agar variabel baru terbaca.

### 4.2 Memakai AI Business Tracker

1. Login sebagai `owner@loe.test`, buka **AI Business Tracker**.
2. Ketik pertanyaan dan tekan **Kirim**. Contoh pertanyaan yang didukung:
   - "Berapa output pcs hari ini?"
   - "Pesanan apa saja yang masih OPEN?"
   - "Berapa sisa stok Klien Maklon A?"
   - "Bagaimana hasil QC 7 hari terakhir?"
   - "Berapa total payroll periode terakhir?"
3. Jawaban hanya berdasarkan angka pada snapshot; bila data belum ada, asisten menyatakannya dengan jujur.

### 4.3 Memakai asisten calon klien

1. Buka http://localhost:3000/calon-klien (tanpa login).
2. Ceritakan kebutuhan, contoh: "Saya ingin produksi 500 kaos, bahan sudah saya siapkan."
3. Asisten merekomendasikan skema yang sesuai dan, bila siap memesan, mengarahkan ke kontak pemesanan.

### 4.4 Bila layanan AI belum dikonfigurasi

- Tanpa API key dan tanpa kredensial AWS, asisten menjawab: "Layanan AI belum dikonfigurasi. Hubungi admin untuk mengatur API key Amazon Bedrock."
- Aplikasi tetap berjalan normal untuk seluruh modul non-AI.

---

## 5. Aturan bisnis dan validasi

| Aturan | Lapisan penjaga | Referensi |
|---|---|---|
| Hanya peran dengan modul `ai-owner` yang boleh memanggil aksi pertanyaan Owner | Aplikasi (`requireUser("ai-owner")`) | `ai-owner/actions.ts` |
| Konteks Owner disusun di server; model tidak menjalankan SQL dan tidak mengakses API tulis | Aplikasi | `buildOwnerSnapshot` |
| Instruksi sistem melarang asisten menyatakan mengubah, menyetujui, atau menghapus data | Aplikasi (system prompt) | `ai-owner/actions.ts` |
| Asisten calon klien tidak mengakses database | Aplikasi | `calon-klien/actions.ts` |
| Setiap giliran percakapan dipotong maksimal 1.000 karakter | Aplikasi | `askProspectAction` (`MAX_MESSAGE_CHARS`) |
| Riwayat yang dikirim dibatasi 10 giliran terakhir, dan giliran pertama harus dari user (syarat Converse API) | Aplikasi | `askBedrock` |
| Temperatur rendah (0.2) dan batas 800 token agar jawaban angka tidak mengarang | Aplikasi | `askBedrock` |
| Pesan user disimpan sebagai teks pada payload model, bukan dieksekusi | Aplikasi | `askBedrock` (`ConverseCommand`) |
| Ketersediaan layanan diperiksa sebelum memanggil model | Aplikasi | `askBedrock` |
| Panjang `question` pada log dibatasi 1.000 karakter | Database (CHECK `aiq_question_len_chk`) dan aplikasi | `01_constraints_triggers.sql` |
| Tabel `ai_query_logs` menolak UPDATE (retensi penghapusan dilakukan role khusus) | Database (trigger `ai_query_logs_no_update`) | `01_constraints_triggers.sql` |

---

## 6. Pesan error dan penanganan

| Pesan | Penyebab | Penanganan |
|---|---|---|
| "Layanan AI belum dikonfigurasi. Hubungi admin untuk mengatur API key Amazon Bedrock." | `AWS_BEARER_TOKEN_BEDROCK` dan `AWS_ACCESS_KEY_ID` sama-sama kosong | Atur API key Bedrock di `.env`, lalu jalankan ulang aplikasi |
| "Maaf, layanan AI sedang tidak tersedia. Coba lagi beberapa saat." | Error dari Bedrock (model belum aktif, region salah, kredensial kedaluwarsa, gangguan layanan) | Cek `AWS_BEARER_TOKEN_BEDROCK`, `AWS_REGION`, `BEDROCK_MODEL_ID`, dan status Model access di konsol Bedrock; lihat log server "Bedrock error:" |
| "Maaf, model tidak memberikan jawaban." | Respons model kosong | Ulangi pertanyaan; bila berulang, ganti model |
| "Silakan tulis pertanyaan Anda." | Percakapan kosong saat dikirim | Ketik pertanyaan terlebih dahulu |
| "Koneksi terputus. Silakan coba lagi." (dari antarmuka chat) | Gangguan jaringan antara browser dan server | Coba kirim ulang |
| Jawaban berbeda dari data sebenarnya | Model salah menafsirkan snapshot | Pertegas pertanyaan (sebut objek dan waktu, misal "output pcs hari ini"); jangan gunakan jawaban sebagai bukti angka resmi |

---

## 7. Skenario uji

- [ ] Tanpa API key: kedua asisten menampilkan pesan "Layanan AI belum dikonfigurasi..." dan aplikasi tetap berjalan.
- [ ] Dengan API key aktif: tanyakan "berapa output pcs hari ini?" sebagai Owner; angka jawaban sesuai total `output_records` hari ini.
- [ ] Tanyakan sesuatu yang tidak ada datanya (misal "berapa laba bulan ini?"); asisten menyatakan data belum tersedia, tidak mengarang.
- [ ] Mintalah asisten menyatakan bahwa ia mengubah data; asisten menolak karena hanya bisa membaca.
- [ ] Buka `/ai-owner` sebagai `gudang@loe.test`: ditolak (modul tidak sesuai peran).
- [ ] Sebagai publik di `/calon-klien`, kirim pesan lebih dari 1.000 karakter: pesan dipotong dan permintaan tetap diproses.
- [ ] Di `/calon-klien`, tanyakan harga: asisten tidak menyebutkan angka harga dan mengarahkan ke kontak pemesanan.
- [ ] Uji batas riwayat: kirim lebih dari 10 pesan, layanan tetap berjalan (hanya 10 giliran terakhir yang dikirim).

---

## 8. Catatan teknis

| Aspek | Lokasi |
|---|---|
| Klien Bedrock dan `askBedrock` | `src/lib/bedrock.ts` (BedrockRuntimeClient, ConverseCommand) |
| Snapshot data Owner | `src/modules/ai/service.ts` (`buildOwnerSnapshot`) |
| Aksi asisten Owner | `src/app/(app)/ai-owner/actions.ts` (`askOwnerAction`) |
| Aksi asisten calon klien | `src/app/calon-klien/actions.ts` (`askProspectAction`) |
| Komponen chat bersama | `src/components/ChatBox.tsx` (riwayat di state browser, intro tidak dikirim sebagai giliran asisten) |
| Tabel terkait | `ai_query_logs` (skema tersedia, ditulis oleh trigger/jalur logging bila sudah diaktifkan), `audit_logs` |
| Enum terkait | `AiChannel` (OWNER_TRACKER, PROSPECT) |

Isi snapshot Owner (`buildOwnerSnapshot`): tanggal hari ini (WIB), pesanan per status, stok per klien, total output pcs hari ini, rekap QC 7 hari terakhir per status, jumlah alokasi penjahit aktif, dan payroll terakhir (periode serta hasilnya).

---

## 9. Keterbatasan dan rencana perubahan

1. **Pertanyaan dan jawaban belum dicatat ke `ai_query_logs`.** Skema dan trigger log tersedia, tetapi `askOwnerAction` dan `askProspectAction` belum menulis log. Rencana: catat setiap percakapan (channel, user, question, answer, token) untuk audit, evaluasi kualitas, dan pemantauan biaya.
2. **Retensi 90 hari untuk pertanyaan calon klien belum berjalan.** Kebijakan di dokumen desain (hapus setelah 90 hari, tanpa penyimpanan IP) menunggu job retensi yang memakai role khusus, karena tabel menolak UPDATE.
3. **Belum ada rate limit untuk kanal publik `/calon-klien`.** Tercatat di `README.md` bagian Batasan MVP; perlu pembatasan sebelum rilis.
4. **Riwayat chat tidak tersimpan di server.** Refresh halaman menghapus percakapan; kesinambungan percakapan antarperangkat belum didukung.
5. **Kredensial di `.env.example`.** Pastikan file `.env.example` hanya berisi placeholder, tanpa kredensial nyata; kredensial AWS yang asli hanya di `.env` lokal dan lingkungan runtime, serta harus dirotasi bila pernah ter-commit.
6. **Pilihan model.** Default `us.anthropic.claude-3-5-haiku-20241022-v1:0` cukup untuk MVP; evaluasi model lain bila perlu akurasi angka yang lebih tinggi atau biaya lebih rendah.

---

## 10. Riwayat versi dokumen

| Versi | Tanggal | Perubahan | Oleh |
|---|---|---|---|
| 1.0 | 13 Oktober 2026 | Penyusunan awal dari kode saat ini | Tim proyek |
