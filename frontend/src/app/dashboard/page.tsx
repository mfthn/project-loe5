"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "../../components/AppLayout";
import { Notice } from "../../components/Notice";
import { useAuth } from "../../lib/auth-context";
import { ClientProfileCard } from "../../components/ClientProfileCard";
import { produksiApi, gudangApi, payrollApi, sampleApi, qcApi, financeApi } from "../../lib/api";
import type {
  BatchFinancial,
  Order,
  OrderSummary,
  PayrollMonthlySummary,
  PayrollNotification,
  ProductionOutput,
  UserRole,
  WorkerDashboardSummary,
  WorkerPayrollSummary,
} from "../../types/api";

type OutputPoint = ProductionOutput & {
  time_window?: string;
  line_number?: number;
  order_component_id?: string;
};

type ClientProgress = {
  order_id: string;
  order_number: string;
  client_id: string;
  status: string;
  completion_pct: number;
  pending: string;
};

function formatPending(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  if (Number.isNaN(ms) || ms < 0) return "-";
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days <= 0) return `${hours % 24} jam`;
  return `${days} hr ${hours % 24} jam`;
}

type SpeedBucket = { label: string; qty: number };

const DASHBOARD_BY_ROLE: Record<UserRole, { title: string; subtitle: string; action?: string; href?: string }> = {
  OWNER: {
    title: "Dashboard Owner",
    subtitle: "Pantau kinerja operasional dan finansial pabrik.",
    action: "Lihat ringkasan payroll",
    href: "/payroll",
  },
  TIM_SAMPLE: {
    title: "Dashboard Tim Sample",
    subtitle: "Fokus pada pembuatan sample dan pencatatan time study.",
    action: "Buka Sample & Stopwatch",
    href: "/sample",
  },
  GUDANG: {
    title: "Dashboard Gudang",
    subtitle: "Kelola persediaan dan pergerakan material.",
    action: "Buka Gudang",
    href: "/gudang",
  },
  MANDOR: {
    title: "Dashboard Mandor",
    subtitle: "Pantau pesanan produksi, validasi output, dan tindak lanjut operasional.",
    action: "Buka Produksi",
    href: "/produksi",
  },
  PENJAHIT: {
    title: "Dashboard Penjahit",
    subtitle: "Ringkasan hasil kerja, kualitas produksi, pesanan aktif, dan gaji resmi.",
  },
  QC_INSPECTOR: {
    title: "Dashboard QC",
    subtitle: "Fokus pada inspeksi kualitas hasil produksi.",
    action: "Buka Quality Control",
    href: "/qc",
  },
  FINANCE_PAYROLL: {
    title: "Dashboard Finance",
    subtitle: "Tinjau payroll, konfirmasi ketersediaan dana, dan catat payout.",
    action: "Kelola Payroll",
    href: "/payroll",
  },
  KLIEN_MAKLON: {
    title: "Dashboard Klien",
    subtitle: "Pantau status pesanan maklon milik perusahaan Anda.",
    action: "Lihat pesanan saya",
    href: "/portal-klien",
  },
};

function formatDate(dateValue: string | null): string {
  if (!dateValue) return "Belum ditentukan";
  const date = new Date(`${dateValue.slice(0, 10)}T12:00:00`);
  return date.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getPayrollWeeksForMonth(monthValue: string): { start: string; end: string }[] {
  if (!/^\d{4}-\d{2}$/.test(monthValue)) return [];
  const [year, month] = monthValue.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks: { start: string; end: string }[] = [];
  for (let day = 1; day <= daysInMonth; day += 1) {
    const saturday = new Date(year, month - 1, day);
    if (saturday.getDay() !== 6) continue;
    const monday = new Date(year, month - 1, day - 5);
    const toIsoDate = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    weeks.push({ start: toIsoDate(monday), end: toIsoDate(saturday) });
  }
  return weeks;
}

function DonutChart({ segments, size = 150 }: { segments: { label: string; value: number; color: string }[]; size?: number }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total <= 0) {
    return <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Belum ada data.</p>;
  }
  let acc = 0;
  const stops = segments.map((s) => {
    const from = (acc / total) * 360;
    acc += s.value;
    const to = (acc / total) * 360;
    return `${s.color} ${from}deg ${to}deg`;
  });
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <div
          role="img"
          aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "9999px",
            background: `conic-gradient(${stops.join(", ")})`,
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: "26%",
            borderRadius: "9999px",
            background: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
          }}
        >
          <span className="font-mono" style={{ fontWeight: 800, fontSize: "1.15rem" }}>{total}</span>
          <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>total</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: "0.8rem" }}>
        {segments.map((s) => (
          <span key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
            {s.label}: <strong className="font-mono">{s.value}</strong>
          </span>
        ))}
      </div>
    </div>
  );
}

