# SOP Fitur: Autentikasi, RBAC, dan Dashboard

| | |
|---|---|
| Modul | Autentikasi (`/login`), RBAC, Dashboard (`/dashboard`) |
| Kebutuhan | Keamanan dasar, matriks RBAC SRS v2.0, Story login |
| Peran utama | Seluruh peran (8 role) |
| Versi dokumen | 1.0 |
| Tanggal | 13 Oktober 2026 |
| Status | Draft, berbasis perilaku kode saat ini |

Sumber kebenaran: `src/lib/auth.ts`, `src/lib/rbac.ts`, `src/app/login/*`, `src/app/(app)/layout.tsx`, `src/app/(app)/dashboard/page.tsx`, `src/components/Sidebar.tsx`. Perubahan skema yang belum diimplementasikan tercantum di bagian 9.

---

## 1. Tujuan dan ruang lingkup

SOP ini mengatur:

1. Cara masuk (login) dan keluar (logout) dari aplikasi.
2. Masa berlaku dan sifat sesi pengguna.
3. Matriks hak akses per peran terhadap 8 modul.
4. Isolasi data klien lewat `clientScope()`.
5. Isi dashboard sebagai halaman muka setelah login.

SOP ini tidak mengatur pembuatan atau penghapusan akun; pembuatan akun awal dilakukan lewat seed (`npm run db:seed`).

---

## 2. Peran dan hak akses

Matriks diambil dari `ROLE_MODULES` di `src/lib/rbac.ts`. Menu pada sidebar hanya menampilkan modul yang berhak.

| Peran | Modul yang boleh diakses |
|---|---|
| OWNER | dashboard, sample, gudang, produksi, qc, payroll, portal-klien, ai-owner |
| TIM_SAMPLE | dashboard, sample |
| GUDANG | dashboard, gudang |
| KEPALA_PRODUKSI | dashboard, produksi |
| PENJAHIT | dashboard, produksi |
| QC_INSPECTOR | dashboard, qc, gudang (baca) |
| FINANCE_PAYROLL | dashboard, payroll |
| KLIEN_MAKLON | dashboard, portal-klien |

Aturan tambahan:

- Halaman publik hanya `/login` dan `/calon-klien`. Seluruh halaman lain wajib login.
- Peran `KLIEN_MAKLON` wajib memiliki `clientId`. Akun tanpa `clientId` akan melempar error saat memakai `clientScope()`.
- Dashboard bisa diakses semua peran yang sudah login.

---

## 3. Alur bisnis

1. Pengguna membuka `/login`, memasukkan email dan password.
2. Server menormalisasi email menjadi huruf kecil, lalu membandingkan password terhadap hash bcrypt.
3. Jika cocok, server menandatangani JWT (sub = user id, berlaku 8 jam) dan menyimpannya di cookie `loe_session` bersifat httpOnly.
4. Pengguna diarahkan ke `/dashboard`, yang menampilkan ringkasan dan kartu modul sesuai peran.
5. Saat keluar, cookie dihapus dan pengguna kembali ke `/login`.

---

## 4. Langkah operasional

### 4.1 Login

1. Buka http://localhost:3000. Jika belum login, sistem otomatis mengarahkan ke `/login`.
2. Isi **Email** (contoh: `owner@loe.test`) dan **Password**.
3. Klik **Masuk**. Berhasil: masuk ke dashboard. Gagal: pesan "Email atau password salah." ditampilkan di halaman login.

### 4.2 Logout

1. Klik tombol **Keluar** di bagian bawah sidebar.
2. Cookie sesi dihapus dan pengguna dikembalikan ke `/login`.

### 4.3 Mengakses modul

1. Setelah login, sidebar hanya menampilkan modul yang sesuai peran.
2. Mengakses URL modul di luar hak peran (misal `gudang@loe.test` membuka `/payroll`) akan dialihkan ke `/dashboard` dengan pesan "Anda tidak memiliki akses ke modul ini."

### 4.4 Akun uji (hasil seed)

Seluruh akun memakai password `password123`.

| Email | Peran | Modul terlihat |
|---|---|---|
| owner@loe.test | OWNER | Semua modul termasuk AI Business Tracker |
| kepala@loe.test | OWNER | Semua modul (penerima bonus QC) |
| sample@loe.test | TIM_SAMPLE | Sample & Time Study |
| gudang@loe.test | GUDANG | Gudang Multi-Klien |
| mandor1@loe.test | KEPALA_PRODUKSI | Produksi & Output |
| mandor2@loe.test | KEPALA_PRODUKSI | Produksi & Output |
| penjahit1@loe.test | PENJAHIT | Produksi & Output (catatan miliknya) |
| penjahit2@loe.test | PENJAHIT | Produksi & Output (catatan miliknya) |
| qc@loe.test | QC_INSPECTOR | QC & Barang Jadi, Gudang (baca) |
| finance@loe.test | FINANCE_PAYROLL | Payroll |
| klien@loe.test | KLIEN_MAKLON | Portal Klien (hanya data Klien Maklon A) |

---

## 5. Aturan bisnis dan validasi

