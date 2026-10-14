"use client";

import React, { useEffect, useState } from "react";
import { AppLayout } from "../../components/AppLayout";
import { Modal } from "../../components/Modal";
import { Notice } from "../../components/Notice";
import { useAuth } from "../../lib/auth-context";
import { produksiApi } from "../../lib/api";
import type { Order, ProductionOutput, OrderSummary, OrderStatus } from "../../types/api";

const STATUS_STEPS: OrderStatus[] = [
  "SAMPLE",
  "CUTTING",
  "SEWING",
  "MENUNGGU_QC",
  "QC",
  "COMPLETED",
];

export default function ProduksiPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [outputs, setOutputs] = useState<ProductionOutput[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);

  // Terminal 30 Menit form state
  const [terminalComponentId, setTerminalComponentId] = useState("");
  const [terminalQty, setTerminalQty] = useState(12);

  // Modal new order
  const [newOrderModal, setNewOrderModal] = useState(false);
  const [newOrderNumber, setNewOrderNumber] = useState("");
  const [newOrderScheme, setNewOrderScheme] = useState<"CMT" | "SEMI_CMT" | "FULL_PACKAGE">("CMT");
  const [newOrderTarget, setNewOrderTarget] = useState(1000);

  const isMandorOrOwner = user?.role === "MANDOR" || user?.role === "OWNER";

  const loadOrders = async () => {
    try {
      setLoading(true);
      const list = await produksiApi.getOrders();
      setOrders(list);
      if (list.length > 0) {
        handleSelectOrder(list[0]);
      }
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal memuat daftar order." });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOrder = async (order: Order) => {
    setSelectedOrder(order);
    try {
      const [sum, outList] = await Promise.all([
        produksiApi.getOrderSummary(order.id).catch(() => null),
        produksiApi.getOutputs({ order_id: order.id }).catch(() => []),
      ]);
      setSummary(sum);
      setOutputs(outList);
      if (order.components && order.components.length > 0) {
        setTerminalComponentId(order.components[0].id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // Catat Output 30 Menit (Penjahit)
  const handleRecordOutput = async () => {
    if (!selectedOrder || !terminalComponentId) {
      setNotice({ type: "warning", message: "Pilih komponen terlebih dahulu." });
      return;
    }
    const now = new Date();
    const intervalStart = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    const intervalEnd = now.toISOString();

    try {
      await produksiApi.recordOutput({
        order_id: selectedOrder.id,
        component_id: terminalComponentId,
        interval_start: intervalStart,
        interval_end: intervalEnd,
        qty_completed: Number(terminalQty),
      });
      setNotice({
        type: "success",
        message: `Output ${terminalQty} pcs berhasil dicatat! Menunggu verifikasi mandor.`,
      });
      handleSelectOrder(selectedOrder);
    } catch (err: any) {
      setNotice({
        type: "danger",
        message: err.message || "Gagal mencatat output (pastikan status order SEWING).",
      });
    }
  };

  // Verifikasi Output (Mandor)
  const handleVerifyOutput = async (outputId: string) => {
    try {
      await produksiApi.verifyOutput(outputId);
      setNotice({ type: "success", message: "Output berhasil diverifikasi oleh Mandor!" });
      if (selectedOrder) handleSelectOrder(selectedOrder);
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal memverifikasi output." });
    }
  };

  // Majukan Status Produksi
  const handleAdvanceStatus = async (nextStatus: OrderStatus) => {
    if (!selectedOrder) return;
    try {
      const updated = await produksiApi.updateOrderStatus(selectedOrder.id, nextStatus);
      setSelectedOrder(updated);
      setNotice({ type: "success", message: `Status order dimajukan ke ${nextStatus}!` });
      loadOrders();
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal memajukan status pesanan." });
    }
  };

  return (
    <AppLayout
      title="Lantai Produksi & Terminal Touchscreen 30 Menit"
      subtitle="Manajemen antrean pesanan, rate card borongan, dan pencatatan output interval (P0)"
      requiredModule="produksi"
    >
      {notice && (
        <Notice
          type={notice.type}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}

      {/* Action Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 10 }}>
          {isMandorOrOwner && (
            <button onClick={() => setNewOrderModal(true)} className="btn btn-primary">
              ➕ Buat Order Produksi Baru
            </button>
          )}
          <button onClick={loadOrders} className="btn btn-secondary btn-sm">
            🔄 Refresh Antrean
          </button>
        </div>

        <div className="badge badge-purple">
          ⏱️ Interval Verifikasi Pabrik: 30 Menit Rutin
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Order List */}
        <div className="card">
          <h3 style={{ fontSize: "1.05rem", marginBottom: 14 }}>Daftar Antrean Order (PO)</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {orders.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: 12 }}>
                {loading ? "Memuat antrean..." : "Belum ada order produksi."}
              </div>
            ) : (
              orders.map((ord) => {
                const isSelected = selectedOrder?.id === ord.id;
                return (
                  <button
                    key={ord.id}
                    onClick={() => handleSelectOrder(ord)}
                    style={{
                      textAlign: "left",
                      padding: "12px 14px",
                      borderRadius: "var(--radius-md)",
                      background: isSelected ? "var(--bg-surface-elevated)" : "var(--bg-secondary)",
                      border: `1px solid ${isSelected ? "var(--accent-primary)" : "var(--border-subtle)"}`,
                      color: "inherit",
                      cursor: "pointer",
                      transition: "all var(--transition-fast)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: "0.9rem", color: isSelected ? "var(--accent-primary)" : "var(--text-primary)" }}>
                        {ord.order_number}
                      </span>
                      <span className="badge badge-neutral" style={{ fontSize: "0.68rem" }}>
                        {ord.scheme}
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      <span>Target: {ord.target_quantity.toLocaleString("id-ID")} pcs</span>
                      <span className="badge badge-info" style={{ fontSize: "0.68rem" }}>
                        {ord.status}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Order Pipeline & Terminal */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {selectedOrder ? (
            <>
              {/* Order Status Stepper */}
              <div className="card-elevated">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <span className="badge badge-purple" style={{ marginBottom: 4 }}>
                      Skema: {selectedOrder.scheme}
                    </span>
                    <h2 style={{ fontSize: "1.4rem", margin: "4px 0" }}>
                      Order: {selectedOrder.order_number}
                    </h2>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      Target Pesanan: {selectedOrder.target_quantity.toLocaleString("id-ID")} pcs
                    </div>
                  </div>

                  {isMandorOrOwner && (
                    <div style={{ display: "flex", gap: 8 }}>
                      {selectedOrder.status === "SAMPLE" && (
                        <button onClick={() => handleAdvanceStatus("CUTTING")} className="btn btn-primary btn-sm">
                          Mulai Cutting →
                        </button>
                      )}
                      {selectedOrder.status === "CUTTING" && (
                        <button onClick={() => handleAdvanceStatus("SEWING")} className="btn btn-primary btn-sm">
                          Mulai Sewing →
                        </button>
                      )}
                      {selectedOrder.status === "SEWING" && (
                        <button onClick={() => handleAdvanceStatus("MENUNGGU_QC")} className="btn btn-warning btn-sm">
                          Ajukan ke QC →
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Visual Pipeline Bar */}
                <div style={{ display: "flex", gap: 6, margin: "16px 0" }}>
                  {STATUS_STEPS.map((step, idx) => {
                    const currentIndex = STATUS_STEPS.indexOf(selectedOrder.status);
                    const isDone = idx <= currentIndex;
                    const isCurrent = idx === currentIndex;
                    return (
                      <div
                        key={step}
                        style={{
                          flex: 1,
                          padding: "8px 6px",
                          borderRadius: "var(--radius-sm)",
                          background: isCurrent
                            ? "var(--accent-primary)"
                            : isDone
                            ? "var(--color-success-bg)"
                            : "var(--bg-secondary)",
                          border: `1px solid ${
                            isCurrent
                              ? "var(--accent-primary)"
                              : isDone
                              ? "var(--color-success-border)"
                              : "var(--border-subtle)"
                          }`,
                          textAlign: "center",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: isCurrent ? "#ffffff" : isDone ? "var(--color-success)" : "var(--text-muted)",
                        }}
                      >
                        {step}
                      </div>
                    );
                  })}
                </div>

                {/* Summary Progress */}
                {summary && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginBottom: 6 }}>
                      <span>Progres Verifikasi: {summary.total_output_verified} / {summary.target_quantity} pcs</span>
                      <span className="font-mono" style={{ fontWeight: 700, color: "var(--color-info)" }}>
                        {summary.percentage_completed.toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ width: "100%", height: 8, background: "var(--bg-secondary)", borderRadius: 4, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${Math.min(100, summary.percentage_completed)}%`,
                          height: "100%",
                          background: "linear-gradient(90deg, #3b82f6, #10b981)",
                          borderRadius: 4,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Terminal Touchscreen Input 30 Menit (FR-4.1) */}
              <div
                className="card-glass"
                style={{
                  border: "1px solid rgba(59, 130, 246, 0.3)",
                  background: "radial-gradient(ellipse at top, rgba(30, 58, 138, 0.2) 0%, rgba(15, 23, 42, 0.9) 100%)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div>
                    <h3 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: 8 }}>
                      🖥️ Terminal Touchscreen Lantai Produksi (Interval 30 Menit)
                    </h3>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Dirancang dengan tombol besar untuk memudahkan operator penjahit langsung di lantai kerja.
                    </div>
                  </div>
                  <span className="badge badge-info">Touch UI Enabled</span>
                </div>

                <div
                  style={{
                    background: "var(--bg-surface)",
                    padding: 20,
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div className="form-row" style={{ alignItems: "flex-end" }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Komponen yang Dikerjakan:</label>
                      <select
                        className="form-select"
                        value={terminalComponentId}
                        onChange={(e) => setTerminalComponentId(e.target.value)}
                      >
                        {selectedOrder.components?.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.component_name} (Target: {c.quantity_target} pcs)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Pcs Selesai (30 Menit Terakhir):</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        {[6, 12, 18, 24].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setTerminalQty(n)}
                            className={`btn ${terminalQty === n ? "btn-primary" : "btn-secondary"}`}
                            style={{ flex: 1, fontWeight: 700 }}
                          >
                            +{n}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
                    <input
                      type="number"
                      className="form-input"
                      value={terminalQty}
                      onChange={(e) => setTerminalQty(Number(e.target.value))}
                      min={1}
                      style={{ maxWidth: 140, fontSize: "1.2rem", fontWeight: 700, textAlign: "center" }}
                    />
                    <button
                      onClick={handleRecordOutput}
                      className="btn btn-primary btn-touch"
                      style={{ flex: 1 }}
                      disabled={selectedOrder.status !== "SEWING"}
                    >
                      ⚡ Simpan Output Borongan ({terminalQty} Pcs)
                    </button>
                  </div>
                  {selectedOrder.status !== "SEWING" && (
                    <div style={{ fontSize: "0.78rem", color: "var(--color-warning)", marginTop: 8 }}>
                      ⚠️ Terminal hanya menerima input saat status pesanan berada di <strong>SEWING</strong>.
                    </div>
                  )}
                </div>
              </div>

              {/* Log Output Terakhir & Verifikasi Mandor */}
              <div className="card">
                <h3 style={{ fontSize: "1.05rem", marginBottom: 14 }}>
                  Catatan Output Penjahit & Verifikasi Mandor Line
                </h3>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Interval Waktu</th>
                        <th>Komponen</th>
                        <th>Jumlah (Pcs)</th>
                        <th>Status Validasi</th>
                        <th>Aksi Mandor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outputs.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                            Belum ada catatan output untuk pesanan ini.
                          </td>
                        </tr>
                      ) : (
                        outputs.map((out) => (
                          <tr key={out.id}>
                            <td className="font-mono" style={{ fontSize: "0.8rem" }}>
                              {new Date(out.interval_start).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                              {" - "}
                              {new Date(out.interval_end).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                            </td>
                            <td style={{ fontWeight: 600 }}>{out.component_name || "Garmen"}</td>
                            <td className="font-mono" style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--text-primary)" }}>
                              {out.qty_completed} pcs
                            </td>
                            <td>
                              {out.is_verified ? (
                                <span className="badge badge-success">✅ Terverifikasi Mandor</span>
                              ) : (
                                <span className="badge badge-warning">⏳ Menunggu Verifikasi</span>
                              )}
                            </td>
                            <td>
                              {!out.is_verified && isMandorOrOwner && (
                                <button
                                  onClick={() => handleVerifyOutput(out.id)}
                                  className="btn btn-success btn-sm"
                                >
                                  Verifikasi 1-Klik
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="card" style={{ textAlign: "center", padding: 48, color: "var(--text-muted)" }}>
              Pilih order produksi dari daftar di sebelah kiri untuk melihat rincian alur kerja dan terminal input.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Order Produksi Baru */}
      <Modal
        isOpen={newOrderModal}
        onClose={() => setNewOrderModal(false)}
        title="➕ Buat Order Produksi Massal Baru"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await produksiApi.createOrder({
                client_id: "00000000-0000-0000-0000-000000000000",
                order_number: newOrderNumber,
                scheme: newOrderScheme,
                target_quantity: Number(newOrderTarget),
              });
              setNotice({ type: "success", message: `Order ${newOrderNumber} berhasil dibuat!` });
              setNewOrderModal(false);
              setNewOrderNumber("");
              loadOrders();
            } catch (err: any) {
              setNotice({ type: "danger", message: err.message || "Gagal membuat order." });
            }
          }}
        >
          <div className="form-group">
            <label className="form-label">Nomor Order / PO</label>
            <input
              type="text"
              className="form-input"
              placeholder="Contoh: PO-2026-LUKLA-001"
              value={newOrderNumber}
              onChange={(e) => setNewOrderNumber(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Skema Kerja Sama</label>
            <select
              className="form-select"
              value={newOrderScheme}
              onChange={(e: any) => setNewOrderScheme(e.target.value)}
            >
              <option value="CMT">CMT (Cut, Make, Trim - Bahan dari Klien)</option>
              <option value="SEMI_CMT">SEMI_CMT (Kain dari Klien, Aksesoris dari Pabrik)</option>
              <option value="FULL_PACKAGE">FULL_PACKAGE (Semua Bahan dari Pabrik)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Target Kuantitas (Pcs)</label>
            <input
              type="number"
              className="form-input"
              value={newOrderTarget}
              onChange={(e) => setNewOrderTarget(Number(e.target.value))}
              min={1}
              required
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setNewOrderModal(false)}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary">
              Simpan Order
            </button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
