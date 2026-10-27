// Tipe data lengkap yang diterima dari API FastAPI backend (project-loe5).
// Dijaga sejalan dengan skema Pydantic backend di app/modules/*/schemas.py.

export type UserRole =
  | "OWNER"
  | "TIM_SAMPLE"
  | "GUDANG"
  | "MANDOR"
  | "PENJAHIT"
  | "QC_INSPECTOR"
  | "FINANCE_PAYROLL"
  | "KLIEN_MAKLON";

export type ClientProfile = {
  id: string;
  company_name: string;
  contact_person: string | null;
  phone_number: string | null;
  client_code: string; // Format LOE5-<nomor HP>, contoh LOE5-08123456789
  created_at: string | null;
};

export type User = {
  id: string;
  username: string;
  email: string | null;
  name: string;
  role: UserRole;
  client_id: string | null;
  client_code?: string | null; // LOE5-<nomor HP>
  client?: ClientProfile | null;
  is_active: boolean;
  created_at: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

export type RegisterClientRequest = {
  username: string;
  password: string;
  email: string;
  company_name: string;
  contact_person: string;
  phone_number: string;
};

export type RegisterClientResponse = {
  message: string;
  client_id: string;
  client_code: string;
  user: User;
};

export type ClientUpdateRequest = {
  company_name?: string;
  contact_person?: string;
  phone_number?: string;
};

export type ClientUpdateResponse = ClientProfile & {
  previous_client_code: string | null;
  client_code_changed: boolean;
  warning: string | null;
};

export type ClientCodeChange = {
  id: string;
  client_id: string;
  old_client_code: string;
  new_client_code: string;
  old_phone: string | null;
  new_phone: string | null;
  changed_by: string | null;
  created_at: string;
};

export type Client = {
  id: string;
  company_name: string;
  contact_person: string | null;
  phone_number: string | null;
  created_at: string;
};

// ================= Gudang =================
export type InventoryItem = {
  id: string;
  client_id: string;
  material_code: string;
  material_name: string;
  current_stock: number;
  unit_measure: string;
  storage_location?: string | null;
  created_at: string;
  client?: Client;
};

export type MaterialRequestStatus =
  | "DIAJUKAN"
  | "DISETUJUI"
  | "DITOLAK"
  | "DISERAHKAN";

export type MaterialRequest = {
  id: string;
  order_id: string;
  inventory_item_id: string;
  client_id: string;
  qty_requested: number;
  qty_fulfilled: number;
  status: MaterialRequestStatus;
  requested_by_user_id: string | null;
  reviewed_by_user_id: string | null;
  notes: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type MaterialHandover = {
  id: string;
  order_id: string;
  inventory_item_id: string;
  material_request_id: string | null;
  transaction_id: string | null;
  client_id: string;
  quantity: number;
  handed_by_user_id: string | null;
  received_by_user_id: string | null;
  handed_at: string;
  received_at: string | null;
  notes: string | null;
};

export type InventoryTransaction = {
  id: string;
  inventory_item_id: string;
  client_id: string;
  order_id: string | null;
  transaction_type: "IN" | "OUT";
  quantity: number;
  transaction_time: string;
  performed_by_user_id: string | null;
  notes: string | null;
};

// ================= Finance (PO & Invoice) =================
export type POStatus = "DRAFT" | "TERKONFIRMASI" | "DISETUJUI" | "DITOLAK" | "DITERIMA_SEBAGIAN" | "SELESAI";

export type POLine = {
  id: string;
  inventory_item_id: string;
  sequence_order: number;
  qty_ordered: number;
  qty_received: number;
  unit_price: number | string;
};

export type PurchaseOrder = {
  id: string;
  po_number: string;
  client_id: string;
  order_id: string;
  supplier_name: string;
  status: POStatus;
  total_amount: number | string;
  requested_by_user_id: string | null;
  reviewed_by_user_id: string | null;
  notes: string | null;
  created_at: string;
  reviewed_at: string | null;
  lines: POLine[];
};

export type InvoiceStatus = "DRAFT" | "BELUM_BAYAR" | "SEBAGIAN" | "LUNAS" | "DITOLAK";

export type Invoice = {
  id: string;
  invoice_number: string;
  client_id: string;
  order_id: string;
  amount_total: number | string;
  amount_paid: number | string;
  status: InvoiceStatus;
  issued_by_user_id: string | null;
  approved_by_user_id: string | null;
  notes: string | null;
  created_at: string;
  approved_at: string | null;
};

export type CuttingResult = {
  id: string;
  order_id: string;
  inventory_item_id: string | null;
  client_id: string;
  qty_lapis: number;
  qty_potong_hasil: number;
  waste_qty: number;
  waste_category?: string | null;
  cut_by_user_id: string | null;
  notes: string | null;
  cut_at: string;
};

export type HPPRealized = {
  order_id: string;
  order_number: string;
  realized_material_cost: number;
  po_count: number;
  breakdown: { po_id: string; po_number: string; status: string; realized_cost: number }[];
};

// ================= Sample & Time Study =================
export type VersionStatus = "DRAFT" | "REVISION" | "APPROVED" | "OWNER_APPROVED" | "OWNER_REJECTED";

export type TimeStudy = {
  id: string;
  component_id: string;
  duration_seconds: number;
  recorded_by_user_id: string;
  notes: string | null;
  created_at: string;
};

export type GarmentComponent = {
  id: string;
  version_id: string;
  component_name: string;
  fabric_consumption: number | null;
  created_at: string;
  time_studies?: TimeStudy[];
  average_duration_seconds?: number;
};

export type SampleVersion = {
  id: string;
  sample_id: string;
  version_number: number;
  status: VersionStatus;
  order_id?: string | null;
  design_image_key?: string | null;
  design_image_url?: string | null;
  notes: string | null;
  tech_pack_notes?: string | null;
  agreed_price?: number | null;
  currency?: string;
  costing_notes?: string | null;
  sample_approved_by?: string | null;
  sample_approved_at?: string | null;
  owner_approved_by?: string | null;
  owner_approved_at?: string | null;
  created_at: string;
  approved_at: string | null;
  approved_by_user_id: string | null;
  components?: GarmentComponent[];
};

export type Sample = {
  id: string;
  client_id: string;
  sample_code: string;
  item_name: string;
  article_name?: string | null;
  category?: string | null;
  created_at: string;
  client?: Client;
  versions?: SampleVersion[];
};

// ================= Produksi =================
export type OrderScheme = "CMT" | "SEMI_CMT" | "FULL_PACKAGE";
export type OrderStatus =
  | "SAMPLE"
  | "CUTTING"
  | "SEWING"
  | "MENUNGGU_QC"
  | "QC"
  | "COMPLETED";

export type RateCard = {
  id: string;
  order_component_id: string;
  cutting_rate_per_pcs: number | string;
  sewing_rate_per_pcs: number | string;
  effective_date: string;
};

export type OrderComponent = {
  id: string;
  order_id: string;
  component_name: string;
  sequence_order: number;
  rate_card?: RateCard | null;
};

export type ProductionOutput = {
  id: string;
  order_id: string;
  order_component_id: string;
  component_id?: string;
  operator_user_id: string;
  line_number?: number;
  interval_start?: string;
  interval_end?: string;
  time_window?: string;
  qty_completed: number;
  is_verified: boolean;
  verified_by_user_id: string | null;
  created_at: string;
  operator?: User;
  order_number?: string;
  component_name?: string;
};

export type Order = {
  id: string;
  client_id: string;
  sample_version_id: string | null;
  order_number: string;
  scheme: OrderScheme;
  target_quantity: number;
  status: OrderStatus;
  selling_price?: number | string | null;
  selling_price_status?: string;
  start_date: string | null;
  deadline: string | null;
  created_at: string;
  client?: Client;
  components?: OrderComponent[];
};

export type OrderSummary = {
  order_id: string;
  order_number: string;
  target_quantity: number;
  total_completed?: number;
  verified_completed?: number;
  completion_pct?: number;
  total_output_verified?: number;
  total_output_unverified?: number;
  percentage_completed?: number;
  status?: OrderStatus;
};

export type WorkerDashboardOrder = {
  order_id: string;
  order_number: string;
  status: OrderStatus;
  target_quantity: number;
  start_date: string | null;
  deadline: string | null;
  own_output_qty: number;
  own_verified_qty: number;
  qc_passed_qty: number;
  qc_repair_qty: number;
  qc_defect_qty: number;
};

export type WorkerDashboardSummary = {
  total_output_qty: number;
  verified_output_qty: number;
  qc_passed_qty: number;
  qc_repair_qty: number;
  qc_defect_qty: number;
  unattributed_qc_inspections: number;
  orders: WorkerDashboardOrder[];
};

// ================= Quality Control =================
export type QCResult = "LOLOS" | "REPAIR" | "DEFECT";

export type QCInspection = {
  id: string;
  order_id: string;
  production_output_id?: string | null;
  inspector_user_id: string;
  inspected_at: string;
  qty_inspected: number;
  result?: QCResult;
  status?: QCResult;
  defect_type?: string | null;
  defect_category?: string | null;
  action_route?: string | null;
  defect_notes?: string | null;
  notes?: string | null;
  repair_count?: number;
  escalated_to_sample?: boolean;
  inspector?: User;
};

export type QCBatchSummary = {
  order_id: string;
  total_inspected: number;
  total_lolos: number;
  total_repair: number;
  total_defect: number;
  pass_rate_percentage: number;
};

export type BonusPoolPreview = {
  order_id: string;
  qty_lolos: number;
  bonus_rate_per_pcs: number | string;
  total_pool: number | string;
  recipient_count: number;
  bonus_per_recipient: number | string;
};

// ================= Payroll & Financials =================
export type BatchFinancial = {
  id: string;
  order_id: string;
  contract_revenue: number;
  material_cost: number;
  overhead_cost: number;
  labor_cost: number;
  total_hpp: number;
  net_profit: number;
  status: "DRAFT" | "LOCKED";
  created_at: string;
  updated_at: string;
};

export type BatchFinancialCreate = {
  order_id: string;
  contract_revenue: number;
  material_cost: number;
  overhead_cost: number;
};

export type MonetaryAmount = number | string;

export type PayrollPayment = {
  id: string;
  payroll_detail_id: string;
  paid_by_user_id: string;
  paid_at: string;
};

export type PayrollDetail = {
  id: string;
  payroll_run_id: string;
  user_id: string;
  total_sewing_fee: MonetaryAmount;
  meal_allowance_amount: MonetaryAmount;
  qc_bonus_share: MonetaryAmount;
  manual_adjustment?: MonetaryAmount;
  net_salary: MonetaryAmount;
  user: Pick<User, "id" | "name" | "role">;
  payment: PayrollPayment | null;
};

export type PayrollPreview = {
  period_start: string;
  period_end: string;
  meal_allowance_percentage: MonetaryAmount;
  qc_bonus_rate_per_pcs: MonetaryAmount;
  total_qc_bonus_pool: MonetaryAmount;
  total_penjahit: number;
  slips: {
    user_id: string;
    username: string;
    name: string;
    role: string;
    total_qty_completed: number;
    total_sewing_fee: MonetaryAmount;
    meal_allowance_amount: MonetaryAmount;
    qc_bonus_share: MonetaryAmount;
    net_salary: MonetaryAmount;
  }[];
};

export type PayrollRun = {
  id: string;
  period_start: string;
  period_end: string;
  meal_allowance_percentage: MonetaryAmount;
  qc_bonus_rate_per_pcs: MonetaryAmount;
  total_qc_bonus_pool: MonetaryAmount;
  is_locked: boolean;
  funding_status: "PENDING" | "SUFFICIENT" | "INSUFFICIENT";
  available_funds: MonetaryAmount | null;
  reviewed_by_user_id: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  details?: PayrollDetail[];
};

export type PayrollNotification = {
  id: string;
  payroll_run_id: string;
  message: string;
  created_at: string;
};

export type PayrollMonthlySummary = {
  year: number;
  month: number;
  orders_created: number;
  active_orders_now: number;
  verified_output_entries: number;
  verified_output_pcs: number;
  qc_pass_pcs: number;
  qc_repair_pcs: number;
  qc_defect_pcs: number;
  payroll_total: MonetaryAmount;
  payroll_paid_total: MonetaryAmount;
  contract_revenue: MonetaryAmount;
  material_cost: MonetaryAmount;
  overhead_cost: MonetaryAmount;
  total_hpp: MonetaryAmount;
  net_profit: MonetaryAmount;
  overhead_per_unit?: MonetaryAmount;
};

export type WorkerProductionNote = {
  id: string;
  order_id: string;
  order_number: string;
  component_name: string;
  line_number: number;
  qty_completed: number;
  is_verified: boolean;
  time_window: string;
};

export type WorkerPayrollSummary = {
  run_id: string;
  period_start: string;
  period_end: string;
  net_salary: MonetaryAmount;
  payment_status: "SCHEDULED" | "PAID";
  scheduled_payment_date: string;
  paid_at: string | null;
  production_notes: WorkerProductionNote[];
};

// ================= AI Dual-Assistant =================
export type AssistantPersona = "owner_tracker" | "client_assistant";

export type DualAskRequest = {
  question: string;
  persona: AssistantPersona;
};

export type SourceDocument = {
  chunk_index?: number;
  start?: number;
  end?: number;
  score?: number;
  text?: string;
  source_file?: string;
  snippet?: string;
};

export type DualAskResponse = {
  question?: string;
  answer: string;
  persona: AssistantPersona;
  persona_label?: string;
  sources: SourceDocument[];
  answered_at?: string;
  whatsapp_handoff_url?: string | null;
};
