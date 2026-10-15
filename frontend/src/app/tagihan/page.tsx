"use client";

import React, { useEffect, useState } from "react";
import { AppLayout } from "../../components/AppLayout";
import { Modal } from "../../components/Modal";
import { Notice } from "../../components/Notice";
import { financeApi, gudangApi, produksiApi } from "../../lib/api";
import type { HPPRealized, InventoryItem, Invoice, Order, PurchaseOrder } from "../../types/api";

export default function KeuanganPage() {
  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);

  const [poModalOpen, setPoModalOpen] = useState(false);
  const [invModalOpen, setInvModalOpen] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payInvoiceId, setPayInvoiceId] = useState("");

  const [poNumber, setPoNumber] = useState("");
  const [poOrderId, setPoOrderId] = useState("");
  const [poSupplier, setPoSupplier] = useState("");
  const [poItemId, setPoItemId] = useState("");
  const [poQty, setPoQty] = useState(100);
  const [poPrice, setPoPrice] = useState(15000);

  const [invNumber, setInvNumber] = useState("");
  const [invOrderId, setInvOrderId] = useState("");
  const [invAmount, setInvAmount] = useState("");
  const [payAmount, setPayAmount] = useState(0);

  const [hppOrderId, setHppOrderId] = useState("");
  const [hppData, setHppData] = useState<HPPRealized | null>(null);
  const [hppRevenue, setHppRevenue] = useState("");
  const [hppOverhead, setHppOverhead] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [poList, invList, orderList, itemList] = await Promise.all([
        financeApi.getPOs().catch(() => []),
        financeApi.getInvoices().catch(() => []),
        produksiApi.getOrders().catch(() => []),
        gudangApi.getItems().catch(() => []),
      ]);
      setPos(poList);
      setInvoices(invList);
      setOrders(orderList);
      setItems(itemList);
      if (orderList.length > 0 && !poOrderId) setPoOrderId(orderList[0].id);
      if (orderList.length > 0 && !invOrderId) setInvOrderId(orderList[0].id);
      if (itemList.length > 0 && !poItemId) setPoItemId(itemList[0].id);
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal memuat data keuangan." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreatePO = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await financeApi.createPO({
        po_number: poNumber,
        order_id: poOrderId,
        supplier_name: poSupplier,
        lines: [{ inventory_item_id: poItemId, qty_ordered: Number(poQty), unit_price: Number(poPrice) }],
      });
      setNotice({ type: "success", message: `PO ${poNumber} tercatat (DRAFT).` });
      setPoModalOpen(false);
      setPoNumber("");
      loadData();
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal membuat PO." });
    }
  };

  const handleReviewPO = async (poId: string, approve: boolean) => {
    try {
      await financeApi.reviewPO(poId, approve);
      setNotice({
        type: approve ? "success" : "warning",
        message: approve ? "PO DISETUJUI — gudang boleh menerima barang." : "PO DITOLAK.",
      });
      loadData();
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal mereview PO." });
    }
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await financeApi.createInvoice({
        invoice_number: invNumber,
        order_id: invOrderId,
        amount_total: invAmount ? Number(invAmount) : undefined,
      });
      setNotice({ type: "success", message: `Invoice ${invNumber} diterbitkan (DRAFT).` });
      setInvModalOpen(false);
      setInvNumber("");
      setInvAmount("");
      loadData();
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal menerbitkan invoice." });
    }
  };

  const handleApproveInvoice = async (invoiceId: string) => {
    try {
      await financeApi.approveInvoice(invoiceId);
      setNotice({ type: "success", message: "Invoice disetujui owner (BELUM_BAYAR)." });
      loadData();
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal menyetujui invoice." });
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await financeApi.recordPayment(payInvoiceId, { amount: Number(payAmount) });
      setNotice({ type: "success", message: "Pembayaran tercatat." });
      setPayModalOpen(false);
      loadData();
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal mencatat pembayaran." });
    }
  };

  const handleCalcHpp = async () => {
    if (!hppOrderId) {
      setNotice({ type: "warning", message: "Pilih order untuk hitung HPP terealisasi." });
      return;
    }
    try {
      const data = await financeApi.getRealizedHpp(hppOrderId);
      setHppData(data);
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal menghitung HPP." });
    }
  };

  const handleApplyHpp = async () => {
    if (!hppOrderId) return;
    try {
      await financeApi.applyHpp(hppOrderId, {
        contract_revenue: hppRevenue ? Number(hppRevenue) : undefined,
        overhead_cost: hppOverhead ? Number(hppOverhead) : undefined,
      });
      setNotice({ type: "success", message: "material_cost HPP diperbarui dari PO terealisasi." });
    } catch (err: any) {
      setNotice({ type: "danger", message: err.message || "Gagal menerapkan HPP." });
    }
  };

  const fmtRp = (v: number | string) => `Rp ${Number(v).toLocaleString("id-ID")}`;

  return (
    <AppLayout
      title="Keuangan — PO Bahan & Invoice Klien"
      subtitle="Pengajuan PO Tim Sample, review Finance/Owner, dan tagihan keseluruhan per order selesai"
      requiredModule="payroll"
    >
      {notice && <Notice type={notice.type} message={notice.message} onClose={() => setNotice(null)} />}

      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        <button onClick={() => setPoModalOpen(true)} className="btn btn-primary">
          📋 Buat PO Bahan
        </button>
        <button onClick={() => setInvModalOpen(true)} className="btn btn-secondary">
          🧾 Terbitkan Invoice
        </button>
        <button onClick={loadData} className="btn btn-ghost btn-sm">
          🔄 Muat Ulang
        </button>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 14 }}>Purchase Order Bahan (Sample → Review → Terima Gudang)</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>No. PO</th>
                <th>Supplier</th>
                <th>Total</th>
                <th>Dipesan / Diterima</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {pos.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                    {loading ? "Memuat PO..." : "Belum ada PO."}
                  </td>
                </tr>
              ) : (
                pos.map((po) => {
                  const ordered = po.lines.reduce((s, l) => s + l.qty_ordered, 0);
                  const received = po.lines.reduce((s, l) => s + l.qty_received, 0);
                  return (
                    <tr key={po.id}>
                      <td className="font-mono" style={{ fontWeight: 700 }}>{po.po_number}</td>
                      <td>{po.supplier_name}</td>
                      <td className="font-mono">{fmtRp(po.total_amount)}</td>
                      <td className="font-mono">{received} / {ordered}</td>
                      <td><span className="badge badge-info">{po.status}</span></td>
                      <td>
                        {po.status === "DRAFT" ? (
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => handleReviewPO(po.id, true)} className="btn btn-primary btn-sm">
                              Setujui
                            </button>
                            <button onClick={() => handleReviewPO(po.id, false)} className="btn btn-secondary btn-sm">
                              Tolak
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>Terverifikasi</span>
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

      <div style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 14 }}>Invoice Klien (Harga Keseluruhan per Order Selesai)</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>No. Invoice</th>
                <th>Total Tagihan</th>
                <th>Dibayar</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                    {loading ? "Memuat invoice..." : "Belum ada invoice."}
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="font-mono" style={{ fontWeight: 700 }}>{inv.invoice_number}</td>
                    <td className="font-mono">{fmtRp(inv.amount_total)}</td>
                    <td className="font-mono">{fmtRp(inv.amount_paid)}</td>
                    <td><span className="badge badge-purple">{inv.status}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: 8 }}>
                        {inv.status === "DRAFT" && (
                          <button onClick={() => handleApproveInvoice(inv.id)} className="btn btn-primary btn-sm">
                            Approve Owner
                          </button>
                        )}
                        {(inv.status === "BELUM_BAYAR" || inv.status === "SEBAGIAN") && (
                          <button
                            onClick={() => { setPayInvoiceId(inv.id); setPayModalOpen(true); }}
                            className="btn btn-secondary btn-sm"
                          >
                            Catat Bayar
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 14 }}>HPP Bahan Terealisasi (Σ qty terima × harga PO)</h3>
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="form-group" style={{ margin: 0, minWidth: 220 }}>
              <label className="form-label">Order</label>
              <select className="form-select" value={hppOrderId} onChange={(e) => setHppOrderId(e.target.value)}>
                <option value="">Pilih order</option>
                {orders.map((o) => (
                  <option key={o.id} value={o.id}>{o.order_number}</option>
                ))}
              </select>
            </div>
            <button onClick={handleCalcHpp} className="btn btn-secondary">Hitung Terealisasi</button>
          </div>
          {hppData && (
            <div style={{ marginTop: 16 }}>
              <div className="font-mono" style={{ fontSize: "1.2rem", fontWeight: 800 }}>
                Rp {Number(hppData.realized_material_cost).toLocaleString("id-ID")}
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
                {hppData.po_count} PO dihitung: {hppData.breakdown.map((b) => `${b.po_number} (${b.status})`).join(", ") || "-"}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Revenue (Rp)</label>
                  <input type="number" className="form-input" value={hppRevenue} onChange={(e) => setHppRevenue(e.target.value)} placeholder="Wajib jika HPP baru" />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Overhead (Rp)</label>
                  <input type="number" className="form-input" value={hppOverhead} onChange={(e) => setHppOverhead(e.target.value)} placeholder="Wajib jika HPP baru" />
                </div>
                <button onClick={handleApplyHpp} className="btn btn-primary">Terapkan ke HPP</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={poModalOpen} onClose={() => setPoModalOpen(false)} title="📋 Pengajuan PO Bahan">
        <form onSubmit={handleCreatePO}>
          <div className="form-group">
            <label className="form-label">Nomor PO</label>
            <input type="text" className="form-input" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} placeholder="PO-2026-001" required />
          </div>
          <div className="form-group">
            <label className="form-label">Order Produksi</label>
            <select className="form-select" value={poOrderId} onChange={(e) => setPoOrderId(e.target.value)} required>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>{o.order_number} ({o.status})</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Supplier</label>
            <input type="text" className="form-input" value={poSupplier} onChange={(e) => setPoSupplier(e.target.value)} placeholder="PT Supplier Tekstil" required />
          </div>
          <div className="form-group">
            <label className="form-label">Bahan</label>
            <select className="form-select" value={poItemId} onChange={(e) => setPoItemId(e.target.value)} required>
              {items.map((it) => (
                <option key={it.id} value={it.id}>{it.material_code} — {it.material_name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Qty</label>
              <input type="number" className="form-input" value={poQty} onChange={(e) => setPoQty(Number(e.target.value))} min={1} required />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Harga Satuan (Rp)</label>
              <input type="number" className="form-input" value={poPrice} onChange={(e) => setPoPrice(Number(e.target.value))} min={0} required />
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setPoModalOpen(false)}>Batal</button>
            <button type="submit" className="btn btn-primary">Ajukan PO</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={invModalOpen} onClose={() => setInvModalOpen(false)} title="🧾 Terbitkan Invoice">
        <form onSubmit={handleCreateInvoice}>
          <div className="notice notice-info" style={{ marginBottom: 16 }}>
            <span>💡</span>
            <div style={{ fontSize: "0.82rem" }}>Hanya order COMPLETED. Kosongkan nominal untuk otomatis agreed_price × target qty.</div>
          </div>
          <div className="form-group">
            <label className="form-label">Nomor Invoice</label>
            <input type="text" className="form-input" value={invNumber} onChange={(e) => setInvNumber(e.target.value)} placeholder="INV-2026-001" required />
          </div>
          <div className="form-group">
            <label className="form-label">Order Selesai</label>
            <select className="form-select" value={invOrderId} onChange={(e) => setInvOrderId(e.target.value)} required>
              {orders.filter((o) => o.status === "COMPLETED").map((o) => (
                <option key={o.id} value={o.id}>{o.order_number}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Nominal (Rp, opsional)</label>
            <input type="number" className="form-input" value={invAmount} onChange={(e) => setInvAmount(e.target.value)} min={1} placeholder="Otomatis dari harga deal" />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setInvModalOpen(false)}>Batal</button>
            <button type="submit" className="btn btn-primary">Terbitkan</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={payModalOpen} onClose={() => setPayModalOpen(false)} title="💰 Catat Pembayaran">
        <form onSubmit={handlePay}>
          <div className="form-group">
            <label className="form-label">Jumlah Bayar (Rp)</label>
            <input type="number" className="form-input" value={payAmount} onChange={(e) => setPayAmount(Number(e.target.value))} min={1} required />
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => setPayModalOpen(false)}>Batal</button>
            <button type="submit" className="btn btn-primary">Simpan</button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}
