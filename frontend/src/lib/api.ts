import { API_BASE_URL } from "./config";

// Error yang membawa status HTTP agar UI bisa menampilkan pesan yang sesuai.
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Pembungkus fetch untuk seluruh pemanggilan ke backend.
// cache: "no-store" memastikan data operasional selalu terbaru (gudang, output, QC).
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init.headers },
    cache: "no-store",
    credentials: "include",
  });

  if (!res.ok) {
    throw new ApiError(res.status, `Permintaan gagal dengan status ${res.status}.`);
  }
  return (await res.json()) as T;
}

// Health check dibaca langsung, karena status 503 tetap membawa isi yang berguna.
export async function fetchHealth(): Promise<{ httpStatus: number; body: import("@/types/api").HealthResponse }> {
  const res = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
  return { httpStatus: res.status, body: (await res.json()) as import("@/types/api").HealthResponse };
}
