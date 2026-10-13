-- =====================================================================
-- Uji otomatis: setiap blok di bawah HARUS GAGAL dengan pesan yang disebutkan.
-- Jalankan dengan: psql ... -f prisma/manual/03_uji_constraint.sql
-- Setiap blok dibungkus DO agar error bisa ditangkap dan dicetak.
-- =====================================================================

-- A. Anti-kontaminasi: bahan klien A dikeluarkan untuk pesanan klien internal -> harus BLOCKED_ISSUE
DO $$
BEGIN
  INSERT INTO stock_movements (item_id, direction, quantity, order_id, created_by)
  VALUES ('st_kla', 'IN', 100, 'or_snh', 'us_gdg');
  RAISE NOTICE 'GAGAL: penerimaan dengan pesanan milik klien lain seharusnya ditolak';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK (A1) ditolak: %', SQLERRM;
END $$;

-- B. Penerimaan yang benar -> harus sukses, saldo naik jadi 100
DO $$
BEGIN
  INSERT INTO stock_movements (item_id, direction, quantity, order_id, created_by)
  VALUES ('st_kla', 'IN', 100, 'or_kla', 'us_gdg');
  RAISE NOTICE 'OK (B) penerimaan benar diterima';
END $$;

-- C. Pengeluaran melebihi saldo -> harus STOCK_INSUFFICIENT
DO $$
BEGIN
  INSERT INTO stock_movements (item_id, direction, quantity, order_id, created_by)
  VALUES ('st_kla', 'OUT', 999, 'or_kla', 'us_gdg');
  RAISE NOTICE 'GAGAL: pengeluaran melebihi saldo seharusnya ditolak';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK (C) ditolak: %', SQLERRM;
END $$;

-- D. Pengeluaran yang benar -> harus sukses, saldo turun jadi 60
DO $$
BEGIN
  INSERT INTO stock_movements (item_id, direction, quantity, order_id, created_by)
  VALUES ('st_kla', 'OUT', 40, 'or_kla', 'us_gdg');
  RAISE NOTICE 'OK (D) pengeluaran benar diterima';
END $$;

-- E. Output 30 menit yang valid (interval 08:00 WIB) -> harus sukses
DO $$
BEGIN
  INSERT INTO output_records (id, order_id, line_id, tailor_id, component, interval_start, pcs, recorded_by, updated_at)
  VALUES ('out_1', 'or_kla', 'ln_a', 'us_pjt', 'Badan depan', '2026-10-13 08:00:00+07', 20, 'us_mnd', now());
  RAISE NOTICE 'OK (E) output valid diterima';
END $$;

-- F. Interval tidak rapi (08:15 WIB) -> harus gagal di or_interval_chk
DO $$
BEGIN
  INSERT INTO output_records (id, order_id, line_id, tailor_id, component, interval_start, pcs, recorded_by, updated_at)
  VALUES ('out_2', 'or_kla', 'ln_a', 'us_pjt', 'Badan depan', '2026-10-13 08:15:00+07', 20, 'us_mnd', now());
  RAISE NOTICE 'GAGAL: interval 08:15 seharusnya ditolak';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK (F) ditolak: %', SQLERRM;
END $$;

-- G. Verifikasi output -> trigger harus mengisi rate_applied 4000 dan wage_amount 80000
UPDATE output_records
   SET verified_by = 'us_mnd', verified_at = now()
 WHERE id = 'out_1';
SELECT id, pcs, rate_applied, wage_amount FROM output_records WHERE id = 'out_1';

-- H. Mengubah output yang sudah terverifikasi -> harus gagal
DO $$
BEGIN
  UPDATE output_records SET pcs = 999 WHERE id = 'out_1';
  RAISE NOTICE 'GAGAL: catatan terverifikasi seharusnya terkunci';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK (H) terkunci: %', SQLERRM;
END $$;

-- I. QC: status REPAIR tanpa kategori -> harus gagal di qc_defect_chk
DO $$
BEGIN
  INSERT INTO qc_records (id, order_id, component, qty, status, inspector_id)
  VALUES ('qc_1', 'or_kla', 'Badan depan', 5, 'REPAIR', 'us_gdg');
  RAISE NOTICE 'GAGAL: REPAIR tanpa kategori seharusnya ditolak';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK (I) ditolak: %', SQLERRM;
END $$;

-- J. Riwayat QC tidak boleh diubah -> harus gagal
DO $$
BEGIN
  INSERT INTO qc_records (id, order_id, component, qty, status, inspector_id)
  VALUES ('qc_2', 'or_kla', 'Badan depan', 5, 'LOLOS', 'us_gdg');
  UPDATE qc_records SET qty = 6 WHERE id = 'qc_2';
  RAISE NOTICE 'GAGAL: qc_records seharusnya append-only';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK (J) append-only: %', SQLERRM;
END $$;

-- K. Periode payroll tumpang tindih -> harus gagal di pp_no_overlap
DO $$
BEGIN
  INSERT INTO payroll_periods (id, start_date, end_date, total_wage, total_meal, total_bonus,
    meal_percent_applied, bonus_per_pcs_applied, finalized_by)
  VALUES ('pp_1', '2026-10-01', '2026-10-08', 0, 0, 0, 12.5, 500, 'us_gdg');
  INSERT INTO payroll_periods (id, start_date, end_date, total_wage, total_meal, total_bonus,
    meal_percent_applied, bonus_per_pcs_applied, finalized_by)
  VALUES ('pp_2', '2026-10-05', '2026-10-12', 0, 0, 0, 12.5, 500, 'us_gdg');
  RAISE NOTICE 'GAGAL: periode tumpang tindih seharusnya ditolak';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK (K) ditolak: %', SQLERRM;
END $$;

-- L. Peran klien tanpa client_id -> harus gagal di users_role_client_chk
DO $$
BEGIN
  INSERT INTO users (id, name, email, password_hash, role, client_id, updated_at)
  VALUES ('us_bad', 'Salah', 'bad@loe.test', 'x', 'KLIEN_MAKLON', NULL, now());
  RAISE NOTICE 'GAGAL: klien tanpa client_id seharusnya ditolak';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'OK (L) ditolak: %', SQLERRM;
END $$;
