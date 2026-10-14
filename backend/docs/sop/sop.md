# SOP Pengembangan project-loe5

Dokumen ini adalah Standard Operating Procedure untuk mengembangkan, menjalankan, menguji, dan mengirim (deploy) platform operasional pabrik garmen **project-loe5** (Lukla Operations Engine). SOP ini berlaku untuk seluruh anggota tim dan diperbarui setiap kali ada perubahan proses yang disepakati.

**Versi:** 1.0
**Status:** Draft untuk disepakati tim
**Pemilik dokumen:** Anggota A (Core dan Payroll)

---

## 1. Tujuan dan Ruang Lingkup

SOP ini mengatur:

1. Cara menyiapkan lingkungan kerja di Fedora (dan Windows untuk anggota yang memakainya).
2. Cara membagi, mengerjakan, dan menggabungkan kode antaranggota.
3. Cara mengubah skema database dengan aman.
4. Standar kode, UI, dan keamanan.
5. Cara menguji, membangun, dan mengirim aplikasi.
6. Cara menangani masalah dan eskalasi.

SOP ini tidak mengatur keputusan produk. Perubahan fitur di luar BRD tetap harus disepakati dengan seluruh tim.

---

## 2. Peran dan Pembagian Tanggung Jawab

| Anggota | Area tanggung jawab | Folder utama |
|---|---|---|
| **A** | Autentikasi, RBAC, layout, seed, Payroll, dokumen SOP dan desain DB | `src/lib/*`, `src/app/login`, `src/app/(app)/layout.tsx`, `src/app/(app)/dashboard`, `src/app/(app)/payroll`, `src/modules/payroll`, `prisma/schema/base.prisma`, `prisma/seed.ts` |
| **B** | Sample dan Time Study, Portal Klien, asisten calon klien | `src/app/(app)/sample`, `src/app/(app)/portal-klien`, `src/app/calon-klien`, `src/modules/sample`, `prisma/schema/sample.prisma` |
| **C** | Gudang Multi-Klien, Produksi dan Output 30 menit | `src/app/(app)/gudang`, `src/app/(app)/produksi`, `src/modules/gudang`, `src/modules/produksi`, `prisma/schema/gudang.prisma`, `prisma/schema/produksi.prisma` |
| **D** | QC dan Barang Jadi, AI Business Tracker, integrasi Bedrock | `src/app/(app)/qc`, `src/app/(app)/ai-owner`, `src/modules/qc`, `src/modules/ai`, `src/lib/bedrock.ts`, `prisma/schema/qc.prisma`, `prisma/schema/ai.prisma` |
| **Bersama** | Skema dan konfigurasi yang dipakai semua orang | `package.json`, `prisma/manual/*`, `src/components/*`, `src/app/globals.css`, `compose.yaml`, `README.md`, `sop.md` |

**Aturan kepemilikan:** file di area bersama hanya boleh diubah setelah diskusi singkat dengan tim dan setelah pemilik area diberi tahu. File di area anggota lain hanya diubah lewat diskusi atau permintaan di Git.

---

## 3. Struktur Proyek

```
project-loe5/
├── compose.yaml              # PostgreSQL 16 untuk Podman
├── package.json              # Skrip dan dependensi
├── prisma/
│   ├── schema/               # Schema Prisma, satu file per modul
│   ├── migrations/           # Migrasi dari Prisma (di-commit)
│   ├── manual/               # SQL constraint, trigger, data uji, uji otomatis
│   └── seed.ts               # Data awal aplikasi
├── src/
│   ├── app/                  # Routing Next.js (App Router), tipis
│   ├── components/           # Komponen UI bersama
│   ├── lib/                  # Auth, RBAC, db, Bedrock, helper
│   └── modules/              # Logika bisnis per modul (service.ts)
└── docs/ atau dokumen di root: README.md, sop.md, desain database, panduan setup
```

**Prinsip pemisahan:** halaman dan server action hanya menerima input, memanggil service, lalu mengembalikan hasil. Aturan bisnis (blokade stok, kunci verifikasi, perhitungan payroll) hidup di `src/modules/<nama>/service.ts`.

---

## 4. Prasyarat dan Penyiapan Lingkungan

