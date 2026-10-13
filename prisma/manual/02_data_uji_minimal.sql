-- =====================================================================
-- Data uji minimal untuk memverifikasi database tanpa menjalankan seed aplikasi.
-- Jalankan setelah migrasi berhasil. Aman dijalankan sekali pada database kosong.
-- =====================================================================

INSERT INTO clients (id, code, name, is_internal) VALUES
  ('cl_snh', 'SNH', 'Snøhund (internal)', true),
  ('cl_kla', 'KLA', 'Klien Maklon A', false);

INSERT INTO users (id, name, email, password_hash, role, client_id, updated_at) VALUES
  ('us_gdg', 'Petugas Gudang', 'gudang@loe.test', 'hash-uji', 'GUDANG', NULL, now()),
  ('us_mnd', 'Mandor 1', 'mandor1@loe.test', 'hash-uji', 'KEPALA_PRODUKSI', NULL, now()),
  ('us_pjt', 'Penjahit 1', 'penjahit1@loe.test', 'hash-uji', 'PENJAHIT', NULL, now()),
  ('us_kla', 'Klien Maklon A', 'klien@loe.test', 'hash-uji', 'KLIEN_MAKLON', 'cl_kla', now());

INSERT INTO production_orders (id, code, client_id, scheme, target_qty, spec_json, created_by, updated_at) VALUES
  ('or_snh', 'ORD-SNH-001', 'cl_snh', 'FULL_PACKAGE', 500, '{}', 'us_gdg', now()),
  ('or_kla', 'ORD-KLA-001', 'cl_kla', 'CMT', 300, '{}', 'us_gdg', now());

INSERT INTO stock_items (id, code, name, type, client_id, order_id, quantity, unit, created_by) VALUES
  ('st_kla', 'LOT-KLA-001', 'Kain cotton combed 30s', 'RAW', 'cl_kla', 'or_kla', 0, 'meter', 'us_gdg');

INSERT INTO rate_cards (id, client_id, component, cutting_rate, sewing_rate, effective_from, created_by) VALUES
  ('rc_kla_1', 'cl_kla', 'Badan depan', 1500, 4000, '2026-01-01', 'us_gdg');

INSERT INTO production_lines (id, name) VALUES ('ln_a', 'Line A');

INSERT INTO line_allocations (id, line_id, tailor_id, allocated_by) VALUES
  ('al_1', 'ln_a', 'us_pjt', 'us_mnd');
