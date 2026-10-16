---
title: Catatan Info Internal, Gap & Daftar Asumsi DEMO
audience: owner
---

# A. Info yang SENGAJA tidak dimasukkan ke versi calon client

| Info | Alasan | File sumber |
|---|---|---|
| Sistem upah borongan, jadwal Sabtu, rate card | Biaya dan hubungan kerja internal; memengaruhi negosiasi harga | 09, 13 |
| Uang makan 10–15% | Struktur biaya internal | 09, 13 |
| Bonus QC 3 arah | Struktur insentif pimpinan, sangat sensitif | 09, 13 |
| Rumus dan angka overhead per unit | Membuka struktur biaya dan margin | 09, 13 |
| HPP, margin, dan profit per pesanan | Membuka struktur biaya dan margin | 14 |
| Slip upah dan log output per operator | Data pribadi pekerja | 13 |
| Batas wewenang operator/QC/mandor | Kontrol internal | 08 |
| Larangan teknis internal (shading rule, K3) | Detail SOP, cukup ringkas di versi client | 08 |
| Detail time study / SAM | Di versi client hanya disebut sebagai dasar estimasi waktu | 08 |
| Istilah "sistem multi-tenant" dan blokir otomatis | Detail sistem; di versi client dijelaskan sederhana | 08 |

# B. Info yang dibuat ringkas / diubah untuk calon client
- Isolasi bahan antar klien: ditampilkan sebagai jaminan keamanan material, tanpa menyebut klien lain.
- Pencatatan 30 menit: ditampilkan sebagai pemantauan progres, tanpa detail operator.
- Waste: ditampilkan sebagai pelaporan efisiensi bahan.
- Contoh pesanan (file 12) hanya memuat status, QC, packing, dan tagihan, tanpa data upah atau biaya.

# C. Redundansi yang sudah dihapus/digabung
- Tag ID Klien dan ID Pesanan (disebut 4 kali) menjadi satu penjelasan.
- Pencatatan output 30 menit (3 kali) menjadi satu.
- Isolasi bahan antar klien (3 kali) menjadi satu.
- Status QC Pass/Repair/Defect (2 kali) menjadi satu.
- Time study (2 kali) menjadi satu.
- Penjelasan skema CMT/Semi-CMT/Full Package menjadi satu file.
- Alur 6 fase dan SOP per fase digabung: ringkas untuk client, detail untuk owner.

# D. Status informasi yang tadinya kurang

| Item | Status sekarang |
|---|---|
| MOQ, lead time, biaya sampel, termin pembayaran, harga | Terisi **asumsi DEMO** di file 11 |
| Kebijakan cacat, sisa kain, pengiriman | Terisi **asumsi DEMO** di file 07 dan 11 |
| Rate card, slip upah, log 30 menit, overhead | Terisi **asumsi DEMO** di file 13 |
| HPP dan margin | Terisi **asumsi DEMO** di file 14 |
| Contoh pesanan end-to-end | **Data fiktif** di file 12 |
| Kontak resmi, alamat lengkap | Masih [ISI OWNER] |
| NDA / kerahasiaan desain | Masih [ISI OWNER] |
| AQL resmi | Masih [ISI OWNER] |
| Jenis produk yang tidak diterima, sertifikasi, kunjungan pabrik, ekspor | Masih [ISI OWNER] |
| Jasa pola/grading, mesin khusus (overdeck, bartack, seam sealing) | Masih [ISI OWNER] |
| Kapasitas bulanan resmi (pcs/bulan), portofolio | Masih [ISI OWNER] |

# E. Hal yang sebaiknya diverifikasi owner (akurasi teknis)
- Korespondensi Tex 24 = ticket 120 dan Tex 40 = ticket 80 bisa berbeda tergantung merek benang; cek dengan supplier.
- Penyebutan "tipe SES/FF" pada jarum ball point sebaiknya dicek kode aslinya.
- Poin lubang pada sistem 4-titik umumnya mengikuti ukuran lubang; pastikan ambang yang dipakai pabrik.
- Bahan outdoor waterproof/laminated biasanya butuh penanganan jahitan khusus (seam tape); tambahkan di `04-material-kain.md` jika dikerjakan.
- "Portal B2B" dan pelacakan ukuran oleh klien: jika belum ada, jangan dipromosikan ke calon client.
- Dokumen asli belum jelas apakah uang makan dipotong dari pool ongkos jahit atau dibayar terpisah.

# F. Daftar ASUMSI DEMO (wajib diganti sebelum go-live)

| Asumsi | Nilai demo | Di file |
|---|---|---|
| Tarif borongan | Rp450 per SAM-menit | 13, 14 |
| Nilai SAM per produk | 8 / 16 / 30 / 28 / 32 / 38 / 45 menit | 13, 14 |
| Target harian operator | 450 SAM-menit, 6 hari kerja | 13 |
| Tenaga non-jahit | 25% dari rate jahit | 14 |
| Uang makan | 12% dari ongkos jahit, dibayar di atas upah | 13, 14 |
| Bonus QC | Rp500 per pcs lolos | 13, 14 |
| Overhead | Rp80 juta per bulan ÷ 20.000 pcs = Rp4.000 per pcs | 13, 14 |
| Markup harga dasar | 1,25 × HPP; diskon volume 5% dan 10%; tambahan 20% untuk 50–99 pcs | 11, 14 |
| MOQ | 50 pcs per model per warna | 11 |
| Biaya sampel | Rp500.000 per model, dikreditkan jika order dalam 60 hari | 11 |
| Termin pembayaran | DP 50%, pelunasan sebelum kirim | 11 |
| Lead time | Sampel 7–14 hari kerja, massal 3–4 minggu per 300 pcs | 11 |
| Kebijakan cacat | Cacat akibat proses tidak ditagihkan | 11, 12 |
| Harga kain dan trims (contoh Full Package) | Rp48.000/m dan Rp22.000/pcs, tidak diverifikasi pasar | 11 |
| Seluruh data pesanan ORD-2026-014 | Fiktif | 12, 13, 14 |

Satu-satunya angka eksternal yang diverifikasi: UMK Kabupaten Bandung 2026 Rp3.972.202. Pencarian ongkos jahit/maklon online hanya menemukan MOQ vendor lain berkisar 12–100 pcs dan tidak menemukan tabel tarif yang bisa diverifikasi, sehingga harga di file 11 disusun dari model biaya internal asumsi, bukan dari harga pasar.