### 4.1 Perangkat lunak

| Perangkat | Versi minimum | Catatan |
|---|---|---|
| Node.js | 20 | Gunakan LTS |
| npm | ikut Node.js | |
| Podman | terbaru | Di Fedora: `sudo dnf install podman podman-compose` |
| Git | terbaru | |
| psql (opsional) | 16 | Bisa dijalankan lewat `podman exec` |

### 4.2 Langkah penyiapan pertama kali

1. Clone repository, lalu masuk ke folder proyek.
2. Salin konfigurasi: `cp .env.example .env`.
3. Isi `AUTH_SECRET` dengan string acak (misalnya `openssl rand -hex 32`).
4. Isi `AWS_BEARER_TOKEN_BEDROCK` dengan API key pribadi. Jangan dibagikan di chat, commit, atau screenshot.
5. Jalankan `npm install`.
6. Nyalakan database: `podman compose up -d`.
7. Terapkan migrasi: `npx prisma migrate dev`.
8. Terapkan constraint manual sesuai panduan setup database.
9. Jalankan aplikasi: `npm run dev`.

Panduan detail ada di `panduan-setup-database-project-loe5.md`.

### 4.3 Konfigurasi yang harus rahasia

| Variabel | Boleh di Git | Keterangan |
|---|---|---|
| `DATABASE_URL` | Tidak | Berisi password database |
| `AUTH_SECRET` | Tidak | Menandatangani session |
| `AWS_BEARER_TOKEN_BEDROCK` | Tidak | API key berbayar |
| `AWS_REGION`, `BEDROCK_MODEL_ID` | Ya | Boleh di `.env.example` |
| `PEMESANAN_CONTACT` | Ya | Kontak tim pemesanan |

File `.env` sudah masuk `.gitignore`. Jika ada secret yang sempat ter-commit, segera ganti secret tersebut dan beri tahu tim.

---

## 5. Alur Kerja Git

### 5.1 Branch

- Branch `main` selalu bisa dijalankan dan tidak boleh rusak.
- Jangan commit langsung ke `main`.
- Setiap pekerjaan memakai branch dengan format:
  - `feat/<modul>-<ringkasan>`, contoh `feat/gudang-blokade`
  - `fix/<modul>-<ringkasan>`, contoh `fix/payroll-pembulatan`
  - `db/<ringkasan>`, contoh `db/tambah-ai-query-log`
  - `chore/<ringkasan>`, contoh `chore/update-readme`

### 5.2 Commit

- Pesan commit singkat dalam bahasa Indonesia atau Inggris, tetapi konsisten dalam satu branch.
- Satu commit sebaiknya berisi satu perubahan logis.
- Jangan commit file berikut: `.env`, `node_modules/`, `.next/`, `*.tsbuildinfo`, dan file hasil build lainnya.

### 5.3 Pull Request dan penggabungan

1. Push branch, lalu buat Pull Request ke `main`.
2. Minimal satu anggota lain melakukan review.
3. Reviewer memastikan: kode berjalan, tidak ada secret, perubahan sesuai scope, dan tidak merusak modul lain.
4. Penulis PR memastikan `npm run build` lolos sebelum meminta review.
5. Penggabungan dilakukan setelah review disetujui. Gunakan squash jika commit berantakan.

### 5.4 Sinkronisasi harian

- Sebelum mulai kerja, jalankan `git pull` di branch `main`, lalu rebase atau merge ke branch kerja.
- Konflik diselesaikan oleh penulis perubahan yang terbaru, dengan bantuan pemilik file jika perlu.
- Setelah konflik selesai, jalankan ulang aplikasi sebelum push.

---

## 6. Perubahan Database

Perubahan database adalah area berisiko tinggi. Ikuti prosedur ini tanpa pengecualian.

### 6.1 Aturan dasar

