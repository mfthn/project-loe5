"use client";

import React, { useEffect, useState } from "react";
import { AppLayout } from "../../components/AppLayout";
import { Modal } from "../../components/Modal";
import { Notice } from "../../components/Notice";
import { useAuth } from "../../lib/auth-context";
import { gudangApi, produksiApi, authApi, financeApi, lockFormSubmit, unlockFormSubmit } from "../../lib/api";
import type { CuttingResult, InventoryItem, InventoryTransaction, MaterialHandover, MaterialRequest, Order, PurchaseOrder } from "../../types/api";

type NeedRow = {
  request_id: string; order_id: string; order_number: string; order_status: string;
  inventory_item_id: string; material_code: string; material_name: string;
  qty_requested: number; qty_fulfilled: number; current_stock: number;
  request_status: string; need_status: string;
};

export default function GudangPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";
  const isMandor = user?.role === "MANDOR";
  const canManageStock = user?.role === "GUDANG";
  const canVerifyRequest = user?.role === "GUDANG" || user?.role === "OWNER";
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [handovers, setHandovers] = useState<MaterialHandover[]>([]);
  const [cuttings, setCuttings] = useState<CuttingResult[]>([]);
  const [needs, setNeeds] = useState<NeedRow[]>([]);
  const [draftPOs, setDraftPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);

  // Modal states
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [handoverModalOpen, setHandoverModalOpen] = useState(false);
  const [cuttingModalOpen, setCuttingModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);

  // Form material baru
  const [newMatClientId, setNewMatClientId] = useState("");
  const [newMatOrderId, setNewMatOrderId] = useState("");
  const [newMatCode, setNewMatCode] = useState("");
  const [newMatName, setNewMatName] = useState("");
  const [newMatStock, setNewMatStock] = useState(0);
  const [newMatUnit, setNewMatUnit] = useState("METER");
  const [newMatLocation, setNewMatLocation] = useState("");

  // Form receive state
  const [receiveItemId, setReceiveItemId] = useState("");
  const [receiveQty, setReceiveQty] = useState(100);
  const [receiveNotes, setReceiveNotes] = useState("");
  const [receiveOrderId, setReceiveOrderId] = useState("");
  const [receivePoId, setReceivePoId] = useState("");

  // Form issue state
  const [issueItemId, setIssueItemId] = useState("");
  const [issueOrderId, setIssueOrderId] = useState("");
  const [issueQty, setIssueQty] = useState(50);
  const [issueNotes, setIssueNotes] = useState("");

  // Form request bahan (mandor → gudang)
  const [reqItemId, setReqItemId] = useState("");
  const [reqOrderId, setReqOrderId] = useState("");
  const [reqQty, setReqQty] = useState(50);
  const [reqNotes, setReqNotes] = useState("");

  // Form serah terima (gudang → mandor)
  const [hoRequestId, setHoRequestId] = useState("");
  const [hoItemId, setHoItemId] = useState("");
  const [hoOrderId, setHoOrderId] = useState("");
  const [hoQty, setHoQty] = useState(50);
  const [hoNotes, setHoNotes] = useState("");

  // Form lokasi penyimpanan
  const [clientFilter, setClientFilter] = useState("");
  const [clients, setClients] = useState<{ id: string; company_name: string; client_code: string }[]>([]);

  const clientOptions = [...new Set(items.map((it) => it.client_id))];
  const visibleItems = clientFilter ? items.filter((it) => it.client_id === clientFilter) : items;

  // Form cutting massal
  const [cutOrderId, setCutOrderId] = useState("");
  const [cutItemId, setCutItemId] = useState("");
  const [cutLapis, setCutLapis] = useState(50);
  const [cutHasil, setCutHasil] = useState(240);
  const [cutWaste, setCutWaste] = useState(0);
  const [cutWasteCategory, setCutWasteCategory] = useState("SISA_POTONG");
  const [cutNotes, setCutNotes] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [itemList, txList, orderList, reqList, hoList, cutList, clientList, needList, poList] = await Promise.all([
        gudangApi.getItems(),
        gudangApi.getTransactions(),
        produksiApi.getOrders().catch(() => []),
        gudangApi.getRequests().catch(() => []),
        gudangApi.getHandovers().catch(() => []),
        gudangApi.getCutting().catch(() => []),
        authApi.getClients().catch(() => []),
        financeApi.getNeeds().catch(() => []),
        financeApi.getPOs().catch(() => []),
      ]);
      setItems(itemList);
      setTransactions(txList);
      setOrders(orderList);
      setRequests(reqList);
      setHandovers(hoList);
      setCuttings(cutList);
      setClients(clientList);
      setNeeds(needList);
      setDraftPOs(poList.filter((p) => p.status === "DRAFT"));
      if (clientList.length > 0 && !newMatClientId) setNewMatClientId(clientList[0].id);
      if (itemList.length > 0) {
        setReceiveItemId(itemList[0].id);
        setIssueItemId(itemList[0].id);
        setReqItemId(itemList[0].id);
        setHoItemId(itemList[0].id);
      }
      if (orderList.length > 0) {
        setIssueOrderId(orderList[0].id);
        setReqOrderId(orderList[0].id);
        setHoOrderId(orderList[0].id);
        setCutOrderId(orderList[0].id);
      }
      const openReq = reqList.find((r) => r.status === "DISETUJUI");
      if (openReq) {
        setHoRequestId(openReq.id);
        setHoItemId(openReq.inventory_item_id);
        setHoOrderId(openReq.order_id);
        setHoQty(Math.max(1, Math.floor(openReq.qty_requested - openReq.qty_fulfilled)));
      }
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal memuat data gudang." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockFormSubmit(e)) return; // cegah spam klik ganda
    try {
      const created = await gudangApi.createItem({
        client_id: newMatClientId,
        material_code: newMatCode,
        material_name: newMatName,
        unit_measure: newMatUnit,
        initial_stock: Number(newMatStock),
        order_id: newMatOrderId,
      });
      if (newMatLocation.trim()) {
        await gudangApi.setLocation(created.id, newMatLocation.trim()).catch(() => null);
      }
      setNotice({ type: "success", message: `Material ${newMatCode} terdaftar.` });
      setItemModalOpen(false);
      setNewMatCode("");
      setNewMatName("");
      setNewMatLocation("");
      loadData();
    } catch (err: any) {
      unlockFormSubmit(e); // gagal → izinkan coba lagi
      setNotice({ type: "danger", message: err.message || "Gagal mendaftarkan material." });
    }
  };

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockFormSubmit(e)) return; // cegah spam klik ganda
    try {
      await gudangApi.receiveMaterial({
        inventory_item_id: receiveItemId,
        quantity: Number(receiveQty),
        order_id: receiveOrderId || undefined,
        po_id: receivePoId || undefined,
        notes: receiveNotes || "Penerimaan kain dari supplier",
      });
      setNotice({ type: "success", message: `Berhasil menerima ${receiveQty} unit bahan.` });
      setReceiveModalOpen(false);
      setReceiveQty(100);
      setReceiveNotes("");
      loadData();
    } catch (err: any) {
      unlockFormSubmit(e); // gagal → izinkan coba lagi
      setNotice({ type: "danger", message: err.message || "Gagal menerima bahan." });
    }
  };

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockFormSubmit(e)) return; // cegah spam klik ganda
    try {
      await gudangApi.issueMaterial({
        inventory_item_id: issueItemId,
        order_id: issueOrderId,
        quantity: Number(issueQty),
        notes: issueNotes || "Pengeluaran barang ke produksi",
      });
      setNotice({ type: "success", message: `Berhasil mengeluarkan ${issueQty} unit bahan ke cutting.` });
      setIssueModalOpen(false);
      setIssueQty(50);
      setIssueNotes("");
      loadData();
    } catch (err: any) {
      unlockFormSubmit(e); // gagal → izinkan coba lagi
      setNotice({
        type: "danger",
        message: `⛔ Proteksi Anti-Kontaminasi: ${err.message || "Bahan ditolak."}`,
      });
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockFormSubmit(e)) return; // cegah spam klik ganda
    try {
      await gudangApi.createRequest({
        order_id: reqOrderId,
        inventory_item_id: reqItemId,
        qty_requested: Number(reqQty),
        notes: reqNotes || "Pengajuan bahan dari tim produksi",
      });
      setNotice({ type: "success", message: `Pengajuan ${reqQty} unit bahan tercatat (DIAJUKAN).` });
      setRequestModalOpen(false);
      loadData();
    } catch (err: any) {
      unlockFormSubmit(e); // gagal → izinkan coba lagi
      setNotice({ type: "danger", message: err.message || "Gagal mengajukan bahan." });
    }
  };

  const handleReview = async (requestId: string, approve: boolean) => {
    try {
      await gudangApi.reviewRequest(requestId, approve);
      setNotice({
        type: approve ? "success" : "warning",
        message: approve ? "Pengajuan DISETUJUI — stok tersedia & milik klien cocok." : "Pengajuan DITOLAK.",
      });
      loadData();
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal memverifikasi pengajuan." });
    }
  };

  const handleHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockFormSubmit(e)) return; // cegah spam klik ganda
    try {
      await gudangApi.createHandover({
        order_id: hoOrderId,
        inventory_item_id: hoItemId,
        quantity: Number(hoQty),
        material_request_id: hoRequestId || null,
        notes: hoNotes || "Serah terima bahan ke mandor operasional",
      });
      setNotice({ type: "success", message: `Serah terima ${hoQty} unit bahan tercatat.` });
      setHandoverModalOpen(false);
      loadData();
    } catch (err: any) {
      unlockFormSubmit(e); // gagal → izinkan coba lagi
      setNotice({ type: "danger", message: err.message || "Gagal serah terima bahan." });
    }
  };

  const handleReceiveHandover = async (handoverId: string) => {
    try {
      await gudangApi.receiveHandover(handoverId);
      setNotice({ type: "success", message: "Mandor konfirmasi terima — order lanjut ke SEWING." });
      loadData();
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal konfirmasi terima." });
    }
  };

  const handleConfirmPO = async (poId: string) => {
    try {
      await financeApi.confirmPO(poId);
      setNotice({ type: "success", message: "Kebutuhan pengadaan DIKONFIRMASI — lanjut ke Finance." });
      loadData();
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal konfirmasi pengadaan." });
    }
  };

  const handleRequestPurchase = async (n: NeedRow) => {
    const shortfall = Math.max(1, Math.ceil(n.qty_requested - n.qty_fulfilled - n.current_stock));
    try {
      await financeApi.createPO({
        po_number: `PO-${n.order_number}-${Date.now().toString().slice(-4)}`,
        order_id: n.order_id,
        supplier_name: "MENUNGGU FINANCE",
        lines: [{ inventory_item_id: n.inventory_item_id, qty_ordered: shortfall, unit_price: 0 }],
      });
      setNotice({ type: "success", message: `Diajukan ke Finance: ${shortfall} unit ${n.material_code}. Finance melengkapi harga.` });
      loadData();
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal mengajukan pembelian." });
    }
  };

  const handleCutting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lockFormSubmit(e)) return; // cegah spam klik ganda
    try {
      await gudangApi.createCutting({
        order_id: cutOrderId,
        inventory_item_id: cutItemId || null,
        qty_lapis: Number(cutLapis),
        qty_potong_hasil: Number(cutHasil),
        waste_qty: Number(cutWaste),
        waste_category: cutWasteCategory || undefined,
        notes: cutNotes || undefined,
      });
      setNotice({ type: "success", message: `Cutting tercatat: ${cutHasil} pcs dari ${cutLapis} lapis.` });
      setCuttingModalOpen(false);
      loadData();
    } catch (err: any) {
      unlockFormSubmit(e); // gagal → izinkan coba lagi
      setNotice({ type: "danger", message: err.message || "Gagal mencatat cutting." });
    }
  };

  return (
    <AppLayout
      title="Gudang Multi-Klien & Anti-Kontaminasi"
      subtitle="Pengelolaan stok bahan baku dengan isolasi Tag ID Klien (Skenario 1 - P0)"
      requiredModule="gudang"
    >
      {notice && (
        <Notice
          type={notice.type}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}

      {/* Top Action Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {canManageStock && (
            <>
              <button onClick={() => setItemModalOpen(true)} className="btn btn-primary">
                📦 Daftarkan Material
              </button>
              <button onClick={() => setReceiveModalOpen(true)} className="btn btn-secondary">
                📥 Penerimaan Bahan Masuk (Receive)
              </button>
              <button onClick={() => setIssueModalOpen(true)} className="btn btn-secondary">
                📤 Pengeluaran Barang ke Produksi
              </button>
              <button onClick={() => setHandoverModalOpen(true)} className="btn btn-secondary">
                🤝 Serah Terima ke Produksi
              </button>
              <button onClick={() => setCuttingModalOpen(true)} className="btn btn-secondary">
                ✂️ Catat Hasil Cutting
              </button>
            </>
          )}
          {isMandor && (
            <button onClick={() => setRequestModalOpen(true)} className="btn btn-secondary">
              🧾 Pengajuan Bahan (Mandor)
            </button>
          )}
          {(isOwner || isMandor || (!canManageStock && !isMandor && !isOwner)) && (
            <span className="badge badge-info">
              {isOwner
                ? "Mode pantau — Owner hanya melihat & memverifikasi pengajuan"
                : isMandor
                ? "Akses Mandor: pengajuan bahan, serah terima, dan daftar stok"
                : "Mode pantau — read-only untuk peran Anda"}
            </span>
          )}
        </div>

        <button onClick={loadData} className="btn btn-ghost btn-sm">
          🔄 Muat Ulang Data
        </button>
      </div>

      {/* Skenario 1 Educational Box */}
      <div
        className="card"
        style={{
          background: "linear-gradient(135deg, #FFFBEB 0%, #ffffff 100%)",
          border: "1px solid var(--color-warning-border)",
          borderRadius: 24,
          marginBottom: 28,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
          <span className="badge badge-warning">Skenario 1 Proteksi P0</span>
          <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "#2E1065" }}>
            Guard Anti-Kontaminasi Bahan Silang
          </span>
        </div>
        <p style={{ fontSize: "0.85rem", color: "#5B5870", margin: 0, lineHeight: 1.6 }}>
          Kain yang terdaftar dengan Tag ID Klien tertentu (misal: PT Tekstil Maju) <strong>secara absolut tidak dapat</strong> dikeluarkan untuk pesanan milik Klien lain (misal: CV Busana Prima / Snøhund). Sistem backend akan otomatis menolak transaksi (HTTP 400) dan stok bahan tidak akan berkurang.
        </p>
      </div>

      {/* Material Inventory Table */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>Daftar Stok Bahan Baku per Tag Klien</h3>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem" }}>
            Filter klien:
            <select className="form-select" value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} style={{ minWidth: 180 }}>
              <option value="">Semua klien</option>
              {clientOptions.map((cid) => (
                <option key={cid} value={cid}>{cid.slice(0, 8)}...</option>
              ))}
            </select>
          </label>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Kode Bahan</th>
                <th>Nama Material</th>
                <th>Tag ID Klien</th>
                <th>Stok Saat Ini</th>
                <th>Satuan</th>
                <th>Lokasi Simpan</th>
                <th>Status Proteksi</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                    {loading ? "Memuat stok bahan..." : "Belum ada data material di gudang."}
                  </td>
                </tr>
              ) : (
                visibleItems.map((item) => (
                  <tr key={item.id}>
                    <td className="font-mono" style={{ fontWeight: 700, color: "var(--accent-primary)" }}>
                      {item.material_code}
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                      {item.material_name}
                    </td>
                    <td>
                      <span className="badge badge-purple font-mono" style={{ fontSize: "0.75rem" }}>
                        Klien: {item.client_id ? item.client_id.slice(0, 8) + "..." : "INTERNAL"}
                      </span>
                    </td>
                    <td className="font-mono" style={{ fontSize: "1.05rem", fontWeight: 700, color: item.current_stock > 0 ? "var(--color-success)" : "var(--color-danger)" }}>
                      {item.current_stock.toLocaleString("id-ID")}
                    </td>
                    <td>{item.unit_measure}</td>
                    <td>
                      <span className="badge badge-info font-mono" style={{ fontSize: "0.75rem" }}>
                        {item.storage_location || "-"}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-success">🔒 Terisolasi</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pengajuan Bahan Produksi → Gudang */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 14 }}>Pengajuan Bahan Tim Produksi (Request → Verifikasi Gudang)</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Diminta</th>
                <th>Terpenuhi</th>
                <th>ID Order</th>
                <th>ID Item</th>
                <th>Aksi Verifikasi</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                    Belum ada pengajuan bahan.
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id}>
                    <td>
                      <span className={`badge ${req.status === "DISETUJUI" ? "badge-success" : req.status === "DITOLAK" ? "badge-danger" : req.status === "DISERAHKAN" ? "badge-purple" : "badge-warning"}`}>
                        {req.status}
                      </span>
                    </td>
                    <td className="font-mono" style={{ fontWeight: 700 }}>{req.qty_requested}</td>
                    <td className="font-mono">{req.qty_fulfilled}</td>
                    <td className="font-mono" style={{ fontSize: "0.78rem" }}>{req.order_id.slice(0, 8)}...</td>
                    <td className="font-mono" style={{ fontSize: "0.78rem" }}>{req.inventory_item_id.slice(0, 8)}...</td>
                    <td>
                      {req.status === "DIAJUKAN" ? (
                        canVerifyRequest ? (
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => handleReview(req.id, true)} className="btn btn-primary btn-sm">
                              Setujui
                            </button>
                            <button onClick={() => handleReview(req.id, false)} className="btn btn-secondary btn-sm">
                              Tolak
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Menunggu verifikasi gudang</span>
                        )
                      ) : (
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Selesai diverifikasi</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Serah Terima Gudang → Produksi */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 14 }}>Serah Terima Gudang → Mandor (Handover Dua Arah)</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Jumlah</th>
                <th>ID Order</th>
                <th>Status Terima</th>
                <th>Aksi Mandor</th>
              </tr>
            </thead>
            <tbody>
              {handovers.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                    Belum ada serah terima bahan.
                  </td>
                </tr>
              ) : (
                handovers.map((ho) => (
                  <tr key={ho.id}>
                    <td className="font-mono" style={{ fontWeight: 700 }}>{ho.quantity}</td>
                    <td className="font-mono" style={{ fontSize: "0.78rem" }}>{ho.order_id.slice(0, 8)}...</td>
                    <td>
                      {ho.received_at ? (
                        <span className="badge badge-success">✅ Diterima produksi</span>
                      ) : (
                        <span className="badge badge-warning">⏳ Menunggu mandor</span>
                      )}
                    </td>
                    <td>
                      {!ho.received_at ? (
                        user?.role === "MANDOR" ? (
                          <button onClick={() => handleReceiveHandover(ho.id)} className="btn btn-primary btn-sm">
                            Konfirmasi Terima (→ SEWING)
                          </button>
                        ) : (
                          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Menunggu mandor</span>
                        )
                      ) : (
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Order lanjut produksi</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hasil Cutting Massal */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 14 }}>Hasil Cutting Massal (Lapis → Pcs + Waste)</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Lapis</th>
                <th>Hasil (pcs)</th>
                <th>Waste</th>
                <th>Kategori</th>
                <th>ID Order</th>
                <th>Waktu</th>
              </tr>
            </thead>
            <tbody>
              {cuttings.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                    Belum ada hasil cutting.
                  </td>
                </tr>
              ) : (
                cuttings.map((c) => (
                  <tr key={c.id}>
                    <td className="font-mono" style={{ fontWeight: 700 }}>{c.qty_lapis}</td>
                    <td className="font-mono" style={{ fontWeight: 700, color: "var(--color-success)" }}>{c.qty_potong_hasil}</td>
                    <td className="font-mono">{c.waste_qty}</td>
                    <td>
                      {c.waste_category ? (
                        <span className="badge badge-warning">{c.waste_category}</span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>-</span>
                      )}
                    </td>
                    <td className="font-mono" style={{ fontSize: "0.78rem" }}>{c.order_id.slice(0, 8)}...</td>
                    <td className="font-mono" style={{ fontSize: "0.8rem" }}>
                      {new Date(c.cut_at).toLocaleString("id-ID")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Kebutuhan Produksi & Konfirmasi Pengadaan */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 14 }}>Kebutuhan Produksi (Terpenuhi / Belum)</h3>
        <div className="table-wrap" style={{ marginBottom: 16 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Material</th>
                <th>Diminta / Terpenuhi / Stok</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {needs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                    Belum ada pengajuan kebutuhan produksi.
                  </td>
                </tr>
              ) : (
                needs.map((n) => (
                  <tr key={n.request_id}>
                    <td className="font-mono" style={{ fontWeight: 700 }}>{n.order_number}</td>
                    <td>{n.material_code}</td>
                    <td className="font-mono">{n.qty_requested} / {n.qty_fulfilled} / {n.current_stock}</td>
                    <td>
                      <span className={`badge ${n.need_status === "TERPENUHI" ? "badge-success" : "badge-danger"}`}>
                        {n.need_status}
                      </span>
                    </td>
                    <td>
                      {n.need_status === "BELUM" && canManageStock && (
                        <button onClick={() => handleRequestPurchase(n)} className="btn btn-primary btn-sm">
                          Minta Finance Belikan
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <h3 style={{ marginBottom: 14 }}>Konfirmasi Pengadaan (Sample → Gudang → Finance)</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>No. PO</th>
                <th>Supplier</th>
                <th>Total</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {draftPOs.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                    Tidak ada PO menunggu konfirmasi gudang.
                  </td>
                </tr>
              ) : (
                draftPOs.map((po) => (
                  <tr key={po.id}>
                    <td className="font-mono" style={{ fontWeight: 700 }}>{po.po_number}</td>
                    <td>{po.supplier_name}</td>
                    <td className="font-mono">Rp {Number(po.total_amount).toLocaleString("id-ID")}</td>
                    <td><span className="badge badge-warning">{po.status}</span></td>
                    <td>
                      {canVerifyRequest ? (
                        <button onClick={() => handleConfirmPO(po.id)} className="btn btn-primary btn-sm">
                          Konfirmasi Kebutuhan
                        </button>
                      ) : (
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Menunggu gudang</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction History Log */}
      <div>
        <h3 style={{ marginBottom: 14 }}>Log Mutasi Gudang Terakhir (Audit Trail)</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Waktu Transaksi</th>
                <th>Tipe</th>
                <th>Jumlah</th>
                <th>ID Item</th>
                <th>ID Order</th>
                <th>Catatan</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                    Belum ada riwayat mutasi.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td className="font-mono" style={{ fontSize: "0.8rem" }}>
                      {new Date(tx.transaction_time).toLocaleString("id-ID")}
                    </td>
                    <td>
                      <span className={`badge ${tx.transaction_type === "IN" ? "badge-success" : "badge-info"}`}>
                        {tx.transaction_type === "IN" ? "📥 MASUK (IN)" : "📤 KELUAR (OUT)"}
                      </span>
                    </td>
                    <td className="font-mono" style={{ fontWeight: 700, color: tx.transaction_type === "IN" ? "var(--color-success)" : "var(--color-warning)" }}>
                      {tx.transaction_type === "IN" ? `+${tx.quantity}` : `-${tx.quantity}`}
                    </td>
                    <td className="font-mono" style={{ fontSize: "0.78rem" }}>
                      {tx.inventory_item_id.slice(0, 8)}...
                    </td>
                    <td className="font-mono" style={{ fontSize: "0.78rem" }}>
                      {tx.order_id ? tx.order_id.slice(0, 8) + "..." : "-"}
                    </td>
                    <td style={{ fontSize: "0.85rem" }}>{tx.notes || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Daftarkan Material Baru */}
      <Modal
        isOpen={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        title="📦 Daftarkan Material Baru"
      >
        <form onSubmit={handleCreateItem}>
          <div className="form-group">
            <label className="form-label">Klien Pemilik (Tag ID)</label>
            <select className="form-select" value={newMatClientId} onChange={(e) => setNewMatClientId(e.target.value)} required>
              <option value="">Pilih klien</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.company_name} ({c.client_code})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Pesanan Asal (wajib FR-6.1)</label>
            <select className="form-select" value={newMatOrderId} onChange={(e) => setNewMatOrderId(e.target.value)} required>
              <option value="">Pilih pesanan</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>{o.order_number} ({o.status})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Kode Material</label>
            <input type="text" className="form-input font-mono" value={newMatCode} onChange={(e) => setNewMatCode(e.target.value)} placeholder="KAIN-COTTON-24S" required />
          </div>
          <div className="form-group">
            <label className="form-label">Nama Material</label>
            <input type="text" className="form-input" value={newMatName} onChange={(e) => setNewMatName(e.target.value)} placeholder="Cotton Combed 24s Navy" required />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Stok Awal</label>
              <input type="number" className="form-input" value={newMatStock} onChange={(e) => setNewMatStock(Number(e.target.value))} min={0} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Satuan</label>
              <select className="form-select" value={newMatUnit} onChange={(e) => setNewMatUnit(e.target.value)}>
                <option value="METER">METER</option>
                <option value="YARD">YARD</option>
                <option value="KG">KG</option>
                <option value="PCS">PCS</option>
                <option value="CONE">CONE</option>
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Lokasi Simpan (Rak/Bin)</label>
              <input type="text" className="form-input font-mono" value={newMatLocation} onChange={(e) => setNewMatLocation(e.target.value)} placeholder="RAK-A-01" />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setItemModalOpen(false)}>Batal</button>
            <button type="submit" className="btn btn-primary">Daftarkan</button>
          </div>
        </form>
      </Modal>

      {/* Modal: Penerimaan Bahan Masuk */}
      <Modal
        isOpen={receiveModalOpen}
        onClose={() => setReceiveModalOpen(false)}
        title="📥 Form Penerimaan Bahan Masuk (Receive)"
      >
        <form onSubmit={handleReceive}>
          <div className="form-group">
            <label className="form-label">Pilih Material</label>
            <select
              className="form-select"
              value={receiveItemId}
              onChange={(e) => setReceiveItemId(e.target.value)}
              required
            >
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.material_code} - {it.material_name} (Stok: {it.current_stock} {it.unit_measure})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Kuantitas Masuk</label>
            <input
              type="number"
              className="form-input"
              value={receiveQty}
              onChange={(e) => setReceiveQty(Number(e.target.value))}
              min={1}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Untuk Pesanan (opsional — wajib isi PO jika dipilih)</label>
            <select
              className="form-select"
              value={receiveOrderId}
              onChange={(e) => setReceiveOrderId(e.target.value)}
            >
              <option value="">Titipan umum / tanpa pesanan</option>
              {orders.map((ord) => (
                <option key={ord.id} value={ord.id}>
                  {ord.order_number} ({ord.scheme})
                </option>
              ))}
            </select>
          </div>

          {receiveOrderId && (
            <div className="form-group">
              <label className="form-label">ID PO Disetujui (wajib untuk pesanan)</label>
              <input
                type="text"
                className="form-input font-mono"
                value={receivePoId}
                onChange={(e) => setReceivePoId(e.target.value)}
                placeholder="UUID PO dari halaman Keuangan"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Catatan / No. Surat Jalan</label>
            <input
              type="text"
              className="form-input"
              value={receiveNotes}
              onChange={(e) => setReceiveNotes(e.target.value)}
              placeholder="Contoh: SJ-2026/10/01 dari supplier tekstil"
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setReceiveModalOpen(false)}
            >
              Batal
            </button>
            <button type="submit" className="btn btn-primary">
              Simpan Penerimaan
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Pengeluaran Bahan ke Cutting (Proteksi Silang) */}
      <Modal
        isOpen={issueModalOpen}
        onClose={() => setIssueModalOpen(false)}
        title="📤 Form Pengeluaran Barang ke Produksi"
      >
        <form onSubmit={handleIssue}>
          <div className="notice notice-info" style={{ marginBottom: 16 }}>
            <span>💡</span>
            <div style={{ fontSize: "0.82rem" }}>
              Coba pilih bahan milik Klien A dan hubungkan ke pesanan Klien B untuk menguji proteksi anti-kontaminasi!
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Pilih Material yang Dikeluarkan</label>
            <select
              className="form-select"
              value={issueItemId}
              onChange={(e) => setIssueItemId(e.target.value)}
              required
            >
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.material_code} - {it.material_name} (Klien: {it.client_id ? it.client_id.slice(0, 8) : "N/A"})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Pilih Pesanan Produksi Tujuan</label>
            <select
              className="form-select"
              value={issueOrderId}
              onChange={(e) => setIssueOrderId(e.target.value)}
              required
            >
              {orders.map((ord) => (
                <option key={ord.id} value={ord.id}>
                  {ord.order_number} ({ord.scheme}) - Klien: {ord.client_id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Kuantitas Dikeluarkan</label>
            <input
              type="number"
              className="form-input"
              value={issueQty}
              onChange={(e) => setIssueQty(Number(e.target.value))}
              min={1}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Catatan Pengeluaran</label>
            <input
              type="text"
              className="form-input"
              value={issueNotes}
              onChange={(e) => setIssueNotes(e.target.value)}
              placeholder="Contoh: Pengeluaran untuk produksi batch 1"
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIssueModalOpen(false)}
            >
              Batal
            </button>
            <button type="submit" className="btn btn-primary">
              Validasi & Keluarkan Bahan
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Pengajuan Bahan Mandor → Gudang */}
      <Modal
        isOpen={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        title="🧾 Pengajuan Kebutuhan Bahan (Mandor → Gudang)"
      >
        <form onSubmit={handleCreateRequest}>
          <div className="form-group">
            <label className="form-label">Pesanan Produksi</label>
            <select className="form-select" value={reqOrderId} onChange={(e) => setReqOrderId(e.target.value)} required>
              {orders.map((ord) => (
                <option key={ord.id} value={ord.id}>
                  {ord.order_number} ({ord.scheme}) - Klien: {ord.client_id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Material Gudang</label>
            <select className="form-select" value={reqItemId} onChange={(e) => setReqItemId(e.target.value)} required>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.material_code} - {it.material_name} (Stok: {it.current_stock})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Kuantitas Diminta</label>
            <input type="number" className="form-input" value={reqQty} onChange={(e) => setReqQty(Number(e.target.value))} min={1} required />
          </div>
          <div className="form-group">
            <label className="form-label">Catatan</label>
            <input type="text" className="form-input" value={reqNotes} onChange={(e) => setReqNotes(e.target.value)} placeholder="Contoh: Butuh untuk cutting batch 1" />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setRequestModalOpen(false)}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary">
              Ajukan ke Gudang
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Serah Terima Gudang → Mandor */}
      <Modal
        isOpen={handoverModalOpen}
        onClose={() => setHandoverModalOpen(false)}
        title="🤝 Serah Terima Bahan ke Produksi"
      >
        <form onSubmit={handleHandover}>
          <div className="form-group">
            <label className="form-label">Pengajuan Terkait (opsional)</label>
            <select className="form-select" value={hoRequestId} onChange={(e) => setHoRequestId(e.target.value)}>
              <option value="">Tanpa request (langsung)</option>
              {requests.filter((r) => r.status === "DISETUJUI").map((r) => (
                <option key={r.id} value={r.id}>
                  {r.id.slice(0, 8)} — minta {r.qty_requested}, terpenuhi {r.qty_fulfilled}
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Pesanan Produksi</label>
            <select className="form-select" value={hoOrderId} onChange={(e) => setHoOrderId(e.target.value)} required>
              {orders.map((ord) => (
                <option key={ord.id} value={ord.id}>
                  {ord.order_number} ({ord.scheme})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Material</label>
            <select className="form-select" value={hoItemId} onChange={(e) => setHoItemId(e.target.value)} required>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.material_code} - {it.material_name} (Stok: {it.current_stock})
                </option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Kuantitas Diserahkan</label>
            <input type="number" className="form-input" value={hoQty} onChange={(e) => setHoQty(Number(e.target.value))} min={1} required />
          </div>
          <div className="form-group">
            <label className="form-label">Catatan Serah Terima</label>
            <input type="text" className="form-input" value={hoNotes} onChange={(e) => setHoNotes(e.target.value)} placeholder="Contoh: Serah ke mandor line 1" />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setHandoverModalOpen(false)}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary">
              Serahkan ke Produksi
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Hasil Cutting Massal */}
      <Modal
        isOpen={cuttingModalOpen}
        onClose={() => setCuttingModalOpen(false)}
        title="✂️ Hasil Cutting Massal"
      >
        <form onSubmit={handleCutting}>
          <div className="form-group">
            <label className="form-label">Pesanan Produksi</label>
            <select className="form-select" value={cutOrderId} onChange={(e) => setCutOrderId(e.target.value)} required>
              {orders
                .filter((o) => o.status === "CUTTING" || o.status === "SEWING")
                .map((ord) => (
                  <option key={ord.id} value={ord.id}>
                    {ord.order_number}
                  </option>
                ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Bahan (opsional)</label>
            <select className="form-select" value={cutItemId} onChange={(e) => setCutItemId(e.target.value)}>
              <option value="">Tanpa bahan spesifik</option>
              {items.map((it) => (
                <option key={it.id} value={it.id}>
                  {it.material_code} - {it.material_name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Lapis</label>
              <input type="number" className="form-input" value={cutLapis} onChange={(e) => setCutLapis(Number(e.target.value))} min={1} required />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Hasil (pcs)</label>
              <input type="number" className="form-input" value={cutHasil} onChange={(e) => setCutHasil(Number(e.target.value))} min={1} required />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Waste</label>
              <input type="number" className="form-input" value={cutWaste} onChange={(e) => setCutWaste(Number(e.target.value))} min={0} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Kategori Waste (FR-6.3, wajib)</label>
            <select className="form-select" value={cutWasteCategory} onChange={(e) => setCutWasteCategory(e.target.value)} required>
              <option value="SISA_POTONG">Sisa potongan</option>
              <option value="SCRAP">Scrap</option>
              <option value="BS_REJECT">BS / Reject</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Catatan</label>
            <input type="text" className="form-input" value={cutNotes} onChange={(e) => setCutNotes(e.target.value)} placeholder="Contoh: Hamparan 1, marker A" />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setCuttingModalOpen(false)}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary">
              Simpan Hasil Cutting
            </button>
          </div>
        </form>
      </Modal>

    </AppLayout>
  );
}
