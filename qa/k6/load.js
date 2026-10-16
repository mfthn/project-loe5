import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

export const options = {
  stages: [
    { duration: "30s", target: 10 }, // ramp ke 10 VU
    { duration: "1m", target: 10 }, // tahan 10 VU
    { duration: "30s", target: 30 }, // spike 30 VU
    { duration: "30s", target: 0 }, // turun
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<1500"],
  },
};

const BASE = __ENV.API_URL || "http://localhost:8000/api/v1";
const trend_login = new Trend("login_duration");
const err_rate = new Rate("app_errors");

let token = null;

function login() {
  const res = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({ username: "hendra_owner", password: "Lukla@Owner2026" }),
    { headers: { "Content-Type": "application/json" } }
  );
  trend_login.add(res.timings.duration);
  if (res.status === 200) token = res.json("access_token");
  return res.status === 200;
}

export default function () {
  if (!token && !login()) {
    err_rate.add(1);
    return;
  }
  const H = { headers: { Authorization: `Bearer ${token}` } };

  const reqs = [
    ["health", http.get("http://localhost:8000/health")],
    ["me", http.get(`${BASE}/auth/me`, H)],
    ["gudang", http.get(`${BASE}/gudang/items`, H)],
    ["produksi", http.get(`${BASE}/produksi/orders`, H)],
    ["monthly", http.get(`${BASE}/payroll/monthly-summary?year=2026&month=10`, H)],
    ["ai-status", http.get(`${BASE}/ai/status`, H)],
  ];
  for (const [name, r] of reqs) {
    const ok = check(r, { [`${name} 200`]: (x) => x.status === 200 });
    err_rate.add(!ok);
  }
  sleep(1);
}
