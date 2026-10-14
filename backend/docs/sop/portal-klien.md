# SOP Fitur: Portal Klien

| | |
|---|---|
| Modul | Portal Klien (`/portal-klien`) |
| Kebutuhan | Isolasi data klien, transparansi status pesanan dan stok titipan |
| Peran utama | KLIEN_MAKLON, OWNER (lihat semua klien) |
| Versi dokumen | 1.0 |
| Tanggal | 13 Oktober 2026 |
| Status | Draft, berbasis perilaku kode saat ini |

Sumber kebenaran: `src/app/(app)/portal-klien/page.tsx`, `src/lib/rbac.ts` (`clientScope`), `prisma/schema/base.prisma`.

---

## 1. Tujuan dan ruang lingkup

SOP ini mengatur:

1. Cara klien maklon memantau status pesanan produksinya sendiri.
2. Cara klien memantau sisa stok bahan titipannya sendiri.
3. Jaminan isolasi data: klien tidak pernah melihat data klien lain.
4. Hak Owner yang melihat seluruh data di layar yang sama.

Portal Klien bersifat **baca-saja**. Tidak ada form input atau tombol aksi pada modul ini.

---

## 2. Peran dan hak akses

| Peran | Hak |
|---|---|
| KLIEN_MAKLON | Melihat status pesanan dan stok milik `client_id` yang terkait pada akunnya saja |
| OWNER | Melihat seluruh pesanan dan stok semua klien (tanpa nama klien pada judul) |
| Peran lain | Tidak memiliki akses ke modul ini |

Mekanisme isolasi: `clientScope()` mengembalikan `client_id` milik akun klien dan dipakai sebagai filter `where` pada seluruh kueri halaman. Akun klien tanpa `client_id` akan melempar error (melanggar CHECK database `users_role_client_chk`).

---

## 3. Alur bisnis

1. Klien login memakai akunnya (contoh `klien@loe.test` untuk Klien Maklon A).
2. Sistem membatasi seluruh kueri halaman ke `client_id` akun tersebut.
3. Klien melihat dua kartu:
   - **Status pesanan**: kode, skema (CMT, Semi-CMT, atau CMT + Bahan), target pcs, status (OPEN, IN_PRODUCTION, QC, DONE, CANCELLED), dan waktu pembuatan. Diurutkan terbaru.
   - **Stok bahan titipan**: kode lot, nama bahan, jenis, dan sisa stok. Diurutkan terbaru.
4. Owner membuka modul yang sama untuk melihat gambaran seluruh klien.

---

## 4. Langkah operasional

### 4.1 Klien memantau pesanan

1. Login sebagai `klien@loe.test` (password `password123`).
2. Buka **Portal Klien** dari sidebar. Judul menampilkan nama klien: "Portal Klien · Klien Maklon A".
3. Periksa tabel **Status pesanan**. Order hasil konversi sample untuk klien ini tampil otomatis.
4. Periksa tabel **Stok bahan titipan** untuk mengetahui sisa bahan yang masih dititipkan ke pabrik.

### 4.2 Owner memantau seluruh klien

1. Login sebagai `owner@loe.test`, buka **Portal Klien**.
2. Judul menampilkan "Portal Klien" tanpa nama klien; kedua tabel memuat seluruh pesanan dan stok semua klien.

### 4.3 Data yang tidak tampil

- Pesanan dan stok klien lain tidak pernah tampil pada akun klien (dijamin filter server, bukan hanya tampilan).
- Rincian upah penjahit, payroll, dan tarif tidak termasuk portal klien.

---

## 5. Aturan bisnis dan validasi

| Aturan | Lapisan penjaga | Referensi |
|---|---|---|
| Halaman ini baca-saja, tanpa form aksi | Aplikasi | `portal-klien/page.tsx` |
| Kueri pesanan dan stok selalu difilter `client_id` milik akun klien | Aplikasi (`clientScope` sebagai `where`) | `portal-klien/page.tsx`, `rbac.ts` |
| Akun klien wajib memiliki `client_id` | Database (CHECK `users_role_client_chk`) dan aplikasi (`clientScope` melempar error) | `01_constraints_triggers.sql` |
| Owner yang membuka modul ini tidak difilter (lihat semua klien) | Aplikasi (`clientScope` mengembalikan null untuk peran lain) | `rbac.ts` |
| Akses ke modul dicek `requireUser("portal-klien")` | Aplikasi | `portal-klien/page.tsx` |
| Data operasional lain terhubung `client_id` sehingga penapisan serupa bisa diterapkan di modul lain | Skema | `stock_items`, `production_orders`, `rate_cards` |

