# Lukla Operations Engine (project-loe5)

Platform operasional manufaktur terpadu pabrik garmen & tas konveksi Ciwidey (*Lukla Manufacturing & Snøhund Brand Management*). Sistem ini melayani pengelolaan brand internal dan mitra maklon B2B secara terisolasi dengan kapasitas lini dinamis hingga ±70 mesin jahit aktif.

---

## 🏛️ Arsitektur Sistem

Proyek ini telah mengadopsi arsitektur **Modular Microservices** untuk skalabilitas tinggi, isolasi peran bisnis, dan pemisahan beban komputasi AI:

```
                               ┌──────────────────────────────────────────────────────────┐
                               │               Frontend Web Application                   │
                               │           Next.js 15 (React 19, TypeScript)              │
                               │                http://localhost:3000                     │
                               └────────────────────────────┬─────────────────────────────┘
                                                            │
                                         /api/v1 Proxy & Rewrites (Next.js / Nginx)
                                                            │
                 ┌───────────────────┬──────────────────────┼──────────────────────┬───────────────────┐
                 │                   │                      │                      │                   │
                 ▼                   ▼                      ▼                      ▼                   ▼
       ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
       │   auth-service    │ │ manufacturing-svc │ │  finance-service  │ │ ai-agent-service  │ │ PostgreSQL 16     │
       │    Port: 8001     │ │    Port: 8002     │ │    Port: 8003     │ │    Port: 8004     │ │    Port: 5433     │
       │                   │ │                   │ │                   │ │                   │ │                   │
       │ • JWT & RBAC 8 Peran│ • Sample & TimeStudy│ • Payroll Sabtu     │ │ • Public Chatbot  │ │ • Skema Relasional│
       │ • Registrasi Klien│ │ • Gudang Isolasi  │ │ • FR-10 Audit Lock│ │   (WhatsApp Handoff)│ • Transaksi Produksi│
       │ • ID Klien & Audit│ │ • Terminal 30m    │ │ • Invoicing & PO  │ │ • Owner Tracker   │ │ • Riwayat Audit   │
       │                   │ │ • QC & Pool Bonus │ │                   │ │   (Live DB Context)│                   │
       └─────────┬─────────┘ └─────────┬─────────┘ └─────────┬─────────┘ └─────────┬─────────┘ └─────────┬─────────┘
                 │                     │                     │                     │                     │
                 └─────────────────────┴─────────────────────┴─────────────────────┴─────────────────────┘
                                               Database Connection Pool (SQLAlchemy)
```

### Komponen Utama:
1. **Frontend (`frontend/`)**:
   * Next.js 15 (App Router, React 19, TypeScript).
   * Desain kustom *Glassmorphism* (Backdrop blur, transisi lembut, modern UI/UX).
   * Antarmuka multi-peran: Dashboard Eksekutif, Terminal Touchscreen Lantai Produksi, Portal Mandiri Klien B2B, dan Widget AI.
2. **Auth Service (`services/auth-service/` - Port 8001)**:
   * Mengelola autentikasi JWT (HttpOnly Cookie & Bearer Token) dengan hashing `bcrypt`.
   * Penegakan otorisasi RBAC untuk 8 peran pengguna.
   * Pendaftaran mandiri klien maklon dengan format ID Klien unik (`LOE-XXXXXX`) dan riwayat audit perubahan nomor kontak.
3. **Manufacturing Service (`services/manufacturing-service/` - Port 8002)**:
   * **Modul Sampel**: Siklus prototipe (v1 DRAFT $\rightarrow$ revisi $\rightarrow$ APPROVED), stopwatch time study (detik per komponen).
   * **Modul Gudang**: Proteksi anti-kontaminasi silang material antar-klien (pemblokiran otomatis HTTP 400 jika bahan tertukar).
   * **Modul Lantai Produksi**: Pipeline status urut (*SAMPLE $\rightarrow$ CUTTING $\rightarrow$ SEWING $\rightarrow$ MENUNGGU_QC $\rightarrow$ QC $\rightarrow$ COMPLETED*), pencatatan output interval 30 menit, dan verifikasi mandor.
   * **Modul Quality Control**: Pencatatan defect/repair/pass dan live kalkulator Pool Bonus QC Mandor 3-arah.
