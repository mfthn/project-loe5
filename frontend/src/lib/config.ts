// Alamat dasar API. Diambil dari environment agar mudah berpindah antara development dan server.
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";
