import type React from "react";
import { API_BASE_URL } from "./config";
import type {
  BatchFinancial,
  BatchFinancialCreate,
  BonusPoolPreview,
  Client,
  ClientProfile,
  CuttingResult,
  DualAskRequest,
  DualAskResponse,
  GarmentComponent,
  HPPRealized,
  InventoryItem,
  InventoryTransaction,
  Invoice,
  MaterialHandover,
  MaterialRequest,
  Order,
  PurchaseOrder,
  OrderComponent,
  OrderSummary,
  PayrollMonthlySummary,
  PayrollNotification,
  PayrollPayment,
  PayrollDetail,
  PayrollPreview,
  PayrollRun,
  ProductionOutput,
  QCBatchSummary,
  QCInspection,
  RateCard,
  RegisterClientRequest,
  RegisterClientResponse,
  Sample,
  SampleVersion,
  TokenResponse,
  User,
  UserRole,
  WorkerPayrollSummary,
  WorkerDashboardSummary,
} from "../types/api";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Helper untuk token di localStorage agar request selalu otentik
function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("loe_token");
}

export function setStoredToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem("loe_token", token);
  } else {
    localStorage.removeItem("loe_token");
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };

  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      credentials: "include",
    });
  } catch (netErr: any) {
    // Coba fallback cerdas: jika target awal localhost, coba 127.0.0.1 (dan sebaliknya)
    const fallbackBase = API_BASE_URL.includes("localhost")
      ? API_BASE_URL.replace("localhost", "127.0.0.1")
      : API_BASE_URL.replace("127.0.0.1", "localhost");
    try {
      res = await fetch(`${fallbackBase}${path}`, {
        ...init,
        headers,
        cache: "no-store",
        credentials: "include",
      });
    } catch {
      throw new ApiError(
        0,
        `Tidak dapat terhubung ke server backend (${API_BASE_URL}). Pastikan server backend sudah aktif (uvicorn app.main:app --reload).`
      );
    }
  }

  if (!res.ok) {
    let errorMsg = `Permintaan gagal dengan status ${res.status}.`;
    let errorDetail: unknown = null;
    try {
      const errorJson = await res.json();
      errorDetail = errorJson;
      if (typeof errorJson?.detail === "string") {
        errorMsg = errorJson.detail;
      } else if (Array.isArray(errorJson?.detail)) {
        errorMsg = errorJson.detail.map((e: { msg?: string }) => e.msg || "").filter(Boolean).join(", ");
      }
    } catch {
      // Body bukan json, pakai status text default
    }
    throw new ApiError(res.status, errorMsg, errorDetail);
  }

  // Jika status 204 No Content
  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

