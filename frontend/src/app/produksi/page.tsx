"use client";

import React, { useEffect, useState } from "react";
import { AppLayout } from "../../components/AppLayout";
import { Modal } from "../../components/Modal";
import { Notice } from "../../components/Notice";
import { useAuth } from "../../lib/auth-context";
import { produksiApi, authApi } from "../../lib/api";
import type { Order, ProductionOutput, OrderSummary, OrderStatus } from "../../types/api";

const STATUS_STEPS: OrderStatus[] = [
  "SAMPLE",
  "CUTTING",
  "SEWING",
  "MENUNGGU_QC",
  "QC",
  "COMPLETED",
];

function formatPending(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  if (Number.isNaN(ms) || ms < 0) return "-";
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  if (days <= 0) return `${rest} jam`;
  return `${days} hr ${rest} jam`;
}

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
  const [terminalOperatorId, setTerminalOperatorId] = useState("");

  // Check-in penjahit (mandor)
  const [workers, setWorkers] = useState<{ id: string; name: string; username: string }[]>([]);
  const [checkins, setCheckins] = useState<{
    id: string; user_id: string; user_name: string | null; order_id: string | null;
    line_number: number; task_category: string | null; checkin_at: string; checkout_at: string | null;
  }[]>([]);
  const [ciUserId, setCiUserId] = useState("");
  const [ciLine, setCiLine] = useState(1);
  const [ciTask, setCiTask] = useState("");

  // Modal new order
  const [newOrderModal, setNewOrderModal] = useState(false);
  const [newOrderNumber, setNewOrderNumber] = useState("");
  const [newOrderScheme, setNewOrderScheme] = useState<"CMT" | "SEMI_CMT" | "FULL_PACKAGE">("CMT");
  const [newOrderTarget, setNewOrderTarget] = useState(1000);
  const [newOrderClientId, setNewOrderClientId] = useState("");
  const [clients, setClients] = useState<{ id: string; company_name: string; client_code: string }[]>([]);

  // Modal tambah komponen
  const [compModalOpen, setCompModalOpen] = useState(false);
  const [compName, setCompName] = useState("");
  const [compCutting, setCompCutting] = useState(500);
  const [compSewing, setCompSewing] = useState(2500);

  const isMandorOrOwner = user?.role === "MANDOR" || user?.role === "OWNER";
  const isOwner = user?.role === "OWNER";

  const loadOrders = async () => {
    try {
      setLoading(true);
      const [list, clientList] = await Promise.all([
        produksiApi.getOrders(),
        authApi.getClients().catch(() => []),
      ]);
      setOrders(list);
      setClients(clientList);
      if (user?.role === "MANDOR" || user?.role === "OWNER") {
        const [w, ci] = await Promise.all([
          produksiApi.getWorkers().catch(() => []),
          produksiApi.getCheckins(true).catch(() => []),
        ]);
        setWorkers(w);
        setCheckins(ci);
        if (w.length > 0 && !ciUserId) setCiUserId(w[0].id);
      }
      if (clientList.length > 0 && !newOrderClientId) setNewOrderClientId(clientList[0].id);
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
      } else {
        setTerminalComponentId("");
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  // Catat Output 30 Menit (Penjahit / Mandor menunjuk id penjahit)
  const handleRecordOutput = async () => {
    if (!selectedOrder || !terminalComponentId) {
      setNotice({ type: "warning", message: "Pilih komponen terlebih dahulu." });
      return;
    }
    if (user?.role === "MANDOR" && !terminalOperatorId) {
      setNotice({ type: "warning", message: "Pilih penjahit pelaksana (dari check-in) terlebih dahulu." });
      return;
    }
    const now = new Date();
    const intervalStart = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
    const intervalEnd = now.toISOString();

    try {
      await produksiApi.recordOutput({
        order_id: selectedOrder.id,
        component_id: terminalComponentId,
        operator_user_id: user?.role === "MANDOR" ? terminalOperatorId : undefined,
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

  // Tambah komponen + rate ke order berjalan
  const handleAddComponent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    try {
      const updated = await produksiApi.addComponent(selectedOrder.id, {
        component_name: compName,
        cutting_rate_per_pcs: Number(compCutting),
        sewing_rate_per_pcs: Number(compSewing),
      });
      setSelectedOrder(updated);
      setCompModalOpen(false);
      setCompName("");
      setNotice({ type: "success", message: `Komponen ${compName} + rate tercatat.` });
      if (updated.components && updated.components.length > 0) {
        setTerminalComponentId(updated.components[updated.components.length - 1].id);
      }
      loadOrders();
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal menambah komponen." });
    }
  };

  // Check-in / checkout penjahit (Mandor)
  const handleCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await produksiApi.checkinWorker({
        user_id: ciUserId,
        order_id: selectedOrder?.id || null,
        line_number: Number(ciLine),
        task_category: ciTask || undefined,
      });
      setNotice({ type: "success", message: "Penjahit di-check-in ke line." });
      const ci = await produksiApi.getCheckins(true).catch(() => []);
      setCheckins(ci);
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal check-in." });
    }
  };

  const handleCheckout = async (checkinId: string) => {
    try {
      await produksiApi.checkoutWorker(checkinId);
      setNotice({ type: "success", message: "Check-out tercatat." });
      const ci = await produksiApi.getCheckins(true).catch(() => []);
      setCheckins(ci);
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal check-out." });
    }
  };

  // Rakit produk utuh → MENUNGGU_QC (FR-7.3/7.4)
  const handleAssemble = async () => {
    if (!selectedOrder) return;
    const input = window.prompt("Jumlah produk utuh hasil rakitan (pcs):", "100");
    if (input === null) return;
    const qty = Number(input);
    if (!qty || qty <= 0) {
      setNotice({ type: "warning", message: "Jumlah rakitan wajib lebih dari 0." });
      return;
    }
    try {
      await produksiApi.assembleOrder(selectedOrder.id, qty);
      setNotice({ type: "success", message: `Dirakit ${qty} pcs — order lanjut ke MENUNGGU_QC.` });
      const updated = await produksiApi.getOrderDetail(selectedOrder.id);
      setSelectedOrder(updated);
      loadOrders();
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal merakit produk." });
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
          {user?.role === "MANDOR" && (
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
                    {ord.status !== "COMPLETED" && (
                      <div style={{ fontSize: "0.75rem", color: "var(--color-warning)", marginTop: 4 }}>
                        ⏳ Terpending: {formatPending(ord.created_at)}
                      </div>
                    )}
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
                      {selectedOrder.status !== "COMPLETED" && (
                        <> • <strong style={{ color: "var(--color-warning)" }}>⏳ Terpending: {formatPending(selectedOrder.created_at)}</strong></>
                      )}
                    </div>
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: "0.8rem", fontWeight: 700 }}>Harga Jual:</span>
                      {selectedOrder.selling_price != null ? (
                        <span className="font-mono" style={{ fontWeight: 800 }}>
                          Rp {Number(selectedOrder.selling_price).toLocaleString("id-ID")}
                        </span>
                      ) : (
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>belum diusulkan</span>
                      )}
                      <span className={`badge ${
                        selectedOrder.selling_price_status === "DISETUJUI" ? "badge-success"
                        : selectedOrder.selling_price_status === "DIAJUKAN" ? "badge-warning"
                        : selectedOrder.selling_price_status === "DITOLAK" ? "badge-danger"
                        : "badge-neutral"
                      }`}>
                        {selectedOrder.selling_price_status && selectedOrder.selling_price_status !== "-" ? selectedOrder.selling_price_status : "BELUM DIAJUKAN"}
                      </span>
                      {user?.role === "MANDOR" && (
                        <button
                          onClick={() => {
                            const v = window.prompt("Usulan harga jual keseluruhan order (Rp):", selectedOrder.selling_price != null ? String(selectedOrder.selling_price) : "5000000");
                            if (v === null) return;
                            produksiApi.proposeSellingPrice(selectedOrder.id, Number(v))
                              .then(async (u) => {
                                setSelectedOrder(u);
                                setNotice({ type: "success", message: "Harga jual diusulkan — menunggu approve Owner." });
                              })
                              .catch((err: any) => setNotice({ type: "danger", message: err.message || "Gagal mengusulkan harga." }));
                          }}
                          className="btn btn-secondary btn-sm"
                        >
                          💰 Usulkan Harga
                        </button>
                      )}
                      {isOwner && selectedOrder.selling_price_status === "DIAJUKAN" && (
                        <>
                          <button
                            onClick={() => {
                              produksiApi.reviewSellingPrice(selectedOrder.id, true)
                                .then(async (u) => {
                                  setSelectedOrder(u);
                                  setNotice({ type: "success", message: "Harga jual DISETUJUI." });
                                })
                                .catch((err: any) => setNotice({ type: "danger", message: err.message || "Gagal menyetujui." }));
                            }}
                            className="btn btn-primary btn-sm"
                          >
                            Setujui Harga
                          </button>
                          <button
                            onClick={() => {
                              produksiApi.reviewSellingPrice(selectedOrder.id, false)
                                .then(async (u) => {
                                  setSelectedOrder(u);
                                  setNotice({ type: "warning", message: "Harga jual DITOLAK." });
                                })
                                .catch((err: any) => setNotice({ type: "danger", message: err.message || "Gagal menolak." }));
                            }}
                            className="btn btn-secondary btn-sm"
                          >
                            Tolak
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {isMandorOrOwner && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {(selectedOrder.status === "SAMPLE" ||
                        selectedOrder.status === "CUTTING" ||
                        selectedOrder.status === "SEWING") && !isOwner && (
                        <button onClick={() => setCompModalOpen(true)} className="btn btn-secondary btn-sm">
                          🧩 Tambah Komponen
                        </button>
                      )}                      {selectedOrder.status === "SAMPLE" && (
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
                        <>
                          <button onClick={handleAssemble} className="btn btn-warning btn-sm">
                            🧩 Rakit & Kirim ke QC
                          </button>
                          <button onClick={() => handleAdvanceStatus("MENUNGGU_QC")} className="btn btn-ghost btn-sm">
                            Lewati rakit →
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Komponen & Rate Borongan (edit rate: Mandor/Owner) */}
                <div className="card" style={{ margin: "16px 0" }}>
                  <h3 style={{ fontSize: "1rem", marginBottom: 12 }}>Komponen & Rate Borongan</h3>
                  {(selectedOrder.components?.length || 0) === 0 ? (
                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: 0 }}>
                      Belum ada komponen. {isMandorOrOwner && !isOwner ? "Tambahkan lewat tombol di atas." : ""}
                    </p>
                  ) : (
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Komponen</th>
                            <th>Rate Cutting</th>
                            <th>Rate Jahit</th>
                            {(user?.role === "MANDOR" || isOwner) && <th>Aksi</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedOrder.components?.map((c) => (
                            <tr key={c.id}>
                              <td className="font-mono">{c.sequence_order}</td>
                              <td style={{ fontWeight: 600 }}>{c.component_name}</td>
                              <td className="font-mono">Rp {c.rate_card ? Number(c.rate_card.cutting_rate_per_pcs).toLocaleString("id-ID") : "-"}</td>
                              <td className="font-mono">Rp {c.rate_card ? Number(c.rate_card.sewing_rate_per_pcs).toLocaleString("id-ID") : "-"}</td>
                              {(user?.role === "MANDOR" || isOwner) && (
                                <td>
                                  <button
                                    onClick={() => {
                                      const cut = window.prompt("Rate cutting baru (Rp/pcs):", String(c.rate_card?.cutting_rate_per_pcs ?? 0));
                                      if (cut === null) return;
                                      const sew = window.prompt("Rate jahit baru (Rp/pcs):", String(c.rate_card?.sewing_rate_per_pcs ?? 0));
                                      if (sew === null) return;
                                      produksiApi.setRateCard(c.id, { cutting_rate_per_pcs: Number(cut), sewing_rate_per_pcs: Number(sew) })
                                        .then(async () => {
                                          const updated = await produksiApi.getOrderDetail(selectedOrder.id);
                                          setSelectedOrder(updated);
                                          setNotice({ type: "success", message: "Rate tercatat di riwayat perubahan." });
                                        })
                                        .catch((err: any) => setNotice({ type: "danger", message: err.message || "Gagal ubah rate." }));
                                    }}
                                    className="btn btn-ghost btn-sm"
                                  >
                                    ✏️ Edit Rate
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
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
                      <span>
                        Progres Verifikasi: {summary.verified_completed ?? summary.total_output_verified ?? 0} / {summary.target_quantity ?? selectedOrder.target_quantity} pcs
                      </span>
                      <span className="font-mono" style={{ fontWeight: 700, color: "var(--color-info)" }}>
                        {Number(summary.completion_pct ?? summary.percentage_completed ?? 0).toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ width: "100%", height: 8, background: "var(--bg-secondary)", borderRadius: 4, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${Math.min(100, Number(summary.completion_pct ?? summary.percentage_completed ?? 0))}%`,
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

              {/* Check-in Penjahit (Mandor menempatkan ke line) */}
              {user?.role === "MANDOR" && (
                <div className="card">
                  <h3 style={{ fontSize: "1.05rem", marginBottom: 4 }}>✅ Check-in Penjahit ke Line</h3>
                  <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: 12 }}>
                    Penugasan dihitung dari check-in: nama, line, dan kategori yang dikerjakan.
                  </div>
                  <form onSubmit={handleCheckin} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 14 }}>
                    <div className="form-group" style={{ margin: 0, minWidth: 180 }}>
                      <label className="form-label">Penjahit</label>
                      <select className="form-select" value={ciUserId} onChange={(e) => setCiUserId(e.target.value)} required>
                        <option value="">Pilih penjahit</option>
                        {workers.map((w) => (
                          <option key={w.id} value={w.id}>{w.name} ({w.username})</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ margin: 0, maxWidth: 110 }}>
                      <label className="form-label">Line</label>
                      <input type="number" className="form-input" value={ciLine} onChange={(e) => setCiLine(Number(e.target.value))} min={1} required />
                    </div>
                    <div className="form-group" style={{ margin: 0, minWidth: 160 }}>
                      <label className="form-label">Kategori Tugas</label>
                      <input type="text" className="form-input" value={ciTask} onChange={(e) => setCiTask(e.target.value)} placeholder="Badan Depan" />
                    </div>
                    <button type="submit" className="btn btn-primary">Check-in</button>
                  </form>
                  {checkins.length > 0 ? (
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Penjahit</th>
                            <th>Line</th>
                            <th>Tugas</th>
                            <th>Sejak</th>
                            <th>Aksi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {checkins.map((c) => (
                            <tr key={c.id}>
                              <td style={{ fontWeight: 700 }}>{c.user_name || c.user_id.slice(0, 8)}</td>
                              <td className="font-mono">L{c.line_number}</td>
                              <td>{c.task_category || "-"}</td>
                              <td className="font-mono" style={{ fontSize: "0.78rem" }}>
                                {new Date(c.checkin_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                              </td>
                              <td>
                                <button onClick={() => handleCheckout(c.id)} className="btn btn-secondary btn-sm">
                                  Check-out
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", margin: 0 }}>
                      Belum ada penjahit check-in hari ini.
                    </p>
                  )}
                </div>
              )}

              {/* Terminal Touchscreen Input 30 Menit (FR-7.3/7.4) */}
              <div
                className="card-glass"
                style={{
                  border: "1px solid rgba(124, 58, 237, 0.35)",
                  background: "linear-gradient(160deg, #2E1065 0%, #1E0A45 100%)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                  <div>
                    <h3 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: 8, color: "#ffffff", margin: 0 }}>
                      🖥️ Terminal Touchscreen Lantai Produksi
                    </h3>
                    <div style={{ fontSize: "0.8rem", color: "#C4B5FD", marginTop: 4 }}>
                      {selectedOrder.order_number} •{" "}
                      <span className="badge badge-info">{selectedOrder.status}</span>{" "}
                      • Interval {(() => {
                        const now = new Date();
                        const slot = Math.floor((now.getHours() * 60 + now.getMinutes()) / 30);
                        const h = String(Math.floor(slot / 2)).padStart(2, "0");
                        return `${h}:${slot % 2 === 0 ? "00" : "30"}`;
                      })()}
                    </div>
                  </div>
                  <span className="badge badge-success">Touch UI Enabled</span>
                </div>

                {(selectedOrder.components?.length || 0) === 0 ? (
                  <div
                    style={{
                      background: "rgba(255, 255, 255, 0.06)",
                      padding: 24,
                      borderRadius: "var(--radius-lg)",
                      border: "1px dashed rgba(196, 181, 253, 0.5)",
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "2rem" }}>🧩</div>
                    <div style={{ color: "#ffffff", fontWeight: 700, margin: "8px 0 4px" }}>
                      Order ini belum punya komponen
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "#C4B5FD", marginBottom: 12 }}>
                      Tambahkan komponen + rate borongan dulu agar terminal bisa dipakai.
                    </div>
                    {isMandorOrOwner && !isOwner && (
                      <button onClick={() => setCompModalOpen(true)} className="btn btn-primary">
                        ➕ Tambah Komponen Pertama
                      </button>
                    )}
                  </div>
                ) : (
                <div
                  style={{
                    background: "#ffffff",
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
                        style={{ fontSize: "1rem", fontWeight: 600 }}
                      >
                        <option value="">— Pilih komponen —</option>
                        {selectedOrder.components?.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.component_name}
                            {c.rate_card ? ` — Rp ${Number(c.rate_card.sewing_rate_per_pcs).toLocaleString("id-ID")}/pcs` : ""}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Pcs Selesai (30 Menit Terakhir):</label>
                      <input
                        type="number"
                        className="form-input"
                        value={terminalQty}
                        onChange={(e) => setTerminalQty(Number(e.target.value))}
                        min={1}
                        aria-label="Jumlah pcs 30 menit terakhir"
                        style={{ fontSize: "1.1rem", fontWeight: 700, textAlign: "center", padding: "12px" }}
                      />
                    </div>
                    {user?.role === "MANDOR" && (
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label">ID Penjahit Pelaksana (check-in):</label>
                        <select
                          className="form-select"
                          value={terminalOperatorId}
                          onChange={(e) => setTerminalOperatorId(e.target.value)}
                          style={{ fontSize: "1rem", fontWeight: 600 }}
                        >
                          <option value="">— Pilih penjahit —</option>
                          {checkins.map((c) => (
                            <option key={c.id} value={c.user_id}>
                              {c.user_name || c.user_id.slice(0, 8)} — Line {c.line_number}{c.task_category ? ` (${c.task_category})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div style={{ marginTop: 16, display: "flex", gap: 12, alignItems: "center" }}>
                    {isOwner ? (
                      <div className="notice notice-info" style={{ flex: 1 }}>
                        <span>👁️</span>
                        <div style={{ fontSize: "0.82rem" }}>Mode pantau — pencatatan output dilakukan Penjahit/Mandor.</div>
                      </div>
                    ) : (
                      <button
                        onClick={handleRecordOutput}
                        className="btn btn-primary btn-touch"
                        style={{ flex: 1 }}
                        disabled={selectedOrder.status !== "SEWING" || !terminalComponentId || (user?.role === "MANDOR" && !terminalOperatorId)}
                      >
                        ⚡ Simpan Output Borongan ({terminalQty} Pcs)
                      </button>
                    )}
                  </div>
                  {selectedOrder.status !== "SEWING" ? (
                    <div style={{ fontSize: "0.78rem", color: "var(--color-warning)", marginTop: 8 }}>
                      ⚠️ Terminal hanya menerima input saat status pesanan berada di <strong>SEWING</strong> (kini: {selectedOrder.status}).
                    </div>
                  ) : !terminalComponentId ? (
                    <div style={{ fontSize: "0.78rem", color: "var(--color-info)", marginTop: 8 }}>
                      👆 Pilih komponen dulu untuk mengaktifkan tombol simpan.
                    </div>
                  ) : null}
                </div>
                )}
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
                        <th>ID Penjahit</th>
                        <th>Komponen</th>
                        <th>Jumlah (Pcs)</th>
                        <th>Status Validasi</th>
                        <th>Aksi Mandor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outputs.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                            Belum ada catatan output untuk pesanan ini.
                          </td>
                        </tr>
                      ) : (
                        outputs.map((out) => {
                          const compName =
                            selectedOrder.components?.find((c) => c.id === (out.order_component_id || out.component_id))?.component_name
                            || out.component_name
                            || "Garmen";
                          const when = out.time_window || out.interval_start;
                          const opName =
                            checkins.find((c) => c.user_id === out.operator_user_id)?.user_name
                            || out.operator?.name
                            || out.operator_user_id.slice(0, 8);
                          return (
                          <tr key={out.id}>
                            <td className="font-mono" style={{ fontSize: "0.8rem" }}>
                              {when ? new Date(when).toLocaleString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "-"}
                            </td>
                            <td style={{ fontWeight: 700 }}>{opName}</td>
                            <td style={{ fontWeight: 600 }}>{compName}</td>
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
                          );
                        })
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
                client_id: newOrderClientId,
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
            <label className="form-label">Klien Pemilik Order</label>
            <select
              className="form-select"
              value={newOrderClientId}
              onChange={(e) => setNewOrderClientId(e.target.value)}
              required
            >
              <option value="">Pilih klien</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name} ({c.client_code})
                </option>
              ))}
            </select>
          </div>

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

      {/* Modal: Tambah Komponen + Rate */}
      <Modal
        isOpen={compModalOpen}
        onClose={() => setCompModalOpen(false)}
        title="🧩 Tambah Komponen + Rate Borongan"
      >
        <form onSubmit={handleAddComponent}>
          <div className="form-group">
            <label className="form-label">Nama Komponen</label>
            <input
              type="text"
              className="form-input"
              value={compName}
              onChange={(e) => setCompName(e.target.value)}
              placeholder="Contoh: Badan Depan, Lengan, Kerah"
              required
            />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Rate Cutting (Rp/pcs)</label>
              <input type="number" className="form-input" value={compCutting} onChange={(e) => setCompCutting(Number(e.target.value))} min={0} required />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Rate Jahit (Rp/pcs)</label>
              <input type="number" className="form-input" value={compSewing} onChange={(e) => setCompSewing(Number(e.target.value))} min={0} required />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setCompModalOpen(false)}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary">
              Simpan Komponen
            </button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
