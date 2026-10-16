"use client";

import React, { useEffect, useState } from "react";
import { AppLayout } from "../../components/AppLayout";
import { Modal } from "../../components/Modal";
import { Notice } from "../../components/Notice";
import { payrollApi } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import type { PayrollPreview, PayrollRun } from "../../types/api";

function formatLocalDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isMondayToSaturday(start: string, end: string): boolean {
  if (!start || !end) return false;
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const dayDifference = (endDate.getTime() - startDate.getTime()) / 86400000;
  return startDate.getDay() === 1 && endDate.getDay() === 6 && dayDifference === 5;
}

export default function PayrollPage() {
  const { user } = useAuth();
  const isFinance = user?.role === "FINANCE_PAYROLL" || user?.role === "OWNER";
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [preview, setPreview] = useState<PayrollPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "danger" | "warning" | "info"; message: string } | null>(null);

  const defaultMonday = new Date();
  defaultMonday.setDate(defaultMonday.getDate() - ((defaultMonday.getDay() + 6) % 7));
  const defaultSaturday = new Date(defaultMonday);
  defaultSaturday.setDate(defaultSaturday.getDate() + 5);
  const [periodStart, setPeriodStart] = useState(formatLocalDate(defaultMonday));
  const [periodEnd, setPeriodEnd] = useState(formatLocalDate(defaultSaturday));
  const [mealPercentage, setMealPercentage] = useState(10);
  const [qcBonusRate, setQcBonusRate] = useState(150);
  const [availableFunds, setAvailableFunds] = useState("");
  const [pendingReviewRunId, setPendingReviewRunId] = useState<string | null>(null);

  // Modal confirm lock
  const [confirmLockModal, setConfirmLockModal] = useState(false);

  const loadRuns = async () => {
    try {
      const runList = await payrollApi.getRuns();
      setRuns(runList);
      if (runList.length > 0) {
        const detail = await payrollApi.getRunDetail(runList[0].id);
        setSelectedRun(detail);
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleRetryFinanceReview = async () => {
    if (!selectedRun) return;
    try {
      setLoading(true);
      const reviewedRun = await payrollApi.reviewFunding(selectedRun.id, {
        available_funds: Number(availableFunds),
      });
      setSelectedRun(reviewedRun);
      setNotice(reviewedRun.is_locked
        ? { type: "success", message: "Dana mencukupi; Finance telah mengunci payroll." }
        : { type: "warning", message: "Dana belum mencukupi. Notifikasi dikirimkan kepada Mandor." });
      await loadRuns();
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal memeriksa kecukupan dana." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, []);

  const handlePreview = async () => {
    if (!isMondayToSaturday(periodStart, periodEnd)) {
      setNotice({ type: "warning", message: "Pilih satu pekan kerja penuh: mulai Senin dan berakhir Sabtu." });
      return;
    }
    try {
      setLoading(true);
      setNotice(null);
      const data = await payrollApi.getPreview({
        period_start: periodStart,
        period_end: periodEnd,
        meal_allowance_percentage: Number(mealPercentage),
        qc_bonus_rate_per_pcs: Number(qcBonusRate),
      });
      setPreview(data);
      const totalPayroll = data.slips.reduce((total, slip) => total + Number(slip.net_salary), 0);
      setNotice({
        type: "info",
        message: `Kalkulasi on-demand selesai: ${data.total_penjahit} penjahit terhitung dengan total estimasi Rp ${totalPayroll.toLocaleString("id-ID")}.`,
      });
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal mengkalkulasi preview payroll." });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmLock = async () => {
    if (!isMondayToSaturday(periodStart, periodEnd)) {
      setNotice({ type: "warning", message: "Pilih satu pekan kerja penuh: mulai Senin dan berakhir Sabtu." });
      return;
    }
    try {
      setLoading(true);
      const runId = pendingReviewRunId ?? (await payrollApi.createRun({
          period_start: periodStart,
          period_end: periodEnd,
          meal_allowance_percentage: Number(mealPercentage),
          qc_bonus_rate_per_pcs: Number(qcBonusRate),
        })).id;
      setPendingReviewRunId(runId);
      const reviewedRun = await payrollApi.reviewFunding(runId, {
        available_funds: Number(availableFunds),
      });
      setPendingReviewRunId(null);
      setSelectedRun(reviewedRun);
      setNotice(reviewedRun.is_locked
        ? {
            type: "success",
            message: `Dana mencukupi. Payroll periode ${periodStart} s/d ${periodEnd} telah dikunci oleh Finance.`,
          }
        : {
            type: "warning",
            message: "Dana belum mencukupi. Payroll belum dikunci dan notifikasi telah dikirim kepada Mandor.",
          });
      setConfirmLockModal(false);
      setPreview(null);
      await loadRuns();
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal mengunci payroll." });
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPaid = async (runId: string, detailId: string) => {
    try {
      setLoading(true);
      const payment = await payrollApi.markDetailPaid(runId, detailId);
      const updatedRun = await payrollApi.getRunDetail(runId);
      setSelectedRun(updatedRun);
      setNotice({
        type: "success",
        message: `Pembayaran ${updatedRun.details?.find((detail) => detail.id === detailId)?.user.name ?? "slip"} dicatat pada ${new Date(payment.paid_at).toLocaleString("id-ID")}.`,
      });
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal mencatat pembayaran." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout
      title="Payroll Engine Sabtu & Audit Lock"
      subtitle="Kalkulasi upah borongan, uang makan 10-15%, bonus QC, dan penguncian audit permanen (Skenario 2 - P0)"
      requiredModule="payroll"
    >
      {notice && (
        <Notice
          type={notice.type}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}

      <div style={{ marginBottom: 20 }}>
        <a href="/tagihan" className="btn btn-secondary">
          📋 Buka PO Bahan & Invoice Klien
        </a>
      </div>

      {/* Skenario 2 Educational Banner */}
      <div
        className="card-elevated"
        style={{
          marginBottom: 28,
          background: "linear-gradient(135deg, rgba(234, 179, 8, 0.1) 0%, rgba(15, 23, 42, 0.9) 100%)",
          border: "1px solid var(--color-warning-border)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div>
            <span className="badge badge-warning" style={{ marginBottom: 6 }}>
              Skenario 2: Kunci Audit Permanen (FR-10)
            </span>
            <h2 style={{ fontSize: "1.35rem", margin: "4px 0" }}>
              Mesin Penggajian Sabtu & Headcount Dinamis
            </h2>
            <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              Hanya Finance yang dapat mengonfirmasi kecukupan dana. Payroll terkunci final hanya setelah saldo yang dikonfirmasi mencukupi total gaji.
            </div>
          </div>

          <span className="badge badge-purple font-mono" style={{ fontSize: "0.85rem", padding: "6px 14px" }}>
            🔒 Immutable Audit Trail
          </span>
        </div>
      </div>

      {isFinance && <div className="card" style={{ marginBottom: 28 }}>
        <h3 style={{ fontSize: "1.05rem", marginBottom: 16 }}>Parameter Periode Penggajian</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: 16,
            alignItems: "flex-end",
          }}
        >
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Tanggal Mulai Periode</label>
            <input
              type="date"
              className="form-input font-mono"
              max={periodEnd}
              value={periodStart}
              onChange={(e) => {
                setPendingReviewRunId(null);
                setPeriodStart(e.target.value);
              }}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Tanggal Akhir Periode</label>
            <input
              type="date"
              className="form-input font-mono"
              min={periodStart}
              value={periodEnd}
              onChange={(e) => {
                setPendingReviewRunId(null);
                setPeriodEnd(e.target.value);
              }}
            />
          </div>
          <p style={{ gridColumn: "1 / -1", margin: "-6px 0 0", fontSize: "0.78rem", color: "var(--text-muted)" }}>
            Periode payroll harus satu pekan kerja penuh, Senin sampai Sabtu.
          </p>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Uang Makan (%)</label>
            <input
              type="number"
              className="form-input font-mono"
              value={mealPercentage}
              onChange={(e) => setMealPercentage(Number(e.target.value))}
              min={10}
              max={15}
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">Rate Bonus QC (Rp/pcs)</label>
            <input
              type="number"
              className="form-input font-mono"
              value={qcBonusRate}
              onChange={(e) => setQcBonusRate(Number(e.target.value))}
              step={50}
            />
          </div>

          <button
            onClick={handlePreview}
            className="btn btn-primary"
            style={{ height: 42 }}
            disabled={loading}
          >
            {loading ? "Menghitung..." : "📊 Preview Kalkulasi"}
          </button>
        </div>
      </div>}

      {/* Live Preview Result (If calculated) */}
      {preview && (
        <div className="card-glass" style={{ marginBottom: 32, border: "1px solid var(--accent-primary)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <div>
              <span className="badge badge-info" style={{ marginBottom: 4 }}>
                Preview Mode (Belum Disimpan)
              </span>
              <h3 style={{ fontSize: "1.2rem", margin: 0 }}>
                Rincian Upah Periode: {preview.period_start} s/d {preview.period_end}
              </h3>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Total Beban Payroll</div>
                <div className="font-mono" style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--color-success)" }}>
                  Rp {preview.slips.reduce((total, slip) => total + Number(slip.net_salary), 0).toLocaleString("id-ID")}
                </div>
              </div>

              <button
                onClick={() => setConfirmLockModal(true)}
                className="btn btn-danger btn-lg"
              >
                Periksa Dana & Finalisasi
              </button>
            </div>
          </div>

          {/* Table of Operator Slips */}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nama Operator</th>
                  <th>Peran</th>
                  <th>Output (Pcs)</th>
                  <th>Upah Borongan</th>
                  <th>Uang Makan ({preview.meal_allowance_percentage}%)</th>
                  <th>Bonus QC</th>
                  <th>Total Gaji Diterima</th>
                </tr>
              </thead>
              <tbody>
                {preview.slips.map((det) => (
                  <tr key={det.user_id}>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                      {det.name}
                    </td>
                    <td>
                      <span className="badge badge-neutral" style={{ fontSize: "0.7rem" }}>
                        {det.role}
                      </span>
                    </td>
                    <td className="font-mono" style={{ fontWeight: 700 }}>
                      {det.total_qty_completed} pcs
                    </td>
                    <td className="font-mono">Rp {Number(det.total_sewing_fee).toLocaleString("id-ID")}</td>
                    <td className="font-mono">Rp {Number(det.meal_allowance_amount).toLocaleString("id-ID")}</td>
                    <td className="font-mono" style={{ color: "var(--color-success)" }}>
                      Rp {Number(det.qc_bonus_share).toLocaleString("id-ID")}
                    </td>
                    <td className="font-mono" style={{ fontWeight: 800, color: "var(--accent-primary)", fontSize: "1rem" }}>
                      Rp {Number(det.net_salary).toLocaleString("id-ID")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* History of Locked Payroll Runs */}
      <div>
        <h3 style={{ marginBottom: 14 }}>Riwayat Periode Payroll</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Periode Kerja</th>
                <th>Status Audit</th>
                <th>Waktu Dibuat</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {runs.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                    Belum ada payroll run yang difinalisasi.
                  </td>
                </tr>
              ) : (
                runs.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono" style={{ fontWeight: 600 }}>
                      {r.period_start} s/d {r.period_end}
                    </td>
                    <td>
                      <span className={`badge ${r.is_locked ? "badge-danger" : "badge-warning"}`}>
                        {r.is_locked ? "🔒 FINAL" : r.funding_status === "INSUFFICIENT" ? "Dana kurang" : "Menunggu Finance"}
                      </span>
                    </td>
                    <td className="font-mono" style={{ fontSize: "0.8rem" }}>
                      {new Date(r.created_at).toLocaleString("id-ID")}
                    </td>
                    <td>
                      <button
                        onClick={async () => {
                          const detail = await payrollApi.getRunDetail(r.id);
                          setSelectedRun(detail);
                        }}
                        className="btn btn-ghost btn-sm"
                        style={{ color: "var(--accent-primary)" }}
                      >
                        Buka Arsip Slip →
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Run Archive Detail Modal */}
      {selectedRun && (
        <Modal
          isOpen={!!selectedRun}
          onClose={() => setSelectedRun(null)}
          title={`${selectedRun.is_locked ? "Payroll Final" : "Review Finance"}: Periode ${selectedRun.period_start} s/d ${selectedRun.period_end}`}
          maxWidth="1080px"
        >
          <div style={{ marginBottom: 14, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Total Pembayaran: <strong style={{ color: "var(--color-success)" }}>Rp {selectedRun.details?.reduce((total, detail) => total + Number(detail.net_salary), 0).toLocaleString("id-ID")}</strong>
            <br />
            Status: <span className={`badge ${selectedRun.is_locked ? "badge-success" : selectedRun.funding_status === "INSUFFICIENT" ? "badge-warning" : "badge-info"}`} style={{ marginTop: 4 }}>
              {selectedRun.is_locked ? "Final dan terkunci" : selectedRun.funding_status === "INSUFFICIENT" ? "Dana belum cukup" : "Menunggu pemeriksaan Finance"}
            </span>
            {selectedRun.available_funds !== null && (
              <div>Dana tercatat: Rp {Number(selectedRun.available_funds).toLocaleString("id-ID")}</div>
            )}
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Peran</th>
                  <th>Upah Borongan</th>
                  <th>Uang Makan</th>
                  <th>Bonus QC</th>
                  <th>Koreksi Manual</th>
                  <th>Total</th>
                  <th>Status pembayaran</th>
                  <th>Tanggal pembayaran</th>
                </tr>
              </thead>
              <tbody>
                {selectedRun.details?.map((d, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{d.user.name}</td>
                    <td><span className="badge badge-neutral">{d.user.role}</span></td>
                    <td className="font-mono">Rp {Number(d.total_sewing_fee).toLocaleString("id-ID")}</td>
                    <td className="font-mono">Rp {Number(d.meal_allowance_amount).toLocaleString("id-ID")}</td>
                    <td className="font-mono">Rp {Number(d.qc_bonus_share).toLocaleString("id-ID")}</td>
                    <td>
                      {!selectedRun.is_locked && isFinance ? (
                        <button
                          onClick={() => {
                            const v = window.prompt(
                              `Koreksi manual untuk ${d.user.name} (Rp, boleh negatif):`,
                              String((d as { manual_adjustment?: number }).manual_adjustment ?? 0),
                            );
                            if (v === null) return;
                            payrollApi.adjustDetail(selectedRun.id, d.id, Number(v))
                              .then(async () => {
                                const updated = await payrollApi.getRunDetail(selectedRun.id);
                                setSelectedRun(updated);
                                setNotice({ type: "success", message: "Koreksi gaji tersimpan di audit." });
                              })
                              .catch((err: any) => setNotice({ type: "danger", message: err.message || "Gagal koreksi gaji." }));
                          }}
                          className="btn btn-ghost btn-sm font-mono"
                          title="Ubah koreksi manual"
                        >
                          Rp {Number((d as { manual_adjustment?: number }).manual_adjustment ?? 0).toLocaleString("id-ID")} ✏️
                        </button>
                      ) : (
                        <span className="font-mono">Rp {Number((d as { manual_adjustment?: number }).manual_adjustment ?? 0).toLocaleString("id-ID")}</span>
                      )}
                    </td>
                    <td className="font-mono" style={{ fontWeight: 700, color: "var(--color-success)" }}>
                      Rp {Number(d.net_salary).toLocaleString("id-ID")}
                    </td>
                    <td>
                      {d.payment ? (
                        <span className="badge badge-success">Sudah dibayar</span>
                      ) : (
                        <span className="badge badge-warning">Terjadwal</span>
                      )}
                    </td>
                    <td>
                      {d.payment ? (
                        new Date(d.payment.paid_at).toLocaleString("id-ID")
                      ) : selectedRun.is_locked && isFinance ? (
                        <button
                          onClick={() => handleMarkPaid(selectedRun.id, d.id)}
                          className="btn btn-success btn-sm"
                          disabled={loading}
                        >
                          Tandai sudah dibayar
                        </button>
                      ) : (
                        selectedRun.is_locked ? "Menunggu Finance mencatat payout" : "Menunggu payroll dikunci Finance"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!selectedRun.is_locked && isFinance && (
            <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
              <label className="form-label" htmlFor="retry-available-funds">
                Dana tersedia yang dikonfirmasi Finance (Rp)
              </label>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  id="retry-available-funds"
                  type="number"
                  min="0"
                  step="1000"
                  className="form-input font-mono"
                  value={availableFunds}
                  onChange={(event) => setAvailableFunds(event.target.value)}
                  placeholder="Saldo yang tersedia (boleh data dummy saat uji)"
                  style={{ flex: "1 1 240px" }}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleRetryFinanceReview}
                  disabled={loading || availableFunds === ""}
                >
                  {loading ? "Memeriksa..." : "Periksa Dana & Finalisasi"}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Modal: Konfirmasi Audit Lock */}
      <Modal
        isOpen={confirmLockModal}
        onClose={() => setConfirmLockModal(false)}
        title="⚠️ Konfirmasi Penguncian Audit Payroll (PERMANEN)"
      >
        <div style={{ marginBottom: 20 }}>
          <div className="notice notice-danger" style={{ marginBottom: 16 }}>
            <span>⛔</span>
            <div style={{ fontSize: "0.85rem" }}>
              <strong>PERINGATAN AUDIT LOCK:</strong> Begitu difinalisasi, transaksi periode ini akan dikunci secara permanen di database PostgreSQL. Sesuai regulasi audit SRS FR-10, data ini tidak dapat diedit atau dihapus oleh peran apa pun termasuk OWNER!
            </div>
          </div>

          <p style={{ fontSize: "0.9rem" }}>
            Total payroll yang akan diperiksa:
            <br />
            <strong className="font-mono" style={{ fontSize: "1.4rem", color: "var(--color-success)" }}>
              Rp {preview?.slips.reduce((total, slip) => total + Number(slip.net_salary), 0).toLocaleString("id-ID")}
            </strong>
          </p>
          <label className="form-label" htmlFor="available-funds">
            Dana tersedia yang telah dikonfirmasi Finance (Rp)
          </label>
          <input
            id="available-funds"
            type="number"
            min="0"
            step="1000"
            className="form-input font-mono"
            value={availableFunds}
            onChange={(event) => setAvailableFunds(event.target.value)}
            placeholder="Masukkan saldo dana (untuk data demo, masukkan nilai contoh)"
          />
          <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: 6 }}>
            Dana kurang akan membatalkan penguncian dan mengirim notifikasi ke Mandor. Gunakan angka dummy hanya untuk pengujian.
          </p>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setConfirmLockModal(false)}
          >
            Batal
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleConfirmLock}
            disabled={loading || availableFunds === ""}
          >
            {loading ? "Memeriksa..." : "Konfirmasi Dana & Finalisasi"}
          </button>
        </div>
      </Modal>
    </AppLayout>
  );
}
