# Panduan Setup Database project-loe5

Panduan ini membangun database PostgreSQL sesuai `desain-database-project-loe5.md`, dari container Podman sampai seluruh constraint, trigger, dan uji otomatis lolos. Jalankan langkah secara berurutan. Semua perintah dijalankan di folder `project-loe5` di Fedora.

Estimasi waktu: 30 sampai 45 menit.

---

## Langkah 0. Pastikan prasyarat terpasang

```bash
podman --version
node --version        # harus 20 atau lebih baru
npm --version
```

Jika `podman compose` tidak tersedia, pasang `podman-compose`:

```bash
sudo dnf install -y podman-compose
```

---

## Langkah 1. Nyalakan PostgreSQL

```bash
cd project-loe5
podman compose up -d
podman ps
```

Output `podman ps` harus menampilkan container bernama `project_loe5_db` dengan status `Up`.

Cek koneksi:

```bash
podman exec -it project_loe5_db psql -U loe -d project_loe5 -c "SELECT version();"
```

Jika muncul versi PostgreSQL 16, koneksi berhasil.

**Catatan penting:** jika sebelumnya Anda sudah menjalankan `migrate dev` dengan skema lama, database dan folder migrasi perlu direset. Jalankan perintah ini hanya jika belum ada data penting:

```bash
rm -rf prisma/migrations
npx prisma migrate reset --skip-seed --force
```

---

## Langkah 2. Pasang skema versi desain

File skema sudah diperbarui di folder `prisma/schema/`. Ada 7 file: `base`, `sample`, `gudang`, `produksi`, `qc`, `payroll`, dan `ai`. Setiap file berisi model dari modul masing-masing.

Pastikan `.env` sudah ada dan `DATABASE_URL` sesuai dengan container:

```bash
cat .env | grep DATABASE_URL
```

Nilainya harus `postgresql://loe:loe_dev@localhost:5432/project_loe5?schema=public`. Jika belum ada, salin dari `.env.example`.

Validasi skema sebelum migrasi:

```bash
npx prisma validate
npx prisma format
```

Jika `validate` menampilkan `The schema at prisma/schema is valid`, lanjutkan. Jika ada error, catat nama file dan baris yang disebutkan, lalu kirimkan kepada saya.

---

## Langkah 3. Buat migrasi awal (tabel dan enum)

```bash
npx prisma migrate dev --name init_schema
```

Prisma akan membuat tabel, enum, foreign key, dan index yang bisa dinyatakan lewat schema. Prisma juga otomatis men-generate client.

Verifikasi:

```bash
podman exec -it project_loe5_db psql -U loe -d project_loe5 -c "\dt"
```

Anda harus melihat 21 tabel. Daftarnya: `clients`, `users`, `production_orders`, `audit_logs`, `samples`, `sample_versions`, `time_studies`, `sample_material_uses`, `stock_items`, `stock_movements`, `production_lines`, `line_allocations`, `rate_cards`, `output_records`, `qc_records`, `payroll_settings`, `bonus_recipients`, `payroll_periods`, `payroll_items`, `payroll_bonus_items`, dan `ai_query_logs`. Tabel `_prisma_migrations` juga muncul, itu normal.

---

## Langkah 4. Pasang constraint, index parsial, dan trigger

Prisma tidak bisa menulis CHECK constraint, exclude constraint, index parsial, dan trigger. Semua itu dimasukkan lewat migrasi kosong yang kita isi sendiri.

Buat migrasi kosong tanpa langsung menjalankannya:

```bash
npx prisma migrate dev --create-only --name custom_constraints
```

Cari nama folder yang baru dibuat:

```bash
ls prisma/schema/migrations
```

Akan ada folder dengan nama seperti `20261013050000_custom_constraints`. Salin isi file SQL ke dalam `migration.sql` di folder tersebut. Ganti `<NAMA_FOLDER>` sesuai hasil `ls`:

```bash
cp prisma/manual/01_constraints_triggers.sql prisma/migrations/schema/migrations
```

Terapkan migrasi:

```bash
npx prisma migrate dev
```

Output harus menampilkan `Applied migration ... custom_constraints`.

