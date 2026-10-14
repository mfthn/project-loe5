# SOP Fitur: Produksi dan Output 30 Menit

| | |
|---|---|
| Modul | Produksi & Output (`/produksi`) |
| Kebutuhan | FR-7.1 (alokasi dinamis), FR-7.2 (rate card), FR-7.3 (output 30 menit), Story 1.2 (kunci verifikasi) |
| Peran utama | KEPALA_PRODUKSI (mandor), PENJAHIT, OWNER |
| Versi dokumen | 1.0 |
| Tanggal | 13 Oktober 2026 |
| Status | Draft, berbasis perilaku kode saat ini |

Sumber kebenaran: `src/modules/produksi/service.ts`, `src/app/(app)/produksi/actions.ts`, `src/app/(app)/produksi/page.tsx`, `src/lib/format.ts` (`floorTo30Min`), `prisma/schema/produksi.prisma`, `prisma/manual/01_constraints_triggers.sql` bagian 5.

---

## 1. Tujuan dan ruang lingkup

SOP ini mengatur:

1. Alokasi penjahit ke line produksi (kapasitas dinamis hingga ±70 mesin dengan menambah baris line).
2. Pencatatan output per interval 30 menit oleh mandor.
3. Verifikasi output oleh mandor yang mengunci catatan.
4. Hak ubah penjahit: hanya catatan miliknya yang belum diverifikasi.
5. Prasyarat tarif: komponen harus punya rate card untuk klien pesanan.

---

## 2. Peran dan hak akses

| Peran | Hak |
|---|---|
| KEPALA_PRODUKSI (mandor) | Mengatur alokasi, mencatat output, memverifikasi, mengubah catatan yang belum diverifikasi, melihat seluruh riwayat output |
| OWNER | Sama dengan mandor (diperiksa eksplisit di server action) |
| PENJAHIT | Melihat dan mengubah pcs catatan miliknya sendiri yang belum diverifikasi; tidak bisa mencatat output baru atau memverifikasi |
| Peran lain | Tidak memiliki akses ke modul ini |

Pembatasan per aksi dilakukan dua lapis: `requireUser("produksi")` lalu pemeriksaan peran `KEPALA_PRODUKSI` atau `OWNER` untuk aksi alokasi, input output, dan verifikasi.

---

## 3. Alur bisnis

1. **Alokasi**: mandor menempatkan penjahit ke sebuah line. Alokasi aktif sebelumnya untuk penjahit tersebut otomatis dinonaktifkan, sehingga satu penjahit hanya berada di satu line dalam satu waktu.
2. **Input output**: setiap 30 menit, mandor mencatat pcs selesai per pesanan, line, penjahit, dan komponen. Waktu catatan dibulatkan ke bawah ke batas :00 atau :30 (WIB). Sebelum menyimpan, sistem memastikan penjahit sedang dialokasikan ke line tersebut dan komponen punya tarif.
3. **Edit oleh penjahit**: penjahit bisa memperbaiki jumlah pcs pada catatannya sendiri selama belum diverifikasi (misal salah input).
4. **Verifikasi mandor**: mandor memverifikasi catatan yang sudah benar. Setelah diverifikasi, catatan terkunci permanen dan menjadi dasar perhitungan payroll.
5. **Payroll**: hanya catatan terverifikasi yang masuk hitung borongan (lihat SOP Payroll).

Halaman memuat ulang dirinya setiap 30 detik agar dashboard line tetap segar.

---

## 4. Langkah operasional

### 4.1 Mengalokasikan penjahit (mandor)

1. Login sebagai `mandor1@loe.test`, buka **Produksi & Output**.
2. Pada kartu **Alokasi penjahit**, pilih **Penjahit** dan **Line** (contoh `Line A`).
3. Klik **Alokasikan**. Hasil: "Penjahit berhasil dialokasikan ke line."
4. Nama penjahit muncul di daftar line terkait. Jika sebelumnya berada di line lain, ia otomatis pindah (alokasi lama ditutup).

### 4.2 Mencatat output 30 menit (mandor)

1. Pada kartu **Input output 30 menit**, isi:
   - **Pesanan** (format `kode · klien`).
   - **Line** dan **Penjahit** (penjahit harus sedang dialokasikan ke line tersebut).
   - **Komponen** (contoh "Badan depan"; wajib sudah ada rate card untuk klien pesanan).
   - **Pcs selesai** (lebih dari 0).
2. Klik **Catat output**. Hasil: "Output 30 menit tercatat." Interval waktu otomatis dibulatkan ke :00 atau :30 terdekat di bawah.
3. Catatan muncul di **Riwayat output** dengan status "Menunggu".

### 4.3 Mengubah catatan sebelum verifikasi

