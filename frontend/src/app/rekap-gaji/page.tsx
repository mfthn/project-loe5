"use client";

import React, { useEffect, useState } from "react";
import { AppLayout } from "../../components/AppLayout";
import { Notice } from "../../components/Notice";
import { payrollApi } from "../../lib/api";
import type { WorkerPayrollSummary } from "../../types/api";

export default function RekapGajiPage() {
  const [summaries, setSummaries] = useState<WorkerPayrollSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    payrollApi
      .getMySummary()
      .then(setSummaries)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Gagal memuat rekap gaji.");
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppLayout
      title="Rekap Gaji Mingguan"
      subtitle="Slip resmi yang telah difinalisasi Finance beserta status pembayaran dan progres kerja"
      requiredModule="rekap-gaji"
    >
      {error && <Notice type="danger" message={error} onClose={() => setError(null)} />}

      {loading ? (
        <div className="card">Memuat rekap gaji...</div>
      ) : summaries.length === 0 ? (
        <div className="card">
          Belum ada rekap gaji resmi. Rekap tampil setelah Finance menghitung dan mengunci payroll periode kerja.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {summaries.map((summary) => (
            <section className="card-elevated" key={summary.run_id}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: 16,
                  marginBottom: 18,
                }}
              >
                <div>
                  <span className="badge badge-purple">Periode kerja</span>
                  <h2 style={{ fontSize: "1.1rem", margin: "8px 0 0" }}>
                    {summary.period_start} s/d {summary.period_end}
                  </h2>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>Total gaji resmi</div>
                  <strong className="font-mono" style={{ fontSize: "1.35rem", color: "var(--color-success)" }}>
                    Rp {Number(summary.net_salary).toLocaleString("id-ID")}
                  </strong>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                <div className="stat-card">
                  <div className="stat-label">Status pembayaran</div>
                  <div>
                    <span className={`badge ${summary.payment_status === "PAID" ? "badge-success" : "badge-warning"}`}>
                      {summary.payment_status === "PAID" ? "Sudah dibayar" : "Terjadwal"}
                    </span>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Jadwal pembayaran (Sabtu)</div>
                  <div className="font-mono" style={{ fontWeight: 700 }}>
                    {summary.scheduled_payment_date}
                  </div>
                </div>
                {summary.paid_at && (
                  <div className="stat-card">
                    <div className="stat-label">Dikonfirmasi dibayar pada</div>
                    <div className="font-mono" style={{ fontWeight: 700 }}>
                      {new Date(summary.paid_at).toLocaleString("id-ID")}
                    </div>
                  </div>
                )}
              </div>

              <h3 style={{ fontSize: "1rem", marginBottom: 10 }}>Catatan progres produksi (interval 30 menit)</h3>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Waktu catatan</th>
                      <th>Order</th>
                      <th>Komponen</th>
                      <th>Line</th>
                      <th>Output</th>
                      <th>Verifikasi Mandor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.production_notes.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>
                          Tidak ada catatan progres pada periode ini.
                        </td>
                      </tr>
                    ) : (
                      summary.production_notes.map((note) => (
                        <tr key={note.id}>
                          <td className="font-mono">{new Date(note.time_window).toLocaleString("id-ID")}</td>
                          <td>{note.order_number}</td>
                          <td>{note.component_name}</td>
                          <td>{note.line_number}</td>
                          <td className="font-mono">{note.qty_completed} pcs</td>
                          <td>
                            <span className={`badge ${note.is_verified ? "badge-success" : "badge-warning"}`}>
                              {note.is_verified ? "Terverifikasi" : "Menunggu"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
    </AppLayout>
  );
}
