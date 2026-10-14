# project-loe5 (Lukla Operations Engine)

Platform operasional terpadu pabrik garmen konveksi Ciwidey (*Lukla Manufacturing & Snøhund Brand Management*) yang melayani brand internal dan klien maklon B2B secara paralel dengan kapasitas dinamis hingga ±70 mesin jahit aktif.

---

## Arsitektur Sistem

- **frontend/**: Next.js 15 (App Router, React 19, TypeScript). Antarmuka web responsif berbasis peran (Dashboard Eksekutif, Terminal Touchscreen Lantai Produksi, dan Portal Klien B2B).
- **backend/**: FastAPI (Python 3.12/3.14). Seluruh logika bisnis manufaktur, modul gudang anti-kontaminasi, sample tracker, terminal output 30 menit, QC defect, payroll engine, dan integrasi AI Amazon Bedrock.
- **Database**: PostgreSQL 16 (port lokal `5433` via Podman/Docker `compose.yaml`).
- **AI & Storage**: AWS Bedrock (Titan Text Embeddings v2 & Nova Lite Inference Profile) + AWS S3 untuk dokumen SOP dan aset.

> **Catatan Arsitektur:** Frontend tidak mengakses database secara langsung. Seluruh operasi bisnis dan data dilayani lewat REST API di `http://localhost:8000/api/v1`.

---

## Status Progres Proyek (Hackathon Tracker)

- [x] **Fase 1: Fondasi Skema Database, Alembic, & Autentikasi RBAC (SELESAI)**
  - Pembuatan 14 tabel ORM SQLAlchemy sesuai dokumen SRS v2.0 dan BRD v1.0.
  - Migrasi skema awal Alembic (`create_initial_schema`) diterapkan ke PostgreSQL.
  - Autentikasi JWT (HttpOnly Cookie & Bearer Header) dengan hashing `bcrypt`.
  - Matriks RBAC untuk 8 Peran Pengguna dengan penegakan izin di sisi server (`require_roles`).
  - Script seeding data demo ([scripts/seed.py](file:///home/fitzeon/Documents/S1-Informatika/Pelatihan/MAIN-Academy/Hechaton/project-loe5-rag/backend/scripts/seed.py)): 3 Klien dan 12 Akun Pengguna siap pakai.
  - Pipeline RAG Bedrock operasional membaca SOP dari AWS S3.
- [x] **Fase 2: Modul Gudang Multi-Klien & Proteksi Anti-Kontaminasi Silang (SELESAI - Skenario 1 P0)**
  - Pendaftaran material dengan Tag ID Klien wajib (`client_id`).
  - Mutasi penerimaan bahan masuk (`POST /api/v1/gudang/receive`).
  - **Skenario 1**: Pengeluaran bahan ke cutting (`POST /api/v1/gudang/issue`) dengan guard otomatis: jika `item.client_id != order.client_id`, sistem memblokir dengan HTTP 400 dan stok tidak berkurang.
  - Isolasi data B2B: Klien maklon hanya dapat melihat stok dan riwayat mutasi miliknya sendiri.
  - Pengujian: **30/30 unit test lulus** di `pytest`, linter `ruff` bersih.
- [x] **Fase 3: Sample & Time Study Tracker + Stopwatch Digital (Skenario 4 - P0) (SELESAI)**
  - CRUD Sample dengan kode unik per klien.
  - Versi sample otomatis v1 DRAFT saat sample dibuat.
  - Revisi versi (v2, v3, dst.) dengan nomor otomatis dan status REVISION.
  - Approval versi (DRAFT/REVISION → APPROVED); versi APPROVED tidak bisa diubah.
  - Komponen garmen + stopwatch time study (detik): ringkasan total waktu & estimasi bahan.
  - Isolasi multi-tenant: KLIEN_MAKLON hanya melihat sample miliknya.
  - Pengujian: **20/20 unit test lulus** (total 52/52 seluruh suite).
- [x] **Fase 4: Produksi & Terminal Input 30 Menit Lantai Pabrik (P0) (SELESAI)**
  - CRUD Order Produksi Massal (langsung atau dari versi sample APPROVED — FR-4.1).
  - Komponen order + Rate Card upah borongan (cutting & sewing per pcs).
  - Guard: nomor order duplikat ditolak (HTTP 409).
  - Guard: sample versi non-APPROVED tidak bisa jadi order (HTTP 409).
  - Transisi status wajib berurutan: SAMPLE→CUTTING→SEWING→MENUNGGU_QC→QC→COMPLETED.
  - Terminal 30 Menit: Penjahit mencatat `qty_completed` per interval; Mandor memverifikasi.
  - Guard: output hanya bisa dicatat saat status SEWING.
  - Ringkasan output vs target (% completion) per order.
  - Isolasi multi-tenant KLIEN_MAKLON pada endpoint GET /produksi/orders.
  - Migrasi Alembic: tabel orders, order_components, rate_cards, production_outputs.
  - Pengujian: **22/22 unit test baru lulus** (total 74/74 seluruh suite).
- [x] **Fase 5: Quality Control, Manajemen Defect, & Pool Bonus QC (Skenario 3 - P0) (SELESAI)**
  - Pencatatan inspeksi QC per batch pcs: LOLOS / REPAIR / DEFECT.
  - Otomatis majukan status order MENUNGGU_QC → QC saat inspeksi pertama.
  - Guard: inspeksi hanya bisa dilakukan saat status MENUNGGU_QC atau QC.
  - Ringkasan QC per order: total, lolos, repair, defect, dan persentase.
  - **Skenario 3**: Pool Bonus QC = `qty_lolos × rate`, dibagi RATA kepada semua MANDOR + Kepala Ops (kalkulasi on-demand).
  - Migrasi Alembic: tabel qc_inspections.
  - Pengujian: **16/16 unit test baru lulus** (total 90/90 seluruh suite).
- [ ] **Fase 6: Payroll Engine Sabtu & Penguncian Transaksi Audit (Skenario 2 - P0)**
- [ ] **Fase 7: AI Dual-Assistant (Owner Tracker & Asisten Calon Klien) (P1)**

---

## Prasyarat

| Perangkat | Versi | Fedora / Linux | Windows |
|---|---|---|---|
| Podman / Docker | Terbaru | `sudo dnf install podman podman-compose` | Podman Desktop / Docker Desktop |
| Python | 3.12 / 3.14 | `sudo dnf install python3.12` | python.org |
| Node.js | 20 atau lebih baru | `sudo dnf install nodejs npm` | nodejs.org (LTS) |
| Git | Terbaru | `sudo dnf install git` | git-scm.com |

---

## Setup & Menjalankan Proyek

### 1. Database PostgreSQL

Dari root folder proyek, jalankan:

```bash
podman compose up -d
podman ps                      # Pastikan container project_loe5_db berstatus Up
```
*(Gunakan `docker compose up -d` jika menggunakan Docker)*.

### 2. Backend (FastAPI)

Masuk ke folder backend, aktifkan virtual environment, dan pasang dependensi:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
cp .env.example .env
```

Pastikan variabel `DATABASE_URL` dan `AUTH_SECRET` di `backend/.env` telah terisi:
```env
DATABASE_URL=postgresql+psycopg://loe:loe_dev@localhost:5433/project_loe5
AUTH_SECRET=lukla_operations_engine_super_secret_auth_key_2026_dev_secure
```

Terapkan migrasi skema database dan jalankan seed data demo:

```bash
alembic upgrade head
python scripts/seed.py
```

Jalankan pengujian untuk memastikan backend 100% sehat:

```bash
pytest
```

Jalankan server API backend:

```bash
uvicorn app.main:app --reload
```
Dokumentasi Swagger API interaktif tersedia di: **http://localhost:8000/docs**

### 3. Frontend (Next.js)

Buka terminal baru di folder frontend:

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Buka **http://localhost:3000** di browser.

---

## Akun Demo Pengujian (Seed Users)

Seluruh akun demo telah disiapkan untuk pengujian masing-masing peran operasional:

| Peran (Role) | Username | Password | Deskripsi / Kewenangan |
|---|---|---|---|
| **OWNER** | `owner` | `owner123` | Akses eksekutif, analitik pabrik, AI tracker |
| **TIM_SAMPLE** | `adis_sample` | `sample123` | Stopwatch time study, revisi sample, approval |
| **GUDANG** | `gudang_budi` | `gudang123` | Penerimaan bahan, pengeluaran ke cutting, anti-kontaminasi |
| **MANDOR** | `mandor_agus` | `mandor123` | Mandor Line 1, alokasi penjahit, verifikasi output 30 menit |
| **MANDOR** | `mandor_joko` | `mandor123` | Mandor Line 2, alokasi penjahit, penerima pool bonus QC |
| **MANDOR** | `ka_ops` | `kaops123` | Kepala Operasional, penerima pool bonus QC |
| **PENJAHIT** | `penjahit_siti` | `jahit123` | Operator jahit Line 1 (upah borongan) |
| **PENJAHIT** | `penjahit_rini` | `jahit123` | Operator jahit Line 2 (upah borongan) |
| **QC_INSPECTOR** | `qc_dewi` | `qc123` | Pemeriksaan produk (Lolos, Repair, Defect) |
| **FINANCE_PAYROLL**| `finance_rina`| `finance123`| Perhitungan upah borongan Sabtu, bonus QC, uang makan % |
| **KLIEN_MAKLON** | `klien_a` | `klien123` | Portal B2B PT Tekstil Maju (hanya data miliknya) |
| **KLIEN_MAKLON** | `klien_b` | `klien123` | Portal B2B CV Busana Prima (hanya data miliknya) |

---

## Daftar Endpoint API Aktif

### Autentikasi (`/api/v1/auth`)
- `POST /api/v1/auth/login` — Login pengguna, menghasilkan JWT & HttpOnly cookie.
- `POST /api/v1/auth/logout` — Logout dan membersihkan cookie sesi.
- `GET /api/v1/auth/me` — Mengambil data profil dan peran pengguna yang sedang login.

### Modul Gudang & Anti-Kontaminasi (`/api/v1/gudang`)
- `GET /api/v1/gudang/items` — Mengambil daftar stok bahan baku (otomatis terisolasi per `client_id` untuk Klien Maklon).
- `POST /api/v1/gudang/items` — Mendaftarkan item material baru dengan Tag ID Klien wajib.
- `POST /api/v1/gudang/receive` — Mencatat mutasi penerimaan bahan masuk (Transaksi IN).
- `POST /api/v1/gudang/issue` — Mengeluarkan bahan ke cutting (Transaksi OUT) dengan **guard anti-kontaminasi silang**.
- `GET /api/v1/gudang/transactions` — Melihat riwayat mutasi stok bahan.

### Modul AI RAG (`/api/v1/ai`)
- `POST /api/v1/ai/ask` — Tanya-jawab RAG seputar SOP operasional manufaktur via Bedrock.
- `POST /api/v1/ai/reindex` — Membangun ulang indeks chunk & embedding dari S3.
- `GET /api/v1/ai/status` — Memeriksa status kesiapan indeks RAG.

### Modul Sample \& Time Study Tracker (`/api/v1/sample`)
- `GET /api/v1/sample/` — Daftar sample beserta semua versi (filter per `client_id` opsional).
- `POST /api/v1/sample/` — Membuat sample baru; v1 DRAFT otomatis terbuat.
- `GET /api/v1/sample/{sample_id}` — Detail sample + semua versi.
- `POST /api/v1/sample/{sample_id}/revisi` — Membuat versi revisi baru (status REVISION).
- `GET /api/v1/sample/versions/{version_id}` — Detail versi + komponen time study + ringkasan.
- `POST /api/v1/sample/versions/{version_id}/approve` — Menyetujui versi (→ APPROVED).
- `POST /api/v1/sample/versions/{version_id}/components` — Menambahkan komponen garmen + stopwatch.
- `PUT /api/v1/sample/components/{component_id}` — Memperbarui komponen garmen.

### Modul Produksi & Terminal 30 Menit (`/api/v1/produksi`)
- `GET /api/v1/produksi/orders` — Daftar order produksi (filter per `client_id` / `status`).
- `POST /api/v1/produksi/orders` — Membuat order baru + komponen + rate card.
- `GET /api/v1/produksi/orders/{order_id}` — Detail order + komponen + rate card.
- `PATCH /api/v1/produksi/orders/{order_id}/status` — Transisi status order.
- `POST /api/v1/produksi/orders/from-sample/{version_id}` — Konversi sample APPROVED → order massal (FR-4.1).
- `GET /api/v1/produksi/orders/{order_id}/summary` — Ringkasan output vs target pcs.
- `GET /api/v1/produksi/outputs` — Log output 30 menit (filter per order/line/status verifikasi).
- `POST /api/v1/produksi/outputs` — Penjahit mencatat output per 30 menit dari terminal.
- `PATCH /api/v1/produksi/outputs/{output_id}/verify` — Mandor memverifikasi log output.

### Modul Quality Control (`/api/v1/qc`)
- `GET /api/v1/qc/inspections` — Daftar inspeksi QC (filter per order / status).
- `POST /api/v1/qc/inspections` — QC Inspector mencatat hasil pemeriksaan (LOLOS/REPAIR/DEFECT).
- `GET /api/v1/qc/inspections/{inspection_id}` — Detail satu catatan inspeksi QC.
- `GET /api/v1/qc/summary/{order_id}` — Ringkasan QC: total, lolos, repair, defect, % pass rate.
- `POST /api/v1/qc/bonus/{order_id}` — **Skenario 3**: Hitung & bagi pool bonus QC 3-arah (Mandor + Kepala Ops).

---

## 4 Skenario Pengujian Operasional Kunci (Kriteria Hackathon)

1. **Proteksi Kontaminasi Silang Stok (FR-6.2):** Sistem memblokir otomatis transaksi pengeluaran bahan jika `item.client_id != order.client_id` dengan error HTTP 400 eksplisit sebelum stok berkurang.
2. **Payroll Headcount Dinamis (FR-10.1 & FR-10.2):** Menambah penjahit baru di tengah minggu, mencatat output 30 menit, dan menghasilkan perhitungan upah borongan Sabtu + uang makan 10–15% secara otomatis tanpa batasan slot.
3. **Pembagian Pool Bonus QC 3-Arah (FR-10.3):** Akumulasi produk lolos QC dikalikan rate bonus per pcs, lalu dibagi rata kepada 2 Mandor dan 1 Kepala Operasional.
4. **Alur Revisi Sample ke Order Massal (FR-3.1 & FR-4.1):** Pembuatan Sample v1 dengan time study, revisi menjadi v2, persetujuan versi, dan konversi otomatis menjadi Order Produksi Massal (CMT / Semi-CMT / Full Package).

---

## Perintah Harian Pengembang

| Tujuan | Perintah | Folder |
|---|---|---|
| Menyalakan database | `podman compose up -d` | root |
| Menghentikan database | `podman compose stop db` | root |
| Menjalankan backend | `uvicorn app.main:app --reload` | `backend/` |
| Menjalankan unit test | `pytest` | `backend/` |
| Memeriksa linter | `ruff check .` | `backend/` |
| Membuat migrasi skema | `alembic revision --autogenerate -m "pesan"` | `backend/` |
| Menerapkan migrasi | `alembic upgrade head` | `backend/` |
| Seeding data demo | `python scripts/seed.py` | `backend/` |
| Menjalankan frontend | `npm run dev` | `frontend/` |
| Typecheck frontend | `npm run typecheck` | `frontend/` |
| Build produksi frontend | `npm run build` | `frontend/` |