| Aturan | Lapisan penjaga | Referensi kode |
|---|---|---|
| Password disimpan sebagai hash bcrypt (cost 10), tidak pernah plaintext | Aplikasi | `auth.ts` (`hashPassword`), `seed.ts` |
| Email dinormalisasi huruf kecil sebelum dicari | Aplikasi | `login/actions.ts` |
| Pesan login gagal dibuat umum agar tidak membocorkan keberadaan email | Aplikasi | `login/actions.ts` |
| Sesi berupa JWT HS256, sub = user id, berlaku 28800 detik (8 jam) | Aplikasi | `auth.ts` (`SESSION_SECONDS`) |
| Cookie `loe_session` httpOnly, sameSite lax, secure saat produksi, path `/` | Aplikasi | `auth.ts` (`createSession`) |
| Setiap request memverifikasi tanda tangan JWT lalu mengambil baris user terbaru dari database | Aplikasi | `auth.ts` (`getCurrentUser`) |
| Setiap halaman dan aksi wajib memanggil `requireUser()` (dan `requireUser(modul)` untuk modul spesifik) | Aplikasi | semua `page.tsx` dan `actions.ts` |
| Akses modul dicek terhadap `ROLE_MODULES` | Aplikasi | `rbac.ts`, `auth.ts` (`requireUser`) |
| Peran klien wajib punya `client_id`, peran lain tidak boleh punya | Database (CHECK `users_role_client_chk`) | `prisma/manual/01_constraints_triggers.sql` |

---

## 6. Pesan error dan penanganan

| Pesan | Penyebab | Penanganan |
|---|---|---|
| "Email atau password salah." | Email tidak terdaftar atau password salah | Periksa kembali penulisan email; akun uji memakai `password123` |
| "Anda tidak memiliki akses ke modul ini." | Peran berhak masuk tetapi membuka modul di luar `ROLE_MODULES` | Kembali ke dashboard, buka modul dari menu sidebar |
| Halaman login kembali tampil meski sudah login | Cookie kadaluarsa (8 jam) atau secret `AUTH_SECRET` berubah | Login ulang; pastikan `AUTH_SECRET` konsisten di `.env` |
| "Akun klien tidak terhubung ke client_id." | Akun `KLIEN_MAKLON` tanpa `clientId` (melanggar CHECK di database) | Perbaiki data akun lewat seed atau migrasi; jangan membuat akun klien tanpa klien |

---

## 7. Skenario uji

- [ ] Login dengan `owner@loe.test` / `password123` berhasil masuk ke dashboard.
- [ ] Login dengan password salah menampilkan "Email atau password salah." dan tidak membocorkan apakah email terdaftar.
- [ ] Email ditulis dengan huruf besar (misal `OWNER@LOE.TEST`) tetap berhasil karena dinormalisasi.
- [ ] Buka `/payroll` sebagai `gudang@loe.test`: dialihkan ke dashboard dengan pesan akses ditolak.
- [ ] Sidebar `penjahit1@loe.test` hanya menampilkan Dashboard dan Produksi & Output.
- [ ] Setelah logout, membuka `/dashboard` mengarahkan kembali ke `/login`.
- [ ] Login `klien@loe.test` dan buka dashboard: hanya kartu Portal Klien yang tampil.
- [ ] Setelah 8 jam (atau dengan mengubah cookie), sesi kedaluwarsa dan pengguna harus login ulang.

---

## 8. Catatan teknis

| Aspek | Lokasi |
|---|---|
| Pembuatan dan verifikasi sesi | `src/lib/auth.ts` |
| Matriks modul, `canAccessModule`, `clientScope` | `src/lib/rbac.ts` |
| Aksi login dan logout | `src/app/login/actions.ts` |
| Halaman login | `src/app/login/page.tsx` |
| Gerbang login semua halaman aplikasi | `src/app/(app)/layout.tsx` (`requireUser()`) |
| Tabel terkait | `users`, `clients`, `audit_logs` |
| Enum terkait | `Role` |
| Variabel environment | `AUTH_SECRET` (wajib diisi, jangan commit) |

Perilaku dashboard (`src/app/(app)/dashboard/page.tsx`):

- **Total pesanan**: seluruh `production_orders`, kecuali peran `KLIEN_MAKLON` yang hanya menghitung pesanan milik `client_id`-nya.
- **Output pcs hari ini**: jumlah `pcs` dari `output_records` dengan `interval_start` sejak tengah hari (WIB) yang sudah dibulatkan ke bawah ke interval 30 menit.
- **Output menunggu verifikasi**: jumlah seluruh catatan output yang belum diverifikasi (lintas peran, angka global).
- Kartu modul di bawah statistik dibuat dari `ROLE_MODULES` minus modul dashboard.

---

## 9. Keterbatasan dan rencana perubahan

Sesuai `backend/docs/sop.md` bagian 16, kode aplikasi belum seluruhnya disesuaikan dengan skema baru di `desain-database-project-loe5.md` bagian 9. Yang menyangkut fitur ini:

1. **`is_active` user belum dicek saat login.** Kolom `users.is_active` sudah ada di skema, tetapi `loginAction` dan `getCurrentUser` belum memfilternya. Menonaktifkan akun lewat kolom ini belum berpengaruh sampai pengecekan ditambahkan. Rencana: tolak login dan tolak sesi berjalan untuk `is_active = false`.
2. **Login belum memiliki rate limit.** Tercatat di `README.md` bagian Batasan MVP. Asisten calon klien publik juga perlu pembatasan sebelum rilis.
3. **Fallback secret.** Jika `AUTH_SECRET` kosong, aplikasi memakai `"dev-only-secret"`. Ini hanya untuk pengembangan; wajib diganti di produksi.
4. **`created_at` audit log.** Skema baru mewajibkan `entity_type` pada `audit_logs`; sebagian penulis log di modul lain belum mengisinya (lihat SOP Gudang).

---

## 10. Riwayat versi dokumen

| Versi | Tanggal | Perubahan | Oleh |
|---|---|---|---|
| 1.0 | 13 Oktober 2026 | Penyusunan awal dari kode saat ini | Tim proyek |
