# SOP Fitur: Gudang Multi-Klien dan Anti-Kontaminasi Silang

| | |
|---|---|
| Modul | Gudang Multi-Klien (`/gudang`) |
| Kebutuhan | FR-5, FR-6.1 (tag klien dan pesanan), FR-6.2 (blokir silang) |
| Peran utama | GUDANG, QC_INSPECTOR (baca), OWNER |
| Versi dokumen | 1.0 |
| Tanggal | 13 Oktober 2026 |
| Status | Draft, berbasis perilaku kode saat ini |

Sumber kebenaran: `src/modules/gudang/service.ts`, `src/app/(app)/gudang/actions.ts`, `src/app/(app)/gudang/page.tsx`, `prisma/schema/gudang.prisma`, `prisma/manual/01_constraints_triggers.sql` bagian 4.

---

## 1. Tujuan dan ruang lingkup

SOP ini mengatur:

1. Penerimaan bahan ke gudang dengan Tag Klien dan ID Pesanan yang wajib diisi.
2. Pengeluaran bahan untuk pesanan tertentu.
3. Blokade anti-kontaminasi silang: bahan satu klien tidak boleh dipakai untuk pesanan klien lain.
4. Pencatatan percobaan pengeluaran yang diblokir sebagai bahan audit.
5. Tampilan inventaris per klien.

Prinsip utama: setiap lot bahan terikat pada satu klien dan satu pesanan sejak diterima. Tag tidak bisa dipindahtangankan.

---

## 2. Peran dan hak akses

| Peran | Hak |
|---|---|
| GUDANG | Menerima dan mengeluarkan bahan, melihat inventaris dan riwayat blokir |
| QC_INSPECTOR | Akses modul gudang untuk membaca data stok |
| OWNER | Akses penuh |
| Peran lain | Tidak memiliki akses ke modul ini |

Catatan: pembatasan aksi di server hanya memakai `requireUser("gudang")`, yaitu cek keanggotaan modul. Peran yang memiliki modul gudang (termasuk QC_INSPECTOR) secara teknis bisa mengirim form penerimaan dan pengeluaran.

---

## 3. Alur bisnis

### 3.1 Penerimaan (IN)

1. Bahan datang dari klien beserta rujukan pesanan.
2. Petugas gudang mengisi form: nama bahan, jenis (RAW/WIP/FINISHED), klien, pesanan, jumlah, satuan.
3. Sistem memvalidasi bahwa pesanan yang dipilih benar-benar milik klien yang dipilih.
4. Baris `stock_items` dibuat (satu baris = satu lot untuk satu pesanan), disertai pergerakan `IN` yang mencatat penerimaan.
5. Kode lot dibuat otomatis dengan format `LOT-<epoch ms>`.

### 3.2 Pengeluaran (OUT)

1. Petugas memilih item stok (hanya yang sisa stoknya lebih dari 0), pesanan tujuan, dan jumlah.
2. Sistem memeriksa kecocokan: klien item harus sama dengan klien pesanan tujuan, dan pesanan item harus sama dengan pesanan tujuan.
3. Jika tidak cocok: percobaan dicatat ke `audit_logs` dengan aksi `BLOCKED_ISSUE`, lalu transaksi ditolak dengan pesan "Ditolak: bahan ... milik ... tidak boleh dikeluarkan untuk pesanan ... milik ...".
4. Jika cocok tetapi jumlah melebihi sisa stok: transaksi ditolak dengan pesan sisa stok.
5. Jika lolos: sisa stok berkurang dan pergerakan `OUT` tercatat.

### 3.3 Pemantauan

Halaman menampilkan empat bagian: form penerimaan, form pengeluaran, inventaris per klien (100 baris terbaru), dan **Percobaan pengeluaran yang diblokir** (5 percobaan terakhir) untuk audit.

---

## 4. Langkah operasional

### 4.1 Menerima bahan

1. Login sebagai `gudang@loe.test`, buka **Gudang Multi-Klien**.
2. Pada kartu **Penerimaan bahan**, isi:
   - **Nama bahan** (contoh "Kain cotton combed 30s").
   - **Jenis**: Bahan baku (RAW), WIP, atau Barang jadi (FINISHED).
   - **Klien**: pemilik bahan (contoh "Klien Maklon A").
   - **Pesanan**: pesanan milik klien tersebut (tampil dengan format `kode · nama klien`).
   - **Jumlah** (lebih dari 0) dan **Satuan** (default `pcs`).
3. Klik **Simpan penerimaan**. Hasil: "Bahan diterima dan sudah diberi Tag Klien serta ID Pesanan."
4. Baris baru muncul di **Inventaris per klien** dengan kode `LOT-...`.

### 4.2 Mengeluarkan bahan

