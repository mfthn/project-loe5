-- =====================================================================
-- project-loe5: constraint, index parsial, dan trigger manual
-- Dimasukkan ke migrasi kosong yang dibuat dengan:
--   npx prisma migrate dev --create-only --name custom_constraints
-- Isi file migration.sql yang baru dibuat dengan seluruh isi file ini.
-- =====================================================================

-- Ekstensi untuk exclude constraint tanggal (payroll tidak boleh tumpang tindih)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ---------------------------------------------------------------------
-- 1. CHECK constraint
-- ---------------------------------------------------------------------

-- Peran klien wajib punya client_id, peran lain tidak boleh
ALTER TABLE users ADD CONSTRAINT users_role_client_chk
  CHECK ((role = 'KLIEN_MAKLON') = (client_id IS NOT NULL));

ALTER TABLE production_orders ADD CONSTRAINT orders_target_chk
  CHECK (target_qty > 0);

ALTER TABLE stock_items ADD CONSTRAINT stock_qty_nonneg_chk
  CHECK (quantity >= 0);
ALTER TABLE stock_movements ADD CONSTRAINT movement_qty_pos_chk
  CHECK (quantity > 0);

ALTER TABLE sample_versions ADD CONSTRAINT sv_version_chk
  CHECK (version_number >= 1);
-- Versi selain DRAFT wajib sudah punya waktu persetujuan
ALTER TABLE sample_versions ADD CONSTRAINT sv_approved_chk
  CHECK (status = 'DRAFT' OR approved_at IS NOT NULL);

ALTER TABLE time_studies ADD CONSTRAINT ts_seconds_chk
  CHECK (seconds > 0);
ALTER TABLE sample_material_uses ADD CONSTRAINT smu_qty_chk
  CHECK (quantity > 0);

ALTER TABLE output_records ADD CONSTRAINT or_pcs_chk
  CHECK (pcs > 0);
-- Verifikasi dan snapshot upah harus terisi bersama-sama
ALTER TABLE output_records ADD CONSTRAINT or_verify_pair_chk
  CHECK ((verified_at IS NULL) = (verified_by IS NULL));
ALTER TABLE output_records ADD CONSTRAINT or_wage_pair_chk
  CHECK ((verified_at IS NULL) = (wage_amount IS NULL));
-- Interval harus tepat di awal jam atau setengah jam (WIB)
ALTER TABLE output_records ADD CONSTRAINT or_interval_chk
  CHECK (EXTRACT(MINUTE FROM (interval_start AT TIME ZONE 'Asia/Jakarta')) IN (0, 30));

ALTER TABLE production_lines ADD CONSTRAINT line_capacity_chk
  CHECK (capacity IS NULL OR capacity > 0);

ALTER TABLE rate_cards ADD CONSTRAINT rc_rates_chk
  CHECK (cutting_rate >= 0 AND sewing_rate >= 0);

ALTER TABLE qc_records ADD CONSTRAINT qc_qty_chk
  CHECK (qty > 0);
-- LOLOS tidak boleh punya kategori cacat, REPAIR dan DEFECT wajib punya kategori (FR-9)
ALTER TABLE qc_records ADD CONSTRAINT qc_defect_chk
  CHECK ((status = 'LOLOS') = (defect_category IS NULL));

ALTER TABLE payroll_settings ADD CONSTRAINT ps_singleton_chk
  CHECK (id = 1);
ALTER TABLE payroll_settings ADD CONSTRAINT ps_meal_chk
  CHECK (meal_percent BETWEEN 0 AND 100);
ALTER TABLE payroll_settings ADD CONSTRAINT ps_bonus_chk
  CHECK (bonus_per_pcs >= 0);

ALTER TABLE payroll_periods ADD CONSTRAINT pp_dates_chk
  CHECK (end_date > start_date);
-- Periode payroll tidak boleh tumpang tindih. Rentang bersifat [start, end)
ALTER TABLE payroll_periods ADD CONSTRAINT pp_no_overlap
  EXCLUDE USING gist (daterange(start_date, end_date) WITH &&);

ALTER TABLE payroll_items ADD CONSTRAINT pi_nonneg_chk
  CHECK (total_pcs >= 0 AND wage_amount >= 0 AND meal_amount >= 0);

ALTER TABLE ai_query_logs ADD CONSTRAINT aiq_question_len_chk
  CHECK (char_length(question) <= 1000);

-- ---------------------------------------------------------------------
-- 2. Index parsial
-- ---------------------------------------------------------------------

-- Satu alokasi aktif per penjahit
CREATE UNIQUE INDEX line_alloc_one_active_per_tailor
  ON line_allocations (tailor_id) WHERE ended_at IS NULL;

-- Daftar penjahit aktif per line
CREATE INDEX line_alloc_active_by_line
  ON line_allocations (line_id) WHERE ended_at IS NULL;

-- Antrean verifikasi mandor
CREATE INDEX output_pending_verify
  ON output_records (interval_start) WHERE verified_at IS NULL;

-- Pool bonus QC per periode
CREATE INDEX qc_lolos_by_time
  ON qc_records (checked_at) WHERE status = 'LOLOS';

-- ---------------------------------------------------------------------
-- 3. Append-only: tolak UPDATE dan DELETE
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Tabel % bersifat append-only, operasi % ditolak', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER stock_movements_append_only
  BEFORE UPDATE OR DELETE ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER qc_records_append_only
  BEFORE UPDATE OR DELETE ON qc_records
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER payroll_periods_append_only
  BEFORE UPDATE OR DELETE ON payroll_periods
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER payroll_items_append_only
  BEFORE UPDATE OR DELETE ON payroll_items
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

