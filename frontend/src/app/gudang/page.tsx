"use client";

import React, { useEffect, useState } from "react";
import { AppLayout } from "../../components/AppLayout";
import { Modal } from "../../components/Modal";
import { Notice } from "../../components/Notice";
import { gudangApi, produksiApi } from "../../lib/api";
import type { InventoryItem, InventoryTransaction, Order } from "../../types/api";

export default function GudangPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);

  // Modal states
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);

  // Form receive state
  const [receiveItemId, setReceiveItemId] = useState("");
  const [receiveQty, setReceiveQty] = useState(100);
  const [receiveNotes, setReceiveNotes] = useState("");

  // Form issue state
  const [issueItemId, setIssueItemId] = useState("");
  const [issueOrderId, setIssueOrderId] = useState("");
  const [issueQty, setIssueQty] = useState(50);
  const [issueNotes, setIssueNotes] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [itemList, txList, orderList] = await Promise.all([
        gudangApi.getItems(),
        gudangApi.getTransactions({ limit: 50 }),
        produksiApi.getOrders().catch(() => []),
      ]);
      setItems(itemList);
      setTransactions(txList);
      setOrders(orderList);
      if (itemList.length > 0) {
        setReceiveItemId(itemList[0].id);
        setIssueItemId(itemList[0].id);
      }
      if (orderList.length > 0) {
        setIssueOrderId(orderList[0].id);
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

  const handleReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await gudangApi.receiveMaterial({
        inventory_item_id: receiveItemId,
        quantity: Number(receiveQty),
        notes: receiveNotes || "Penerimaan kain dari supplier",
      });
      setNotice({ type: "success", message: `Berhasil menerima ${receiveQty} unit bahan.` });
      setReceiveModalOpen(false);
      loadData();
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal menerima bahan." });
    }
  };

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await gudangApi.issueMaterial({
        inventory_item_id: issueItemId,
        order_id: issueOrderId,
        quantity: Number(issueQty),
        notes: issueNotes || "Pengeluaran kain ke line cutting",
      });
      setNotice({ type: "success", message: `Berhasil mengeluarkan ${issueQty} unit bahan ke cutting.` });
      setIssueModalOpen(false);
      loadData();
    } catch (err: any) {
      setNotice({
        type: "danger",
        message: `⛔ Proteksi Anti-Kontaminasi: ${err.message || "Bahan ditolak."}`,
      });
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
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setReceiveModalOpen(true)} className="btn btn-primary">
            📥 Penerimaan Bahan Masuk (Receive)
          </button>
          <button onClick={() => setIssueModalOpen(true)} className="btn btn-secondary">
            📤 Pengeluaran ke Cutting (Issue)
          </button>
        </div>

        <button onClick={loadData} className="btn btn-ghost btn-sm">
          🔄 Muat Ulang Data
        </button>
      </div>

      {/* Skenario 1 Educational Box */}
      <div
        className="card"
        style={{
          background: "rgba(30, 41, 59, 0.4)",
          border: "1px solid var(--border-default)",
          marginBottom: 28,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <span className="badge badge-warning">Skenario 1 Proteksi P0</span>
          <span style={{ fontWeight: 700, fontSize: "0.95rem" }}>
            Guard Anti-Kontaminasi Bahan Silang
          </span>
        </div>
        <p style={{ fontSize: "0.85rem", color: "var(--text-secondary)", margin: 0 }}>
          Kain yang terdaftar dengan Tag ID Klien tertentu (misal: PT Tekstil Maju) <strong>secara absolut tidak dapat</strong> dikeluarkan untuk pesanan milik Klien lain (misal: CV Busana Prima / Snøhund). Sistem backend akan otomatis menolak transaksi (HTTP 400) dan stok bahan tidak akan berkurang.
        </p>
      </div>

      {/* Material Inventory Table */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 14 }}>Daftar Stok Bahan Baku per Tag Klien</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Kode Bahan</th>
                <th>Nama Material</th>
                <th>Tag ID Klien</th>
                <th>Stok Saat Ini</th>
                <th>Satuan</th>
                <th>Status Proteksi</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                    {loading ? "Memuat stok bahan..." : "Belum ada data material di gudang."}
                  </td>
                </tr>
              ) : (
                items.map((item) => (
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
                      <span className="badge badge-success">🔒 Terisolasi</span>
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
        title="📤 Form Pengeluaran Bahan ke Cutting (Issue)"
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
            <label className="form-label">Pilih Pesanan Produksi (Target Cutting)</label>
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
              placeholder="Contoh: Pengeluaran untuk cutting batch 1"
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
    </AppLayout>
  );
}
