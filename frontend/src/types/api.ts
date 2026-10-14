// Tipe data yang diterima dari API. Dijaga sejalan dengan skema Pydantic di backend.

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

export type Client = {
  id: string;
  company_name: string;
  contact_person: string | null;
  phone_number: string | null;
  created_at: string;
};

export type InventoryItem = {
  id: string;
  client_id: string;
  material_code: string;
  material_name: string;
  current_stock: number;
  unit_measure: string;
  created_at: string;
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

export type Order = {
  id: string;
  client_id: string;
  sample_version_id: string | null;
  order_number: string;
  scheme: "CMT" | "SEMI_CMT" | "FULL_PACKAGE";
  target_quantity: number;
  status: "SAMPLE" | "CUTTING" | "SEWING" | "MENUNGGU_QC" | "QC" | "COMPLETED";
  start_date: string | null;
  deadline: string | null;
  created_at: string;
};
