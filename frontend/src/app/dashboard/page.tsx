"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "../../components/AppLayout";
import { Notice } from "../../components/Notice";
import { useAuth } from "../../lib/auth-context";
import { produksiApi, gudangApi, payrollApi } from "../../lib/api";
import type {
  BatchFinancial,
  PayrollMonthlySummary,
  PayrollNotification,
  UserRole,
  WorkerDashboardSummary,
  WorkerPayrollSummary,
} from "../../types/api";

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
  const [workerDashboard, setWorkerDashboard] = useState<WorkerDashboardSummary | null>(null);
  const [workerPayroll, setWorkerPayroll] = useState<WorkerPayrollSummary[]>([]);
  const [selectedPayrollWeek, setSelectedPayrollWeek] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

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
        } else if (user?.role === "FINANCE_PAYROLL") {
          setFinancials(await payrollApi.getBatchFinancials());
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

      {dashboard?.href && dashboard.action && (
        <section className="card-elevated" style={{ marginBottom: 24, display: "flex", justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <Link href={dashboard.href} className="btn btn-primary">
            {dashboard.action} →
          </Link>
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

      {/* Skenario Hackathon Quick Guide Banner */}
      <div
        className="card-elevated"
        style={{
          marginBottom: 32,
          background: "linear-gradient(135deg, var(--jadoo-cream) 0%, #ffffff 100%)",
          border: "1px solid #E9D5FF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 12 }}>
          <div>
            <span className="badge badge-coral" style={{ marginBottom: 6 }}>
              Hackathon Skenario Terintegrasi
            </span>
            <h2 style={{ fontSize: "1.35rem", margin: 0, color: "var(--jadoo-ink)" }}>Alur Bisnis & Validasi Kritis Operasional</h2>
          </div>
          <span className="badge badge-purple font-mono">Backend: 114/114 Tests Pass</span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
            marginTop: 16,
          }}
        >
          <div style={{ background: "#ffffff", padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-subtle)" }}>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--jadoo-coral)", marginBottom: 4 }}>
              1. Gudang Anti-Kontaminasi
            </div>
            <div style={{ fontSize: "0.82rem", color: "var(--jadoo-text)" }}>
              Sistem menolak otomatis bila kain milik Klien A dikeluarkan untuk pesanan Klien B.
            </div>
          </div>

          <div style={{ background: "#ffffff", padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-subtle)" }}>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--color-success)", marginBottom: 4 }}>
              2. Terminal 30m & Stopwatch
            </div>
            <div style={{ fontSize: "0.82rem", color: "var(--jadoo-text)" }}>
              Input borongan penjahit touchscreen per 30 menit & stopwatch digital time study sampel.
            </div>
          </div>

          <div style={{ background: "#ffffff", padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-subtle)" }}>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--color-warning)", marginBottom: 4 }}>
              3. Pool Bonus QC Mandor
            </div>
            <div style={{ fontSize: "0.82rem", color: "var(--jadoo-text)" }}>
              Bonus dibagi rata ke seluruh mandor berdasarkan pcs yang LOLOS inspeksi QC.
            </div>
          </div>

          <div style={{ background: "#ffffff", padding: 16, borderRadius: "var(--radius-md)", border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-subtle)" }}>
            <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--jadoo-purple)", marginBottom: 4 }}>
              4. Payroll & Audit Lock
            </div>
            <div style={{ fontSize: "0.82rem", color: "var(--jadoo-text)" }}>
              Payroll Sabtu dikunci permanen: tidak dapat diubah oleh siapa pun termasuk Owner.
            </div>
          </div>
        </div>
      </div>

      {/* Allowed Modules Grid */}
      <h3 style={{ marginBottom: 16, fontSize: "1.1rem" }}>
        Modul yang Tersedia untuk Peran Anda ({user?.role})
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: 20,
        }}
      >
        {allowedModules.map((mod) => (
          <Link
            key={mod.id}
            href={mod.href}
            className="card"
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              textDecoration: "none",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <span style={{ fontSize: "2rem" }}>{mod.icon}</span>
                {mod.badge && <span className="badge badge-info">{mod.badge}</span>}
              </div>
              <h4 style={{ fontSize: "1.05rem", marginBottom: 6, color: "var(--text-primary)" }}>
                {mod.label}
              </h4>
              <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.5 }}>
                {mod.description}
              </p>
            </div>

            <div
              style={{
                marginTop: 18,
                paddingTop: 12,
                borderTop: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "var(--accent-primary)",
              }}
            >
              <span>Buka Modul</span>
              <span>→</span>
            </div>
          </Link>
        ))}
      </div>
    </AppLayout>
  );
}
