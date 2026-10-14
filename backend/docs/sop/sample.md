# SOP Fitur: Sample dan Time Study

| | |
|---|---|
| Modul | Sample & Time Study (`/sample`) |
| Kebutuhan | FR-1 s.d. FR-4 (sample, versioning, time study, konversi ke order) |
| Peran utama | TIM_SAMPLE, OWNER |
| Versi dokumen | 1.0 |
| Tanggal | 13 Oktober 2026 |
| Status | Draft, berbasis perilaku kode saat ini |

Sumber kebenaran: `src/modules/sample/service.ts`, `src/app/(app)/sample/actions.ts`, `src/app/(app)/sample/page.tsx`, `prisma/schema/sample.prisma`, `prisma/manual/01_constraints_triggers.sql` bagian 6.

---

## 1. Tujuan dan ruang lingkup

SOP ini mengatur:

1. Pembuatan master sample baru.
2. Pembuatan versi revisi yang berantai (v1, v2, v3, dst.).
3. Persetujuan versi (DRAFT menjadi APPROVED).
4. Pencatatan time study dengan stopwatch dan pemakaian bahan sample.
5. Konversi versi yang sudah disetujui menjadi order produksi massal.

---

## 2. Peran dan hak akses

| Peran | Hak |
|---|---|
| TIM_SAMPLE | Membuat sample, menambah versi, menyetujui, mencatat time study dan pemakaian bahan, mengonversi ke order |
| OWNER | Sama dengan TIM_SAMPLE (akses penuh) |
| Peran lain | Tidak memiliki akses ke modul ini |

---

## 3. Alur bisnis

Alur utama mengikuti siklus hidup versi sample:

1. **Sample baru** dibuat dengan kode unik (contoh `SMP-002`) dan nama.
2. **Versi pertama** dibuat lewat "Tambah revisi". Versi selalu berstatus `DRAFT`.
3. Setiap **revisi** berikutnya otomatis menjadi nomor versi berikutnya (`v(n+1)`) dan terhubung ke versi sebelumnya lewat `parentId`, sehingga riwayat tidak hilang.
4. Tim sample **menyetujui** versi. Hanya versi `DRAFT` yang bisa disetujui; status berubah menjadi `APPROVED`.
5. Versi `APPROVED` bisa **dikonversi** menjadi order produksi massal. Saat konversi, seluruh riwayat versi sampai versi yang dikonversi disimpan sebagai snapshot di `spec_json` order, dan versi berubah menjadi `CONVERTED`.
6. **Time study** (waktu per komponen) dan **pemakaian bahan** dicatat selama proses pengembangan sample.

Status versi: `DRAFT` → `APPROVED` → `CONVERTED`. Tidak ada jalan mundur dari `CONVERTED`.

---

## 4. Langkah operasional

### 4.1 Membuat sample baru

1. Login sebagai `sample@loe.test`.
2. Pada kartu **Sample baru**, isi **Kode** (unik, contoh `SMP-002`) dan **Nama** (contoh `Hoodie Snøhund`).
3. Klik **Buat sample**. Hasil: "Sample dibuat."

### 4.2 Menambah versi (revisi)

1. Pada kartu **Versi sample**, temukan blok sample yang diinginkan.
2. Isi **Catatan revisi spesifikasi** (misal "Ganti karet lengan menjadi rib").
3. Klik **Tambah revisi**. Hasil: "Versi baru dibuat sebagai DRAFT dan terhubung ke versi sebelumnya."
4. Tabel versi menampilkan baris baru dengan nomor versi berikutnya dan status `DRAFT`.

### 4.3 Menyetujui versi

1. Pada tabel versi, tombol **Setujui** hanya muncul di baris berstatus `DRAFT`.
2. Klik **Setujui**. Status berubah menjadi `APPROVED` (badge hijau).
3. Versi `APPROVED` muncul di pilihan form konversi.

### 4.4 Mencatat time study

1. Pada kartu **Stopwatch time study**, pilih **Sample**.
2. Isi **Nama komponen** (contoh "Lengan kiri").
3. Gunakan stopwatch untuk mengukur, lalu klik **Simpan waktu**. Hasil: "Waktu pengerjaan dicatat."
4. Jumlah total catatan time study tampil di bawah form.

### 4.5 Mencatat pemakaian bahan

1. Pada kartu **Pemakaian bahan sample**, pilih **Sample**, isi **Bahan**, **Jumlah** (lebih dari 0), dan **Satuan** (default `meter`).
2. Klik **Catat pemakaian**. Hasil: "Pemakaian bahan sample dicatat."