Verifikasi trigger terpasang. Hasilnya harus 12 baris:

```bash
podman exec -it project_loe5_db psql -U loe -d project_loe5 -c \
"SELECT tgname, tgrelid::regclass AS tabel FROM pg_trigger WHERE NOT tgisinternal ORDER BY 2, 1;"
```

Verifikasi constraint dan index pada `output_records`:

```bash
podman exec -it project_loe5_db psql -U loe -d project_loe5 -c "\d output_records"
```

Pada bagian Check constraints harus ada `or_interval_chk`, `or_wage_pair_chk`, dan `or_verify_pair_chk`. Pada bagian Triggers harus ada `output_records_guard_update` dan `output_records_guard_delete`.

---

## Langkah 5. Isi data uji minimal

Data uji ini membuat dua klien, empat user, dua pesanan, satu lot bahan, satu tarif, satu line, dan satu alokasi penjahit. Dimasukkan langsung lewat SQL, tanpa menunggu seed aplikasi.

```bash
podman exec -i project_loe5_db psql -U loe -d project_loe5 -v ON_ERROR_STOP=1 < prisma/manual/02_data_uji_minimal.sql
```

Jika muncul `INSERT 0 2`, `INSERT 0 4`, dan seterusnya tanpa error, data berhasil masuk.

---

## Langkah 6. Jalankan uji constraint otomatis

```bash
podman exec -i project_loe5_db psql -U loe -d project_loe5 < prisma/manual/03_uji_constraint.sql
```

Skrip ini menjalankan 12 uji. Setiap uji mencetak satu baris dengan awalan `OK` atau `GAGAL`. Hasil yang benar:

| Uji | Yang diharapkan |
|---|---|
| A1 | `OK (A1) ditolak: BLOCKED_ISSUE ...` (penerimaan pesanan klien lain) |
| B | `OK (B) penerimaan benar diterima` |
| C | `OK (C) ditolak: STOCK_INSUFFICIENT ...` (melebihi saldo) |
| D | `OK (D) pengeluaran benar diterima` |
| E | `OK (E) output valid diterima` |
| F | `OK (F) ditolak ...` (interval 08:15 tidak valid) |
| G | Baris hasil SELECT: `rate_applied = 4000.00` dan `wage_amount = 80000.00` |
| H | `OK (H) terkunci ...` |
| I | `OK (I) ditolak ...` (REPAIR tanpa kategori) |
| J | `OK (J) append-only ...` |
| K | `OK (K) ditolak ...` (periode tumpang tindih) |
| L | `OK (L) ditolak ...` (klien tanpa client_id) |

Jika ada baris yang diawali `GAGAL`, berarti constraint atau trigger tidak bekerja. Catat nomor ujinya dan kirimkan kepada saya.

**Catatan:** skrip ini mengubah data. Untuk mengulang dari awal, jalankan:

```bash
npx prisma migrate reset --skip-seed --force
```

Lalu ulangi langkah 5 dan 6. Gunakan `--skip-seed` karena seed aplikasi belum disesuaikan dengan skema baru.

---

## Langkah 7. Buat role database untuk aplikasi (disarankan)

Saat ini aplikasi dan migrasi memakai user `loe` yang merupakan owner. Untuk keamanan, aplikasi sebaiknya memakai role terbatas. Ini lapisan tambahan di atas trigger.

```bash
podman exec -it project_loe5_db psql -U loe -d project_loe5 <<'SQL'
CREATE ROLE loe_app LOGIN PASSWORD 'ganti_password_ini';
GRANT CONNECT ON DATABASE project_loe5 TO loe_app;
GRANT USAGE ON SCHEMA public TO loe_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO loe_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO loe_app;

-- Tabel append-only: aplikasi hanya boleh membaca dan menambah
REVOKE UPDATE, DELETE ON audit_logs, stock_movements, qc_records,
  payroll_periods, payroll_items, payroll_bonus_items FROM loe_app;
REVOKE UPDATE ON ai_query_logs FROM loe_app;

-- Tabel migrasi tidak boleh disentuh aplikasi
REVOKE ALL ON _prisma_migrations FROM loe_app;
SQL
```