1. Setiap perubahan skema dilakukan lewat **Prisma schema** (`prisma/schema/*.prisma`) lalu migrasi.
2. Constraint, trigger, dan index yang tidak bisa dinyatakan Prisma ditulis di migrasi kustom (`--create-only`). Jangan mengubah database secara manual lewat psql di luar migrasi.
3. Migrasi yang sudah di-commit atau sudah dijalankan di mesin lain **tidak boleh diedit**. Buat migrasi baru untuk perbaikan.
4. Perubahan skema yang menghapus kolom atau tabel wajib mendapat persetujuan tim dan rencana pemindahan data.
5. Tabel append-only (`audit_logs`, `stock_movements`, `qc_records`, `payroll_periods`, `payroll_items`, `payroll_bonus_items`) dan tabel output yang sudah terverifikasi tidak boleh diubah atau dihapus lewat kode aplikasi.

### 6.2 Langkah perubahan skema

1. Buat branch `db/<ringkasan>`.
2. Ubah file schema di `prisma/schema/`.
3. Jalankan `npx prisma validate` dan `npx prisma format`.
4. Jalankan `npx prisma migrate dev --name <nama_perubahan>`.
5. Jika perlu constraint atau trigger, jalankan `--create-only`, isi SQL, lalu `npx prisma migrate dev`.
6. Jalankan ulang uji constraint: `prisma/manual/03_uji_constraint.sql`. Semua uji harus menampilkan `OK`.
7. Perbarui `seed.ts` dan service yang terpengaruh.
8. Tulis catatan perubahan di PR, termasuk dampak ke modul lain.
9. Minta review dari Anggota A sebagai pemilik skema dasar.

### 6.3 Larangan

- Dilarang menjalankan `prisma migrate reset` di database yang berisi data penting.
- Dilarang menjalankan `DROP`, `TRUNCATE`, atau `DELETE` massal di database bersama tanpa persetujuan tim.
- Dilarang menonaktifkan trigger atau constraint hanya untuk membuat kode lolos.

---

## 7. Standar Kode

### 7.1 TypeScript dan Next.js

- Gunakan TypeScript dengan mode strict. Hindari `any`. Jika terpaksa, beri komentar alasannya.
- Halaman berada di `src/app`. Logika bisnis berada di `src/modules`.
- Server action (`actions.ts`) wajib diawali `"use server"` dan memanggil `requireUser(modul)` sebelum melakukan apa pun.
- Setiap aksi mengembalikan hasil lewat helper `backWith()` dan `errorMessage()` dari `src/lib/action.ts`.
- Jangan memanggil `redirect()` di dalam blok `try`, karena akan tertangkap sebagai error.
- Gunakan `Decimal` dari Prisma untuk uang dan kuantitas. Konversi ke angka hanya saat menampilkan atau menghitung dengan presisi yang aman.

### 7.2 Penamaan

| Jenis | Format | Contoh |
|---|---|---|
| File komponen | PascalCase | `ChatBox.tsx` |
| File lain | kebab-case atau lowercase | `service.ts`, `rbac.ts` |
| Fungsi aksi | camelCase diakhiri `Action` | `issueAction` |
| Fungsi service | kata kerja deskriptif | `receiveStock`, `computePayroll` |
| Model Prisma | PascalCase | `OutputRecord` |
| Kolom database | snake_case lewat `@map` | `interval_start` |
| Teks UI dan pesan error | Bahasa Indonesia | "Stok tidak cukup." |

### 7.3 Komentar

- Komentar ditulis pada logika yang tidak jelas dari kodenya sendiri, misalnya aturan bisnis, alasan keamanan, atau trade-off.
- Komentar tidak mengulang apa yang sudah jelas dari nama fungsi.
- Setiap file service menjelaskan tujuannya di baris pertama.

### 7.4 Format

- Indentasi 2 spasi, LF sebagai line ending (dijaga `.gitattributes`).
- Tanpa tanda pisah panjang (em dash) di kode dan dokumentasi.
- Jalankan formatter yang disepakati sebelum commit.

---

## 8. Keamanan

