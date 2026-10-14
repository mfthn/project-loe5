# SOP Fitur: QC dan Barang Jadi

| | |
|---|---|
| Modul | QC & Barang Jadi (`/qc`) |
| Kebutuhan | FR-8 (pencatatan hasil QC), FR-9 (kategori cacat wajib) |
| Peran utama | QC_INSPECTOR, OWNER |
| Versi dokumen | 1.0 |
| Tanggal | 13 Oktober 2026 |
| Status | Draft, berbasis perilaku kode saat ini |

Sumber kebenaran: `src/modules/qc/service.ts`, `src/app/(app)/qc/actions.ts`, `src/app/(app)/qc/page.tsx`, `prisma/schema/qc.prisma`, `prisma/manual/01_constraints_triggers.sql` (CHECK `qc_defect_chk`, trigger `qc_records_append_only`).

---

## 1. Tujuan dan ruang lingkup

SOP ini mengatur:

1. Pencatatan hasil pemeriksaan QC per pesanan dan komponen.
2. Aturan status `LOLOS`, `REPAIR`, dan `DEFECT`, termasuk kewajiban kategori cacat.
3. Sifat riwayat QC yang append-only (tidak bisa diubah atau dihapus).
4. Peran data LOLOS sebagai dasar pool bonus QC di payroll.

---

## 2. Peran dan hak akses

| Peran | Hak |
|---|---|
| QC_INSPECTOR | Mencatat hasil QC dan melihat riwayat |
| OWNER | Sama dengan QC_INSPECTOR |
| Peran lain | Tidak memiliki akses ke modul ini |

Setiap catatan QC terikat pada `inspector_id`, yaitu akun yang sedang login saat mencatat.

---

## 3. Alur bisnis

1. Inspektor memeriksa hasil produksi per pesanan dan komponen.
2. Inspektor memilih status:
   - **LOLOS**: pcs diterima tanpa cacat. Tidak boleh disertai kategori cacat.
   - **REPAIR**: pcs perlu diperbaiki. Wajib memilih kategori cacat.
   - **DEFECT**: pcs cacat permanen. Wajib memilih kategori cacat.
3. Catatan tersimpan sebagai riwayat permanen dengan waktu pemeriksaan otomatis.
4. Total pcs LOLOS pada suatu periode mengalir ke pool bonus QC (lihat SOP Payroll).

---

## 4. Langkah operasional

### 4.1 Mencatat hasil pemeriksaan

1. Login sebagai `qc@loe.test`, buka **QC & Barang Jadi**.
2. Pada kartu **Catat hasil pemeriksaan**, isi:
   - **Pesanan** (format `kode · klien`).
   - **Komponen** (contoh "Badan depan").
   - **Jumlah pcs** (lebih dari 0).
   - **Status**: Lolos, Repair, atau Defect.
   - **Kategori cacat** (wajib untuk Repair/Defect): Jahitan, Noda, Ukuran, Bahan, Lainnya.
   - **Catatan** (opsional, maksimal 500 karakter pada skema).
3. Klik **Simpan hasil QC**. Hasil: "Hasil QC tersimpan dan terkunci."

### 4.2 Melihat riwayat

- Kartu **Riwayat QC** menampilkan 50 pemeriksaan terakhir: waktu (WIB), pesanan, komponen, pcs, status (Lolos hijau, Defect merah), kategori, dan nama inspektor.
- Tidak ada tombol ubah atau hapus; riwayat memang bersifat permanen.

### 4.3 Jika ada kesalahan pencatatan

Karena catatan bersifat append-only, kesalahan pencatatan tidak diperbaiki dengan mengubah baris lama. Catat pemeriksaan baru sebagai koreksi (status dan jumlah yang benar), lalu beri keterangan pada kolom **Catatan** bahwa baris tersebut mengoreksi catatan sebelumnya. Pertimbangan serupa berlaku untuk data REPAIR/DEFECT yang salah.

---

## 5. Aturan bisnis dan validasi

