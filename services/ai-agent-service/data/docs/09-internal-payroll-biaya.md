## 1. Total Wholesale Pool (Upah Jahit & Perbaikan)

**Penjelasan Konseptual:**
Menghitung akumulasi total anggaran jahit berdasarkan komponen produk yang bagus (`pcs_good`) serta komponen yang masuk jalur perbaikan (`pcs_repair`), dikalikan dengan kuantitas kebutuhan per item (*BOM qty*) dan masing-masing tarif dasarnya.

**Formula Matematis:**
$$\text{Total\_Wholesale\_Pool} = \sum (\text{production\_outputs.pcs\_good} \times \text{bom\_items.qty\_required} \times \text{rate\_cards.rate\_per\_pcs}) + \sum (\text{production\_outputs.pcs\_repair} \times \text{bom\_items.qty\_required} \times \text{rate\_cards.repair\_rate\_per\_pcs})$$

**Sumber Variabel (Asal Data):**
* `production_outputs`: Diambil dari input harian terminal lantai produksi.
* `bom_items`: Diambil dari spesifikasi Bill of Materials sampel/artikel.
* `rate_cards`: Diambil dari master data tarif jahit dan perbaikan per komponen.

**Komponen Variabel:**
* `pcs_good`: Jumlah unit komponen bagus yang selesai dikerjakan penjahit.
* `pcs_repair`: Jumlah unit komponen yang masuk jalur perbaikan (*repair*).
* `qty_required`: Jumlah kebutuhan komponen fisik untuk membentuk 1 unit produk.
* `rate_per_pcs`: Tarif upah normal per komponen.
* `repair_rate_per_pcs`: Tarif khusus upah perbaikan per komponen.

---

## 2. Subsidi Uang Makan (Berbasis Man-Days)

**Penjelasan Konseptual:**
Anggaran total makan ditentukan dari persentase tetap terhadap total *wholesale pool*. Dana ini kemudian didistribusikan secara proporsional kepada masing-masing pekerja berdasarkan hari kehadiran aktual mereka di pabrik.

**Formula Matematis:**
$$\text{Total\_Meal\_Budget} = \text{Total\_Wholesale\_Pool} \times \text{persentase\_makan}$$

$$\text{Meal\_Allowance\_Individu} = \left( \frac{\text{Total\_Meal\_Budget}}{\sum (\text{attendance.total\_man\_days\_pabrik})} \right) \times \text{attendance.hari\_hadir\_individu}$$

**Sumber Variabel (Asal Data):**
* `payroll_periods`: Mengambil nilai total *wholesale pool* yang telah direkap per periode.
* `attendance`: Diambil dari pencatatan absensi harian karyawan di pabrik.

**Komponen Variabel:**
* `Total_Wholesale_Pool`: Total anggaran jahit mingguan dari Modul 1.
* `persentase_makan`: Nilai parameter persentase tetap kebijakan perusahaan (misal `0.10` untuk 10%).
* `total_man_days_pabrik` ($T$): Akumulasi total hari hadir seluruh penjahit aktif dalam satu periode.
* `hari_hadir_individu` ($D$): Jumlah hari masuk kerja aktual dari penjahit bersangkutan.

---

## 3. Insentif QC & Pool Bonus 3-Arah

**Penjelasan Konseptual:**
Kompensasi pengawas kualitas mencakup insentif harian berdasarkan jumlah unit yang diinspeksi, serta *pool* bonus dari unit lolos QC yang dibagikan merata ke 3 pihak (2 Mandor dan 1 Kepala Operasional).

**Formula Matematis:**
$$\text{Total\_QC\_Incentive} = \sum (\text{qc\_inspections.pcs\_inspected} \times \text{qc\_inspections.rate\_insentif\_qc})$$

$$\text{QC\_Bonus\_Share\_Per\_Role} = \frac{\sum (\text{qc\_inspections.pcs\_passed} \times \text{qc\_inspections.rate\_bonus\_qc})}{3}$$

**Sumber Variabel (Asal Data):**
* `qc_inspections`: Diambil dari tabel hasil validasi mutu inspektur QC di akhir proses produksi.

**Komponen Variabel:**
* `pcs_inspected`: Jumlah unit total yang diperiksa oleh inspektur.
* `rate_insentif_qc`: Besaran tarif insentif per unit yang diinspeksi.
* `pcs_passed`: Jumlah unit yang dinyatakan lolos mutu (*Lolos*).
* `rate_bonus_qc`: Besaran tarif bonus per unit lolos yang masuk ke dalam *pool* manajemen.
* `Angka 3`: Pembagi tetap untuk dibagikan rata kepada 2 orang Mandor dan 1 orang Kepala Operasional.

---

## 4. Total HPP Batch (Cost of Goods Sold)

**Penjelasan Konseptual:**
Menggabungkan seluruh pos biaya langsung dan tidak langsung (material gudang, upah jahit, uang makan, insentif, bonus QC, hingga alokasi overhead tetap) untuk menghasilkan total harga pokok produksi per batch.

**Formula Matematis:**
$$\text{Total\_HPP\_Batch} = \text{Total\_Material\_Cost} + \text{Total\_Wholesale\_Pool} + \text{Total\_Meal\_Budget} + \text{Total\_QC\_Incentive} + \text{Total\_QC\_Bonus\_Pool} + \text{Fixed\_Overhead\_Cost}$$

**Sumber Variabel (Asal Data):**
* `batch_financials`: Tabel rekapitulasi finansial akhir per *batch* pesanan.
* Modul Gudang & Produksi: Akumulasi data biaya dari tabel material, *wholesale*, dan *payroll*.

**Komponen Variabel:**
* `Total_Material_Cost`: Akumulasi bahan baku utama (BOM) ditambah pesanan pembelian (*Purchase Order*) bahan dari gudang.
* `Total_Wholesale_Pool`: Total anggaran upah jahit dan perbaikan.
* `Total_Meal_Budget`: Total anggaran subsidi uang makan.
* `Total_QC_Incentive`: Total insentif pengawas QC.
* `Total_QC_Bonus_Pool`: Total *pool* bonus QC sebelum dibagi.
* `Fixed_Overhead_Cost`: Parameter biaya tetap (*fixed cost*) bulanan/mingguan yang diproporsikan ke *batch* tersebut.

---

## 5. Net Profit Owner & Profit Margin

**Penjelasan Konseptual:**
Menghitung keuntungan bersih pemilik pabrik dari selisih omzet total penjualan (*Total Revenue*) terhadap seluruh HPP batch yang dikeluarkan, lengkap dengan persentase margin labanya.

**Formula Matematis:**
$$\text{Net\_Profit\_Owner} = \text{Total\_Revenue} - \text{Total\_HPP\_Batch}$$

$$\text{Profit\_Margin\_Percentage} = \left( \frac{\text{Net\_Profit\_Owner}}{\text{Total\_Revenue}} \right) \times 100$$

**Sumber Variabel (Asal Data):**
* `batch_financials`: Tabel akhir yang memuat data omzet penjualan pesanan dan total HPP.

**Komponen Variabel:**
* `Total_Revenue`: Omzet kotor penjualan yang diperoleh dari jumlah unit terjual dikalikan harga jual (*selling price*).
* `Total_HPP_Batch`: Total keseluruhan biaya produksi dari Modul 4.