1. **Secret** hanya di `.env`. Tidak boleh ada password, API key, atau token di kode, komentar, log, atau pesan commit.
2. **Autentikasi:** setiap halaman dan aksi yang membutuhkan login wajib memanggil `requireUser()`. Halaman publik hanya `/login` dan `/calon-klien`.
3. **Otorisasi:** akses modul dicek lewat `ROLE_MODULES` dan `canAccessModule()`. Aturan di UI bukan pengganti pengecekan di server.
4. **Isolasi klien:** peran `KLIEN_MAKLON` hanya boleh membaca data dengan `client_id` miliknya, lewat `clientScope()`.
5. **Input:** semua input dari form divalidasi di service. Jangan percaya data dari client.
6. **Database:** aplikasi memakai role `loe_app` dengan hak terbatas di lingkungan produksi. Query memakai Prisma, bukan string SQL yang digabung manual.
7. **AI:** asisten Owner hanya membaca ringkasan data dari server. Asisten calon klien tidak mengakses database. Pesan dibatasi 1000 karakter.
8. **Pelaporan:** jika menemukan celah keamanan, laporkan ke Anggota A dan jangan dibahas di chat umum atau repository publik.

---

## 9. UI dan Responsivitas

- Semua halaman harus dapat digunakan di layar kecil (mulai 360 px). Tabel dibungkus `.table-wrap` agar bisa digeser.
- Gunakan kelas dan variabel warna dari `src/app/globals.css`. Jangan membuat warna baru di setiap halaman tanpa alasan.
- Setiap form menampilkan pesan sukses atau error lewat komponen `Notice`.
- Setiap daftar atau tabel punya empty state yang jelas.
- Tombol aksi berbahaya (misalnya finalisasi payroll) harus menampilkan konfirmasi atau keterangan dampaknya.
- Aksesibilitas: setiap input punya label, kontras teks cukup, dan navigasi bisa dilakukan dengan keyboard.

---

## 10. Pengujian

### 10.1 Tingkat pengujian

| Tingkat | Alat | Kapan dijalankan |
|---|---|---|
| Type-check | `npx tsc --noEmit` | Sebelum setiap commit |
| Build | `npm run build` | Sebelum setiap PR |
| Uji database | `prisma/manual/03_uji_constraint.sql` | Setiap perubahan skema atau trigger |
| Uji skenario | Checklist skenario di README | Sebelum demo dan sebelum rilis |
| Uji silang | Dikerjakan orang lain (bukan pemilik modul) | Hari testing dan sebelum rilis |

### 10.2 Skenario wajib sebelum rilis

1. **Anti-kontaminasi:** bahan milik satu klien tidak bisa dikeluarkan untuk pesanan klien lain.
2. **Kunci verifikasi:** output yang sudah diverifikasi tidak bisa diubah oleh penjahit.
3. **Sample ke order:** versi yang belum disetujui tidak bisa dikonversi.
4. **QC:** REPAIR atau DEFECT tanpa kategori ditolak.
5. **Payroll:** periode yang sudah difinalisasi tidak bisa difinalisasi ulang, dan periode tidak boleh tumpang tindih.
6. **Akses:** setiap peran hanya melihat menu dan data yang sesuai.
7. **Isolasi klien:** akun klien hanya melihat data miliknya.
8. **AI Owner:** jawaban sesuai data database, tanpa angka yang dikarang.

### 10.3 Aturan pengujian

- Jangan mengklaim suatu tes berhasil jika belum benar-benar dijalankan.
- Catat hasil uji: tanggal, nama penguji, skenario, hasil (lolos atau gagal), dan bug yang ditemukan.
- Bug P0 (blokade, keamanan, kehilangan data) harus selesai sebelum rilis.

---

## 11. Build dan Deploy

### 11.1 Build lokal

```bash
npm run build
npm run start
```

### 11.2 Deploy ke server

1. Tandai versi di Git, misalnya `v1.0.0`.
2. Pastikan semua secret tersedia di environment server, bukan di repository.
3. Gunakan PostgreSQL dengan Podman dan backup harian (pg_dump) dan WAL archiving.
4. Jalankan `npx prisma migrate deploy` (bukan `migrate dev`) di server.
5. Terapkan constraint manual jika migrasi kustom belum ikut dijalankan.
6. Jalankan `npm run build`, lalu `npm run start` di belakang reverse proxy dengan HTTPS.
7. Jalankan smoke test: login, buka dashboard, buka satu halaman per modul.
8. Catat versi yang dirilis dan tanggal deploy di `CHANGELOG.md`.

### 11.3 Rollback

