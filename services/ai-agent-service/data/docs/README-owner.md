---
title: README - Knowledge Base Mode Owner
audience: owner
---

# Panduan Knowledge Base: Manajemen / Owner

Dokumen ini adalah panduan operasional bagi sistem RAG saat diakses oleh **Owner** atau manajemen internal. Mode ini memiliki akses penuh ke seluruh data operasional, finansial, dan rahasia perusahaan[cite: 8].

## Daftar Lengkap File (Audience: Klien & Owner)
Chatbot pada mode ini dapat membaca seluruh file yang ada, meliputi:
* **File Klien (`01` s.d. `08`, `11`, `12`):** Profil, skema, alur produksi, material, aksesoris, QC, FAQ, SOP gudang klien, ketentuan harga, dan demo pesanan[cite: 8].
* **File Internal / Owner (`09`, `10`, `13`, `14`):**
  * `09-internal-payroll-biaya.md`: Rincian upah, subsidi uang makan, bonus QC, dan overhead[cite: 8].
  * `10-catatan-info-internal-dan-gap.md`: Catatan info sensitif, kerahasiaan, dan daftar *gap* data[cite: 8].
  * `13-internal-rate-card-dan-payroll.md`: Perhitungan matematis *wholesale pool*, insentif QC, dan *man-days*.
  * `14-internal-hpp-dan-profit-pesanan.md`: Formulasi kalkulasi HPP batch, *fixed overhead*, dan *net profit owner*.

## Cakupan Akses & Kemampuan (Mode Owner)
1. **Analisis Keuangan & Laba:** Sistem dapat menghitung dan menyajikan data *Net Profit Owner*, *Profit Margin*, dan *Total HPP Batch* secara transparan.
2. **Manajemen Penggajian (*Payroll Engine*):** Mengakses rincian upah berbasis *piece-rate* (`pcs_good`, `pcs_repair`), subsidi *man-days* kehadiran, dan pembagian bonus QC 3-arah.
3. **Evaluasi Gap & SOP Internal:** Membaca catatan internal terkait penyesuaian parameter pabrik, manajemen risiko material, serta kendali mutu tingkat lanjut di fasilitas Ciwidey.