1. Pada kartu **Pengeluaran ke cutting**, isi:
   - **Item stok**: pilih lot (hanya lot dengan sisa lebih dari 0 yang tampil, lengkap dengan sisa stok).
   - **Pesanan tujuan**: pilih pesanan yang sama persis dengan milik lot.
   - **Jumlah** (lebih dari 0 dan tidak melebihi sisa).
2. Klik **Keluarkan bahan**. Hasil: "Pengeluaran bahan berhasil dicatat." Sisa stok pada tabel inventaris berkurang.

### 4.3 Menguji blokade anti-kontaminasi (skenario wajib BRD)

1. Pastikan ada lot milik "Klien Maklon A" untuk pesanan milik Klien A (dari langkah 4.1).
2. Pada form pengeluaran, pilih lot tersebut tetapi pilih **Pesanan tujuan** milik klien lain (misal pesanan Snøhund).
3. Klik **Keluarkan bahan**. Sistem menolak dengan pesan "Ditolak: bahan ... milik Klien Maklon A tidak boleh dikeluarkan untuk pesanan ... milik Snøhund (internal)."
4. Percobaan muncul di kartu **Percobaan pengeluaran yang diblokir** beserta waktu, kode bahan, pemilik, dan pesanan tujuan.

### 4.4 Memantau inventaris

- Tabel **Inventaris per klien** menampilkan kode, bahan, jenis, klien, pesanan, sisa, dan waktu penerimaan (100 baris terbaru).
- Klik menu peran lain untuk cross-check: akun klien melihat stoknya di **Portal Klien**.

---

## 5. Aturan bisnis dan validasi

| Aturan | Lapisan penjaga | Referensi |
|---|---|---|
| Tag klien dan ID pesanan wajib diisi saat penerimaan | Aplikasi | `receiveStock` |
| Pesanan yang dipilih harus benar-benar milik klien yang dipilih | Aplikasi | `receiveStock` |
| Jumlah penerimaan harus lebih dari 0 | Aplikasi | `receiveStock` |
| Pengeluaran hanya jika klien item = klien pesanan tujuan DAN pesanan item = pesanan tujuan | Aplikasi (dicek sebelum transaksi) dan database (trigger `stock_movement_guard`) | `issueStock`, `01_constraints_triggers.sql` |
| Percobaan yang diblokir dicatat ke `audit_logs` dengan aksi `BLOCKED_ISSUE` berisi kode bahan, pemilik, pesanan tujuan, dan klien tujuan | Aplikasi | `issueStock` |
| Jumlah pengeluaran harus lebih dari 0 dan tidak melebihi sisa stok | Aplikasi | `issueStock` |
| Pengeluaran dan pengurangan stok berjalan dalam satu transaksi | Aplikasi | `issueStock` (`$transaction`) |
| Trigger database mengunci baris item (`SELECT ... FOR UPDATE`) saat insert pergerakan, sehingga dua pengeluaran bersamaan tidak melewati batas stok | Database | `stock_movement_guard` |
| Tag klien dan pesanan pada pergerakan harus cocok dengan item; jika tidak, error `BLOCKED_ISSUE` | Database | `stock_movement_guard` |
| Saldo stok diperbarui oleh trigger `AFTER INSERT` (IN menambah, OUT mengurangi) | Database | `stock_movement_apply` |
| `stock_items.quantity >= 0` dan `stock_movements.quantity > 0` | Database (CHECK) | `01_constraints_triggers.sql` |
| `stock_movements` bersifat append-only (UPDATE dan DELETE ditolak) | Database (trigger) | `01_constraints_triggers.sql` |

---

## 6. Pesan error dan penanganan

| Pesan | Penyebab | Penanganan |
|---|---|---|
| "Tag ID Klien dan ID Pesanan wajib diisi sebelum bahan disimpan." | Klien atau pesanan tidak dipilih | Pilih klien dan pesanan pada form |
| "Jumlah harus lebih dari 0." | Jumlah 0 atau negatif (penerimaan maupun pengeluaran) | Isi jumlah valid |
| "Pesanan tidak ditemukan atau bukan milik klien yang dipilih." | Pesanan dipilih tidak sesuai klien | Pilih klien dan pesanan yang benar-benar berpasangan |
| "Item stok tidak ditemukan." / "Pesanan tujuan tidak ditemukan." | ID tidak valid atau data sudah berubah | Muat ulang halaman dan pilih ulang dari daftar terkini |
| "Ditolak: bahan X milik A tidak boleh dikeluarkan untuk pesanan Y milik B." | Percobaan kontaminasi silang | Kembalikan ke pilihan pesanan yang benar; percobaan tercatat untuk audit |
| "Stok tidak cukup. Tersisa N satuan untuk X." | Jumlah keluar melebihi sisa | Kurangi jumlah atau terima bahan tambahan dulu |
| "BLOCKED_ISSUE: bahan milik klien ... tidak boleh dipakai untuk pesanan ..." (dari database) | Percobaan lolos pemeriksaan aplikasi (misal lewat klien lain) tetapi ditolak trigger | Perbaiki pemilihan pesanan; lapisan database adalah pengaman terakhir |
| "STOCK_INSUFFICIENT: sisa stok hanya ..." (dari database) | Race condition dua pengeluaran bersamaan | Muat ulang dan ulangi dengan jumlah yang tersedia |