---

## 6. Pesan error dan penanganan

| Pesan | Penyebab | Penanganan |
|---|---|---|
| "Akun klien tidak terhubung ke client_id." | Akun `KLIEN_MAKLON` tanpa relasi klien (melanggar CHECK di database) | Perbaiki data akun lewat seed atau migrasi |
| "Anda tidak memiliki akses ke modul ini." | Peran non-klien dan non-Owner membuka `/portal-klien` | Kembali ke modul sesuai peran |
| Tabel "Belum ada pesanan." / "Belum ada stok." | Klien memang belum punya pesanan atau stok tercatat | Pastikan tim sample sudah mengonversi order dan gudang sudah menerima bahan untuk klien tersebut |

---

## 7. Skenario uji

- [ ] Login `klien@loe.test`: judul menampilkan "Portal Klien · Klien Maklon A".
- [ ] Hanya pesanan milik Klien Maklon A yang tampil (buat order untuk Snøhund dan pastikan tidak muncul).
- [ ] Hanya stok milik Klien Maklon A yang tampil.
- [ ] Order hasil konversi sample untuk Klien A tampil dengan skema dan target yang benar.
- [ ] Stok yang sudah dikeluarkan menunjukkan sisa yang berkurang sesuai SOP Gudang.
- [ ] Login `owner@loe.test`: seluruh pesanan dan stok semua klien tampil.
- [ ] Buka `/portal-klien` sebagai `gudang@loe.test`: ditolak dengan pesan akses.

---

## 8. Catatan teknis

| Aspek | Lokasi |
|---|---|
| Halaman | `src/app/(app)/portal-klien/page.tsx` |
| Isolasi data | `src/lib/rbac.ts` (`clientScope`), dipakai sebagai `where: { clientId: scope }` |
| Tabel terkait | `production_orders` (dengan klien), `stock_items` (dengan klien), `clients` |
| Field yang ditampilkan | Pesanan: `code`, `scheme`, `targetQty`, `status`, `createdAt`. Stok: `code`, `name`, `type`, `quantity`, `unit` |
| Format waktu | `tanggalJam` (`src/lib/format.ts`), zona Asia/Jakarta |

Kueri halaman juga mengambil jumlah catatan output dan QC per pesanan (`_count`) untuk keperluan relasi, tetapi belum ditampilkan di tabel.

---

## 9. Keterbatasan dan rencana perubahan

1. **Tampilan status belum bervariasi per skema.** Semua skema (CMT, Semi-CMT, Full Package) menampilkan kolom yang sama; perbedaan rincian bahan belum dijelaskan di portal.
2. **Belum ada notifikasi.** Klien harus membuka portal secara manual; pengiriman notifikasi perubahan status termasuk out-of-scope MVP (README, bagian Batasan).
3. **Row-Level Security (RLS) belum dipasang.** Isolasi saat ini di lapisan aplikasi melalui `clientScope()`. Rencana: pasang RLS di `production_orders`, `stock_items`, dan `payroll_items` setelah MVP (keputusan terbuka no. 3 di dokumen desain).
4. **Klien tidak melihat riwayat QC atau progres per komponen.** Perluasan cakupan tampilan menunggu kebutuhan klien lanjutan.
5. **Pembatasan aksi.** Karena modul ini baca-saja, risiko rendah; namun seluruh server action di aplikasi tetap wajib memanggil `requireUser()` sesuai modulnya.

---

## 10. Riwayat versi dokumen

| Versi | Tanggal | Perubahan | Oleh |
|---|---|---|---|
| 1.0 | 13 Oktober 2026 | Penyusunan awal dari kode saat ini | Tim proyek |