// ================= Auth API =================
export const authApi = {
  login: async (username: string, password: string): Promise<TokenResponse> => {
    const data = await apiFetch<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    setStoredToken(data.access_token);
    return data;
  },
  logout: async (): Promise<{ message: string }> => {
    try {
      const data = await apiFetch<{ message: string }>("/auth/logout", {
        method: "POST",
      });
      setStoredToken(null);
      return data;
    } finally {
      setStoredToken(null);
    }
  },
  getMe: async (): Promise<User> => {
    return apiFetch<User>("/auth/me");
  },
  register: async (data: RegisterClientRequest): Promise<RegisterClientResponse> => {
    return apiFetch<RegisterClientResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  getClients: async (): Promise<ClientProfile[]> => {
    return apiFetch<ClientProfile[]>("/auth/clients");
  },
  getUsers: async (): Promise<User[]> => {
    return apiFetch<User[]>("/auth/users");
  },
  createUser: async (data: {
    username: string;
    password: string;
    name: string;
    email?: string;
    role: UserRole;
    client_id?: string | null;
  }): Promise<User> => {
    return apiFetch<User>("/auth/users", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  updateUser: async (
    userId: string,
    data: { name?: string; email?: string; role?: UserRole; client_id?: string | null; is_active?: boolean },
  ): Promise<User> => {
    return apiFetch<User>(`/auth/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
  deleteUser: async (userId: string): Promise<void> => {
    await apiFetch(`/auth/users/${userId}`, { method: "DELETE" });
  },
};

// ================= Gudang API =================
export const gudangApi = {
  getItems: async (): Promise<InventoryItem[]> => {
    return apiFetch<InventoryItem[]>("/gudang/items");
  },
  createItem: async (data: {
    client_id: string;
    material_code: string;
    material_name: string;
    unit_measure: string;
    initial_stock?: number;
    order_id: string;
  }): Promise<InventoryItem> => {
    return apiFetch<InventoryItem>("/gudang/items", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  receiveMaterial: async (data: {
    inventory_item_id: string;
    quantity: number;
    order_id?: string;
    po_id?: string;
    notes?: string;
  }): Promise<InventoryTransaction> => {
    return apiFetch<InventoryTransaction>("/gudang/receive", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  issueMaterial: async (data: {
    inventory_item_id: string;
    order_id: string;
    quantity: number;
    notes?: string;
  }): Promise<InventoryTransaction> => {
    return apiFetch<InventoryTransaction>("/gudang/issue", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  getTransactions: async (params?: {
    inventory_item_id?: string;
    client_id?: string;
    order_id?: string;
  }): Promise<InventoryTransaction[]> => {
    const query = new URLSearchParams();
    if (params?.inventory_item_id) query.set("item_id", params.inventory_item_id);
    if (params?.client_id) query.set("client_id", params.client_id);
    if (params?.order_id) query.set("order_id", params.order_id);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return apiFetch<InventoryTransaction[]>(`/gudang/transactions${qs}`);
  },
  setLocation: async (itemId: string, storage_location: string): Promise<InventoryItem> => {
    return apiFetch<InventoryItem>(`/gudang/items/${itemId}/location`, {
      method: "PATCH",
      body: JSON.stringify({ storage_location }),
    });
  },
  adjustStock: async (data: {
    inventory_item_id: string;
    delta: number;
    notes: string;
  }): Promise<InventoryTransaction> => {
    return apiFetch<InventoryTransaction>("/gudang/adjust", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  createRequest: async (data: {
    order_id: string;
    inventory_item_id: string;
    qty_requested: number;
    notes?: string;
  }): Promise<MaterialRequest> => {
    return apiFetch<MaterialRequest>("/gudang/requests", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  getRequests: async (): Promise<MaterialRequest[]> => {
    return apiFetch<MaterialRequest[]>("/gudang/requests");
  },
  reviewRequest: async (requestId: string, approve: boolean, notes?: string): Promise<MaterialRequest> => {
    return apiFetch<MaterialRequest>(`/gudang/requests/${requestId}/review`, {
      method: "PATCH",
      body: JSON.stringify({ approve, notes }),
    });
  },
  createHandover: async (data: {
    order_id: string;
    inventory_item_id: string;
    quantity: number;
    material_request_id?: string | null;
    notes?: string;
  }): Promise<MaterialHandover> => {
    return apiFetch<MaterialHandover>("/gudang/handovers", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  receiveHandover: async (handoverId: string): Promise<MaterialHandover> => {
    return apiFetch<MaterialHandover>(`/gudang/handovers/${handoverId}/receive`, {
      method: "POST",
    });
  },
  getHandovers: async (): Promise<MaterialHandover[]> => {
    return apiFetch<MaterialHandover[]>("/gudang/handovers");
  },
  createCutting: async (data: {
    order_id: string;
    inventory_item_id?: string | null;
    qty_lapis: number;
    qty_potong_hasil: number;
    waste_qty?: number;
    waste_category?: string;
    notes?: string;
  }): Promise<CuttingResult> => {
    return apiFetch<CuttingResult>("/gudang/cutting", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  getCutting: async (): Promise<CuttingResult[]> => {
    return apiFetch<CuttingResult[]>("/gudang/cutting");
  },
};

// ================= Sample API =================
export const sampleApi = {
  getSamples: async (): Promise<Sample[]> => {
    return apiFetch<Sample[]>("/sample/");
  },
  getSampleDetail: async (sampleId: string): Promise<Sample> => {
    return apiFetch<Sample>(`/sample/${sampleId}`);
  },
  createSample: async (data: {
    client_id: string;
    sample_code?: string;
    article_name: string;
    category: string;
    tech_pack_notes?: string;
  }): Promise<Sample> => {
    return apiFetch<Sample>("/sample/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  createVersion: async (
    sampleId: string,
    data: { tech_pack_notes?: string; order_id?: string },
  ): Promise<SampleVersion> => {
    return apiFetch<SampleVersion>(`/sample/${sampleId}/revisi`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  approveVersion: async (versionId: string): Promise<SampleVersion> => {
    return apiFetch<SampleVersion>(`/sample/versions/${versionId}/approve`, {
      method: "POST",
    });
  },
  getVersionDetail: async (versionId: string): Promise<SampleVersion> => {
    return apiFetch<SampleVersion>(`/sample/versions/${versionId}`);
  },
  uploadDesignImage: async (versionId: string, file: File): Promise<SampleVersion> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("loe_token") : null;
    const form = new FormData();
    form.append("file", file);
    const tryFetch = async (base: string) => {
      const res = await fetch(`${base}/sample/versions/${versionId}/design-image`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        let msg = `Gagal mengunggah (${res.status}).`;
        try {
          const j = await res.json();
          if (typeof j?.detail === "string") msg = j.detail;
        } catch {
          // abaikan
        }
        throw new ApiError(res.status, msg);
      }
      return (await res.json()) as SampleVersion;
    };
    try {
      return await tryFetch(API_BASE_URL);
    } catch (e) {
      const fallback = API_BASE_URL.includes("localhost")
        ? API_BASE_URL.replace("localhost", "127.0.0.1")
        : API_BASE_URL.replace("127.0.0.1", "localhost");
      if (fallback === API_BASE_URL) throw e;
      return tryFetch(fallback);
    }
  },
  approveOwner: async (
    versionId: string,
    data: { agreed_price: number; currency?: string; costing_notes?: string },
  ): Promise<SampleVersion> => {
    return apiFetch<SampleVersion>(`/sample/versions/${versionId}/approve-owner`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  rejectOwner: async (versionId: string, reason?: string): Promise<SampleVersion> => {
    return apiFetch<SampleVersion>(`/sample/versions/${versionId}/reject-owner`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    });
  },
  addComponent: async (
    versionId: string,
    data: { component_name: string; material_usage_est?: number; time_study_seconds?: number },
  ): Promise<GarmentComponent> => {
    return apiFetch<GarmentComponent>(`/sample/versions/${versionId}/components`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  updateComponent: async (
    componentId: string,
    data: { component_name: string; material_usage_est?: number; time_study_seconds?: number },
  ): Promise<GarmentComponent> => {
    return apiFetch<GarmentComponent>(`/sample/components/${componentId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
  recordTimeStudy: async (
    componentId: string,
    data: { component_name: string; material_usage_est?: number; time_study_seconds: number },
  ): Promise<GarmentComponent> => {
    return apiFetch<GarmentComponent>(`/sample/components/${componentId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
};

// ================= Produksi API =================
export const produksiApi = {
  getMyDashboard: async (): Promise<WorkerDashboardSummary> => {
    return apiFetch<WorkerDashboardSummary>("/produksi/my-dashboard");
  },
  getOrders: async (): Promise<Order[]> => {
    return apiFetch<Order[]>("/produksi/orders");
  },
  getOrderDetail: async (orderId: string): Promise<Order> => {
    return apiFetch<Order>(`/produksi/orders/${orderId}`);
  },
  createOrder: async (data: {
    client_id: string;
    order_number: string;
    scheme: "CMT" | "SEMI_CMT" | "FULL_PACKAGE";
    target_quantity: number;
    sample_version_id?: string | null;
    start_date?: string | null;
    deadline?: string | null;
  }): Promise<Order> => {
    return apiFetch<Order>("/produksi/orders", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  updateOrderStatus: async (orderId: string, status: string): Promise<Order> => {
    return apiFetch<Order>(`/produksi/orders/${orderId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },
  assembleOrder: async (orderId: string, qty_assembled: number, notes?: string): Promise<{
    id: string; order_id: string; qty_assembled: number;
  }> => {
    return apiFetch(`/produksi/orders/${orderId}/assemble`, {
      method: "POST",
      body: JSON.stringify({ qty_assembled, notes }),
    });
  },
  proposeSellingPrice: async (orderId: string, selling_price: number): Promise<Order> => {
    return apiFetch<Order>(`/produksi/orders/${orderId}/selling-price`, {
      method: "POST",
      body: JSON.stringify({ selling_price }),
    });
  },
  reviewSellingPrice: async (orderId: string, approve: boolean): Promise<Order> => {
    return apiFetch<Order>(`/produksi/orders/${orderId}/selling-price/review`, {
      method: "POST",
      body: JSON.stringify({ approve }),
    });
  },
  addComponent: async (
    orderId: string,
    data: { component_name: string; cutting_rate_per_pcs: number; sewing_rate_per_pcs: number },
  ): Promise<Order> => {
    return apiFetch<Order>(`/produksi/orders/${orderId}/components`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  setRateCard: async (
    componentId: string,
    data: { cutting_rate_per_pcs: number; sewing_rate_per_pcs: number },
  ): Promise<Order> => {
    return apiFetch<Order>(`/produksi/components/${componentId}/rate-card`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },
  getOutputs: async (params?: { order_id?: string; is_verified?: boolean }): Promise<ProductionOutput[]> => {
    const query = new URLSearchParams();
    if (params?.order_id) query.set("order_id", params.order_id);
    if (params?.is_verified !== undefined) query.set("is_verified", String(params.is_verified));
    const qs = query.toString() ? `?${query.toString()}` : "";
    return apiFetch<ProductionOutput[]>(`/produksi/outputs${qs}`);
  },
  recordOutput: async (data: {
    order_id: string;
    order_component_id?: string;
    component_id?: string;
    operator_user_id?: string;
    line_number?: number;
    interval_start?: string;
    interval_end?: string;
    time_window?: string;
    qty_completed: number;
  }): Promise<ProductionOutput> => {
    const payload = {
      order_id: data.order_id,
      order_component_id: data.order_component_id || data.component_id,
      operator_user_id: data.operator_user_id,
      line_number: data.line_number || 1,
      qty_completed: data.qty_completed,
      time_window: data.time_window || data.interval_start || new Date().toISOString(),
    };
    return apiFetch<ProductionOutput>("/produksi/outputs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  verifyOutput: async (outputId: string): Promise<ProductionOutput> => {
    return apiFetch<ProductionOutput>(`/produksi/outputs/${outputId}/verify`, {
      method: "PATCH",
    });
  },
  getOrderSummary: async (orderId: string): Promise<OrderSummary> => {
    return apiFetch<OrderSummary>(`/produksi/orders/${orderId}/summary`);
  },
  getLeaderboard: async (limit = 8): Promise<
    { user_id: string; name: string; total_qty: number; verified_qty: number }[]
  > => {
    return apiFetch(`/produksi/leaderboard?limit=${limit}`);
  },
  getWorkers: async (): Promise<{ id: string; name: string; username: string }[]> => {
    return apiFetch("/produksi/workers");
  },
  getCheckins: async (onlyOpen = true): Promise<{
    id: string; user_id: string; user_name: string | null; order_id: string | null;
    line_number: number; task_category: string | null; checkin_at: string; checkout_at: string | null;
  }[]> => {
    return apiFetch(`/produksi/checkins?only_open=${onlyOpen}`);
  },
  checkinWorker: async (data: {
    user_id: string; order_id?: string | null; line_number?: number; task_category?: string; notes?: string;
  }): Promise<unknown> => {
    return apiFetch("/produksi/checkins", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  checkoutWorker: async (checkinId: string): Promise<unknown> => {
    return apiFetch(`/produksi/checkins/${checkinId}/checkout`, { method: "POST" });
  },
};

// ================= QC API =================
export const qcApi = {
  recordInspection: async (data: {
    order_id: string;
    qty_inspected: number;
    result?: "LOLOS" | "REPAIR" | "DEFECT";
    status?: "LOLOS" | "REPAIR" | "DEFECT";
    defect_type?: string;
    defect_category?: string;
    defect_notes?: string;
    notes?: string;
    repair_count?: number;
  }): Promise<QCInspection> => {
    const payload = {
      order_id: data.order_id,
      qty_inspected: data.qty_inspected,
      status: data.status || data.result || "LOLOS",
      defect_category: data.defect_category || data.defect_type,
      notes: data.notes || data.defect_notes,
      repair_count: data.repair_count || 1,
    };
    return apiFetch<QCInspection>("/qc/inspections", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
  getInspections: async (orderId: string): Promise<QCInspection[]> => {
    return apiFetch<QCInspection[]>(`/qc/inspections?order_id=${orderId}`);
  },
  getOrderSummary: async (orderId: string): Promise<QCBatchSummary> => {
    return apiFetch<QCBatchSummary>(`/qc/summary/${orderId}`);
  },
  getBonusPoolPreview: async (params?: {
    order_id?: string;
    rate_per_pcs?: number;
  }): Promise<BonusPoolPreview> => {
    const query = new URLSearchParams();
    if (params?.order_id) query.set("order_id", params.order_id);
    if (params?.rate_per_pcs) query.set("bonus_rate_per_pcs", String(params.rate_per_pcs));
    const qs = query.toString() ? `?${query.toString()}` : "";
    return apiFetch<BonusPoolPreview>(`/qc/bonus-preview${qs}`);
  },
  getEscalations: async (): Promise<QCInspection[]> => {
    return apiFetch<QCInspection[]>("/qc/escalations");
  },
};

// ================= Payroll & Financials API =================
export const payrollApi = {
  getPreview: async (params: {
    period_start: string;
    period_end: string;
    meal_allowance_percentage?: number;
    qc_bonus_rate_per_pcs?: number;
  }): Promise<PayrollPreview> => {
    return apiFetch<PayrollPreview>("/payroll/preview", {
      method: "POST",
      body: JSON.stringify(params),
    });
  },
  createRun: async (data: {
    period_start: string;
    period_end: string;
    meal_allowance_percentage?: number;
    qc_bonus_rate_per_pcs?: number;
  }): Promise<PayrollRun> => {
    return apiFetch<PayrollRun>("/payroll/runs", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  getRuns: async (): Promise<PayrollRun[]> => {
    return apiFetch<PayrollRun[]>("/payroll/runs");
  },
  getRunDetail: async (runId: string): Promise<PayrollRun> => {
    return apiFetch<PayrollRun>(`/payroll/runs/${runId}`);
  },
  reviewFunding: async (
    runId: string,
    data: { available_funds: number; review_note?: string },
  ): Promise<PayrollRun> => {
    return apiFetch<PayrollRun>(`/payroll/runs/${runId}/finance-review`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  markDetailPaid: async (runId: string, detailId: string): Promise<PayrollPayment> => {
    return apiFetch<PayrollPayment>(
      `/payroll/runs/${runId}/details/${detailId}/payment`,
      { method: "POST" },
    );
  },
  adjustDetail: async (runId: string, detailId: string, manual_adjustment: number): Promise<PayrollDetail> => {
    return apiFetch<PayrollDetail>(`/payroll/runs/${runId}/details/${detailId}/adjustment`, {
      method: "PATCH",
      body: JSON.stringify({ manual_adjustment }),
    });
  },
  getMySummary: async (): Promise<WorkerPayrollSummary[]> => {
    return apiFetch<WorkerPayrollSummary[]>("/payroll/my-summary");
  },
  getNotifications: async (): Promise<PayrollNotification[]> => {
    return apiFetch<PayrollNotification[]>("/payroll/notifications");
  },
  getMonthlySummary: async (year: number, month: number): Promise<PayrollMonthlySummary> => {
    const query = new URLSearchParams({ year: String(year), month: String(month) });
    return apiFetch<PayrollMonthlySummary>(`/payroll/monthly-summary?${query.toString()}`);
  },
  getBatchFinancials: async (): Promise<BatchFinancial[]> => {
    return apiFetch<BatchFinancial[]>("/payroll/financials");
  },
  getBatchFinancial: async (orderId: string): Promise<BatchFinancial> => {
    return apiFetch<BatchFinancial>(`/payroll/financials/${orderId}`);
  },
  calculateBatchFinancial: async (data: BatchFinancialCreate): Promise<BatchFinancial> => {
    return apiFetch<BatchFinancial>("/payroll/financials", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};

// ================= Finance (PO & Invoice) API =================
export const financeApi = {
  getPOs: async (): Promise<PurchaseOrder[]> => {
    return apiFetch<PurchaseOrder[]>("/finance/pos");
  },
  createPO: async (data: {
    po_number: string;
    order_id: string;
    supplier_name: string;
    notes?: string;
    lines: { inventory_item_id: string; qty_ordered: number; unit_price: number }[];
  }): Promise<PurchaseOrder> => {
    return apiFetch<PurchaseOrder>("/finance/pos", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  reviewPO: async (poId: string, approve: boolean, notes?: string): Promise<PurchaseOrder> => {
    return apiFetch<PurchaseOrder>(`/finance/pos/${poId}/review`, {
      method: "PATCH",
      body: JSON.stringify({ approve, notes }),
    });
  },
  confirmPO: async (poId: string): Promise<PurchaseOrder> => {
    return apiFetch<PurchaseOrder>(`/finance/pos/${poId}/confirm`, {
      method: "POST",
    });
  },
  updatePO: async (poId: string, data: { supplier_name?: string; line_prices?: Record<string, number> }): Promise<PurchaseOrder> => {
    return apiFetch<PurchaseOrder>(`/finance/pos/${poId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },
  payPO: async (poId: string, data: { amount: number; notes?: string }): Promise<{
    po_id: string; po_number: string; total_amount: number; total_paid: number; remaining: number; lunas: boolean;
  }> => {
    return apiFetch(`/finance/pos/${poId}/payments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  getNeeds: async (): Promise<{
    request_id: string; order_id: string; order_number: string; order_status: string;
    inventory_item_id: string; material_code: string; material_name: string;
    qty_requested: number; qty_fulfilled: number; current_stock: number;
    request_status: string; need_status: string;
  }[]> => {
    return apiFetch("/finance/needs");
  },
  getInvoices: async (): Promise<Invoice[]> => {
    return apiFetch<Invoice[]>("/finance/invoices");
  },
  createInvoice: async (data: {
    invoice_number: string;
    order_id: string;
    amount_total?: number;
    notes?: string;
  }): Promise<Invoice> => {
    return apiFetch<Invoice>("/finance/invoices", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  approveInvoice: async (invoiceId: string): Promise<Invoice> => {
    return apiFetch<Invoice>(`/finance/invoices/${invoiceId}/approve`, {
      method: "POST",
    });
  },
  recordPayment: async (
    invoiceId: string,
    data: { amount: number; notes?: string },
  ): Promise<Invoice> => {
    return apiFetch<Invoice>(`/finance/invoices/${invoiceId}/payments`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  getRealizedHpp: async (orderId: string): Promise<HPPRealized> => {
    return apiFetch<HPPRealized>(`/finance/hpp/${orderId}`);
  },  applyHpp: async (
    orderId: string,
    data: { contract_revenue?: number; overhead_cost?: number },
  ): Promise<BatchFinancial> => {
    return apiFetch<BatchFinancial>(`/finance/hpp/${orderId}/apply`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  getOverhead: async (year: number, month: number): Promise<{
    id: string; year: number; month: number; category: string;
    amount: number | string; notes: string | null; created_at: string;
  }[]> => {
    return apiFetch(`/payroll/overhead?year=${year}&month=${month}`);
  },
  addOverhead: async (data: {
    year: number; month: number; category: string; amount: number; notes?: string;
  }): Promise<unknown> => {
    return apiFetch("/payroll/overhead", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  deleteOverhead: async (expenseId: string): Promise<void> => {
    await apiFetch(`/payroll/overhead/${expenseId}`, { method: "DELETE" });
  },
};
// ================= AI Assistant API =================
export const aiApi = {
  // 1. /ai/rag — Chatbot publik & klien maklon (S3 SOP knowledge base)
  askClient: async (question: string): Promise<DualAskResponse> => {
    return apiFetch<DualAskResponse>("/ai/rag", {
      method: "POST",
      body: JSON.stringify({ question }),
    });
  },
  // 2. /ai/ask-agent — Owner tracker (S3 SOP + live database context)
  askAgent: async (question: string): Promise<DualAskResponse> => {
    return apiFetch<DualAskResponse>("/ai/ask-agent", {
      method: "POST",
      body: JSON.stringify({ question }),
    });
  },
  askAgentStream: async (
    question: string,
    onChunk: (text: string) => void,
  ): Promise<void> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("loe_token") : null;
    const doFetch = async (base: string) => {
      const res = await fetch(`${base}/ai/ask-agent/stream`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ question }),
        credentials: "include",
      });
      if (!res.ok || !res.body) {
        let msg = `Gagal streaming (${res.status}).`;
        try {
          const j = await res.json();
          if (typeof j?.detail === "string") msg = j.detail;
        } catch {
          // abaikan
        }
        throw new ApiError(res.status, msg);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        onChunk(decoder.decode(value, { stream: true }));
      }
    };
    try {
      await doFetch(API_BASE_URL);
    } catch (e) {
      const fallback = API_BASE_URL.includes("localhost")
        ? API_BASE_URL.replace("localhost", "127.0.0.1")
        : API_BASE_URL.replace("127.0.0.1", "localhost");
      if (fallback === API_BASE_URL) throw e;
      await doFetch(fallback);
    }
  },
  // Legacy backward-compatible assistant endpoint
  askAssistant: async (data: DualAskRequest): Promise<DualAskResponse> => {
    return apiFetch<DualAskResponse>("/ai/assistant", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  getStatus: async (): Promise<{ status: string; doc_count?: number; model_id?: string }> => {
    return apiFetch<{ status: string; doc_count?: number; model_id?: string }>("/ai/status");
  },
  reindex: async (): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>("/ai/reindex", {
      method: "POST",
    });
  },
};

/** Pesan error AI yang dibedakan: dokumen hilang vs model/offline vs auth. */
export function friendlyAiError(raw?: string): string {
  const msg = (raw || "").toLowerCase();
  if (!msg) return "Layanan AI tidak menjawab. Coba lagi beberapa saat.";
  if (msg.includes("tidak ada dokumen") || msg.includes("s3_bucket") || msg.includes("sop"))
    return "Dokumen SOP belum tersedia di server. Minta admin mengunggah dokumen lalu sinkron ulang.";
  if (msg.includes("embedding") || msg.includes("model") || msg.includes("llm") || msg.includes("bedrock"))
    return "Model AI sedang gangguan. Coba lagi; bila berlanjut hubungi tim IT.";
  if (msg.includes("401") || msg.includes("403") || msg.includes("login") || msg.includes("akses ditolak"))
    return "Sesi berakhir atau akses ditolak. Silakan login ulang.";
  return raw || "Layanan AI tidak menjawab. Coba lagi beberapa saat.";
}

/**
 * Kunci anti-spam form: nonaktifkan tombol submit saat request berjalan.
 * Pakai di awal onSubmit (jika false → batalkan), dan buka lagi di catch.
 * Saat sukses modal ditutup sehingga tidak perlu dibuka manual.
 */
export function lockFormSubmit(e: React.FormEvent): boolean {
  const btn = (e.currentTarget as HTMLFormElement).querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  );
  if (!btn || btn.disabled) return false;
  btn.disabled = true;
  btn.dataset.locked = "1";
  return true;
}

export function unlockFormSubmit(e: React.FormEvent): void {
  const btn = (e.currentTarget as HTMLFormElement).querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  );
  if (btn) {
    btn.disabled = false;
    delete btn.dataset.locked;
  }
}

export type AiStatus = {
  httpStatus: number;
  ok: boolean;
  indexReady: boolean;
  chunks: number;
};

export async function fetchAiStatus(): Promise<AiStatus> {
  const none = { httpStatus: 0, ok: false, indexReady: false, chunks: 0 };
  try {
    const res = await apiFetch<{ index_ready: boolean; chunks: number }>("/ai/status");
    return { httpStatus: 200, ok: true, indexReady: !!res.index_ready, chunks: res.chunks || 0 };
  } catch (err: any) {
    const status = err instanceof ApiError ? err.status : 0;
    return { ...none, httpStatus: status };
  }
}