- Kode: kembali ke tag versi sebelumnya dan build ulang.
- Database: jangan rollback dengan menghapus tabel. Gunakan migrasi perbaikan baru, atau pulihkan dari backup jika data rusak.

---

## 12. Dokumentasi

Dokumen yang wajib selalu diperbarui sesuai perubahan:

| Dokumen | Isi | Pemilik |
|---|---|---|
| `README.md` | Cara menjalankan dan akun uji | Anggota A |
| `sop.md` | Dokumen ini | Anggota A |
| `desain-database-project-loe5.md` | Desain tabel, constraint, trigger | Anggota A |
| `panduan-setup-database-project-loe5.md` | Langkah setup database | Anggota A |
| `CHANGELOG.md` | Riwayat rilis | Anggota yang merilis |

Perubahan fitur yang memengaruhi cara pakai harus ikut memperbarui README.

---

## 13. Penanganan Masalah

### 13.1 Alur penanganan

1. Catat masalah: gejala, pesan error lengkap, langkah reproduksi, dan branch.
2. Cek dulu apakah sudah ada di daftar masalah umum (lihat 13.2).
3. Jika belum selesai dalam 30 menit, minta bantuan anggota lain lewat grup tim.
4. Jika menyangkut keamanan atau data, hentikan pekerjaan dan laporkan ke Anggota A.

### 13.2 Masalah umum

| Gejala | Penyebab umum | Solusi |
|---|---|---|
| `port 5432 already allocated` | PostgreSQL lain berjalan | Hentikan layanan lain, atau ubah port di `compose.yaml` dan `DATABASE_URL` |
| `Drift detected` | Database diubah manual | Di database development: `npx prisma migrate reset --skip-seed` |
| `Prisma Client has no exported member` | Client belum di-generate | `npx prisma generate` |
| `btree_gist permission denied` | Ekstensi belum ada | Jalankan `CREATE EXTENSION IF NOT EXISTS btree_gist;` sebagai superuser |
| Halaman error setelah pull | Schema berubah tetapi migrasi belum dijalankan | `npx prisma migrate dev` lalu `npm install` |
| Asisten AI tidak menjawab | API key atau model belum aktif | Cek `AWS_BEARER_TOKEN_BEDROCK`, region, dan Model access di konsol Bedrock |

---

## 14. Definition of Done

Sebuah pekerjaan dianggap selesai jika:

1. Kode berjalan tanpa error di `npm run dev` dan lolos `npm run build`.
2. Skenario uji terkait sudah dijalankan dan lolos.
3. Tidak ada secret di perubahan.
4. Tampilan sudah dicek di layar kecil.
5. README, dokumen desain, atau SOP sudah diperbarui jika perlu.
6. PR sudah di-review dan disetujui.
7. Pemilik modul sudah diberi tahu.

---

## 15. Jadwal dan Rapat Tim

| Kegiatan | Waktu | Durasi | Peserta |
|---|---|---|---|
| Standup | Setiap pagi | 15 menit | Seluruh tim |
| Sinkronisasi Git dan merge | Sebelum tengah hari saat sprint | 20 menit | Seluruh tim |
| Feature freeze | Sesuai jadwal sprint | Titik waktu | Seluruh tim |
| Review kode | Saat PR dibuat | Sesuai kesepakatan | Reviewer |
| Retrospektif | Akhir sprint | 30 menit | Seluruh tim |

---

## 16. Status Proyek Saat Ini

Per dokumen ini dibuat:

- Skema database sudah sesuai desain dan siap dimigrasikan.
- File SQL untuk constraint, trigger, data uji, dan uji otomatis sudah tersedia.
- Kode aplikasi (service, server action, seed) **belum** disesuaikan dengan skema baru. Pekerjaan ini masuk backlog tahap berikutnya dan wajib selesai sebelum demo.
- Uji skenario end-to-end belum dijalankan.

Setiap anggota wajib memperbarui bagian ini ketika menyelesaikan pekerjaan dari backlog.

---

## 17. Riwayat Perubahan SOP

| Versi | Tanggal | Perubahan | Oleh |
|---|---|---|---|
| 1.0 | 13 Oktober 2026 | Penyusunan awal | Anggota A |