4. **Finance Service (`services/finance-service/` - Port 8003)**:
   * **Payroll Engine Sabtu**: Perhitungan upah borongan dinamis per penjahit, uang makan 10–15%, dan bonus QC.
   * **FR-10 Audit Lock**: Penguncian rekapitulasi upah permanen yang tidak dapat diubah sepihak.
   * Pencatatan invoice tagihan klien dan purchase order (PO) bahan baku.
5. **AI Agent Service (`services/ai-agent-service/` - Port 8004)**:
   * Ditenagai **Google Gemini AI** (`gemini-3.5-flash-lite`) dengan fallback cerdas ke generator heuristik lokal offline.
   * **Chatbot Calon Klien (`/ai/rag`)**: Menjawab seputar skema CMT/Semi-CMT/Full Package, kapasitas pabrik, dan SOP dengan *intent-based WhatsApp handoff* otomatis ke tim sample saat klien siap order.
   * **Owner Tracker (`/ai/ask-agent`)**: Menggabungkan SOP pabrik dengan data operasional *real-time* dari PostgreSQL (status SPK aktif, output per lini, dan statistik QC).
6. **Database**:
   * PostgreSQL 16 (Port `5433` lokal via Docker/Podman).

---

## 🚀 Panduan Menjalankan Sistem

### Prasyarat:
* **Docker** atau **Podman** (termasuk Compose).
* **Python 3.12** atau **3.14**.
* **Node.js 20+** dan **npm**.

---

### Cara 1: Menjalankan Lokal (Recommended untuk Development)

#### 1. Jalankan Database PostgreSQL
Dari root direktori proyek:
```bash
docker compose up -d
# atau bila menggunakan podman:
podman compose up -d
```
Pastikan database berjalan di port `5433`.

#### 2. Konfigurasi Environment File
Salin template environment untuk masing-masing service:
```bash
cp .env.example .env
cp frontend/.env.example frontend/.env.local
cp services/auth-service/.env.example services/auth-service/.env
cp services/manufacturing-service/.env.example services/manufacturing-service/.env
cp services/finance-service/.env.example services/finance-service/.env
cp services/ai-agent-service/.env.example services/ai-agent-service/.env
```
*(Opsional: Masukkan `GEMINI_API_KEY` Anda di `services/ai-agent-service/.env` jika ingin menggunakan model Google Gemini aktif).*

#### 3. Jalankan Seluruh Microservices Backend (1 Perintah)
Gunakan skrip otomatis lokal:
```bash
./scripts/run-microservices-local.sh
```
Skrip ini akan otomatis menyiapkan *virtual environment*, memasang dependensi yang dibutuhkan, dan menjalankan seluruh microservices di latar belakang:
* Auth Service: `http://localhost:8001`
* Manufacturing Service: `http://localhost:8002`
* Finance Service: `http://localhost:8003`
* AI Agent Service: `http://localhost:8004`

#### 4. Jalankan Frontend Web
Buka terminal baru:
```bash
cd frontend
npm install
npm run dev
```
Buka browser di **http://localhost:3000**.

---

### Cara 2: Menjalankan Seluruh Sistem dengan Docker Compose (Production Ready)

Untuk menjalankan seluruh microservices dan frontend dalam container terisolasi:
```bash
docker compose -f docker-compose.microservices.yml up --build -d
```

---

## 👥 Akun Sistem & Akses Pengguna