- **Penjahit** (login `penjahit1@loe.test`): pada baris catatannya yang berstatus "Menunggu", ubah angka **pcs** lalu klik **Ubah**. Hasil: "Catatan output diperbarui."
- **Mandor**: dapat mengubah pcs catatan siapa pun yang belum diverifikasi.
- Setelah status "Terverifikasi", kolom ubah dan tombol verifikasi hilang, dan perubahan dari sisi server pun ditolak.

### 4.4 Memverifikasi output (mandor)

1. Pada baris berstatus "Menunggu", klik **Verifikasi**.
2. Hasil: "Output diverifikasi dan dikunci." Status berubah menjadi badge "Terverifikasi".
3. Verifikasi ulang pada catatan yang sama ditolak ("Catatan ini sudah diverifikasi.").

### 4.5 Menyiapkan tarif (prasyarat)

Sebelum output bisa dicatat, klien pesanan harus memiliki rate card untuk komponen tersebut. Data contoh dari seed:

| Klien | Komponen | Ongkos potong | Ongkos jahit |
|---|---|---|---|
| Klien Maklon A | Badan depan | 1.500 | 4.000 |
| Klien Maklon A | Lengan | 800 | 2.500 |
| Snøhund (internal) | Badan depan | 1.200 | 3.500 |

---

## 5. Aturan bisnis dan validasi

| Aturan | Lapisan penjaga | Referensi |
|---|---|---|
| Hanya mandor (KEPALA_PRODUKSI) dan OWNER yang boleh mengalokasikan, mencatat, dan memverifikasi | Aplikasi | `produksi/actions.ts` |
| Alokasi aktif sebelumnya penjahit dinonaktifkan saat dialokasikan ke line baru | Aplikasi (transaksi) | `allocateTailor` |
| Satu penjahit hanya boleh punya satu alokasi aktif | Database (index unik parsial `line_alloc_one_active_per_tailor` pada `ended_at IS NULL`) | `01_constraints_triggers.sql` |
| Jumlah pcs harus lebih dari 0 | Aplikasi dan database (CHECK `or_pcs_chk`) | `recordOutput`, `updateUnverifiedOutput` |
| Penjahit harus sedang dialokasikan ke line tempat output dicatat | Aplikasi | `recordOutput` |
| Komponen wajib punya rate card untuk klien pesanan sebelum output dicatat | Aplikasi | `recordOutput` |
| Waktu catatan dibulatkan ke bawah ke interval 30 menit | Aplikasi (`floorTo30Min`) dan database (CHECK `or_interval_chk` menit 0 atau 30 WIB) | `recordOutput` |
| Catatan yang sudah diverifikasi tidak bisa diubah sama sekali | Aplikasi (`verifyOutput`, `updateUnverifiedOutput`) dan database (trigger `output_records_guard_update`) | service, `01_constraints_triggers.sql` |
| Catatan yang sudah diverifikasi tidak bisa dihapus | Database (trigger `output_records_guard_delete`) | `01_constraints_triggers.sql` |
| Verifikasi mengunci: `verified_by` dan `verified_at` wajib terisi bersamaan; `wage_amount` wajib mengikuti `verified_at` | Database (CHECK `or_verify_pair_chk`, `or_wage_pair_chk`) | `01_constraints_triggers.sql` |
| Saat verifikasi, trigger mengisi `rate_applied` dari rate card yang berlaku pada tanggal interval lalu menghitung `wage_amount = pcs x rate_applied` | Database (trigger `output_records_guard_update`) | `01_constraints_triggers.sql` |
| Penjahit hanya melihat dan mengubah catatan miliknya sendiri | Aplikasi (filter kueri dan pemeriksaan pemilik) | `produksi/page.tsx`, `editOutputAction` |

---

## 6. Pesan error dan penanganan

| Pesan | Penyebab | Penanganan |
|---|---|---|
| "Hanya mandor yang bisa mengatur alokasi." / "... mencatat output." / "... memverifikasi." | Peran bukan KEPALA_PRODUKSI atau OWNER | Lakukan lewat akun mandor |
| "Jumlah pcs harus lebih dari 0." | Pcs 0 atau negatif | Isi jumlah valid |
| "Penjahit tidak dialokasikan ke line ini." | Penjahit dipindah line atau belum dialokasikan | Alokasikan penjahit ke line yang benar terlebih dahulu |
| "Pesanan tidak ditemukan." | ID pesanan tidak valid | Muat ulang halaman dan pilih ulang |
| `Rate card untuk komponen "X" belum diatur.` | Komponen belum punya tarif untuk klien pesanan | Tambahkan rate card untuk klien dan komponen tersebut, lalu ulangi |
| "Catatan output tidak ditemukan." | ID tidak valid | Muat ulang halaman |
| "Catatan ini sudah diverifikasi." | Memverifikasi dua kali | Tidak perlu tindakan; status sudah terkunci |
| "Catatan sudah diverifikasi dan terkunci." | Percobaan mengubah catatan terverifikasi | Koreksi dilakukan lewat catatan baru atau proses QC, bukan mengubah yang terkunci |
| "Catatan ini bukan milik Anda." | Penjahit mengubah catatan penjahit lain | Hanya boleh mengubah catatan sendiri |
| "Rate card untuk komponen X belum berlaku" (dari database) | Verifikasi tanpa rate card yang berlaku pada tanggal interval | Sediakan rate card dengan `effective_from` yang mencakup tanggal interval |

