# project-loe5

Platform operasional pabrik garmen Ciwidey: stok multi-klien dengan anti-kontaminasi silang, alokasi line produksi, output 30 menit, QC, payroll, portal klien, dan dua asisten AI (Amazon Bedrock).

Stack: Next.js 15 (App Router, TypeScript), Node.js, PostgreSQL 16, Prisma ORM, Amazon Bedrock (Converse API).

## Cara kerja singkat
- `src/app`: halaman dan server actions. Tipis, hanya menerima form lalu memanggil modul.
- `src/modules/<modul>/service.ts`: seluruh aturan bisnis (blokade stok, kunci verifikasi, perhitungan payroll). Satu folder per anggota tim.
- `src/lib`: auth (JWT di cookie httpOnly), RBAC 8 peran, klien Bedrock, dan helper.
- `prisma/schema`: satu file per modul agar merge tidak bentrok.
- Login memakai email dan password. Akses menu dan halaman dikunci per peran, dan Portal Klien dibatasi ke client_id milik akun.

## Menjalankan di komputer lokal

### Prasyarat

- Git.
- Node.js 20 atau lebih baru (disarankan versi LTS).
- Salah satu runtime container: Docker Desktop (disarankan untuk Windows) atau Podman.
- Windows: Docker Desktop dengan backend WSL 2 harus sudah dijalankan sebelum memakai `docker compose`.
- Fedora dengan Podman: pasang Podman dan provider Compose (`sudo dnf install -y podman podman-compose git`); pastikan versi Node.js tetap 20 atau lebih baru.

Pastikan alat yang dibutuhkan tersedia:

```bash
node --version
npm --version
git --version
docker compose version
```

Untuk Fedora/Podman, gunakan `podman --version` dan `podman compose version` sebagai pengganti pemeriksaan Docker.

### 1. Ambil source code dan pasang dependensi

Clone repository, lalu buka terminal di folder `project-loe5`:

```bash
npm ci
```

`npm ci` memasang versi dependensi yang tercatat di `package-lock.json`.

### 2. Siapkan environment

Buat `.env` dari template. Di PowerShell:

```powershell
Copy-Item .env.example .env
```

Di Fedora, macOS, atau Git Bash:

```bash
cp .env.example .env
```

Ganti `AUTH_SECRET` di `.env` dengan nilai acak. Bisa dibuat lintas platform memakai Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Salin hasilnya ke `AUTH_SECRET`. `AWS_BEARER_TOKEN_BEDROCK` boleh dikosongkan untuk menjalankan fitur selain AI; isi dengan API key Bedrock hanya jika ingin mencoba asisten AI. Jangan commit `.env` atau membagikan isinya.

### 3. Nyalakan PostgreSQL

Port PostgreSQL host untuk aplikasi ini adalah `5433` agar tidak bentrok dengan instalasi PostgreSQL lokal. URL koneksi di `.env.example` sudah disesuaikan.

Di Windows dengan Docker Desktop:

```powershell
docker compose up -d
docker compose ps
```

Di Fedora dengan Podman:

```bash
podman compose up -d
podman ps
```

Jika perintah `podman compose` tidak tersedia, pasang `podman-compose` lalu gunakan `podman-compose up -d`. Script `npm run db:up` dan `npm run db:down` di `package.json` menggunakan Podman; pengguna Docker Desktop dapat memakai `docker compose up -d` dan `docker compose down` secara langsung.

### 4. Siapkan schema dan data uji

Migration awal sudah disimpan di repository. Jalankan:

```bash
npx prisma migrate dev
npx prisma generate
npm run db:seed
```

Seed membuat akun uji yang tercantum di bawah. Langkah ini tidak menghapus database; hindari `npm run db:reset` jika ingin mempertahankan data lokal.

### 5. Jalankan aplikasi

```bash
npm run dev
```

Buka http://localhost:3000.

Untuk menghentikan PostgreSQL, jalankan `docker compose down` (Docker Desktop) atau `podman compose down` (Podman). Data database disimpan pada volume container dan tetap ada setelah container dihentikan.

## Akun uji
Semua akun memakai password `password123`.

| Email | Peran | Yang bisa dilihat |
|---|---|---|
| owner@loe.test | Owner | Semua modul termasuk AI Business Tracker |
| sample@loe.test | Tim Sample | Sample dan time study |
| gudang@loe.test | Gudang | Gudang multi-klien |
| mandor1@loe.test | Kepala Produksi | Produksi, alokasi, verifikasi |
| penjahit1@loe.test | Penjahit | Riwayat output sendiri, ubah yang belum diverifikasi |
| qc@loe.test | QC Inspector | QC dan gudang (baca) |
| finance@loe.test | Finance & Payroll | Payroll |
| klien@loe.test | Klien Maklon A | Portal klien, hanya data Klien A |

Asisten calon klien bisa diakses tanpa login di http://localhost:3000/calon-klien

## Skenario uji (sesuai BRD)
1. Anti-kontaminasi: login sebagai gudang, terima bahan untuk Klien Maklon A dan pesanan milik klien tersebut, lalu coba keluarkan bahan itu untuk pesanan milik Snøhund. Sistem harus menolak dan menampilkan peringatan. Percobaan tercatat di bagian "Percobaan pengeluaran yang diblokir".
2. Sample ke order: login sebagai sample, buat revisi (v2 otomatis terhubung ke v1), setujui, lalu konversi dengan mencentang konfirmasi.
3. Produksi: login sebagai mandor1, alokasikan penjahit ke Line A, catat output, lalu verifikasi. Login sebagai penjahit1 dan coba ubah catatan yang sudah diverifikasi. Hasilnya harus ditolak.
4. QC: catat hasil LOLOS, REPAIR, dan DEFECT. Repair atau defect tanpa kategori harus ditolak.
5. Payroll: login sebagai finance, pilih periode yang mencakup output terverifikasi, lalu finalisasi. Periode yang sama tidak bisa difinalisasi dua kali.
6. Portal klien: login sebagai klien@loe.test dan pastikan hanya data Klien A yang tampil.
7. AI Owner: login sebagai owner dan tanyakan misalnya "berapa output pcs hari ini?". Jawaban harus sesuai data di database.

## Catatan Bedrock
- API key Bedrock dibaca otomatis oleh AWS SDK dari variabel `AWS_BEARER_TOKEN_BEDROCK`.
- Model harus diaktifkan dulu di konsol AWS Bedrock (menu Model access) pada region yang sama dengan `AWS_REGION`.
- Jika tidak ada API key, asisten menampilkan pesan bahwa layanan AI belum dikonfigurasi, dan aplikasi tetap berjalan.

## Batasan MVP
- Login belum memakai rate limit. Asisten calon klien publik sebaiknya diberi pembatasan sebelum rilis.
- Tarif disederhanakan menjadi satu tarif per komponen per klien. Tarif per artikel dan riwayat perubahan tarif masuk backlog.
- Overhead per unit (FR-10.4), scrap, dan notifikasi termasuk out-of-scope sesuai BRD.
- Migrasi awal tersedia di `prisma/schema/migrations`. Perubahan schema berikutnya perlu dibuat sebagai migration dan disertakan bersama perubahan kode terkait.

## Perintah berguna
- `npm run db:studio` membuka Prisma Studio untuk melihat data.
- `npm run db:reset` mengosongkan database lalu menjalankan ulang migrasi dan seed; seluruh data lokal akan terhapus.
- `npm run db:down` mematikan container PostgreSQL (khusus Podman; pengguna Docker dapat menjalankan `docker compose down`).