### 4.6 Konversi ke order produksi massal

1. Pada kartu **Konversi ke order produksi massal** (hanya tampil jika ada versi `APPROVED`), isi:
   - **Versi disetujui**: pilih versi (contoh `SMP-001 v1`).
   - **Klien**: pemilik order.
   - **Skema**: `CMT`, `Semi-CMT`, atau `CMT + Bahan`.
   - **Kode order**: unik (contoh `ORD-2026-001`).
   - **Target pcs**: lebih dari 0.
2. Centang **Saya konfirmasi order ini**. Konversi akan ditolak tanpa centang ini.
3. Klik **Buat order**. Hasil: "Order produksi massal dibuat dengan riwayat versi sample."

Order hasil konversi tersedia di modul Gudang dan Produksi untuk pemakaian selanjutnya.

---

## 5. Aturan bisnis dan validasi

| Aturan | Lapisan penjaga | Referensi |
|---|---|---|
| Kode dan nama sample wajib diisi | Aplikasi | `createSample` |
| Nomor versi = versi tertinggi + 1, `parentId` menunjuk versi sebelumnya | Aplikasi | `addSampleVersion` |
| Versi baru selalu berstatus `DRAFT` | Aplikasi | `addSampleVersion` |
| Hanya versi `DRAFT` yang bisa disetujui | Aplikasi | `approveSampleVersion` |
| Konversi wajib mendapat konfirmasi (checkbox) | Aplikasi | `convertToOrder` |
| Target qty harus lebih dari 0 | Aplikasi | `convertToOrder` |
| Konversi hanya boleh dari versi berstatus `APPROVED` | Aplikasi dan database (trigger `sample_versions_guard`) | `convertToOrder`, `01_constraints_triggers.sql` |
| Order hasil konversi menyimpan snapshot riwayat versi (nomor, status, spesifikasi) di `spec_json` | Aplikasi | `convertToOrder` |
| Konversi dan perubahan status versi berjalan dalam satu transaksi | Aplikasi | `convertToOrder` (`$transaction`) |
| `version_number >= 1` | Database (CHECK `sv_version_chk`) | `01_constraints_triggers.sql` |
| Versi selain `DRAFT` wajib punya `approved_at` | Database (CHECK `sv_approved_chk`) | `01_constraints_triggers.sql` |
| Versi `APPROVED` atau `CONVERTED` terkunci: `spec_json`, `version_number`, `sample_id`, dan `approved_at` tidak boleh berubah | Database (trigger `sample_versions_guard`) | `01_constraints_triggers.sql` |
| Versi `CONVERTED` tidak bisa diubah statusnya kembali | Database (trigger `sample_versions_guard`) | `01_constraints_triggers.sql` |
| `UNIQUE (sample_id, version_number)` | Skema Prisma | `sample.prisma` |
| Time study: nama komponen wajib, detik lebih dari 0 | Aplikasi | `addTimeStudy` |
| Pemakaian bahan: nama bahan wajib, jumlah lebih dari 0 | Aplikasi | `addMaterialUse` |

---

## 6. Pesan error dan penanganan

| Pesan | Penyebab | Penanganan |
|---|---|---|
| "Kode dan nama sample wajib diisi." | Form sample baru kosong | Isi kedua kolom (form browser seharusnya mencegah kosong) |
| "Versi sample tidak ditemukan." | ID versi tidak valid atau sudah terhapus | Muat ulang halaman, pilih versi dari daftar terbaru |
| "Hanya versi berstatus DRAFT yang bisa disetujui." | Menekan Setujui dua kali atau pada versi APPROVED/CONVERTED | Periksa status versi; hanya DRAFT yang bisa disetujui |
| "Konfirmasi diperlukan sebelum order massal disetujui." | Checkbox "Saya konfirmasi order ini" tidak dicentang | Centang checkbox lalu kirim ulang |
| "Target jumlah harus lebih dari 0." | Target pcs 0 atau negatif | Isi jumlah pcs yang valid |
| "Versi harus APPROVED sebelum dikonversi." | Versi masih DRAFT atau sudah CONVERTED | Setujui dulu versi DRAFT; versi CONVERTED tidak bisa dikonversi ulang |
| "Nama komponen wajib diisi." / "Waktu harus lebih dari 0 detik." | Time study tidak lengkap | Isi nama komponen dan waktu positif |
| "Nama bahan wajib diisi." / "Jumlah pemakaian harus lebih dari 0." | Pemakaian bahan tidak lengkap | Isi nama dan jumlah positif |
| Pelanggaran `UNIQUE (sample_id, version_number)` | Dua versi dengan nomor sama (anomali konkurensi) | Muat ulang halaman dan buat revisi ulang |
| "Versi sudah disetujui, spesifikasinya terkunci" (dari database) | Percobaan mengubah spesifikasi versi APPROVED/CONVERTED | Buat revisi baru sebagai versi berikutnya, jangan mengubah versi lama |

