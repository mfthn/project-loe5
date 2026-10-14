# SOP Fitur: Payroll dan Rekap

| | |
|---|---|
| Modul | Payroll (`/payroll`) |
| Kebutuhan | FR-10.1 (borongan), FR-10.2 (uang makan), FR-10.3 (bonus QC), anti-duplikasi periode |
| Peran utama | FINANCE_PAYROLL, OWNER |
| Versi dokumen | 1.0 |
| Tanggal | 13 Oktober 2026 |
| Status | Draft, berbasis perilaku kode saat ini |

Sumber kebenaran: `src/modules/payroll/service.ts`, `src/app/(app)/payroll/actions.ts`, `src/app/(app)/payroll/page.tsx`, `prisma/schema/payroll.prisma`, `prisma/manual/01_constraints_triggers.sql` (payroll_settings, payroll_periods, payroll_items).

---

## 1. Tujuan dan ruang lingkup

SOP ini mengatur:

1. Perhitungan upah borongan per penjahit dari output yang sudah diverifikasi.
2. Perhitungan pool uang makan sebagai persentase dari total ongkos jahit, dibagi proporsional.
3. Perhitungan pool bonus QC dari pcs LOLOS, dibagi rata ke penerima bonus terdaftar.
4. Pengaturan tunggal (persentase uang makan dan bonus per pcs).
5. Finalisasi periode menjadi snapshot yang tidak bisa diubah.

---

## 2. Peran dan hak akses

| Peran | Hak |
|---|---|
| FINANCE_PAYROLL | Melihat rekap, mengubah pengaturan, memfinalisasi periode |
| OWNER | Sama dengan FINANCE_PAYROLL |
| Peran lain | Tidak memiliki akses ke modul ini |

---

## 3. Alur bisnis

1. Finance memilih periode perhitungan (rentang tanggal WIB, tanggal selesai bersifat eksklusif).
2. Sistem menghitung ulang rekap secara langsung:
   - **Borongan**: setiap catatan output terverifikasi pada periode dikalikan tarif jahit untuk klien pesanan dan komponen tersebut, lalu diakumulasi per penjahit.
   - **Uang makan**: persentase pengaturan dikalikan total ongkos jahit periode (pool), lalu dibagi ke penjahit sebanding dengan porsi upahnya.
   - **Bonus QC**: total pcs LOLOS pada periode dikalikan bonus per pcs (pool), lalu dibagi rata ke seluruh penerima bonus terdaftar.
3. Finance memeriksa rekap dan peringatan yang tampil.
4. Finance mengklik **Finalisasi periode**. Sistem memeriksa apakah periode yang persis sama sudah pernah difinalisasi, lalu menyimpan hasil sebagai snapshot permanen.

---

## 4. Langkah operasional

### 4.1 Memilih periode

1. Login sebagai `finance@loe.test`, buka **Payroll & Rekap**.
2. Pada kartu **Periode perhitungan**, isi **Mulai** dan **Selesai (tidak termasuk)**. Default: 7 hari terakhir sampai besok.
3. Klik **Hitung**. Seluruh kartu di bawahnya menampilkan hasil periode tersebut.

### 4.2 Memeriksa rekap

- **Total ongkos jahit**, **Pool uang makan** (dengan persentase aktif), dan **Pool bonus QC** tampil sebagai kartu statistik.
- Tabel **Borongan dan uang makan per penjahit**: pcs, upah borongan, uang makan, total.
- Tabel **Bonus QC (dibagi rata)**: nama penerima dan jumlah bonus.
- Peringatan tampil sebagai kotak merah, misalnya tarif hilang atau belum ada penerima bonus.

### 4.3 Mengubah pengaturan

1. Pada kartu **Pengaturan**, isi **Uang makan (% dari ongkos jahit)** (0 sampai 100, contoh `12.5`) dan **Bonus per pcs LOLOS (Rp)** (tidak negatif, contoh `500`).
2. Klik **Simpan pengaturan**. Hasil: "Pengaturan payroll diperbarui."
3. Pengaturan baru berlaku untuk perhitungan berikutnya; periode yang sudah difinalisasi tetap memakai nilai lama (snapshot).

### 4.4 Finalisasi periode

1. Pastikan periode dan rekap sudah benar. Perhatikan: **setelah difinalisasi, hasil tidak bisa diubah**.
2. Klik **Finalisasi periode**. Hasil: "Payroll periode ini difinalisasi dan disimpan sebagai snapshot."
3. Finalisasi periode yang sama dua kali ditolak dengan pesan "Periode ini sudah difinalisasi."

