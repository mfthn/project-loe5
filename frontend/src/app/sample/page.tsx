"use client";

import React, { useEffect, useState, useRef } from "react";
import { AppLayout } from "../../components/AppLayout";
import { Modal } from "../../components/Modal";
import { Notice } from "../../components/Notice";
import { sampleApi, qcApi } from "../../lib/api";
import type { Sample, SampleVersion, GarmentComponent, QCInspection } from "../../types/api";

export default function SamplePage() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
  const [escalations, setEscalations] = useState<QCInspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);

  // Stopwatch state
  const [elapsedMs, setElapsedMs] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  // Component selection for time study
  const [selectedComponentId, setSelectedComponentId] = useState<string>("");
  const [studyNotes, setStudyNotes] = useState("");

  // Modals
  const [newSampleModal, setNewSampleModal] = useState(false);
  const [newVersionModal, setNewVersionModal] = useState(false);
  const [newComponentModal, setNewComponentModal] = useState(false);

  // Form states
  const [sampleCode, setSampleCode] = useState("");
  const [sampleItemName, setSampleItemName] = useState("");
  const [componentName, setComponentName] = useState("");
  const [fabricConsumption, setFabricConsumption] = useState(0.45);

  const loadSamples = async () => {
    try {
      setLoading(true);
      const [list, escList] = await Promise.all([
        sampleApi.getSamples(),
        qcApi.getEscalations().catch(() => []),
      ]);
      setSamples(list);
      setEscalations(escList);
      if (list.length > 0) {
        // Load detail of first sample
        const detail = await sampleApi.getSampleDetail(list[0].id);
        setSelectedSample(detail);
      }
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal memuat katalog sampel." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSamples();
  }, []);

  const handleSelectSample = async (id: string) => {
    try {
      const detail = await sampleApi.getSampleDetail(id);
      setSelectedSample(detail);
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal membuka sampel." });
    }
  };

  // Stopwatch Controls
  const startStopwatch = () => {
    if (!timerRunning) {
      setTimerRunning(true);
      startTimeRef.current = Date.now() - elapsedMs;
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 50);
    }
  };

  const pauseStopwatch = () => {
    if (timerRunning) {
      setTimerRunning(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resetStopwatch = () => {
    setTimerRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setElapsedMs(0);
  };

  // Format Elapsed Time: mm:ss.ms
  const formatTime = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const mins = Math.floor(totalSecs / 60);
    const secs = totalSecs % 60;
    const tenths = Math.floor((ms % 1000) / 100);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}.${tenths}`;
  };

  // Submit Time Study from Stopwatch
  const handleSaveTimeStudy = async () => {
    if (!selectedComponentId) {
      setNotice({ type: "warning", message: "Pilih komponen garmen terlebih dahulu untuk mencatat time study." });
      return;
    }
    const durationSeconds = Math.max(1, Math.round(elapsedMs / 1000));
    try {
      await sampleApi.recordTimeStudy(selectedComponentId, {
        duration_seconds: durationSeconds,
        notes: studyNotes || `Time study stopwatch digital: ${durationSeconds} detik`,
      });
      setNotice({
        type: "success",
        message: `Tercatat: ${durationSeconds} detik untuk komponen yang dipilih!`,
      });
      resetStopwatch();
      setStudyNotes("");
      if (selectedSample) {
        handleSelectSample(selectedSample.id);
      }
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal menyimpan time study." });
    }
  };

  // Approve Version Tahap 1 (tim sample)
  const handleApproveVersion = async (versionId: string) => {
    try {
      await sampleApi.approveVersion(versionId);
      setNotice({
        type: "success",
        message: "Tahap 1 lolos! Versi APPROVED — menunggu approval owner beserta harga.",
      });
      if (selectedSample) {
        handleSelectSample(selectedSample.id);
      }
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal menyetujui versi sampel." });
    }
  };

  // Owner approval tahap 2 (produk + harga)
  const [ownerModalOpen, setOwnerModalOpen] = useState(false);
  const [ownerPrice, setOwnerPrice] = useState(45000);
  const [ownerNotes, setOwnerNotes] = useState("");

  const handleApproveOwner = async () => {
    if (!activeVersion) return;
    try {
      await sampleApi.approveOwner(activeVersion.id, {
        agreed_price: Number(ownerPrice),
        costing_notes: ownerNotes || undefined,
      });
      setNotice({
        type: "success",
        message: `Owner APPROVED Rp ${Number(ownerPrice).toLocaleString("id-ID")}/pcs — versi siap jadi order massal.`,
      });
      setOwnerModalOpen(false);
      if (selectedSample) handleSelectSample(selectedSample.id);
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal approval owner." });
    }
  };

  const handleRejectOwner = async (versionId: string) => {
    const reason = window.prompt("Alasan penolakan owner:");
    if (reason === null) return;
    try {
      await sampleApi.rejectOwner(versionId, reason || undefined);
      setNotice({ type: "warning", message: "Versi DITOLAK owner — buat revisi baru untuk lanjut." });
      if (selectedSample) handleSelectSample(selectedSample.id);
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal menolak versi." });
    }
  };

  // Active latest version
  const activeVersion =
    selectedSample?.versions && selectedSample.versions.length > 0
      ? selectedSample.versions[selectedSample.versions.length - 1]
      : null;

  return (
    <AppLayout
      title="Sample & Stopwatch Time Study Tracker"
      subtitle="Pengembangan prototipe, versi approval, dan pengukuran detik penjahitan (Skenario 4 - P0)"
      requiredModule="sample"
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
        <button onClick={() => setNewSampleModal(true)} className="btn btn-primary">
          ➕ Buat Sampel Baru
        </button>

        <span className="badge badge-info">
          ⏱️ Skenario 4: Stopwatch Pengukuran Detik Riil
        </span>
      </div>

      {/* Activity Diagram: Analisa Laporan Cacat dari Kepala Produksi (Eskalasi 3x Repair) */}
      <div
        className="card-elevated"
        style={{
          marginBottom: 24,
          background: escalations.length > 0 ? "linear-gradient(135deg, rgba(223, 105, 81, 0.08) 0%, #ffffff 100%)" : "#ffffff",
          border: `1px solid ${escalations.length > 0 ? "var(--jadoo-coral)" : "var(--border-subtle)"}`,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="badge badge-coral">Alur Final: Escalation Loop</span>
            <h3 style={{ margin: 0, fontSize: "1.1rem", color: "var(--jadoo-ink)" }}>
              Analisa Laporan Cacat dari Kepala Produksi (3x Repair)
            </h3>
          </div>
          <span className="font-mono" style={{ fontSize: "0.85rem", fontWeight: 700, color: escalations.length > 0 ? "var(--color-danger)" : "var(--color-success)" }}>
            {escalations.length} Laporan Butuh Analisa
          </span>
        </div>

        {escalations.length === 0 ? (
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            ✅ Tidak ada eskalasi perbaikan berulang dari Kepala Produksi. Lini menjahit berjalan sesuai time study dan toleransi BOM.
          </p>
        ) : (
          <div className="table-container" style={{ marginTop: 8 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Order Ref</th>
                  <th>Qty Cacat</th>
                  <th>Kategori Defect</th>
                  <th>Catatan Kepala Produksi</th>
                  <th>Tindakan Tim Sampel</th>
                </tr>
              </thead>
              <tbody>
                {escalations.map((esc) => (
                  <tr key={esc.id}>
                    <td className="font-mono" style={{ fontSize: "0.8rem" }}>
                      {new Date(esc.inspected_at).toLocaleDateString("id-ID")}
                    </td>
                    <td className="font-mono" style={{ fontWeight: 600 }}>
                      PO #{esc.order_id.slice(0, 8)}
                    </td>
                    <td className="font-mono" style={{ fontWeight: 700, color: "var(--color-danger)" }}>
                      {esc.qty_inspected} pcs
                    </td>
                    <td>
                      <span className="badge badge-warning">
                        {esc.defect_category || esc.defect_type || "Cacat Produksi"}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.82rem" }}>
                      {esc.notes || esc.defect_notes || "Melebihi batas 3x repair di lini."}
                    </td>
                    <td>
                      <span className="badge badge-purple" style={{ fontSize: "0.75rem" }}>
                        Kaji Ulang Detik Sewing &amp; Pola
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div
        className="split-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "300px 1fr",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* Sample List Sidebar */}
        <div className="card">
          <h3 style={{ fontSize: "1.05rem", marginBottom: 12 }}>Katalog Sampel</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {samples.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", padding: 12 }}>
                {loading ? "Memuat katalog..." : "Belum ada sampel terdaftar."}
              </div>
            ) : (
              samples.map((s) => {
                const isSelected = selectedSample?.id === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleSelectSample(s.id)}
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
                    <div style={{ fontWeight: 700, fontSize: "0.88rem", color: isSelected ? "var(--accent-primary)" : "var(--text-primary)" }}>
                      {s.sample_code}
                    </div>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-secondary)" }}>
                      {s.item_name}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Sample Detail & Stopwatch */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {selectedSample ? (
            <>
              {/* Header Info */}
              <div className="card-elevated">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <span className="badge badge-purple" style={{ marginBottom: 6 }}>
                      Kode: {selectedSample.sample_code}
                    </span>
                    <h2 style={{ fontSize: "1.35rem", margin: "4px 0" }}>
                      {selectedSample.item_name}
                    </h2>
                    <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                      Dibuat pada: {new Date(selectedSample.created_at).toLocaleDateString("id-ID")}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {activeVersion && (
                      <span
                        className={`badge ${
                          activeVersion.status === "OWNER_APPROVED"
                            ? "badge-success"
                            : activeVersion.status === "APPROVED"
                            ? "badge-info"
                            : activeVersion.status === "OWNER_REJECTED"
                            ? "badge-danger"
                            : activeVersion.status === "REVISION"
                            ? "badge-warning"
                            : "badge-neutral"
                        }`}
                        style={{ fontSize: "0.85rem", padding: "6px 14px" }}
                      >
                        Versi v{activeVersion.version_number} : {activeVersion.status}
                        {activeVersion.status === "OWNER_APPROVED" && activeVersion.agreed_price != null
                          ? ` — Rp ${Number(activeVersion.agreed_price).toLocaleString("id-ID")}/pcs`
                          : ""}
                      </span>
                    )}

                    {activeVersion &&
                      (activeVersion.status === "DRAFT" || activeVersion.status === "REVISION") && (
                        <button
                          onClick={() => handleApproveVersion(activeVersion.id)}
                          className="btn btn-success btn-sm"
                        >
                          ✅ Setujui Tahap 1 (Tim Sample)
                        </button>
                      )}

                    {activeVersion && activeVersion.status === "APPROVED" && (
                      <>
                        <button onClick={() => setOwnerModalOpen(true)} className="btn btn-primary btn-sm">
                          💰 Approve Owner + Harga
                        </button>
                        <button
                          onClick={() => handleRejectOwner(activeVersion.id)}
                          className="btn btn-secondary btn-sm"
                        >
                          ❌ Tolak Owner
                        </button>
                      </>
                    )}

                    {activeVersion && activeVersion.status === "OWNER_APPROVED" && (
                      <span className="badge badge-success">
                        Siap dikonversi ke order massal
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stopwatch Time Study Panel (Interactive Feature) */}
              <div
                className="card-glass"
                style={{
                  border: "1px solid rgba(56, 189, 248, 0.3)",
                  background: "radial-gradient(ellipse at top, rgba(14, 165, 233, 0.1) 0%, rgba(15, 23, 42, 0.8) 100%)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: "1.1rem", display: "flex", alignItems: "center", gap: 8 }}>
                      ⏱️ Stopwatch Digital Time Study (Detik)
                    </h3>
                    <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                      Ukur waktu penjahitan per komponen secara presisi untuk standardisasi upah borongan.
                    </div>
                  </div>
                  <span className="badge badge-info">Stopwatch Presisi ±50ms</span>
                </div>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "column",
                    gap: 16,
                    padding: "20px 0",
                  }}
                >
                  <div className="digital-clock">{formatTime(elapsedMs)}</div>

                  {/* Stopwatch Buttons */}
                  <div style={{ display: "flex", gap: 12 }}>
                    {!timerRunning ? (
                      <button onClick={startStopwatch} className="btn btn-primary btn-lg">
                        ▶ Mulai Stopwatch
                      </button>
                    ) : (
                      <button onClick={pauseStopwatch} className="btn btn-warning btn-lg">
                        ⏸ Jeda
                      </button>
                    )}
                    <button onClick={resetStopwatch} className="btn btn-secondary btn-lg">
                      🔄 Reset
                    </button>
                  </div>
                </div>

                {/* Save Time Study to Component */}
                <div
                  style={{
                    background: "var(--bg-surface)",
                    padding: 18,
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-subtle)",
                    marginTop: 10,
                  }}
                >
                  <div className="form-row">
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Tautkan ke Komponen Garmen:</label>
                      <select
                        className="form-select"
                        value={selectedComponentId}
                        onChange={(e) => setSelectedComponentId(e.target.value)}
                      >
                        <option value="">-- Pilih Komponen --</option>
                        {activeVersion?.components?.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.component_name} (Konsumsi: {c.fabric_consumption ?? "-"} m)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">Catatan Operator Time Study:</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Contoh: Mesin overdeck jarum 2, operator terampil"
                        value={studyNotes}
                        onChange={(e) => setStudyNotes(e.target.value)}
                      />
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                    <button
                      onClick={handleSaveTimeStudy}
                      className="btn btn-success"
                      disabled={elapsedMs === 0 || !selectedComponentId}
                    >
                      💾 Simpan Rekam Time Study (
                      {Math.max(1, Math.round(elapsedMs / 1000))} Detik)
                    </button>
                  </div>
                </div>
              </div>

              {/* Garment Components Table */}
              <div className="card">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <h3 style={{ fontSize: "1.05rem" }}>
                    Daftar Komponen Garmen (Versi v{activeVersion?.version_number ?? 1})
                  </h3>
                  <button
                    onClick={() => setNewComponentModal(true)}
                    className="btn btn-secondary btn-sm"
                    disabled={
                      activeVersion?.status === "APPROVED" ||
                      activeVersion?.status === "OWNER_APPROVED" ||
                      activeVersion?.status === "OWNER_REJECTED"
                    }
                  >
                    ➕ Tambah Komponen
                  </button>
                </div>

                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Nama Komponen</th>
                        <th>Konsumsi Kain (m/pcs)</th>
                        <th>Jumlah Studi Waktu</th>
                        <th>Rata-rata Waktu</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!activeVersion?.components || activeVersion.components.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: "center", padding: 20, color: "var(--text-muted)" }}>
                            Belum ada komponen pada versi ini.
                          </td>
                        </tr>
                      ) : (
                        activeVersion.components.map((c) => (
                          <tr key={c.id}>
                            <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                              {c.component_name}
                            </td>
                            <td className="font-mono">{c.fabric_consumption ?? "0.0"} m</td>
                            <td className="font-mono">
                              {c.time_studies?.length ?? 0} kali uji
                            </td>
                            <td className="font-mono" style={{ color: "var(--color-info)", fontWeight: 700 }}>
                              {c.average_duration_seconds ? `${c.average_duration_seconds} dtk` : "-"}
                            </td>
                            <td>
                              <button
                                onClick={() => setSelectedComponentId(c.id)}
                                className="btn btn-ghost btn-sm"
                                style={{ color: "var(--accent-primary)" }}
                              >
                                Pilih untuk Stopwatch
                              </button>
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
              Pilih salah satu sampel dari katalog untuk melihat detail dan menjalankan stopwatch time study.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Tambah Komponen Garmen */}
      <Modal
        isOpen={newComponentModal}
        onClose={() => setNewComponentModal(false)}
        title="➕ Tambah Komponen Garmen"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!activeVersion) return;
            try {
              await sampleApi.addComponent(activeVersion.id, {
                component_name: componentName,
                fabric_consumption: Number(fabricConsumption),
              });
              setNotice({ type: "success", message: `Komponen ${componentName} berhasil ditambahkan.` });
              setNewComponentModal(false);
              setComponentName("");
              if (selectedSample) handleSelectSample(selectedSample.id);
            } catch (err: any) {
              setNotice({ type: "danger", message: err.message || "Gagal menambah komponen." });
            }
          }}
        >
          <div className="form-group">
            <label className="form-label">Nama Komponen</label>
            <input
              type="text"
              className="form-input"
              placeholder="Contoh: Kerah Rib, Badan Depan, Lengan Raglan"
              value={componentName}
              onChange={(e) => setComponentName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Estimasi Konsumsi Kain (meter / pcs)</label>
            <input
              type="number"
              step="0.01"
              className="form-input"
              value={fabricConsumption}
              onChange={(e) => setFabricConsumption(Number(e.target.value))}
              required
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setNewComponentModal(false)}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary">
              Simpan Komponen
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Buat Sampel Baru */}
      <Modal
        isOpen={newSampleModal}
        onClose={() => setNewSampleModal(false)}
        title="➕ Buat Prototipe Sampel Baru"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              // Pakai clientId klien A atau fallback
              const created = await sampleApi.createSample({
                client_id: "00000000-0000-0000-0000-000000000000", // Will resolve in backend or default
                sample_code: sampleCode,
                item_name: sampleItemName,
              });
              setNotice({ type: "success", message: `Sampel ${sampleCode} berhasil dibuat!` });
              setNewSampleModal(false);
              setSampleCode("");
              setSampleItemName("");
              loadSamples();
            } catch (err: any) {
              setNotice({ type: "danger", message: err.message || "Gagal membuat sampel." });
            }
          }}
        >
          <div className="form-group">
            <label className="form-label">Kode Sampel</label>
            <input
              type="text"
              className="form-input"
              placeholder="Contoh: SMP-HOODIE-01"
              value={sampleCode}
              onChange={(e) => setSampleCode(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Nama Barang / Model</label>
            <input
              type="text"
              className="form-input"
              placeholder="Contoh: Heavyweight Fleece Hoodie 330gsm"
              value={sampleItemName}
              onChange={(e) => setSampleItemName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setNewSampleModal(false)}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary">
              Buat Sampel
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Approval Owner + Harga */}
      <Modal
        isOpen={ownerModalOpen}
        onClose={() => setOwnerModalOpen(false)}
        title="💰 Approval Owner — Produk + Harga Kesepakatan"
      >
        <div className="notice notice-info" style={{ marginBottom: 16 }}>
          <span>💡</span>
          <div style={{ fontSize: "0.82rem" }}>
            Tahap 2: owner mengunci produk yang dipelajari tim sample beserta harga deal per pcs.
            Setelah ini versi menjadi OWNER_APPROVED dan bisa dikonversi ke order massal.
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Harga Deal per Pcs (Rp, wajib &gt; 0)</label>
          <input
            type="number"
            className="form-input"
            value={ownerPrice}
            onChange={(e) => setOwnerPrice(Number(e.target.value))}
            min={1}
            required
          />
        </div>
        <div className="form-group">
          <label className="form-label">Catatan Costing / Skema Maklon</label>
          <input
            type="text"
            className="form-input"
            value={ownerNotes}
            onChange={(e) => setOwnerNotes(e.target.value)}
            placeholder="Contoh: Deal CMT 45rb/pcs, MOQ 100"
          />
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
          <button type="button" className="btn btn-secondary" onClick={() => setOwnerModalOpen(false)}>
            Batal
          </button>
          <button type="button" className="btn btn-primary" onClick={handleApproveOwner}>
            Kunci & Setujui Owner
          </button>
        </div>
      </Modal>
    </AppLayout>
  );
}