CREATE TRIGGER payroll_bonus_items_append_only
  BEFORE UPDATE OR DELETE ON payroll_bonus_items
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- Log AI boleh dihapus oleh job retensi, jadi hanya UPDATE yang ditolak
CREATE TRIGGER ai_query_logs_no_update
  BEFORE UPDATE ON ai_query_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- ---------------------------------------------------------------------
-- 4. Anti-kontaminasi silang dan saldo stok (FR-6.2)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION stock_movement_guard() RETURNS trigger AS $$
DECLARE
  item_client   TEXT;
  item_order    TEXT;
  item_qty      NUMERIC(12,3);
  target_client TEXT;
BEGIN
  -- Kunci baris item agar dua pengeluaran bersamaan tidak melewati batas stok
  SELECT client_id, order_id, quantity
    INTO item_client, item_order, item_qty
    FROM stock_items
   WHERE id = NEW.item_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item stok tidak ditemukan' USING ERRCODE = 'P0001';
  END IF;

  SELECT client_id INTO target_client
    FROM production_orders
   WHERE id = NEW.order_id;

  -- Tag klien dan pesanan harus sama dengan item
  IF target_client IS DISTINCT FROM item_client OR NEW.order_id <> item_order THEN
    RAISE EXCEPTION 'BLOCKED_ISSUE: bahan milik klien % tidak boleh dipakai untuk pesanan %',
      item_client, NEW.order_id
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.direction = 'OUT' AND NEW.quantity > item_qty THEN
    RAISE EXCEPTION 'STOCK_INSUFFICIENT: sisa stok hanya %', item_qty
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stock_movement_before_insert
  BEFORE INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION stock_movement_guard();

CREATE OR REPLACE FUNCTION stock_movement_apply() RETURNS trigger AS $$
BEGIN
  UPDATE stock_items
     SET quantity = quantity + CASE WHEN NEW.direction = 'IN' THEN NEW.quantity ELSE -NEW.quantity END
   WHERE id = NEW.item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER stock_movement_after_insert
  AFTER INSERT ON stock_movements
  FOR EACH ROW EXECUTE FUNCTION stock_movement_apply();

-- ---------------------------------------------------------------------
-- 5. Kunci verifikasi output dan snapshot upah (Story 1.2, FR-10.1)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION output_guard_update() RETURNS trigger AS $$
DECLARE
  order_client TEXT;
  rate         NUMERIC(14,2);
BEGIN
  -- Catatan yang sudah terverifikasi tidak boleh diubah sama sekali
  IF OLD.verified_at IS NOT NULL THEN
    RAISE EXCEPTION 'Catatan output sudah diverifikasi dan terkunci'
      USING ERRCODE = 'P0001';
  END IF;

  -- Saat verifikasi: simpan tarif yang berlaku pada tanggal interval dan hitung upah
  IF NEW.verified_at IS NOT NULL THEN
    SELECT client_id INTO order_client
      FROM production_orders WHERE id = NEW.order_id;

    SELECT rc.sewing_rate INTO rate
      FROM rate_cards rc
     WHERE rc.client_id = order_client
       AND rc.component = NEW.component
       AND rc.effective_from <= (NEW.interval_start AT TIME ZONE 'Asia/Jakarta')::date
     ORDER BY rc.effective_from DESC
     LIMIT 1;

    IF rate IS NULL THEN
      RAISE EXCEPTION 'Rate card untuk komponen % belum berlaku', NEW.component
        USING ERRCODE = 'P0001';
    END IF;

    NEW.rate_applied := rate;
    NEW.wage_amount  := NEW.pcs * rate;
  ELSE
    NEW.rate_applied := NULL;
    NEW.wage_amount  := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER output_records_guard_update
  BEFORE UPDATE ON output_records
  FOR EACH ROW EXECUTE FUNCTION output_guard_update();

CREATE OR REPLACE FUNCTION output_guard_delete() RETURNS trigger AS $$
BEGIN
  IF OLD.verified_at IS NOT NULL THEN
    RAISE EXCEPTION 'Catatan output yang sudah diverifikasi tidak boleh dihapus'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER output_records_guard_delete
  BEFORE DELETE ON output_records
  FOR EACH ROW EXECUTE FUNCTION output_guard_delete();

-- ---------------------------------------------------------------------
-- 6. Sample yang sudah disetujui tidak boleh diubah spesifikasinya (FR-3)
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sample_version_guard() RETURNS trigger AS $$
BEGIN
  IF OLD.status IN ('APPROVED', 'CONVERTED') THEN
    IF NEW.spec_json IS DISTINCT FROM OLD.spec_json
       OR NEW.version_number <> OLD.version_number
       OR NEW.sample_id <> OLD.sample_id
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
      RAISE EXCEPTION 'Versi % sudah disetujui, spesifikasinya terkunci', OLD.version_number
        USING ERRCODE = 'P0001';
    END IF;
    IF OLD.status = 'CONVERTED' AND NEW.status <> 'CONVERTED' THEN
      RAISE EXCEPTION 'Versi yang sudah dikonversi tidak bisa diubah statusnya'
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Konversi hanya boleh dari APPROVED
  IF NEW.status = 'CONVERTED' AND OLD.status <> 'APPROVED' THEN
    RAISE EXCEPTION 'Versi harus APPROVED sebelum dikonversi' USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sample_versions_guard
  BEFORE UPDATE ON sample_versions
  FOR EACH ROW EXECUTE FUNCTION sample_version_guard();