function TrendChart({ points }: { points: { month: string; revenue: number; payroll: number; net: number }[] }) {
  if (points.length < 2) {
    return <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>Butuh minimal 2 bulan data untuk tren.</p>;
  }
  const W = 620;
  const H = 240;
  const PAD_L = 58;
  const PAD_B = 28;
  const PAD_T = 12;
  const maxV = Math.max(1, ...points.flatMap((p) => [p.revenue, p.payroll, Math.abs(p.net)]));
  const x = (i: number) => PAD_L + (i / (points.length - 1)) * (W - PAD_L - 16);
  const y = (v: number) => PAD_T + (1 - Math.min(1, Math.max(0, v / maxV))) * (H - PAD_T - PAD_B);
  const line = (pick: (p: (typeof points)[number]) => number) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(pick(p)).toFixed(1)}`).join(" ");
  const fmtShort = (v: number) =>
    v >= 1_000_000_000 ? `${(v / 1_000_000_000).toFixed(1)}M`
    : v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}jt`
    : v >= 1_000 ? `${(v / 1_000).toFixed(0)}rb` : `${v}`;
  const series = [
    { label: "Revenue", color: "#7C3AED", d: line((p) => p.revenue) },
    { label: "Payroll", color: "#EC4899", d: line((p) => p.payroll) },
    { label: "Net profit", color: "#059669", d: line((p) => Math.max(0, p.net)) },
  ];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }} role="img"
        aria-label={`Tren 6 bulan: ${points.map((p) => `${p.month} revenue ${p.revenue}`).join(", ")}`}>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <g key={f}>
            <line x1={PAD_L} y1={y(maxV * f)} x2={W - 8} y2={y(maxV * f)} stroke="#e5e7eb" strokeDasharray="3 3" />
            <text x={PAD_L - 6} y={y(maxV * f) + 4} textAnchor="end" fontSize="10" fill="#84829a">{fmtShort(maxV * f)}</text>
          </g>
        ))}
        {series.map((s) => (
          <path key={s.label} d={s.d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {points.map((p, i) => (
          <g key={p.month}>
            <circle cx={x(i)} cy={y(p.revenue)} r="3.5" fill="#7C3AED" />
            <circle cx={x(i)} cy={y(p.payroll)} r="3.5" fill="#EC4899" />
            <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#5B5870">{p.month}</text>
          </g>
        ))}
      </svg>
      <div style={{ display: "flex", gap: 16, fontSize: "0.8rem", marginTop: 4, flexWrap: "wrap" }}>
        {series.map((s) => (
          <span key={s.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span aria-hidden="true" style={{ width: 14, height: 3, borderRadius: 2, background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalOrders: 0,
    activeOrders: 0,
    unverifiedOutputs: 0,
    inventoryItemsCount: 0,
    qcPassRate: 0,
  });
  const [financials, setFinancials] = useState<BatchFinancial[]>([]);
  const [monthlySummary, setMonthlySummary] = useState<PayrollMonthlySummary | null>(null);
  const [payrollNotifications, setPayrollNotifications] = useState<PayrollNotification[]>([]);
  const [rolePanel, setRolePanel] = useState<{
    cards: { label: string; value: string; meta?: string; tone?: "ok" | "warn" | "bad" | "info" }[];
    rows: { title: string; detail: string }[];
  } | null>(null);
  const [speedBuckets, setSpeedBuckets] = useState<SpeedBucket[]>([]);
  const [linesActive, setLinesActive] = useState(0);
  const [tailorsOnDuty, setTailorsOnDuty] = useState(0);
  const [clientProgress, setClientProgress] = useState<ClientProgress[]>([]);
  const [statusCounts, setStatusCounts] = useState<{ status: string; count: number }[]>([]);
  const [trend, setTrend] = useState<{ month: string; revenue: number; payroll: number; net: number }[]>([]);
  const [leaderboard, setLeaderboard] = useState<{ user_id: string; name: string; total_qty: number; verified_qty: number }[]>([]);
  const [outputByLine, setOutputByLine] = useState<{ line: number; qty: number }[]>([]);
  const [workerDashboard, setWorkerDashboard] = useState<WorkerDashboardSummary | null>(null);
  const [workerPayroll, setWorkerPayroll] = useState<WorkerPayrollSummary[]>([]);
  const [selectedPayrollWeek, setSelectedPayrollWeek] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  async function loadRealtimeOps(orders: { id: string; order_number: string; client_id: string; status: string }[]) {
    try {
      const allOutputs = (await produksiApi.getOutputs({})) as OutputPoint[];
      const today = new Date().toISOString().slice(0, 10);
      const todays = allOutputs.filter((o) => {
        const ts = o.time_window || o.interval_start;
        return ts && ts.slice(0, 10) === today;
      });
      const buckets = new Map<number, number>();
      const lines = new Set<number>();
      const tailors = new Set<string>();
      for (const o of todays) {
        const raw = o.time_window || o.interval_start;
        if (!raw) continue;
        const ts = new Date(raw);
        if (Number.isNaN(ts.getTime())) continue;
        const slot = Math.floor((ts.getHours() * 60 + ts.getMinutes()) / 30);
        buckets.set(slot, (buckets.get(slot) || 0) + o.qty_completed);
        if (o.line_number) lines.add(o.line_number);
        if (o.operator_user_id) tailors.add(o.operator_user_id);
      }
      const sorted = [...buckets.entries()].sort((a, b) => a[0] - b[0]).slice(-12);
      setSpeedBuckets(
        sorted.map(([slot, qty]) => ({
          label: `${String(Math.floor(slot / 2)).padStart(2, "0")}:${slot % 2 === 0 ? "00" : "30"}`,
          qty,
        }))
      );
      setLinesActive(lines.size);
      setTailorsOnDuty(tailors.size);
      const perLine = new Map<number, number>();
      for (const o of todays) {
        if (o.line_number) perLine.set(o.line_number, (perLine.get(o.line_number) || 0) + o.qty_completed);
      }
      setOutputByLine(
        [...perLine.entries()]
          .map(([line, qty]) => ({ line, qty }))
          .sort((a, b) => a.line - b.line)
          .slice(0, 10)
      );

      const counts = new Map<string, number>();
      for (const o of orders) counts.set(o.status, (counts.get(o.status) || 0) + 1);
      const ORDER_STEPS = ["SAMPLE", "CUTTING", "SEWING", "MENUNGGU_QC", "QC", "COMPLETED"];
      setStatusCounts(
        ORDER_STEPS.filter((s) => counts.has(s)).map((s) => ({ status: s, count: counts.get(s) || 0 }))
      );

      const active = orders.filter((o) => o.status !== "COMPLETED").slice(0, 12);
      const progress: ClientProgress[] = [];
      await Promise.all(
        active.map(async (o) => {
          try {
            const s: OrderSummary = await produksiApi.getOrderSummary(o.id);
            progress.push({
              order_id: o.id,
              order_number: o.order_number,
              client_id: o.client_id,
              status: o.status,
              completion_pct: s.completion_pct ?? s.percentage_completed ?? 0,
              pending: formatPending((o as { created_at?: string }).created_at || ""),
            });
          } catch {
            // Order tanpa output dilewati
          }
        })
      );
      setClientProgress(progress.sort((a, b) => a.order_number.localeCompare(b.order_number)));
    } catch {
      // Panel real-time opsional — kegagalan tidak menggagalkan dashboard
    }
  }

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setDataError(null);
        setStats({
          totalOrders: 0,
          activeOrders: 0,
          unverifiedOutputs: 0,
          inventoryItemsCount: 0,
          qcPassRate: 0,
        });
        setFinancials([]);
        setMonthlySummary(null);
        setPayrollNotifications([]);
        setWorkerDashboard(null);
        setWorkerPayroll([]);
        setRolePanel(null);

        if (user?.role === "PENJAHIT") {
          const [workerData, payrollData] = await Promise.all([
            produksiApi.getMyDashboard(),
            payrollApi.getMySummary(),
          ]);
          setWorkerDashboard(workerData);
          setWorkerPayroll(payrollData);
        } else if (user?.role === "OWNER") {
          const [orders, outputs, items, finList] = await Promise.all([
            produksiApi.getOrders(),
            produksiApi.getOutputs({ is_verified: false }),
            gudangApi.getItems(),
            payrollApi.getBatchFinancials(),
          ]);
          setStats((current) => ({
            ...current,
            totalOrders: orders.length,
            activeOrders: orders.filter((order) => order.status !== "COMPLETED").length,
            unverifiedOutputs: outputs.length,
            inventoryItemsCount: items.length,
          }));
          setFinancials(finList);
          await loadRealtimeOps(orders);
          try {
            setLeaderboard(await produksiApi.getLeaderboard(8));
          } catch {
            // Leaderboard opsional
          }
          const now = new Date();
          const points: { month: string; revenue: number; payroll: number; net: number }[] = [];
          for (let back = 5; back >= 0; back -= 1) {
            const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
            try {
              const s = await payrollApi.getMonthlySummary(d.getFullYear(), d.getMonth() + 1);
              points.push({
                month: d.toLocaleDateString("id-ID", { month: "short" }),
                revenue: Number(s.contract_revenue),
                payroll: Number(s.payroll_total),
                net: Number(s.net_profit),
              });
            } catch {
              // Bulan tanpa data dilewati
            }
          }
          setTrend(points);
        } else if (user?.role === "MANDOR") {
          const [orders, outputs, notifications] = await Promise.all([
            produksiApi.getOrders(),
            produksiApi.getOutputs({ is_verified: false }),
            payrollApi.getNotifications(),
          ]);
          setStats((current) => ({
            ...current,
            totalOrders: orders.length,
            activeOrders: orders.filter((order) => order.status !== "COMPLETED").length,
            unverifiedOutputs: outputs.length,
          }));
          setPayrollNotifications(notifications);
          await loadRealtimeOps(orders);
        } else if (user?.role === "FINANCE_PAYROLL") {
          setFinancials(await payrollApi.getBatchFinancials());
          const [invoices, pos, runs] = await Promise.all([
            financeApi.getInvoices().catch(() => []),
            financeApi.getPOs().catch(() => []),
            payrollApi.getRuns().catch(() => []),
          ]);
          const openInv = invoices.filter((i) => i.status === "BELUM_BAYAR" || i.status === "SEBAGIAN");
          const unpaid = openInv.reduce((s, i) => s + (Number(i.amount_total) - Number(i.amount_paid)), 0);
          const draftPO = pos.filter((p) => p.status === "DRAFT" || p.status === "TERKONFIRMASI");
          const openRuns = runs.filter((r) => !r.is_locked);
          setRolePanel({
            cards: [
              { label: "Piutang terbuka", value: `${openInv.length} invoice`, meta: `Rp ${unpaid.toLocaleString("id-ID")} belum dibayar`, tone: openInv.length ? "warn" : "ok" },
              { label: "PO menunggu", value: `${draftPO.length} PO`, meta: "DRAFT / TERKONFIRMASI", tone: draftPO.length ? "warn" : "ok" },
              { label: "Siklus gaji terbuka", value: `${openRuns.length} run`, meta: "belum dikunci audit", tone: "info" },
            ],
            rows: openInv.slice(0, 5).map((i) => ({ title: i.invoice_number, detail: `${i.status} — sisa Rp ${(Number(i.amount_total) - Number(i.amount_paid)).toLocaleString("id-ID")}` })),
          });
        } else if (user?.role === "TIM_SAMPLE") {
          const [samples, escalations] = await Promise.all([
            sampleApi.getSamples().catch(() => []),
            qcApi.getEscalations().catch(() => []),
          ]);
          const versions = samples.flatMap((s) => s.versions || []);
          const pendingOwner = versions.filter((v) => v.status === "APPROVED").length;
          setRolePanel({
            cards: [
              { label: "Katalog sample", value: `${samples.length} artikel`, meta: `${versions.length} versi`, tone: "info" },
              { label: "Menunggu Owner", value: `${pendingOwner} versi`, meta: "APPROVED → approve harga", tone: pendingOwner ? "warn" : "ok" },
              { label: "Eskalasi QC", value: `${escalations.length} laporan`, meta: "3x repair dari produksi", tone: escalations.length ? "bad" : "ok" },
            ],
            rows: samples.slice(0, 5).map((s) => ({
              title: s.sample_code,
              detail: `${(s.versions || []).length} versi — ${s.versions?.[s.versions.length - 1]?.status || "-"}`,
            })),
          });
        } else if (user?.role === "GUDANG") {
          const [items, reqs, hos, pos] = await Promise.all([
            gudangApi.getItems().catch(() => []),
            gudangApi.getRequests().catch(() => []),
            gudangApi.getHandovers().catch(() => []),
            financeApi.getPOs().catch(() => []),
          ]);
          const empty = items.filter((it) => (it.current_stock || 0) <= 0).length;
          const pendingReq = reqs.filter((r) => r.status === "DIAJUKAN").length;
          const pendingHo = hos.filter((h) => !h.received_at).length;
          const draftPO = pos.filter((p) => p.status === "DRAFT").length;
          setRolePanel({
            cards: [
              { label: "Stok tercatat", value: `${items.length} material`, meta: `${empty} stok habis`, tone: empty ? "bad" : "ok" },
              { label: "Pengajuan pending", value: `${pendingReq} request`, meta: "menunggu verifikasi", tone: pendingReq ? "warn" : "ok" },
              { label: "Serah terima jalan", value: `${pendingHo} handover`, meta: "menunggu mandor", tone: "info" },
              { label: "PO perlu konfirmasi", value: `${draftPO} PO`, meta: "DRAFT dari sample", tone: draftPO ? "warn" : "ok" },
            ],
            rows: reqs.filter((r) => r.status === "DIAJUKAN").slice(0, 5).map((r) => ({
              title: `Order ${r.order_id.slice(0, 8)}…`,
              detail: `minta ${r.qty_requested} — terpenuhi ${r.qty_fulfilled}`,
            })),
          });
        } else if (user?.role === "QC_INSPECTOR") {
          const [orders, escalations] = await Promise.all([
            produksiApi.getOrders().catch(() => []),
            qcApi.getEscalations().catch(() => []),
          ]);
          const waiting = orders.filter((o) => o.status === "MENUNGGU_QC" || o.status === "QC");
          let passPcs = 0;
          await Promise.all(
            waiting.slice(0, 10).map(async (o) => {
              try {
                const s = await qcApi.getOrderSummary(o.id);
                passPcs += s.total_lolos;
              } catch {
                // abaikan
              }
            })
          );
          setRolePanel({
            cards: [
              { label: "Antrean QC", value: `${waiting.length} order`, meta: "MENUNGGU_QC / QC", tone: waiting.length ? "warn" : "ok" },
              { label: "Lolos (≤10 order)", value: `${passPcs} pcs`, meta: "akumulasi ringkasan", tone: "ok" },
              { label: "Eskalasi sample", value: `${escalations.length} laporan`, meta: "3x repair", tone: escalations.length ? "bad" : "ok" },
            ],
            rows: waiting.slice(0, 5).map((o) => ({ title: o.order_number, detail: o.status })),
          });
        } else if (user?.role === "KLIEN_MAKLON") {
          const [myOrders, myItems] = await Promise.all([
            produksiApi.getOrders().catch(() => []),
            gudangApi.getItems().catch(() => []),
          ]);
          const tag = (st: string) =>
            st === "COMPLETED" ? "Delivering" : st === "SEWING" || st === "MENUNGGU_QC" || st === "QC" ? "Production" : "Pending";
          setRolePanel({
            cards: [
              { label: "Pesanan saya", value: `${myOrders.length} order`, meta: "semua status", tone: "info" },
              { label: "Stok titipan", value: `${myItems.length} material`, meta: "di gudang", tone: "info" },
            ],
            rows: myOrders.slice(0, 6).map((o) => ({ title: o.order_number, detail: `${tag(o.status)} — target ${o.target_quantity} pcs` })),
          });
        }

        if (
          (user?.role === "OWNER" || user?.role === "FINANCE_PAYROLL") &&
          /^\d{4}-\d{2}$/.test(selectedMonth)
        ) {
          const [year, month] = selectedMonth.split("-").map(Number);
          const summary = await payrollApi.getMonthlySummary(year, month);
          setMonthlySummary(summary);
          const inspected = summary.qc_pass_pcs + summary.qc_repair_pcs + summary.qc_defect_pcs;
          if (user?.role === "OWNER") {
            setStats((current) => ({
              ...current,
              qcPassRate: inspected > 0 ? Number(((summary.qc_pass_pcs / inspected) * 100).toFixed(1)) : 0,
            }));
          }
        }
      } catch (err) {
        console.error("Gagal mengambil statistik dashboard:", err);
        setDataError(err instanceof Error ? err.message : "Gagal memuat data dashboard.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [user, selectedMonth]);

  const dashboard = user ? DASHBOARD_BY_ROLE[user.role] : null;
  const payrollWeeks = getPayrollWeeksForMonth(selectedMonth);
  const visibleWorkerPayroll = workerPayroll
    .filter((summary) => summary.period_end.slice(0, 7) === selectedMonth)
    .filter((summary) => selectedPayrollWeek === "all" || summary.period_start === selectedPayrollWeek);
  const qcTotal =
    (workerDashboard?.qc_passed_qty || 0) +
    (workerDashboard?.qc_repair_qty || 0) +
    (workerDashboard?.qc_defect_qty || 0);
  const qcSegments = workerDashboard
    ? [
        { label: "Lolos", quantity: workerDashboard.qc_passed_qty, color: "var(--color-success)" },
        { label: "Perbaikan", quantity: workerDashboard.qc_repair_qty, color: "var(--color-warning)" },
        { label: "Cacat", quantity: workerDashboard.qc_defect_qty, color: "var(--color-danger)" },
      ]
    : [];

  return (
    <AppLayout
      title={dashboard?.title || "Dashboard"}
      subtitle={dashboard?.subtitle}
      requiredModule="dashboard"
    >
      {dataError && <Notice type="danger" message={dataError} />}

      {user?.role === "KLIEN_MAKLON" && (
        <ClientProfileCard user={user} />
      )}

      {user?.role === "OWNER" ? (
        <section className="card-elevated" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
            <div>
              <span className="badge badge-purple">Look Utama Operasional</span>
              <h2 style={{ margin: "8px 0 0", fontSize: "1.25rem" }}>Diagram Alir Proses & Kinerja Pekerja</h2>
            </div>
            {dashboard?.href && dashboard.action && (
              <Link href={dashboard.href} className="btn btn-primary btn-sm">
                {dashboard.action} →
              </Link>
            )}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
            <div>
              <h3 style={{ fontSize: "0.95rem", marginBottom: 12 }}>Aliran Order per Tahap Proses</h3>
              {statusCounts.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(() => {
                    const max = Math.max(...statusCounts.map((s) => s.count), 1);
                    const colors = ["#84829a", "#0284c7", "#7C3AED", "#d97706", "#EC4899", "#059669"];
                    return statusCounts.map((s, i) => (
                      <div key={s.status} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ width: 110, fontSize: "0.75rem", fontWeight: 700 }}>{s.status}</span>
                        <div style={{ flex: 1, height: 20, borderRadius: "var(--radius-sm)", background: "var(--bg-secondary)", overflow: "hidden" }}>
                          <div
                            role="img"
                            aria-label={`${s.status}: ${s.count} order`}
                            style={{ width: `${Math.max(3, (s.count / max) * 100)}%`, height: "100%", background: colors[i % colors.length], display: "flex", alignItems: "center", justifyContent: "flex-end", paddingRight: 8 }}
                          >
                            <span className="font-mono" style={{ fontSize: "0.72rem", fontWeight: 800, color: "#ffffff" }}>{s.count}</span>
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{loading ? "Memuat..." : "Belum ada order."}</p>
              )}
            </div>
            <div>
              <h3 style={{ fontSize: "0.95rem", marginBottom: 12 }}>Kinerja Pekerja (pcs terverifikasi)</h3>
              {leaderboard.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {(() => {
                    const max = Math.max(...leaderboard.map((e) => e.verified_qty), 1);
                    return leaderboard.map((e, i) => (
                      <div key={e.user_id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span className="font-mono" style={{ width: 22, fontWeight: 800, color: i < 3 ? "#BE185D" : "var(--text-muted)" }}>{i + 1}</span>
                        <span style={{ width: 110, fontSize: "0.78rem", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                        <div style={{ flex: 1, height: 20, borderRadius: "var(--radius-sm)", background: "var(--bg-secondary)", overflow: "hidden" }}>
                          <div
                            role="img"
                            aria-label={`${e.name}: ${e.verified_qty} pcs terverifikasi dari ${e.total_qty}`}
                            style={{ width: `${Math.max(3, (e.verified_qty / max) * 100)}%`, height: "100%", background: "linear-gradient(90deg, #7C3AED, #EC4899)" }}
                          />
                        </div>
                        <span className="font-mono" style={{ fontSize: "0.78rem", fontWeight: 700 }}>{e.verified_qty}</span>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{loading ? "Memuat..." : "Belum ada output pekerja."}</p>
              )}
            </div>
            <div>
              <h3 style={{ fontSize: "0.95rem", marginBottom: 12 }}>Output per Line Hari Ini (pcs)</h3>
              {outputByLine.length > 0 ? (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 150, paddingTop: 8 }}>
                  {(() => {
                    const max = Math.max(...outputByLine.map((l) => l.qty), 1);
                    return outputByLine.map((l, i) => (
                      <div key={l.line} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                        <span className="font-mono" style={{ fontSize: "0.7rem", fontWeight: 700 }}>{l.qty}</span>
                        <div
                          role="img"
                          aria-label={`Line ${l.line}: ${l.qty} pcs`}
                          title={`Line ${l.line}: ${l.qty} pcs`}
                          style={{
                            width: "100%",
                            height: `${Math.max(4, (l.qty / max) * 100)}%`,
                            borderRadius: "4px 4px 2px 2px",
                            background: i === 0 ? "linear-gradient(180deg, #EC4899 0%, #DB2777 100%)" : "rgba(124, 58, 237, 0.35)",
                          }}
                        />
                        <span className="font-mono" style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>L{l.line}</span>
                      </div>
                    ));
                  })()}
                </div>
              ) : (
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{loading ? "Memuat..." : "Belum ada output hari ini."}</p>
              )}
            </div>
          </div>
        </section>
      ) : (
        dashboard?.href && dashboard.action && (
          <section className="card-elevated" style={{ marginBottom: 24, display: "flex", justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <Link href={dashboard.href} className="btn btn-primary">
              {dashboard.action} →
            </Link>
          </section>
        )
      )}

      {(user?.role === "OWNER" || user?.role === "MANDOR") && (
        <section className="card-elevated" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
            <div>
              <span className="badge badge-purple">Real-time Operasional</span>
              <h2 style={{ margin: "8px 0 0", fontSize: "1.15rem" }}>Kondisi Lantai Pabrik Hari Ini</h2>
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: "0.85rem" }}>
              <span><strong className="font-mono">{linesActive}</strong> line aktif</span>
              <span><strong className="font-mono">{tailorsOnDuty}</strong> penjahit bertugas</span>
            </div>
          </div>

          <div style={{ marginBottom: 8, fontSize: "0.82rem", color: "var(--text-secondary)" }}>
            Kecepatan produksi per interval 30 menit (pcs)
          </div>
          {speedBuckets.length > 0 ? (
            <div
              role="img"
              aria-label={`Grafik kecepatan produksi: ${speedBuckets.map((b) => `${b.label} ${b.qty} pcs`).join(", ")}`}
              style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 120, paddingTop: 8 }}
            >
              {speedBuckets.map((b, i) => {
                const max = Math.max(...speedBuckets.map((x) => x.qty), 1);
                const isLast = i === speedBuckets.length - 1;
                return (
                  <div key={b.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                    <span className="font-mono" style={{ fontSize: "0.7rem", fontWeight: 700 }}>{b.qty}</span>
                    <div
                      title={`${b.label}: ${b.qty} pcs`}
                      style={{
                        width: "100%",
                        height: `${Math.max(4, (b.qty / max) * 100)}%`,
                        borderRadius: "4px 4px 2px 2px",
                        background: isLast
                          ? "linear-gradient(180deg, #EC4899 0%, #DB2777 100%)"
                          : "rgba(124, 58, 237, 0.35)",
                      }}
                    />
                    <span className="font-mono" style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{b.label}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              {loading ? "Memuat grafik..." : "Belum ada output tercatat hari ini."}
            </p>
          )}

          <h3 style={{ fontSize: "1rem", margin: "20px 0 10px" }}>Progres Order per Klien</h3>
          {clientProgress.length > 0 ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Klien</th>
                    <th>Status</th>
                    <th>Terpending</th>
                    <th>Progres</th>
                  </tr>
                </thead>
                <tbody>
                  {clientProgress.map((p) => (
                    <tr key={p.order_id}>
                      <td className="font-mono" style={{ fontWeight: 700 }}>{p.order_number}</td>
                      <td><span className="badge badge-purple font-mono" style={{ fontSize: "0.72rem" }}>{p.client_id.slice(0, 8)}...</span></td>
                      <td><span className="badge badge-info">{p.status}</span></td>
                      <td className="font-mono" style={{ fontSize: "0.78rem", color: "var(--color-warning)", fontWeight: 700 }}>⏳ {p.pending}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ flex: 1, height: 8, borderRadius: "var(--radius-full)", background: "var(--bg-secondary)", overflow: "hidden" }}>
                            <div style={{ width: `${Math.min(100, p.completion_pct)}%`, height: "100%", background: "linear-gradient(90deg, #7C3AED, #EC4899)" }} />
                          </div>
                          <span className="font-mono" style={{ fontSize: "0.78rem", fontWeight: 700 }}>{p.completion_pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              {loading ? "Memuat progres..." : "Tidak ada order aktif."}
            </p>
          )}
        </section>
      )}

      {rolePanel && (
        <section className="card-elevated" style={{ marginBottom: 24 }}>
          <h2 style={{ margin: "0 0 16px", fontSize: "1.15rem" }}>Ringkasan Kerja Anda</h2>
          <div className="stats-grid" style={{ marginBottom: rolePanel.rows.length ? 20 : 0 }}>
            {rolePanel.cards.map((c) => (
              <div className="stat-card" key={c.label}>
                <div className="stat-label">{c.label}</div>
                <div
                  className="stat-value"
                  style={{
                    color:
                      c.tone === "ok" ? "var(--color-success)"
                      : c.tone === "warn" ? "var(--color-warning)"
                      : c.tone === "bad" ? "var(--color-danger)"
                      : undefined,
                  }}
                >
                  {c.value}
                </div>
                {c.meta && <div className="stat-meta">{c.meta}</div>}
              </div>
            ))}
          </div>
          {rolePanel.rows.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <tbody>
                  {rolePanel.rows.map((r, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 700 }}>{r.title}</td>
                      <td style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>{r.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {user?.role === "PENJAHIT" && (
        <>
          <section className="card-elevated" style={{ marginBottom: 24 }}>
            <h2 style={{ margin: "0 0 16px", fontSize: "1.15rem" }}>Kinerja Produksi Saya</h2>
            {workerDashboard ? (
              <>
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-label">Total output pada pesanan aktif</div>
                    <div className="stat-value">{workerDashboard.total_output_qty.toLocaleString("id-ID")}</div>
                    <div className="stat-meta">pcs komponen yang Anda catat</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Output terverifikasi</div>
                    <div className="stat-value">{workerDashboard.verified_output_qty.toLocaleString("id-ID")}</div>
                    <div className="stat-meta">pcs komponen yang diverifikasi Mandor</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Lolos QC</div>
                    <div className="stat-value" style={{ color: "var(--color-success)" }}>
                      {workerDashboard.qc_passed_qty.toLocaleString("id-ID")}
                    </div>
                    <div className="stat-meta">pcs pada hasil inspeksi terbaru</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Perlu perbaikan</div>
                    <div className="stat-value" style={{ color: "var(--color-warning)" }}>
                      {workerDashboard.qc_repair_qty.toLocaleString("id-ID")}
                    </div>
                    <div className="stat-meta">pcs pada hasil inspeksi terbaru</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Cacat</div>
                    <div className="stat-value" style={{ color: "var(--color-danger)" }}>
                      {workerDashboard.qc_defect_qty.toLocaleString("id-ID")}
                    </div>
                    <div className="stat-meta">pcs pada hasil inspeksi terbaru</div>
                  </div>
                </div>
                <div style={{ marginTop: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: "0.85rem" }}>
                    <strong>Ringkasan hasil QC</strong>
                    <span>{qcTotal.toLocaleString("id-ID")} pcs diperiksa</span>
                  </div>
                  {qcTotal > 0 ? (
                    <div
                      role="img"
                      aria-label={`Hasil QC: ${workerDashboard.qc_passed_qty} lolos, ${workerDashboard.qc_repair_qty} perlu perbaikan, ${workerDashboard.qc_defect_qty} cacat`}
                      style={{ display: "flex", height: 18, overflow: "hidden", borderRadius: "var(--radius-full)", background: "var(--bg-secondary)" }}
                    >
                      {qcSegments.map((segment) => (
                        <div
                          key={segment.label}
                          title={`${segment.label}: ${segment.quantity} pcs`}
                          style={{ width: `${(segment.quantity / qcTotal) * 100}%`, background: segment.color }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="notice notice-info">Belum ada hasil QC yang dapat dikaitkan dengan catatan output Anda.</div>
                  )}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10, fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    {qcSegments.map((segment) => (
                      <span key={segment.label}>
                        <span aria-hidden="true" style={{ color: segment.color }}>●</span> {segment.label}: {segment.quantity}
                      </span>
                    ))}
                  </div>
                  <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", margin: "10px 0 0" }}>
                    QC dihitung dari inspeksi terbaru yang terhubung ke output Anda.{" "}
                    {workerDashboard.unattributed_qc_inspections > 0
                      ? `${workerDashboard.unattributed_qc_inspections} catatan inspeksi di pesanan Anda belum terkait ke output, sehingga belum dapat dialokasikan ke Penjahit.`
                      : "Inspeksi tanpa kaitan ke catatan output tidak dialokasikan ke Penjahit."}
                  </p>
                </div>
              </>
            ) : (
              <p style={{ margin: 0, color: "var(--text-secondary)" }}>
                {loading ? "Memuat data produksi..." : "Belum ada catatan output untuk pesanan yang sedang berjalan."}
              </p>
            )}
          </section>

          <section className="card-elevated" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
              <div>
                <span className="badge badge-purple">Data Resmi Finance</span>
                <h2 style={{ margin: "8px 0 0", fontSize: "1.15rem" }}>Rekap Gaji Mingguan</h2>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <label>
                  <span className="sr-only">Pilih bulan</span>
                  <input
                    aria-label="Pilih bulan payroll"
                    type="month"
                    className="form-input font-mono"
                    value={selectedMonth}
                    onChange={(event) => {
                      setSelectedMonth(event.target.value);
                      setSelectedPayrollWeek("all");
                    }}
                  />
                </label>
                <select
                  aria-label="Pilih minggu payroll"
                  className="form-select"
                  value={selectedPayrollWeek}
                  onChange={(event) => setSelectedPayrollWeek(event.target.value)}
                >
                  <option value="all">Semua minggu dalam bulan</option>
                  {payrollWeeks.map((week) => (
                    <option key={week.start} value={week.start}>
                      {formatDate(week.start)} – {formatDate(week.end)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {visibleWorkerPayroll.length === 0 ? (
              <div className="notice notice-info">
                Belum ada payroll resmi terkunci Finance untuk minggu yang dipilih. Status pembayaran hanya berubah setelah Finance mencatat pembayaran.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
                {visibleWorkerPayroll.map((summary) => (
                  <article className="stat-card" key={summary.run_id}>
                    <div className="stat-label">Periode kerja</div>
                    <div style={{ fontWeight: 700, marginBottom: 14 }}>
                      {formatDate(summary.period_start)} – {formatDate(summary.period_end)}
                    </div>
                    <div className="stat-label">Total gaji resmi</div>
                    <div className="stat-value" style={{ fontSize: "1.25rem", color: "var(--color-success)" }}>
                      Rp {Number(summary.net_salary).toLocaleString("id-ID")}
                    </div>
                    <div style={{ marginTop: 14 }}>
                      <div className="stat-label">Status pembayaran Finance</div>
                      <span className={`badge ${summary.payment_status === "PAID" ? "badge-success" : "badge-warning"}`}>
                        {summary.payment_status === "PAID" ? "Sudah dibayar" : "Belum dibayar"}
                      </span>
                    </div>
                    {summary.paid_at ? (
                      <div className="stat-meta" style={{ marginTop: 8 }}>
                        Dibayar: {new Date(summary.paid_at).toLocaleString("id-ID")}
                      </div>
                    ) : (
                      <div className="stat-meta" style={{ marginTop: 8 }}>
                        Jadwal pembayaran: {formatDate(summary.scheduled_payment_date)}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="card-elevated" style={{ marginBottom: 24 }}>
            <h2 style={{ margin: "0 0 16px", fontSize: "1.15rem" }}>Pesanan yang Sedang Saya Kerjakan</h2>
            {!workerDashboard || workerDashboard.orders.length === 0 ? (
              <p style={{ margin: 0, color: "var(--text-secondary)" }}>
                Belum ada pesanan aktif yang memiliki catatan output dari akun Anda.
              </p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
                {workerDashboard.orders.map((order) => (
                  <article className="stat-card" key={order.order_id}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                      <h3 style={{ fontSize: "1rem", margin: 0 }}>{order.order_number}</h3>
                      <span className="badge badge-info">{order.status.replaceAll("_", " ")}</span>
                    </div>
                    <div className="stat-meta" style={{ marginTop: 12 }}>
                      Pengerjaan: {formatDate(order.start_date)} – {formatDate(order.deadline)}
                    </div>
                    <div style={{ marginTop: 12, fontSize: "0.88rem" }}>
                      Output Anda: <strong>{order.own_output_qty} pcs komponen</strong>
                      <br />
                      Terverifikasi Mandor: <strong>{order.own_verified_qty} pcs komponen</strong>
                    </div>
                    <div className="stat-meta" style={{ marginTop: 10 }}>
                      QC terbaru — Lolos {order.qc_passed_qty} · Perbaikan {order.qc_repair_qty} · Cacat {order.qc_defect_qty}
                    </div>
                    <div className="stat-meta" style={{ marginTop: 4 }}>
                      Target order: {order.target_quantity.toLocaleString("id-ID")} pcs produk
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {(user?.role === "OWNER" || user?.role === "FINANCE_PAYROLL") && (
        <section className="card-elevated" style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
            <div>
              <span className="badge badge-purple">Bulan Kalender</span>
              <h2 style={{ margin: "8px 0 0", fontSize: "1.2rem" }}>
                {user.role === "OWNER" ? "Rekap Operasional & Finansial Bulanan" : "Rekap Finansial Bulanan"}
              </h2>
            </div>
            <input
              aria-label="Pilih bulan kalender"
              type="month"
              className="form-input font-mono"
              value={selectedMonth}
              onChange={(event) => {
                setMonthlySummary(null);
                setSelectedMonth(event.target.value);
              }}
              style={{ maxWidth: 220 }}
            />
          </div>
          {monthlySummary && (
            <div className="stats-grid">
              {user.role === "OWNER" && (
                <>
                  <div className="stat-card">
                    <div className="stat-label">Order dibuat / aktif sekarang</div>
                    <div className="stat-value">{monthlySummary.orders_created} / {monthlySummary.active_orders_now}</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">Output terverifikasi</div>
                    <div className="stat-value">{monthlySummary.verified_output_pcs.toLocaleString("id-ID")} pcs</div>
                    <div className="stat-meta">{monthlySummary.verified_output_entries} catatan produksi</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-label">QC lolos / repair / defect</div>
                    <div className="stat-value">{monthlySummary.qc_pass_pcs} / {monthlySummary.qc_repair_pcs} / {monthlySummary.qc_defect_pcs}</div>
                    <div className="stat-meta">Jumlah pcs yang diperiksa dalam bulan kalender</div>
                  </div>
                </>
              )}
              <div className="stat-card">
                <div className="stat-label">Payroll final / telah dibayar</div>
                <div className="stat-value" style={{ fontSize: "1rem" }}>
                  Rp {Number(monthlySummary.payroll_total).toLocaleString("id-ID")}
                </div>
                <div className="stat-meta">Dibayar: Rp {Number(monthlySummary.payroll_paid_total).toLocaleString("id-ID")}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Pemasukan kontrak</div>
                <div className="stat-value" style={{ fontSize: "1rem" }}>Rp {Number(monthlySummary.contract_revenue).toLocaleString("id-ID")}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Material / overhead</div>
                <div className="stat-value" style={{ fontSize: "1rem" }}>
                  Rp {(Number(monthlySummary.material_cost) + Number(monthlySummary.overhead_cost)).toLocaleString("id-ID")}
                </div>
                <div className="stat-meta">Overhead/unit: Rp {Number(monthlySummary.overhead_per_unit ?? 0).toLocaleString("id-ID")}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Total HPP</div>
                <div className="stat-value" style={{ fontSize: "1rem" }}>Rp {Number(monthlySummary.total_hpp).toLocaleString("id-ID")}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Net profit</div>
                <div className="stat-value" style={{ fontSize: "1rem", color: "var(--color-success)" }}>Rp {Number(monthlySummary.net_profit).toLocaleString("id-ID")}</div>
              </div>
            </div>
          )}
          {!monthlySummary && (
            <p style={{ color: "var(--text-muted)", margin: 0 }}>
              {loading ? "Memuat ringkasan bulan..." : "Ringkasan bulan belum tersedia. Periksa data finansial yang tersimpan."}
            </p>
          )}
        </section>
      )}

      {user?.role === "MANDOR" && payrollNotifications.length > 0 && (
        <section className="card" style={{ marginBottom: 24, borderColor: "var(--color-warning-border)" }}>
          <h2 style={{ marginTop: 0 }}>Pemberitahuan Payroll untuk Mandor</h2>
          {payrollNotifications.map((notification) => (
            <div key={notification.id} className="notice notice-warning" style={{ marginBottom: 8 }}>
              <span>!</span>
              <div>
                {notification.message}
                <div style={{ fontSize: "0.75rem", marginTop: 4 }}>
                  {new Date(notification.created_at).toLocaleString("id-ID")}
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {user?.role === "OWNER" && (
        <section className="card-elevated" style={{ marginBottom: 24 }}>
          <span className="badge badge-purple">Visualisasi Data Riil</span>
          <h2 style={{ margin: "8px 0 16px", fontSize: "1.15rem" }}>Grafik Operasional & Finansial</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
            <div>
              <h3 style={{ fontSize: "0.95rem", marginBottom: 12 }}>Distribusi Status Order</h3>
              <DonutChart
                segments={statusCounts.map((s, i) => ({
                  label: s.status,
                  value: s.count,
                  color: ["#84829a", "#0284c7", "#7C3AED", "#d97706", "#EC4899", "#059669"][i % 6],
                }))}
              />
            </div>
            <div>
              <h3 style={{ fontSize: "0.95rem", marginBottom: 12 }}>Hasil QC Bulan Berjalan (pcs)</h3>
              {monthlySummary ? (
                <DonutChart
                  segments={[
                    { label: "Lolos", value: monthlySummary.qc_pass_pcs, color: "#059669" },
                    { label: "Repair", value: monthlySummary.qc_repair_pcs, color: "#d97706" },
                    { label: "Defect", value: monthlySummary.qc_defect_pcs, color: "#dc2626" },
                  ]}
                />
              ) : (
                <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  {loading ? "Memuat..." : "Belum ada data QC bulan ini."}
                </p>
              )}
            </div>
          </div>
          <h3 style={{ fontSize: "0.95rem", margin: "24px 0 12px" }}>Tren Revenue vs Payroll vs Net Profit (6 bulan)</h3>
          {trend.length > 0 ? (
            <TrendChart points={trend} />
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              {loading ? "Memuat tren..." : "Belum ada data tren."}
            </p>
          )}
          {monthlySummary && Number(monthlySummary.contract_revenue) > 0 && (
            <>
              <h3 style={{ fontSize: "0.95rem", margin: "24px 0 12px" }}>Komposisi Revenue Bulan Berjalan</h3>
              {(() => {
                const rev = Number(monthlySummary.contract_revenue);
                const parts = [
                  { label: "Material", value: Number(monthlySummary.material_cost), color: "#7C3AED" },
                  { label: "Overhead", value: Number(monthlySummary.overhead_cost), color: "#d97706" },
                  { label: "Labor", value: Math.max(0, Number(monthlySummary.total_hpp) - Number(monthlySummary.material_cost) - Number(monthlySummary.overhead_cost)), color: "#0284c7" },
                  { label: "Net profit", value: Math.max(0, Number(monthlySummary.net_profit)), color: "#059669" },
                ];
                return (
                  <div>
                    <div
                      role="img"
                      aria-label={parts.map((p) => `${p.label}: Rp ${p.value.toLocaleString("id-ID")}`).join(", ")}
                      style={{ display: "flex", height: 26, borderRadius: "var(--radius-full)", overflow: "hidden", background: "var(--bg-secondary)" }}
                    >
                      {parts.map((p) => (
                        <div key={p.label} title={`${p.label}: Rp ${p.value.toLocaleString("id-ID")}`}
                          style={{ width: `${(p.value / rev) * 100}%`, background: p.color, minWidth: p.value > 0 ? 4 : 0 }} />
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 16, fontSize: "0.8rem", marginTop: 8, flexWrap: "wrap" }}>
                      {parts.map((p) => (
                        <span key={p.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 3, background: p.color }} />
                          {p.label}: <strong className="font-mono">Rp {p.value.toLocaleString("id-ID")}</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </section>
      )}
      {(user?.role === "OWNER" || user?.role === "MANDOR") && (
        <div className="stats-grid">
          {user.role === "OWNER" && (
            <div className="stat-card">
              <div className="stat-label">Total Pesanan Produksi</div>
              <div className="stat-value">{stats.totalOrders}</div>
              <div className="stat-meta">
                <span style={{ color: "var(--color-info)" }}>{stats.activeOrders} PO</span> sedang aktif berjalan
              </div>
            </div>
          )}

          <div className="stat-card">
            <div className="stat-label">Output Belum Diverifikasi</div>
            <div className="stat-value" style={{ color: stats.unverifiedOutputs > 0 ? "var(--color-warning)" : "var(--color-success)" }}>
              {stats.unverifiedOutputs}
            </div>
            <div className="stat-meta">
              {stats.unverifiedOutputs > 0 ? "⚠️ Perlu validasi Mandor Line" : "✅ Seluruh interval terverifikasi"}
            </div>
          </div>

          {user.role === "OWNER" && (
            <>
              <div className="stat-card">
                <div className="stat-label">Stok Material Gudang</div>
                <div className="stat-value">{stats.inventoryItemsCount}</div>
                <div className="stat-meta">Material terisolasi per Tag Klien</div>
              </div>

              <div className="stat-card">
                <div className="stat-label">Quality Rate (QC Pass)</div>
                <div className="stat-value" style={{ color: "var(--color-success)" }}>
                  {stats.qcPassRate}%
                </div>
                <div className="stat-meta">Akumulasi ke Pool Bonus Mandor</div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Owner & Finance: Net Profit Batch & HPP Dashboard (Activity Diagram) */}
      {(user?.role === "OWNER" || user?.role === "FINANCE_PAYROLL") && (
        <div
          className="card-elevated"
          style={{
            marginBottom: 32,
            background: "#ffffff",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <div>
              <span className="badge badge-purple" style={{ marginBottom: 6 }}>
                Finansial & Net Profit Engine
              </span>
              <h3 style={{ fontSize: "1.25rem", margin: 0, color: "var(--jadoo-ink)" }}>
                Analisis Laba/Rugi & Total HPP Batch
              </h3>
            </div>
            <Link href="/payroll" className="btn btn-secondary btn-sm">
              Kelola Penggajian & Payout →
            </Link>
          </div>

          {financials.length === 0 ? (
            <div style={{ padding: "24px", textAlign: "center", background: "var(--bg-secondary)", borderRadius: "var(--radius-md)" }}>
              <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
                Belum ada kalkulasi batch finansial tersimpan. Kalkulasi otomatis dibuat saat draft payroll diproses atau melalui modul Payroll.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
              {financials.map((fin) => {
                const marginPct = fin.contract_revenue > 0 ? ((fin.net_profit / fin.contract_revenue) * 100).toFixed(1) : "0.0";
                return (
                  <div
                    key={fin.id}
                    style={{
                      padding: 16,
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-subtle)",
                      background: "linear-gradient(180deg, #fafafa 0%, #ffffff 100%)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span className="font-mono" style={{ fontWeight: 700, fontSize: "0.85rem" }}>
                        PO #{fin.order_id.slice(0, 8)}
                      </span>
                      <span className={`badge ${fin.status === "LOCKED" ? "badge-success" : "badge-warning"}`}>
                        {fin.status}
                      </span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: "0.82rem", marginBottom: 12 }}>
                      <div>
                        <span style={{ color: "var(--text-secondary)" }}>Pendapatan Kontrak:</span>
                        <div style={{ fontWeight: 600 }}>Rp {Number(fin.contract_revenue).toLocaleString("id-ID")}</div>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-secondary)" }}>Total HPP Batch:</span>
                        <div style={{ fontWeight: 600, color: "var(--color-warning)" }}>
                          Rp {Number(fin.total_hpp).toLocaleString("id-ID")}
                        </div>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-secondary)" }}>Material & Overhead:</span>
                        <div>Rp {(Number(fin.material_cost) + Number(fin.overhead_cost)).toLocaleString("id-ID")}</div>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-secondary)" }}>Upah & Pool QC:</span>
                        <div>Rp {Number(fin.labor_cost).toLocaleString("id-ID")}</div>
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "8px 12px",
                        background: "var(--jadoo-cream)",
                        borderRadius: "var(--radius-sm)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--jadoo-ink)" }}>
                        Net Profit Owner:
                      </span>
                      <span style={{ fontSize: "1rem", fontWeight: 800, color: "var(--color-success)" }}>
                        Rp {Number(fin.net_profit).toLocaleString("id-ID")} ({marginPct}%)
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </AppLayout>
  );
}