---

## 7. Skenario uji

- [ ] Terima bahan untuk Klien Maklon A + pesanan milik Klien A: berhasil, tag klien dan pesanan terisi.
- [ ] Coba terima bahan dengan pesanan milik klien lain: ditolak ("bukan milik klien yang dipilih").
- [ ] Keluarkan bahan lot Klien A untuk pesanan Klien A: berhasil, sisa stok berkurang tepat.
- [ ] Keluarkan bahan lot Klien A untuk pesanan Snøhund: diblokir, muncul pesan "Ditolak: ...".
- [ ] Percobaan yang diblokir tampil di kartu "Percobaan pengeluaran yang diblokir" dengan data benar.
- [ ] Keluarkan melebihi sisa stok: ditolak dengan keterangan sisa.
- [ ] Konfirmasi di database: `stock_movements` tidak bisa diubah atau dihapus (trigger append-only).
- [ ] Dua pengeluaran bersamaan yang melebihi saldo: satu ditolak trigger (kunci baris `FOR UPDATE`).
- [ ] Akun `klien@loe.test`: stok titipan Klien A terlihat di Portal Klien tanpa data klien lain.

---

## 8. Catatan teknis

| Aspek | Lokasi |
|---|---|
| Logika bisnis | `src/modules/gudang/service.ts` (`receiveStock`, `issueStock`, `BlockedTransactionError`) |
| Server actions | `src/app/(app)/gudang/actions.ts` (`receiveAction`, `issueAction`) |
| Halaman | `src/app/(app)/gudang/page.tsx` |
| Tabel terkait | `stock_items`, `stock_movements`, `production_orders`, `clients`, `audit_logs` |
| Enum terkait | `StockType` (RAW, WIP, FINISHED), `MovementDirection` (IN, OUT) |
| Trigger terkait | `stock_movement_guard` (anti-kontaminasi + kunci baris + cek saldo), `stock_movement_apply` (saldo), `stock_movements_append_only` |
| Aksi audit | `BLOCKED_ISSUE` pada `audit_logs`, ditampilkan sebagai "Percobaan pengeluaran yang diblokir" |

`BlockedTransactionError` adalah kelas error khusus agar lapisan UI bisa membedakan pemblokiran bisnis dari error teknis biasa. Pesan errornya ditampilkan apa adanya kepada pengguna.

---

## 9. Keterbatasan dan rencana perubahan

1. **Duplikasi penerapan saldo (penting).** Kode `receiveStock` dan `issueStock` saat ini mengubah `stock_items.quantity` langsung dari aplikasi, sementara skema baru juga memasang trigger `stock_movement_apply` yang melakukan hal yang sama. Saat trigger sudah aktif, saldo bisa terpotong atau bertambah dua kali. Rencana: setelah migrasi trigger, hapus pembaruan saldo manual di service dan serahkan seluruhnya ke trigger.
2. **`audit_logs` belum mengisi `entity_type` dan `entity_id`.** Skema baru mewajibkan `entity_type`. Rencana: isi `entity_type = "stock_movements"` dan `entity_id` terkait saat mencatat `BLOCKED_ISSUE`.
3. **Pencatatan audit blokir oleh aplikasi.** Sesuai keputusan terbuka no. 1 di `desain-database-project-loe5.md`, audit ditulis aplikasi sebelum error dilempar (pilihan a), karena `RAISE EXCEPTION` membatalkan transaksi database.
4. **Kode lot otomatis memakai `Date.now()`.** Format `LOT-<epoch ms>` rawan duplikat jika dua penerimaan terjadi pada milidetik yang sama. Skema mewajibkan `code` unik.
5. **Pengeluaran selalu mencatat catatan "Pengeluaran ke cutting".** Untuk alur lain (misal finishing atau barang jadi) belum ada pilihan tujuan catatan.
6. **`received_at` dan `created_at` pada service.** Kolom `received_at` dan `created_at` mengandalkan default database; service tidak mengisinya secara eksplisit (sesuai skema saat ini).

---

## 10. Riwayat versi dokumen

| Versi | Tanggal | Perubahan | Oleh |
|---|---|---|---|
| 1.0 | 13 Oktober 2026 | Penyusunan awal dari kode saat ini | Tim proyek |