| Peran (Role) | Username | Password | Deskripsi & Akses Modul |
|---|---|---|---|
| **OWNER** | `hendra_owner` | `Lukla@Owner2026` | Akses penuh seluruh modul: Dashboard Eksekutif, Owner AI Tracker, Gudang, Produksi, QC, Payroll, dan Manajemen Pengguna. |
| **FINANCE_PAYROLL** | `rina_finance` | `Lukla@Finance2026` | Rekapitulasi payroll Sabtu, penguncian audit lock, dan pencatatan pembayaran upah. |
| **MANDOR** | `agus_mandor` | `Lukla@Mandor2026` | Monitoring lini jahit, verifikasi log output penjahit interval 30 menit, pool bonus QC. |
| **PENJAHIT** | `siti_jahit` | `Lukla@Jahit2026` | Terminal input hasil jahit berkala dan pantauan slip upah borongan pribadi. |
| **GUDANG** | `budi_gudang` | `Lukla@Gudang2026` | Penerimaan bahan, pencatatan rak simpan, dan pengeluaran kain berproteksi anti-kontaminasi. |
| **TIM_SAMPLE** | `adis_sample` | `Lukla@Sample2026` | Pembuatan versi prototipe (v1, v2), time study stopwatch detik, dan pengajuan approval. |
| **QC_INSPECTOR** | `dewi_qc` | `Lukla@QC2026` | Pemeriksaan kualitas akhir (Lolos, Repair, Defect/Afkir). |
| **KLIEN_MAKLON** | *Registrasi Mandiri* atau `busanatest` | *Password saat daftar* | Portal Klien B2B: Pantau progres pesanan, transparansi sisa bahan baku di gudang, konsultasi maklon. |

> **Registrasi Klien**: Calon mitra/brand maklon dapat mendaftar mandiri melalui halaman **Login** $\rightarrow$ tab **Daftar Klien**. Sistem akan menerbitkan ID Klien resmi (misal: `LOE-C26D65`) untuk isolasi data pesanan dan bahan.

---

## 📌 Ringkasan Skenario Bisnis Utama (Core Factory Business Rules)

1. **Proteksi Anti-Kontaminasi Silang Gudang (Scenario 1)**:
   Bahan baku kain yang didaftarkan terikat wajib ke `client_id`. Sistem menolak pengeluaran bahan (`/gudang/issue`) jika pesanan produksi bukan milik klien pemilik bahan tersebut.
2. **Headcount Dinamis & Payroll Sabtu (Scenario 2)**:
   Penjahit baru dapat langsung mencatat output tanpa batasan slot. Upah borongan, tunjangan makan 10–15%, dan bonus QC dihitung otomatis saat tutup buku Sabtu dengan proteksi **FR-10 Audit Lock** permanen.
3. **Pembagian Pool Bonus QC 3-Arah (Scenario 3)**:
   Total barang lolos QC dikalikan tarif bonus per pcs dan dibagikan secara adil kepada Mandor dan Kepala Operasional.
4. **Alur Validasi State Machine Produksi (Scenario 4)**:
   Tahapan produksi wajib melewati urutan:
   $$\text{SAMPLE} \longrightarrow \text{CUTTING} \longrightarrow \text{SEWING} \longrightarrow \text{MENUNGGU\_QC} \longrightarrow \text{QC} \longrightarrow \text{COMPLETED}$$
   Output jahit hanya dapat dicatat saat status order berada di tahap `SEWING`.

---

## 📂 Struktur Repositori

```
project-loe5-rag/
├── frontend/                     # Next.js 15 Web Application
│   ├── src/app/                  # App Router Pages & Styles
│   ├── src/components/           # Reusable UI & Widget Components
│   └── src/lib/                  # API Client & RBAC Utilities
├── services/                     # Microservices Backend
│   ├── auth-service/             # Port 8001: Autentikasi & Klien
│   ├── manufacturing-service/    # Port 8002: Sampel, Gudang, Produksi, QC
│   ├── finance-service/          # Port 8003: Payroll, Invoice, PO
│   └── ai-agent-service/         # Port 8004: Chatbot RAG & Owner Tracker
├── gateway/                      # Nginx API Gateway Configuration
├── scripts/                      # Skrip automasi & runner lokal
├── docker-compose.microservices.yml # Orkestrasi container production
├── compose.yaml                  # Database PostgreSQL local container
└── README.md                     # Dokumentasi resmi proyek
```