### 4.5 Penerima bonus

Penerima bonus QC terdaftar di tabel `bonus_recipients` (hasil seed: Mandor 1, Mandor 2, dan Kepala Operasional). Penambahan atau pengurangan penerima dilakukan lewat seed atau migrasi data, bukan lewat layar.

---

## 5. Aturan bisnis dan validasi

| Aturan | Lapisan penjaga | Referensi |
|---|---|---|
| Hanya output dengan `verified_at` terisi yang dihitung ke borongan | Aplikasi | `computePayroll` |
| Upah per baris = pcs x tarif jahit (sewing rate) untuk klien pesanan dan komponen | Aplikasi | `computePayroll` |
| Tarif yang tidak tersedia menghasilkan peringatan dan baris dilewati (tidak dihitung, tidak menjatuhkan proses) | Aplikasi | `computePayroll` |
| Pool uang makan = persentase pengaturan x total ongkos jahit | Aplikasi | `computePayroll` |
| Uang makan per penjahit = (upah penjahit / total ongkos jahit) x pool uang makan | Aplikasi | `computePayroll` |
| Pool bonus QC = total pcs LOLOS periode x bonus per pcs | Aplikasi | `computePayroll` |
| Bonus dibagi rata ke semua penerima aktif; tanpa penerima menghasilkan peringatan dan bonus nol | Aplikasi | `computePayroll` |
| Periode memakai zona waktu WIB: input `YYYY-MM-DD` menjadi awal hari UTC+7 | Aplikasi | `payroll/actions.ts` (`jakartaDate`) |
| Periode [mulai, selesai): batas akhir tidak termasuk | Aplikasi | `computePayroll` (`gte` mulai, `lt` selesai) |
| Finalisasi menolak periode yang sudah pernah difinalisasi (bandingan mulai dan selesai persis) | Aplikasi | `finalizePayroll` |
| `payroll_settings` hanya boleh satu baris (id = 1) | Database (CHECK `ps_singleton_chk`) | `01_constraints_triggers.sql` |
| Persentase uang makan 0 sampai 100; bonus per pcs tidak negatif | Aplikasi dan database (CHECK `ps_meal_chk`, `ps_bonus_chk`) | `payroll/actions.ts`, `01_constraints_triggers.sql` |
| Periode: `end_date > start_date` dan tidak boleh tumpang tindih | Database (CHECK `pp_dates_chk`, EXCLUDE `pp_no_overlap` dengan `btree_gist`) | `01_constraints_triggers.sql` |
| Tabel `payroll_periods`, `payroll_items`, dan `payroll_bonus_items` bersifat append-only | Database (trigger) | `01_constraints_triggers.sql` |
| Nilai uang memakai `NUMERIC(14,2)`, bukan floating point | Skema | `payroll.prisma` |

---

## 6. Pesan error dan penanganan

| Pesan | Penyebab | Penanganan |
|---|---|---|
| "Periode ini sudah difinalisasi." | Periode mulai dan selesai sama persis dengan periode tersimpan | Pilih periode berbeda atau akui hasil finalisasi sebelumnya |
| "Persentase uang makan harus 0 sampai 100." | Nilai di luar rentang | Isi persentase valid |
| "Nilai bonus tidak boleh negatif." | Bonus per pcs negatif | Isi 0 atau lebih |
| Peringatan "Tarif hilang untuk komponen X (pesanan Y)." | Output terverifikasi tanpa rate card yang cocok | Tambahkan rate card untuk klien dan komponen, lalu hitung ulang |
| Peringatan "Belum ada penerima bonus QC yang terdaftar." | Tabel `bonus_recipients` kosong | Daftarkan penerima bonus lewat seed |
| "Payroll periode ini difinalisasi dan disimpan sebagai snapshot." (sukses) | Finalisasi berhasil | Lanjutkan ke periode berikutnya |
| Pelanggaran EXCLUDE constraint (periode tumpang tindih, dari database) | Membuat periode yang menabrak periode tersimpan | Sesuaikan rentang tanggal agar tidak menimpa |
| "Tabel payroll_* bersifat append-only..." (dari database) | Percobaan mengubah hasil finalisasi | Hasil final bersifat permanen; kesalahan diatasi dengan periode koreksi terpisah |

