# Lukla Operations Engine

Platform operasional pabrik garmen yang menyatukan pemisahan stok multi-klien, alokasi line produksi dinamis, pencatatan output setiap 30 menit, kontrol kualitas, dan perhitungan payroll yang fleksibel — dirancang untuk kapasitas cair 1 hingga ±70 mesin jahit aktif di fasilitas produksi Ciwidey, melayani brand internal Snøhund dan klien maklon B2B secara paralel.

---

## Latar Belakang

Lukla Manufacturing menghadapi tiga masalah utama dalam operasional sehari-hari:

1. **Risiko kontaminasi silang stok** — Bahan baku, WIP, dan barang jadi milik banyak klien dikelola bersamaan tanpa pemisahan sistemik.
2. **Payroll kompleks dengan headcount dinamis** — Upah borongan mingguan berbasis output 30 menit, bonus QC bersama, uang makan, dan overhead membutuhkan pencatatan otomatis yang akurat.
3. **Kurangnya penelusuran dan histori revisi** — Perubahan spesifikasi sample, estimasi pemakaian bahan, time study, dan catatan defect belum terpusat secara digital.
4. **Akses informasi belum efisien** — Owner harus menelusuri banyak layar; calon klien B2B belum punya kanal konsultasi awal yang otomatis.

---

## Fitur Utama (MVP)

| Modul | Deskripsi |
|---|---|
| **Auth & RBAC** | Login dengan 8 peran berbeda, isolasi data klien berdasarkan `client_id` |
| **Sample & Time Study Tracker** | Pencatatan pemakaian bahan sample, time study per komponen, versioning sample (v1, v2, …), konversi ke Order Produksi Massal |
| **Gudang Multi-Klien** | Penerimaan bahan dengan Tag ID Klien & ID Pesanan; pemblokiran otomatis bahan yang tidak cocok (anti-kontaminasi silang) |
| **Terminal Input 30 Menit** | Alokasi penjahit ke line paralel, rate card per artikel/klien, input output 30 menit, dashboard operasional real-time |
| **QC & Barang Jadi** | Status Lolos / Repair / Defect dengan kategori defect terpusat |
| **Payroll Engine** | Upah borongan mingguan, uang makan (persentase input manual), pool bonus QC dibagi 3 |
| **Portal Klien Maklon (B2B)** | Pemantauan status pesanan dan stok titipan oleh klien secara mandiri |
| **Chatbot Owner (AI)** | Tanya-jawab data operasional berbasis data sistem nyata; baca saja, hanya peran Owner |
| **Chatbot Calon Klien (AI)** | Konsultasi awal skema kerja sama (CMT, Semi-CMT, Full Package) + arahan ke WA/Telegram pemesanan |

### Skema Kerja Sama yang Didukung

| Skema | Keterangan |
|---|---|
| CMT (Cut, Make, Trim) | Klien menyediakan seluruh bahan baku; Lukla menyediakan jasa cutting, jahit, finishing |
| Semi-CMT | Klien menyediakan bahan utama; Lukla menyediakan bahan pendukung & aksesoris |
| CMT + Bahan (Full Package) | Lukla menyediakan seluruh bahan baku dan jasa produksi (termasuk order internal Snøhund) |

---

## Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router) |
| UI | React 19 + Tailwind CSS 4 |
| Auth | NextAuth v4 |
| ORM | Prisma 8 |
| Database | PostgreSQL 16 |
| AI | AWS Bedrock (via `@aws-sdk/client-bedrock-runtime`) |
| Validasi | Zod 4 |
| Runtime | TypeScript 5 |

---

## Memulai Proyek

### 1. Prasyarat

- Node.js (versi LTS terbaru)
- Docker & Docker Compose (untuk database)
- Akses AWS Bedrock (untuk fitur chatbot AI)

### 2. Jalankan Database

File `.env` sudah berisi konfigurasi Docker Compose untuk PostgreSQL:

```bash
docker compose up -d
```

### 3. Install Dependensi

```bash
npm install
```

### 4. Migrasi Database

```bash
npx prisma migrate dev
```

### 5. Jalankan Development Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

---

## Struktur Direktori

```
src/
└── app/          # Next.js App Router (pages, layouts, API routes)
prisma/           # Schema & migrasi database
public/           # Aset statis
```

---

## Roadmap Sprint

| Hari | Fokus |
|---|---|
| Hari 1 | Planning — BRD, ERD, Wireframe, Kontrak API, Rancangan AI |
| Hari 2 | Build 1 — Auth/RBAC, Gudang Multi-Klien, Terminal Output 30 Menit |
| Hari 3 | Build 2 — Sample Versioning, QC, Payroll, Dashboard, Chatbot AI *(Feature Freeze)* |
| Hari 4 | Testing — Uji 4 skenario SRS, uji chatbot, bug fixing, deploy staging |
| Hari 5 | Deploy Final & Demo ke Klien |

---

## Tim

- **Product Owner**: Lukla Manufacturing Operations Team & Snøhund Brand Management  
- **Tech Lead / Architect**: Muhammad Fathin Abdul Aziz / Kelompok 5  
- **Dokumen Acuan**: BRD Lukla Operations Engine v1.0 · SRS Lukla Operations Engine v2.0

---

## Lisensi

Proyek ini bersifat privat dan dikembangkan untuk keperluan internal Lukla Manufacturing.