---

## 7. Skenario uji

- [ ] Buat sample `SMP-002`, tambah revisi v1 (DRAFT), revisi v2 otomatis terhubung ke v1.
- [ ] Setujui v1: status menjadi APPROVED dan tombol Setujui hilang.
- [ ] Coba setujui v1 kembali: ditolak ("Hanya versi berstatus DRAFT...").
- [ ] Konversi v1 tanpa mencentang konfirmasi: ditolak.
- [ ] Konversi v1 dengan konfirmasi: order dibuat, v1 menjadi CONVERTED, `spec_json` order memuat riwayat v1.
- [ ] Coba konversi versi yang sama lagi: tidak muncul di pilihan (status sudah CONVERTED) dan ditolak bila dipaksa.
- [ ] Catat time study 0 detik: ditolak ("Waktu harus lebih dari 0 detik.").
- [ ] Catat pemakaian bahan dengan jumlah 0: ditolak.
- [ ] Konfirmasi di database: versi APPROVED tidak bisa diubah spesifikasinya (trigger `sample_versions_guard`).

---

## 8. Catatan teknis

| Aspek | Lokasi |
|---|---|
| Logika bisnis | `src/modules/sample/service.ts` (`createSample`, `addSampleVersion`, `approveSampleVersion`, `convertToOrder`, `addTimeStudy`, `addMaterialUse`) |
| Server actions | `src/app/(app)/sample/actions.ts` |
| Halaman | `src/app/(app)/sample/page.tsx`, komponen `src/components/Stopwatch.tsx` |
| Tabel terkait | `samples`, `sample_versions`, `time_studies`, `sample_material_uses`, `production_orders` |
| Enum terkait | `SampleVersionStatus` (DRAFT, APPROVED, CONVERTED), `Scheme` (CMT, SEMI_CMT, FULL_PACKAGE) |
| Trigger terkait | `sample_versions_guard` (kunci spesifikasi versi terkonversi) |

Data uji dari seed: sample `SMP-001` "Kaos Basic Oversize" dengan v1 berstatus `APPROVED`, siap dikonversi.

Spesifikasi disimpan sebagai JSON. Form UI mengisinya sebagai `{ "catatan": "<teks bebas>" }`, dan riwayat versi ikut tersimpan di `spec_json` order dengan struktur `{ sampel, versiDikonversi, riwayat: [{ versi, status, spec }] }`.

---

## 9. Keterbatasan dan rencana perubahan

1. **Time study dan pemakaian bahan terikat ke sample di kode, ke versi di skema.** Service saat ini mengisi `sampleId`, sedangkan `prisma/schema/sample.prisma` terbaru mengikat `time_studies` dan `sample_material_uses` ke `sample_version_id` (waktu bisa berbeda antarversi). Rencana: pindahkan input time study ke tingkat versi.
2. **Persetujuan belum mengisi `approved_by` dan `approved_at`.** Skema baru mewajibkan `approved_at` terisi untuk status selain DRAFT (CHECK `sv_approved_chk`). Rencana: isi kedua kolom saat `approveSampleVersion` dan saat konversi.
3. **`spec_json` versi hanya berisi teks bebas `catatan`.** Struktur lengkap (bahan, warna, ukuran) sesuai BRD menunggu desain form lanjutan.
4. **Pemilihan klien pada form konversi tidak divalidasi terhadap klien pemilik sample.** Sample bisa saja dibuat tanpa klien; pemilihan klien order bebas sesuai kebutuhan bisnis.
5. **Status `production_orders` masih selalu `OPEN` setelah konversi.** Perubahan otomatis ke `IN_PRODUCTION` atau `QC` termasuk keputusan terbuka no. 6 di `desain-database-project-loe5.md`.

---

## 10. Riwayat versi dokumen

| Versi | Tanggal | Perubahan | Oleh |
|---|---|---|---|
| 1.0 | 13 Oktober 2026 | Penyusunan awal dari kode saat ini | Tim proyek |