---

## 7. Skenario uji

- [ ] Pilih periode yang memuat output terverifikasi: rekap borongan tampil per penjahit dengan angka benar.
- [ ] Ubah persentase uang makan: pool uang makan berubah pada hitungan ulang, tanpa mengubah periode yang sudah final.
- [ ] Ubah bonus per pcs: pool bonus QC berubah pada hitungan ulang.
- [ ] Finalisasi periode: berhasil, hasil terkunci.
- [ ] Finalisasi periode yang sama lagi: ditolak ("Periode ini sudah difinalisasi.").
- [ ] Periode dengan pcs LOLOS 0: pool bonus QC nol.
- [ ] Periode tanpa output terverifikasi: tabel borongan kosong dengan pesan "Belum ada output terverifikasi pada periode ini."
- [ ] Konfirmasi di database: periode tumpang tindih ditolak EXCLUDE constraint; baris hasil payroll tidak bisa diubah atau dihapus (append-only).

---

## 8. Catatan teknis

| Aspek | Lokasi |
|---|---|
| Logika bisnis | `src/modules/payroll/service.ts` (`computePayroll`, `finalizePayroll`, tipe `PayrollResult`) |
| Server actions | `src/app/(app)/payroll/actions.ts` (`finalizeAction`, `updateSettingAction`, `jakartaDate`) |
| Halaman | `src/app/(app)/payroll/page.tsx` (pembulatan tanggal memakai `toLocaleDateString("sv-SE", { timeZone: "Asia/Jakarta" })`) |
| Tabel terkait | `payroll_settings`, `bonus_recipients`, `payroll_periods`, `payroll_items`, `payroll_bonus_items`, `output_records`, `qc_records`, `rate_cards` |
| Nilai default pengaturan | `mealPercent` 12.5, `bonusPerPcs` 500 (dari seed) |
| Ekstensi database | `btree_gist` untuk exclude constraint tanggal |

Formula ringkas (periode `[mulai, selesai)`):

```
upah(penjahit)   = SUM(pcs terverifikasi x sewing_rate(klien pesanan, komponen))
poolUangMakan    = mealPercent% x totalOngkosJahit
uangMakan(p)     = (upah(p) / totalOngkosJahit) x poolUangMakan
poolBonusQc      = SUM(pcs QC LOLOS) x bonusPerPcs
bonus(penerima)  = poolBonusQc / jumlah penerima
```

---

## 9. Keterbatasan dan rencana perubahan

1. **Hasil finalisasi masih disimpan sebagai satu JSON.** `finalizePayroll` menulis seluruh `PayrollResult` ke kolom `result`, sedangkan skema baru memecahnya menjadi `payroll_periods` (total dan snapshot pengaturan), `payroll_items` (upah per penjahit), dan `payroll_bonus_items` (bonus per penerima). Rencana: tulis ketiga tabel saat finalisasi agar bisa diquery dan dijaga constraint append-only.
2. **Duplikasi perhitungan tarif.** `computePayroll` menghitung ulang upah dari rate card terkini (`clientId_component`), sementara trigger verifikasi menyimpan `rate_applied` dan `wage_amount` per baris output. Rencana: payroll membaca `wage_amount` snapshot per baris, bukan menghitung ulang, sehingga perubahan tarif retroaktif tidak mengubah hasil periode lalu.
3. **Periode difinalisasi dibandingkan persis mulai dan selesai.** Periode yang tumpang tindih tetap dicegah oleh EXCLUDE constraint di database (saat migrasi aktif), tetapi pesan errornya kurang ramah pengguna dibanding pesan aplikasi.
4. **Pembulatan.** Perhitungan uang makan dan bonus memakai pembulatan bawaan JavaScript ke `NUMERIC(14,2)`; kebijakan pembulatan desimal (misal dibulatkan ke rupiah terdekat) perlu disepakati sebelum rilis keuangan resmi.
5. **Pengelolaan penerima bonus belum punya layar.** Penambahan penerima dilakukan lewat seed; BRD menetapkan tiga penerima (2 mandor dan 1 kepala operasional), jumlah dijaga di layer aplikasi.

---

## 10. Riwayat versi dokumen

| Versi | Tanggal | Perubahan | Oleh |
|---|---|---|---|
| 1.0 | 13 Oktober 2026 | Penyusunan awal dari kode saat ini | Tim proyek |
