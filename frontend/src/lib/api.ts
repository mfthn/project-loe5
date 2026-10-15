import { API_BASE_URL } from "./config";
import type {
  BatchFinancial,
  BatchFinancialCreate,
  BonusPoolPreview,
  Client,
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
    limit?: number;
  }): Promise<InventoryTransaction[]> => {
    const query = new URLSearchParams();
    if (params?.inventory_item_id) query.set("inventory_item_id", params.inventory_item_id);
    if (params?.client_id) query.set("client_id", params.client_id);
    if (params?.limit) query.set("limit", params.limit.toString());
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
    sample_code: string;
    item_name: string;
    notes?: string;
  }): Promise<Sample> => {
    return apiFetch<Sample>("/sample/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  createVersion: async (sampleId: string, notes?: string): Promise<SampleVersion> => {
    return apiFetch<SampleVersion>(`/sample/${sampleId}/versions`, {
      method: "POST",
      body: JSON.stringify({ notes }),
    });
  },
  approveVersion: async (versionId: string): Promise<SampleVersion> => {
    return apiFetch<SampleVersion>(`/sample/versions/${versionId}/approve`, {
      method: "POST",
    });
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
    data: { component_name: string; fabric_consumption?: number },
  ): Promise<GarmentComponent> => {
    return apiFetch<GarmentComponent>(`/sample/versions/${versionId}/components`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  recordTimeStudy: async (
    componentId: string,
    data: { duration_seconds: number; notes?: string },
  ): Promise<any> => {
    return apiFetch(`/sample/components/${componentId}/time-study`, {
      method: "POST",
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
  addComponent: async (
    orderId: string,
    data: { component_name: string; quantity_target: number },
  ): Promise<OrderComponent> => {
    return apiFetch<OrderComponent>(`/produksi/orders/${orderId}/components`, {
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
    line_number?: number;
    interval_start?: string;
    interval_end?: string;
    time_window?: string;
    qty_completed: number;
  }): Promise<ProductionOutput> => {
    const payload = {
      order_id: data.order_id,
      order_component_id: data.order_component_id || data.component_id,
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
    return apiFetch<QCInspection[]>(`/qc/orders/${orderId}/inspections`);
  },
  getOrderSummary: async (orderId: string): Promise<QCBatchSummary> => {
    return apiFetch<QCBatchSummary>(`/qc/orders/${orderId}/summary`);
  },
  getBonusPoolPreview: async (params?: {
    start_date?: string;
    end_date?: string;
    rate_per_pcs?: number;
  }): Promise<BonusPoolPreview> => {
    const query = new URLSearchParams();
    if (params?.start_date) query.set("start_date", params.start_date);
    if (params?.end_date) query.set("end_date", params.end_date);
    if (params?.rate_per_pcs) query.set("rate_per_pcs", String(params.rate_per_pcs));
    const qs = query.toString() ? `?${query.toString()}` : "";
    return apiFetch<BonusPoolPreview>(`/qc/bonus-pool/preview${qs}`);
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
  },
  applyHpp: async (
    orderId: string,
    data: { contract_revenue?: number; overhead_cost?: number },
  ): Promise<BatchFinancial> => {
    return apiFetch<BatchFinancial>(`/finance/hpp/${orderId}/apply`, {
      method: "POST",
      body: JSON.stringify(data),
    });
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

export async function fetchAiStatus(): Promise<{ httpStatus: number; ok: boolean }> {
  try {
    const res = await fetch(`${API_BASE_URL}/ai/status`, { cache: "no-store" });
    return { httpStatus: res.status, ok: res.ok };
  } catch {
    return { httpStatus: 0, ok: false };
  }
}
