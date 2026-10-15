"use client";

import React, { useEffect, useState } from "react";
import { AppLayout } from "../../components/AppLayout";
import { Modal } from "../../components/Modal";
import { Notice } from "../../components/Notice";
import { qcApi, produksiApi } from "../../lib/api";
import type { Order, QCInspection, QCBatchSummary, BonusPoolPreview } from "../../types/api";

export default function QCPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [inspections, setInspections] = useState<QCInspection[]>([]);
  const [summary, setSummary] = useState<QCBatchSummary | null>(null);
  const [bonusPool, setBonusPool] = useState<BonusPoolPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);

  // Form input inspection
  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [qtyInspected, setQtyInspected] = useState(50);
  const [result, setResult] = useState<"LOLOS" | "REPAIR" | "DEFECT">("LOLOS");
  const [defectType, setDefectType] = useState("Jahitan Loncat / Lepas");
  const [defectNotes, setDefectNotes] = useState("");
  const [repairCount, setRepairCount] = useState(1);

  const loadData = async () => {
    try {
      setLoading(true);
      const [orderList, pool] = await Promise.all([
        produksiApi.getOrders(),
        qcApi.getBonusPoolPreview().catch(() => null),
      ]);
      setOrders(orderList);
      setBonusPool(pool);
      if (orderList.length > 0) {
        handleSelectOrder(orderList[0].id);
      }
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal memuat data QC." });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOrder = async (orderId: string) => {
    setSelectedOrderId(orderId);
    try {
      const [insp, sum] = await Promise.all([
        qcApi.getInspections(orderId).catch(() => []),
        qcApi.getOrderSummary(orderId).catch(() => null),
      ]);
      setInspections(insp);
      setSummary(sum);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleRecordInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrderId) return;
    try {
      await qcApi.recordInspection({
        order_id: selectedOrderId,
        qty_inspected: Number(qtyInspected),
        result,
        defect_type: result !== "LOLOS" ? defectType : undefined,
        defect_notes: defectNotes || undefined,
        repair_count: result !== "LOLOS" ? Number(repairCount) : 1,
      });
      const isEscalated = result !== "LOLOS" && Number(repairCount) >= 3;
      setNotice({
        type: isEscalated ? "warning" : "success",
        message: isEscalated
          ? `Inspeksi ${qtyInspected} pcs [${result}] (Perbaikan ke-${repairCount}) berhasil dicatat. ⚠️ Otomatis dieskalasi ke Tim Sampel!`
          : `Inspeksi ${qtyInspected} pcs [${result}] berhasil dicatat! Pool bonus diperbarui.`,
      });
      setInspectModalOpen(false);
      setRepairCount(1);
      handleSelectOrder(selectedOrderId);
      // Refresh pool bonus preview
      const updatedPool = await qcApi.getBonusPoolPreview();
      setBonusPool(updatedPool);
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal mencatat inspeksi QC." });
    }
  };

  return (
    <AppLayout
      title="Quality Control (QC) & Pool Bonus Mandor"
      subtitle="Manajemen cacat garmen & kalkulasi bonus kualitas mandor otomatis (Skenario 3 - P0)"
      requiredModule="qc"
    >
      {notice && (
        <Notice
          type={notice.type}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}

      {/* Top Banner: Pool Bonus QC Live Preview */}
      <div
        className="card-elevated"
        style={{
          marginBottom: 28,
          background: "linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 23, 42, 0.8) 100%)",
          border: "1px solid var(--color-success-border)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div>
            <span className="badge badge-success" style={{ marginBottom: 6 }}>
              Skenario 3: Pool Bonus Kualitas
            </span>
            <h2 style={{ fontSize: "1.35rem", margin: "4px 0" }}>
              Pool Bonus QC Mandor Line
            </h2>
            <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
              Rumus: <strong>Qty Lolos × Rp 150/pcs</strong>, dibagi rata secara adil ke seluruh Mandor Line + Kepala Operasional.
            </div>
          </div>

          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", textTransform: "uppercase" }}>
                Total Pool Bonus Terkumpul
              </div>
              <div className="font-mono" style={{ fontSize: "1.8rem", fontWeight: 800, color: "var(--color-success)" }}>
                Rp {bonusPool?.total_bonus_pool ? bonusPool.total_bonus_pool.toLocaleString("id-ID") : "0"}
              </div>
            </div>

            <div
              style={{
                background: "var(--bg-surface)",
                padding: "8px 14px",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>Per Mandor:</div>
              <div className="font-mono" style={{ fontWeight: 700, color: "var(--color-info)", fontSize: "1.1rem" }}>
                Rp {bonusPool?.bonus_per_mandor ? bonusPool.bonus_per_mandor.toLocaleString("id-ID") : "0"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Orders & Inspections */}
      <div
        className="split-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Order Selector */}
        <div className="card">
          <h3 style={{ fontSize: "1.05rem", marginBottom: 14 }}>Pilih Pesanan untuk Inspeksi</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {orders.map((ord) => {
              const isSelected = selectedOrderId === ord.id;
              return (
                <button
                  key={ord.id}
                  onClick={() => handleSelectOrder(ord.id)}
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
                  <div style={{ fontWeight: 700, fontSize: "0.9rem", color: isSelected ? "var(--accent-primary)" : "var(--text-primary)" }}>
                    {ord.order_number}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    Status: {ord.status}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Inspection Details & Form */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {selectedOrderId ? (
            <>
              {/* Batch Summary Stats */}
              <div className="stats-grid" style={{ marginBottom: 0 }}>
                <div className="stat-card">
                  <div className="stat-label">Total Diinspeksi</div>
                  <div className="stat-value">{summary?.total_inspected ?? 0} pcs</div>
                  <div className="stat-meta">Hasil Sampling Batch</div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">LOLOS (Grade A)</div>
                  <div className="stat-value" style={{ color: "var(--color-success)" }}>
                    {summary?.total_lolos ?? 0} pcs
                  </div>
                  <div className="stat-meta">Memenuhi standar QC</div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">REPAIR (Dikerjakan Ulang)</div>
                  <div className="stat-value" style={{ color: "var(--color-warning)" }}>
                    {summary?.total_repair ?? 0} pcs
                  </div>
                  <div className="stat-meta">Perbaikan jahitan/kancing</div>
                </div>

                <div className="stat-card">
                  <div className="stat-label">DEFECT (BS / Rusak)</div>
                  <div className="stat-value" style={{ color: "var(--color-danger)" }}>
                    {summary?.total_defect ?? 0} pcs
                  </div>
                  <div className="stat-meta">Kain bolong / noda mati</div>
                </div>
              </div>

              {/* Action Button */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <button onClick={() => setInspectModalOpen(true)} className="btn btn-primary">
                  🔍 Catat Hasil Inspeksi Batch Baru
                </button>
              </div>

              {/* Inspection Records Table */}
              <div className="card">
                <h3 style={{ fontSize: "1.05rem", marginBottom: 14 }}>
                  Riwayat Catatan Inspeksi Batch
                </h3>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Waktu Inspeksi</th>
                        <th>Jumlah</th>
                        <th>Hasil Evaluasi</th>
                        <th>Jenis Cacat (Defect)</th>
                        <th>Rute Tindakan</th>
                        <th>Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inspections.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                            Belum ada catatan inspeksi untuk pesanan ini.
                          </td>
                        </tr>
                      ) : (
                        inspections.map((insp) => {
                          const statusResult = insp.status || insp.result;
                          const defectCat = insp.defect_category || insp.defect_type;
                          const notes = insp.notes || insp.defect_notes;
                          const route = insp.action_route
                            || (statusResult === "LOLOS" ? "GUDANG_BARANG_JADI"
                              : statusResult === "REPAIR" ? "LINE_REPAIR" : "SCRAP_DISPOSAL");
                          const routeLabel: Record<string, string> = {
                            GUDANG_BARANG_JADI: "→ Gudang Barang Jadi",
                            LINE_REPAIR: "→ Kembali ke Line",
                            SCRAP_DISPOSAL: "→ Scrap Disposal",
                          };
                          const isEscalated = (insp.repair_count && insp.repair_count >= 3) || insp.escalated_to_sample;
                          return (
                            <tr key={insp.id}>
                              <td className="font-mono" style={{ fontSize: "0.8rem" }}>
                                {new Date(insp.inspected_at).toLocaleString("id-ID")}
                              </td>
                              <td className="font-mono" style={{ fontWeight: 700, fontSize: "1rem" }}>
                                {insp.qty_inspected} pcs
                              </td>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                  <span
                                    className={`badge ${
                                      statusResult === "LOLOS"
                                        ? "badge-success"
                                        : statusResult === "REPAIR"
                                        ? "badge-warning"
                                        : "badge-danger"
                                    }`}
                                  >
                                    {statusResult}
                                  </span>
                                  {statusResult !== "LOLOS" && insp.repair_count && (
                                    <span className="badge badge-secondary" style={{ fontSize: "0.7rem" }}>
                                      Perbaikan ke-{insp.repair_count}
                                    </span>
                                  )}
                                  {isEscalated && (
                                    <span className="badge badge-coral" style={{ fontSize: "0.7rem", fontWeight: 700 }}>
                                      ⚠️ Eskalasi Tim Sampel
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td style={{ color: defectCat ? "var(--color-danger)" : "var(--text-muted)" }}>
                                {defectCat || "-"}
                              </td>
                              <td>
                                <span className="badge badge-purple" style={{ fontSize: "0.72rem" }}>
                                  {routeLabel[route] || route}
                                </span>
                              </td>
                              <td style={{ fontSize: "0.82rem" }}>{notes || "-"}</td>
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
              Pilih pesanan di sebelah kiri untuk melihat rekam mutu QC.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Input Inspeksi QC */}
      <Modal
        isOpen={inspectModalOpen}
        onClose={() => setInspectModalOpen(false)}
        title="🔍 Form Catat Inspeksi QC"
      >
        <form onSubmit={handleRecordInspection}>
          <div className="form-group">
            <label className="form-label">Jumlah Pcs Diinspeksi</label>
            <input
              type="number"
              className="form-input"
              value={qtyInspected}
              onChange={(e) => setQtyInspected(Number(e.target.value))}
              min={1}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Hasil Penilaian QC</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <button
                type="button"
                onClick={() => setResult("LOLOS")}
                className={`btn ${result === "LOLOS" ? "btn-success" : "btn-secondary"}`}
              >
                ✅ LOLOS
              </button>
              <button
                type="button"
                onClick={() => setResult("REPAIR")}
                className={`btn ${result === "REPAIR" ? "btn-warning" : "btn-secondary"}`}
              >
                ⚠️ REPAIR
              </button>
              <button
                type="button"
                onClick={() => setResult("DEFECT")}
                className={`btn ${result === "DEFECT" ? "btn-danger" : "btn-secondary"}`}
              >
                ⛔ DEFECT
              </button>
            </div>
          </div>

          {result !== "LOLOS" && (
            <>
              <div className="form-group">
                <label className="form-label">Siklus Perbaikan ke-</label>
                <select
                  className="form-select"
                  value={repairCount}
                  onChange={(e) => setRepairCount(Number(e.target.value))}
                >
                  <option value={1}>Perbaikan ke-1 (Re-sew standard)</option>
                  <option value={2}>Perbaikan ke-2 (Re-check operator)</option>
                  <option value={3}>Perbaikan ke-3 (Batas Toleransi - Eskalasi Tim Sampel)</option>
                  <option value={4}>Perbaikan ke-4+ (Kritis)</option>
                </select>
                {repairCount >= 3 && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: "8px 12px",
                      background: "rgba(223, 105, 81, 0.12)",
                      border: "1px solid var(--jadoo-coral)",
                      borderRadius: "var(--radius-sm)",
                      fontSize: "0.8rem",
                      color: "var(--jadoo-coral)",
                      fontWeight: 600,
                    }}
                  >
                    ⚠️ Sesuai Activity Diagram Alur Final: Karena sudah mencapai 3x perbaikan, laporan barang cacat ini akan otomatis dikirim ke Tim Sampel untuk peninjauan time study &amp; bill of material (BOM).
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Kategori Cacat (Defect)</label>
                <select
                  className="form-select"
                  value={defectType}
                  onChange={(e) => setDefectType(e.target.value)}
                >
                  <option value="Jahitan Loncat / Lepas">Jahitan Loncat / Lepas</option>
                  <option value="Toleransi Ukuran Meleset">Toleransi Ukuran Meleset (&gt;1.5cm)</option>
                  <option value="Kain Bolong / Tarik Benang">Kain Bolong / Tarik Benang</option>
                  <option value="Noda Minyak Mesin">Noda Minyak Mesin</option>
                  <option value="Label Miring / Terbalik">Label Miring / Terbalik</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Keterangan Tambahan / Tindakan</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Contoh: Dikerjakan ulang oleh Line 1 meja 4"
                  value={defectNotes}
                  onChange={(e) => setDefectNotes(e.target.value)}
                />
              </div>
            </>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setInspectModalOpen(false)}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary">
              Simpan Hasil QC
            </button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
