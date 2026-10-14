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

export type User = {
  id: string;
  username: string;
  email: string | null;
  name: string;
  role: UserRole;
  client_id: string | null;
  is_active: boolean;
  created_at: string;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  user: User;
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
  created_at: string;
  client?: Client;
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

// ================= Sample & Time Study =================
export type VersionStatus = "DRAFT" | "REVISION" | "APPROVED";

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
  notes: string | null;
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
  component_id: string;
  sewing_rate: number;
  cutting_rate: number;
  effective_date: string;
};

export type OrderComponent = {
  id: string;
  order_id: string;
  component_name: string;
  quantity_target: number;
  rate_cards?: RateCard[];
  current_rate?: RateCard | null;
};

export type ProductionOutput = {
  id: string;
  order_id: string;
  component_id: string;
  operator_user_id: string;
  interval_start: string;
  interval_end: string;
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

// ================= Quality Control =================
export type QCResult = "LOLOS" | "REPAIR" | "DEFECT";

export type QCInspection = {
  id: string;
  order_id: string;
  inspector_user_id: string;
  inspected_at: string;
  qty_inspected: number;
  result: QCResult;
  defect_type: string | null;
  defect_notes: string | null;
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
  total_pcs_lolos: number;
  rate_per_pcs: number;
  total_bonus_pool: number;
  num_mandors: number;
  bonus_per_mandor: number;
};

// ================= Payroll =================
export type PayrollDetail = {
  id?: string;
  payroll_run_id?: string;
  user_id: string;
  user_name: string;
  role: string;
  total_output_pcs: number;
  piece_rate_pay: number;
  meal_allowance: number;
  qc_bonus: number;
  total_pay: number;
};

export type PayrollPreview = {
  period_start: string;
  period_end: string;
  meal_allowance_percentage: number;
  qc_bonus_rate_per_pcs: number;
  total_payroll: number;
  total_operators: number;
  details: PayrollDetail[];
};

export type PayrollRun = {
  id: string;
  period_start: string;
  period_end: string;
  total_amount: number;
  is_locked: boolean;
  locked_at: string;
  locked_by_user_id: string;
  created_at: string;
  details?: PayrollDetail[];
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
};
