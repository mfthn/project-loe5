-- CreateEnum
CREATE TYPE "AiChannel" AS ENUM ('OWNER_TRACKER', 'PROSPECT');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'TIM_SAMPLE', 'GUDANG', 'KEPALA_PRODUKSI', 'PENJAHIT', 'QC_INSPECTOR', 'FINANCE_PAYROLL', 'KLIEN_MAKLON');

-- CreateEnum
CREATE TYPE "Scheme" AS ENUM ('CMT', 'SEMI_CMT', 'FULL_PACKAGE');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('OPEN', 'IN_PRODUCTION', 'QC', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockType" AS ENUM ('RAW', 'WIP', 'FINISHED');

-- CreateEnum
CREATE TYPE "MovementDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "QcStatus" AS ENUM ('LOLOS', 'REPAIR', 'DEFECT');

-- CreateEnum
CREATE TYPE "DefectCategory" AS ENUM ('JAHITAN', 'NODA', 'UKURAN', 'BAHAN', 'LAINNYA');

-- CreateEnum
CREATE TYPE "SampleVersionStatus" AS ENUM ('DRAFT', 'APPROVED', 'CONVERTED');

-- CreateTable
CREATE TABLE "ai_query_logs" (
    "id" BIGSERIAL NOT NULL,
    "channel" "AiChannel" NOT NULL,
    "user_id" TEXT,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "input_tokens" INTEGER,
    "output_tokens" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_query_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "is_internal" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(100) NOT NULL,
    "role" "Role" NOT NULL,
    "client_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_orders" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "client_id" TEXT NOT NULL,
    "sample_version_id" TEXT,
    "scheme" "Scheme" NOT NULL,
    "target_qty" INTEGER NOT NULL,
    "spec_json" JSONB NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'OPEN',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "production_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "user_id" TEXT,
    "action" VARCHAR(60) NOT NULL,
    "entity_type" VARCHAR(40) NOT NULL,
    "entity_id" TEXT,
    "detail" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_items" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(30) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "type" "StockType" NOT NULL,
    "client_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unit" VARCHAR(20) NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" BIGSERIAL NOT NULL,
    "item_id" TEXT NOT NULL,
    "direction" "MovementDirection" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "order_id" TEXT NOT NULL,
    "note" VARCHAR(255),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "meal_percent" DECIMAL(5,2) NOT NULL DEFAULT 12.5,
    "bonus_per_pcs" DECIMAL(14,2) NOT NULL DEFAULT 500,
    "updated_by" TEXT NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payroll_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bonus_recipients" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "bonus_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_periods" (
    "id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "total_wage" DECIMAL(14,2) NOT NULL,
    "total_meal" DECIMAL(14,2) NOT NULL,
    "total_bonus" DECIMAL(14,2) NOT NULL,
    "meal_percent_applied" DECIMAL(5,2) NOT NULL,
    "bonus_per_pcs_applied" DECIMAL(14,2) NOT NULL,
    "finalized_by" TEXT NOT NULL,
    "finalized_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payroll_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_items" (
    "id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "tailor_id" TEXT NOT NULL,
    "total_pcs" INTEGER NOT NULL,
    "wage_amount" DECIMAL(14,2) NOT NULL,
    "meal_amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "payroll_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payroll_bonus_items" (
    "id" TEXT NOT NULL,
    "period_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "payroll_bonus_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_lines" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "capacity" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "production_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "line_allocations" (
    "id" TEXT NOT NULL,
    "line_id" TEXT NOT NULL,
    "tailor_id" TEXT NOT NULL,
    "allocated_by" TEXT NOT NULL,
    "allocated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(6),

    CONSTRAINT "line_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_cards" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "component" VARCHAR(120) NOT NULL,
    "cutting_rate" DECIMAL(14,2) NOT NULL,
    "sewing_rate" DECIMAL(14,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "rate_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "output_records" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "line_id" TEXT NOT NULL,
    "tailor_id" TEXT NOT NULL,
    "component" VARCHAR(120) NOT NULL,
    "interval_start" TIMESTAMPTZ(6) NOT NULL,
    "pcs" INTEGER NOT NULL,
    "recorded_by" TEXT NOT NULL,
    "verified_by" TEXT,
    "verified_at" TIMESTAMPTZ(6),
    "rate_applied" DECIMAL(14,2),
    "wage_amount" DECIMAL(14,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "output_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qc_records" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "component" VARCHAR(120) NOT NULL,
    "qty" INTEGER NOT NULL,
    "status" "QcStatus" NOT NULL,
    "defect_category" "DefectCategory",
    "note" VARCHAR(500),
    "inspector_id" TEXT NOT NULL,
    "checked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qc_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "samples" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "client_id" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sample_versions" (
    "id" TEXT NOT NULL,
    "sample_id" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "parent_id" TEXT,
    "spec_json" JSONB NOT NULL,
    "status" "SampleVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "approved_by" TEXT,
    "approved_at" TIMESTAMPTZ(6),
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sample_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "time_studies" (
    "id" TEXT NOT NULL,
    "sample_version_id" TEXT NOT NULL,
    "component_name" VARCHAR(120) NOT NULL,
    "seconds" DECIMAL(10,2) NOT NULL,
    "recorded_by" TEXT NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "time_studies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sample_material_uses" (
    "id" TEXT NOT NULL,
    "sample_version_id" TEXT NOT NULL,
    "material_name" VARCHAR(150) NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "unit" VARCHAR(20) NOT NULL,
    "recorded_by" TEXT NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sample_material_uses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_query_logs_channel_created_at_idx" ON "ai_query_logs"("channel", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "clients_code_key" ON "clients"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "production_orders_code_key" ON "production_orders"("code");

-- CreateIndex
CREATE INDEX "production_orders_client_id_status_idx" ON "production_orders"("client_id", "status");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "stock_items_code_key" ON "stock_items"("code");

-- CreateIndex
CREATE INDEX "stock_items_client_id_idx" ON "stock_items"("client_id");

-- CreateIndex
CREATE INDEX "stock_items_order_id_idx" ON "stock_items"("order_id");

-- CreateIndex
CREATE INDEX "stock_movements_item_id_created_at_idx" ON "stock_movements"("item_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "bonus_recipients_user_id_key" ON "bonus_recipients"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_items_period_id_tailor_id_key" ON "payroll_items"("period_id", "tailor_id");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_bonus_items_period_id_user_id_key" ON "payroll_bonus_items"("period_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "production_lines_name_key" ON "production_lines"("name");

-- CreateIndex
CREATE INDEX "line_allocations_line_id_idx" ON "line_allocations"("line_id");

-- CreateIndex
CREATE UNIQUE INDEX "rate_cards_client_id_component_effective_from_key" ON "rate_cards"("client_id", "component", "effective_from");

-- CreateIndex
CREATE INDEX "output_records_interval_start_idx" ON "output_records"("interval_start");

-- CreateIndex
CREATE INDEX "output_records_tailor_id_interval_start_idx" ON "output_records"("tailor_id", "interval_start");

-- CreateIndex
CREATE INDEX "output_records_order_id_interval_start_idx" ON "output_records"("order_id", "interval_start");

-- CreateIndex
CREATE INDEX "qc_records_order_id_checked_at_idx" ON "qc_records"("order_id", "checked_at");

-- CreateIndex
CREATE UNIQUE INDEX "samples_code_key" ON "samples"("code");

-- CreateIndex
CREATE UNIQUE INDEX "sample_versions_sample_id_version_number_key" ON "sample_versions"("sample_id", "version_number");

-- AddForeignKey
ALTER TABLE "ai_query_logs" ADD CONSTRAINT "ai_query_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_sample_version_id_fkey" FOREIGN KEY ("sample_version_id") REFERENCES "sample_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_orders" ADD CONSTRAINT "production_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_settings" ADD CONSTRAINT "payroll_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bonus_recipients" ADD CONSTRAINT "bonus_recipients_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_periods" ADD CONSTRAINT "payroll_periods_finalized_by_fkey" FOREIGN KEY ("finalized_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_items" ADD CONSTRAINT "payroll_items_tailor_id_fkey" FOREIGN KEY ("tailor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_bonus_items" ADD CONSTRAINT "payroll_bonus_items_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "payroll_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payroll_bonus_items" ADD CONSTRAINT "payroll_bonus_items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_allocations" ADD CONSTRAINT "line_allocations_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "production_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_allocations" ADD CONSTRAINT "line_allocations_tailor_id_fkey" FOREIGN KEY ("tailor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_allocations" ADD CONSTRAINT "line_allocations_allocated_by_fkey" FOREIGN KEY ("allocated_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_cards" ADD CONSTRAINT "rate_cards_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "output_records" ADD CONSTRAINT "output_records_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "output_records" ADD CONSTRAINT "output_records_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "production_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "output_records" ADD CONSTRAINT "output_records_tailor_id_fkey" FOREIGN KEY ("tailor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "output_records" ADD CONSTRAINT "output_records_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "output_records" ADD CONSTRAINT "output_records_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_records" ADD CONSTRAINT "qc_records_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "production_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "qc_records" ADD CONSTRAINT "qc_records_inspector_id_fkey" FOREIGN KEY ("inspector_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "samples" ADD CONSTRAINT "samples_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_versions" ADD CONSTRAINT "sample_versions_sample_id_fkey" FOREIGN KEY ("sample_id") REFERENCES "samples"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_versions" ADD CONSTRAINT "sample_versions_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "sample_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_versions" ADD CONSTRAINT "sample_versions_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_versions" ADD CONSTRAINT "sample_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_studies" ADD CONSTRAINT "time_studies_sample_version_id_fkey" FOREIGN KEY ("sample_version_id") REFERENCES "sample_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_studies" ADD CONSTRAINT "time_studies_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_material_uses" ADD CONSTRAINT "sample_material_uses_sample_version_id_fkey" FOREIGN KEY ("sample_version_id") REFERENCES "sample_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sample_material_uses" ADD CONSTRAINT "sample_material_uses_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