---

## 7. Skenario uji

- [ ] Alokasikan `penjahit1` ke `Line A`: nama tampil di daftar line aktif.
- [ ] Alokasikan `penjahit1` ke line lain: alokasi lama otomatis nonaktif, ia pindah line.
- [ ] Catat output untuk penjahit yang tidak dialokasikan ke line tersebut: ditolak.
- [ ] Catat output dengan komponen tanpa rate card: ditolak dengan pesan rate card.
- [ ] Catat output valid: tercatat dengan interval :00 atau :30, status "Menunggu".
- [ ] Login `penjahit1@loe.test`: hanya catatan miliknya yang terlihat; ubah pcs: berhasil selama belum diverifikasi.
- [ ] Verifikasi catatan oleh mandor: status "Terverifikasi", tombol ubah hilang.
- [ ] Coba ubah pcs catatan terverifikasi lewat aplikasi: ditolak.
- [ ] Konfirmasi di database: update atau delete pada catatan terverifikasi melempar error "Catatan output sudah diverifikasi dan terkunci".
- [ ] Catatan terverifikasi masuk hitung payroll pada periode yang mencakup intervalnya.

---

## 8. Catatan teknis

| Aspek | Lokasi |
|---|---|
| Logika bisnis | `src/modules/produksi/service.ts` (`allocateTailor`, `recordOutput`, `verifyOutput`, `updateUnverifiedOutput`) |
| Server actions | `src/app/(app)/produksi/actions.ts` |
| Halaman | `src/app/(app)/produksi/page.tsx` (refresh meta 30 detik) |
| Pembulatan interval | `src/lib/format.ts` (`floorTo30Min`) |
| Tabel terkait | `production_lines`, `line_allocations`, `rate_cards`, `output_records`, `production_orders`, `users` |
| Trigger terkait | `output_records_guard_update` (kunci + snapshot tarif), `output_records_guard_delete` |
| Index terkait | `line_alloc_one_active_per_tailor`, `output_pending_verify` (antrean verifikasi) |

Data uji dari seed: line "Line A", `penjahit1` sudah dialokasikan ke Line A, rate card tiga baris pada tabel 4.5.

---

## 9. Keterbatasan dan rencana perubahan

1. **Kode memakai kolom `active`, skema memakai `ended_at`.** `allocateTailor`, halaman produksi, dan seed masih menandai alokasi dengan boolean `active`, sedangkan `prisma/schema/produksi.prisma` terbaru memakai `ended_at` (NULL = aktif) plus index unik parsial. Rencana: ganti seluruh akses `active` menjadi `ended_at` (menutup alokasi lama dengan mengisi waktu, bukan menonaktifkan boolean).
2. **`recorded_by` belum diisi.** Skema baru mewajibkan siapa yang menginput output. Rencana: isi `recordedById` dari user yang sedang login saat `recordOutput` dipanggil.
3. **`rate_applied` dan `wage_amount` diisi trigger, bukan aplikasi.** Snapshot upah terjadi saat verifikasi lewat trigger database dengan memilih rate card `effective_from` terbaru yang tidak melewati tanggal interval. Layar payroll saat ini masih menghitung ulang dari rate card terkini (lihat SOP Payroll).
4. **Penjahit hanya di line yang dialokasikan dijaga aplikasi.** Pengecekan serupa di database (keputusan terbuka no. 2 di `desain-database-project-loe5.md`) belum dipasang; usulan MVP: di aplikasi, dipindah ke database setelah demo.
5. **Perubahan status pesanan belum otomatis.** `production_orders.status` tidak berubah saat produksi berjalan (keputusan terbuka no. 6 di dokumen desain).
6. **Refresh halaman memakai meta refresh 30 detik.** Belum memakai mekanisme live update; penjahit perlu memuat ulang untuk melihat perubahan terbaru.

---

## 10. Riwayat versi dokumen

| Versi | Tanggal | Perubahan | Oleh |
|---|---|---|---|
| 1.0 | 13 Oktober 2026 | Penyusunan awal dari kode saat ini | Tim proyek |