Ganti `ganti_password_ini` dengan password yang kuat. Setelah ini, `DATABASE_URL` untuk aplikasi di `.env` diubah menjadi `postgresql://loe_app:...`. Migrasi tetap memakai `loe`.

---

## Langkah 8. Cek akhir

```bash
npx prisma migrate status
```

Output harus menyatakan `Database schema is up to date!`.

Cek ukuran dan ringkasan:

```bash
podman exec -it project_loe5_db psql -U loe -d project_loe5 -c \
"SELECT 'clients' AS tabel, count(*) FROM clients
 UNION ALL SELECT 'stock_movements', count(*) FROM stock_movements
 UNION ALL SELECT 'output_records', count(*) FROM output_records;"
```

Jika hasilnya sesuai dengan data uji, database siap dipakai.

---

## Troubleshooting

**`extension "btree_gist" ... permission denied`**
Jalankan manual sebagai superuser. User `loe` adalah superuser di container ini:
```bash
podman exec -it project_loe5_db psql -U loe -d project_loe5 -c "CREATE EXTENSION IF NOT EXISTS btree_gist;"
```
Lalu ulangi `npx prisma migrate dev`.

**`Drift detected` atau migrasi tidak cocok**
Terjadi jika ada perubahan manual di database. Untuk data uji, reset:
```bash
npx prisma migrate reset --skip-seed --force
```

**`port 5432 is already allocated`**
Ada PostgreSQL lain yang berjalan di mesin. Cek dan hentikan:
```bash
sudo ss -ltnp | grep 5432
```

**`relation "xxx" does not exist` saat uji**
Migrasi belum berhasil. Jalankan `npx prisma migrate status` dan periksa langkah 3 dan 4.

**Uji 02 gagal dengan `duplicate key`**
Data uji sudah pernah dimasukkan. Reset database lalu ulangi langkah 5.

**Warning `package.json#prisma is deprecated`**
Tidak mengganggu. Konfigurasi bisa dipindah ke `prisma.config.ts` nanti.

---

## Yang belum berubah di kode aplikasi

Skema database sudah berubah, tetapi kode di `src/` masih memakai bentuk lama. Aplikasi belum bisa berjalan penuh sampai bagian ini diperbaiki. Daftar ini menjadi pekerjaan tahap berikutnya.

1. **Uang dan kuantitas bertipe `Decimal`.** Semua perhitungan di service harus mengubahnya dengan `Number(...)` atau memakai library desimal.
2. **Field baru wajib diisi.** `createdById`, `recordedById`, `entityType`, `approvedById`, dan `allocatedById` harus dikirim dari session user.
3. **Penerimaan bahan.** `receiveStock` membuat item dengan `quantity: 0`, lalu menambahkan movement `IN`. Saldo dijaga trigger, jadi aplikasi tidak lagi mengisi `quantity` langsung.
4. **Alokasi penjahit.** `active` diganti `endedAt`. Alokasi lama diakhiri dengan mengisi `endedAt`.
5. **Verifikasi output.** Aplikasi cukup mengisi `verifiedById` dan `verifiedAt`. Trigger mengisi `rateApplied` dan `wageAmount`.
6. **Payroll.** Hitung dari `wageAmount` yang sudah tersimpan, bukan dari tarif saat ini. Hasil finalisasi disimpan ke `payroll_items` dan `payroll_bonus_items`.
7. **Sample.** `approveSampleVersion` harus mengisi `approvedById` dan `approvedAt`, karena constraint `sv_approved_chk` menuntutnya.
8. **Waktu dan bahan.** Time study dan pemakaian bahan sekarang terikat ke `sampleVersionId`, bukan `sampleId`.
9. **QC.** Kategori cacat harus berupa nilai enum `DefectCategory`.
10. **Seed.** `prisma/seed.ts` harus disesuaikan dengan kode klien, `createdById`, dan field baru.

Setelah langkah 1 sampai 8 di panduan ini berhasil, kirimkan hasilnya ke saya. Kita lanjutkan dengan penyesuaian kode di urutan 1 sampai 10 di atas.
