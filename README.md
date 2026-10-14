# project-loe5

Platform operasional pabrik garmen Ciwidey.

Arsitektur:

- **frontend/**: Next.js 15 (App Router, TypeScript). Tampilan dan pemanggilan API.
- **backend/**: FastAPI (Python 3.12). Seluruh aturan bisnis, akses database, autentikasi, dan integrasi Amazon Bedrock.
- **Database**: PostgreSQL 16, dijalankan dengan Podman lewat `compose.yaml`.

Frontend tidak mengakses database secara langsung. Semua data lewat API di `http://localhost:8000/api/v1`.

## Prasyarat

| Perangkat | Versi | Fedora | Windows |
|---|---|---|---|
| Podman | terbaru | `sudo dnf install podman podman-compose` | Podman Desktop |
| Python | 3.12 | `sudo dnf install python3.12` | python.org (centang "Add to PATH") |
| Node.js | 20 atau lebih baru | `sudo dnf install nodejs npm` | nodejs.org (versi LTS) |
| Git | terbaru | `sudo dnf install git` | git-scm.com |

## Setup pertama kali

### 1. Database

Dari folder root:

```bash
podman compose up -d
podman ps                      # container project_loe5_db harus berstatus Up
```

Jika `podman compose` tidak tersedia, gunakan `podman-compose up -d`.

### 2. Backend

Masuk ke folder backend, buat virtual environment, lalu pasang dependensi.

Fedora:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env
```

Backend menggunakan `DATABASE_URL` dari `backend/.env`. Nilai default mengarah ke PostgreSQL lokal pada port `5433`, sesuai pemetaan port di `compose.yaml`.

Windows (PowerShell):

```powershell
cd backend
py -3.12 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
copy .env.example .env
```

Isi `AUTH_SECRET` di `backend/.env` dengan string acak minimal 32 karakter.

Jalankan pengujian untuk memastikan backend sehat:

```bash
pytest
```

Semua tes harus lolos sebelum melanjutkan.

Jalankan server:

```bash
uvicorn app.main:app --reload
```

Buka http://localhost:8000/docs untuk dokumentasi API interaktif.

### 3. Frontend

Buka terminal baru di folder root.

```bash
cd frontend
npm install
cp .env.example .env.local     # Windows: copy .env.example .env.local
npm run dev
```

Buka http://localhost:3000. Halaman harus menampilkan status **Backend: Terhubung** dan **Database: Terhubung**.

## Verifikasi koneksi

Tiga langkah berikut membuktikan bahwa frontend, backend, dan database terhubung.

1. `http://localhost:8000/api/v1/health` mengembalikan `{"status":"ok","database":"ok"}`.
2. `http://localhost:3000` menampilkan dua badge hijau pada bagian Status koneksi.
3. Hentikan container database (`podman compose stop db`), lalu muat ulang halaman. Badge database harus berubah menjadi merah, dan halaman tetap terbuka.

## Perintah harian

| Tujuan | Perintah | Folder |
|---|---|---|
| Menyalakan database | `podman compose up -d` | root |
| Menghentikan database | `podman compose stop db` | root |
| Menjalankan API | `uvicorn app.main:app --reload` | backend |
| Pengujian backend | `pytest` | backend |
| Pemeriksaan gaya kode | `ruff check .` | backend |
| Membuat migrasi | `alembic revision --autogenerate -m "pesan"` | backend |
| Menerapkan migrasi | `alembic upgrade head` | backend |
| Menjalankan frontend | `npm run dev` | frontend |
| Pemeriksaan tipe | `npm run typecheck` | frontend |
| Build produksi | `npm run build` | frontend |

## Struktur proyek

```
project-loe5/
├── compose.yaml                 PostgreSQL untuk Podman
├── frontend/                    Next.js (TypeScript)
│   └── src/
│       ├── app/                 routing halaman (App Router)
│       ├── components/          komponen UI bersama
│       ├── lib/                 klien API dan konfigurasi
│       └── types/               tipe data dari API
└── backend/                     FastAPI (Python)
    ├── app/
    │   ├── main.py              titik masuk aplikasi
    │   ├── core/                konfigurasi, database, utilitas inti
    │   ├── api/v1/              router HTTP per versi API
    │   └── modules/             logika per fitur (auth, sample, gudang, ...)
    ├── migrations/              migrasi Alembic
    └── tests/                   pengujian pytest
```

## Aturan pembagian kerja

- Setiap anggota mengerjakan folder modul sesuai pembagian di `sop.md`.
- Pola modul backend: `models.py`, `schemas.py`, `service.py`, `router.py`. Logika bisnis hanya di `service.py`, dan router tidak boleh mengakses database secara langsung.
- Halaman frontend memanggil API lewat `src/lib/api.ts`. Jangan memanggil `fetch` langsung dari komponen.
- Setiap perubahan skema wajib disertai migrasi Alembic, bukan perubahan manual di database.
- Jangan commit file `.env`, `.env.local`, atau `.venv`.

## Masalah umum

| Gejala | Penyebab | Solusi |
|---|---|---|
| Badge backend merah | API belum berjalan | Jalankan `uvicorn` di folder backend |
| Badge database merah | Container belum menyala | `podman compose up -d`, lalu cek `podman ps` |
| CORS error di browser | Origin frontend tidak terdaftar | Pastikan `CORS_ORIGINS` di `backend/.env` memuat `http://localhost:3000` |
| `port 5432 already allocated` | PostgreSQL lain berjalan | Hentikan layanan lain di mesin |
| `ModuleNotFoundError: app` | Perintah dijalankan dari folder yang salah | Pastikan berada di folder `backend` |
| `AUTH_SECRET` error saat start | `ENVIRONMENT=production` tanpa secret kuat | Isi `AUTH_SECRET` minimal 32 karakter |