| Aturan | Lapisan penjaga | Referensi |
|---|---|---|
| Jumlah pcs harus lebih dari 0 | Aplikasi dan database (CHECK `qc_qty_chk`) | `recordQc`, `01_constraints_triggers.sql` |
| Status REPAIR atau DEFECT wajib memiliki kategori cacat | Aplikasi | `recordQc` |
| Status LOLOS tidak boleh memiliki kategori cacat (disimpan NULL meski form terisi) | Aplikasi dan database (CHECK `qc_defect_chk`) | `recordQc`, `01_constraints_triggers.sql` |
| Inspektor diambil dari akun yang sedang login | Aplikasi | `recordQcAction` |
| Waktu pemeriksaan diisi otomatis oleh database | Database (default `now()`) | `qc.prisma` |
| Tabel `qc_records` bersifat append-only: UPDATE dan DELETE ditolak | Database (trigger `qc_records_append_only`) | `01_constraints_triggers.sql` |
| Tidak ada fungsi edit atau hapus di lapisan aplikasi | Aplikasi | `src/modules/qc/service.ts` hanya berisi `recordQc` |
| Pcs LOLOS menjadi dasar pool bonus QC per periode | Aplikasi (query agregat `status = LOLOS`) | `computePayroll` |

---

## 6. Pesan error dan penanganan

| Pesan | Penyebab | Penanganan |
|---|---|---|
| "Jumlah harus lebih dari 0." | Qty 0 atau negatif | Isi jumlah valid |
| "Kategori cacat wajib diisi untuk status Repair atau Defect." | Status REPAIR/DEFECT tanpa kategori | Pilih salah satu kategori cacat lalu simpan ulang |
| "Tabel qc_records bersifat append-only, operasi UPDATE/DELETE ditolak" (dari database) | Percobaan mengubah atau menghapus riwayat QC | Jangan ubah riwayat; catat pencatatan koreksi baru |

---

## 7. Skenario uji

- [ ] Catat hasil LOLOS 20 pcs tanpa kategori: berhasil, kategori tampil "-".
- [ ] Catat hasil LOLOS dengan kategori dipilih: kategori tetap disimpan NULL (tidak ikut tersimpan).
- [ ] Catat REPAIR tanpa kategori: ditolak dengan pesan kewajiban kategori.
- [ ] Catat DEFECT dengan kategori "Noda": berhasil, badge merah pada riwayat.
- [ ] Catat qty 0: ditolak.
- [ ] Konfirmasi di database: UPDATE dan DELETE pada baris QC melempar error append-only.
- [ ] Periode payroll yang memuat catatan LOLOS menghasilkan pool bonus QC sesuai total pcs LOLOS.

---

## 8. Catatan teknis

| Aspek | Lokasi |
|---|---|
| Logika bisnis | `src/modules/qc/service.ts` (`recordQc`) |
| Server action | `src/app/(app)/qc/actions.ts` (`recordQcAction`) |
| Halaman | `src/app/(app)/qc/page.tsx` |
| Tabel terkait | `qc_records`, `production_orders`, `users` |
| Enum terkait | `QcStatus` (LOLOS, REPAIR, DEFECT), `DefectCategory` (JAHITAN, NODA, UKURAN, BAHAN, LAINNYA) |
| Index terkait | `qc_lolos_by_time` (pool bonus per periode) |
| Batas ukuran | `note` maksimal 500 karakter (skema) |

---

## 9. Keterbatasan dan rencana perubahan

1. **Nilai kategori di UI tidak cocok dengan enum database.** Form mengirim nilai berhuruf besar seperti "Jahitan", sedangkan enum `DefectCategory` memakai huruf kapital semua (`JAHITAN`). Saat migrasi enum dijalankan, nilai form harus disamakan atau dipetakan di server action.
2. **Koreksi QC belum didukung alur resmi.** Skema append-only memaksa koreksi lewat pencatatan baru; belum ada penanda "koreksi dari catatan X". Rencana: tambahkan kolom rujukan atau catatan wajib untuk koreksi.
3. **QC tidak mengubah status pesanan.** Perubahan `production_orders.status` ke `QC` atau `DONE` otomatis dari aktivitas QC termasuk keputusan terbuka no. 6 di dokumen desain.
4. **QC Inspector juga memiliki akses modul Gudang** sesuai matriks RBAC; detailnya ada di SOP Gudang.
5. **Retensi dan pelaporan lanjutan.** Rekap defect per kategori, tren per komponen, dan laporan barang jadi keluar dari ruang lingkup MVP.

---

## 10. Riwayat versi dokumen

| Versi | Tanggal | Perubahan | Oleh |
|---|---|---|---|
| 1.0 | 13 Oktober 2026 | Penyusunan awal dari kode saat ini | Tim proyek |
