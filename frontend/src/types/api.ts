// Tipe data yang diterima dari API. Dijaga sejalan dengan skema Pydantic di backend.

export type HealthResponse = {
  status: "ok" | "degraded";
  database: "ok" | "unavailable";
};
