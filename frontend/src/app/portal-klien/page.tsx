"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { AppLayout } from "../../components/AppLayout";
import { Notice } from "../../components/Notice";
import { useAuth } from "../../lib/auth-context";
import { ClientProfileCard } from "../../components/ClientProfileCard";
import { KontakPemesananCard } from "../../components/KontakPemesananCard";
import { gudangApi, produksiApi } from "../../lib/api";
import type { InventoryItem, Order } from "../../types/api";

export default function PortalKlienPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ type: "danger" | "info"; message: string } | null>(null);

  useEffect(() => {
    async function loadClientData() {
      try {
        setLoading(true);
        // Backend otomatis menyaring data sesuai client_id akun KLIEN_MAKLON yang sedang login
        const [myItems, myOrders] = await Promise.all([
          gudangApi.getItems(),
          produksiApi.getOrders(),
        ]);
        setItems(myItems);
        setOrders(myOrders);
      } catch (err: any) {
        setNotice({ type: "danger", message: err.message || "Gagal memuat portal klien." });
      } finally {
        setLoading(false);
      }
    }
    loadClientData();
  }, [user]);

  return (
    <AppLayout
      title="Portal Klien Maklon B2B"
      subtitle="Pemantauan mandiri real-time untuk status pesanan garmen & transparansi stok bahan"
      requiredModule="portal-klien"
    >
      {notice && (
        <Notice
          type={notice.type}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}

      {/* Profil Pendaftar & ID Klien (10 Karakter) — disembunyikan untuk Owner */}
      {!isOwner && <ClientProfileCard user={user} />}

      {/* Hubungi Tim Sample untuk Buat Sample / Tambah Pesanan Baru */}
      {!isOwner && (
      <div
        style={{
          marginBottom: 28,
          background: "#ffffff",
          borderRadius: 14,
          padding: "16px 20px",
          border: "1px solid #EDE9FE",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14,
        }}
      >
        <div>
          <div style={{ fontWeight: 800, color: "#2E1065", fontSize: "0.98rem" }}>
            Ingin Mengajukan Pembuatan Sampel Baru atau Konsultasi Tas?
          </div>
          <div style={{ fontSize: "0.82rem", color: "#6D28D9", marginTop: 2 }}>
            Gunakan ID Klien Anda saat menghubungi Tim Sample agar spesifikasi dan pola terarsip otomatis.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/konsultasi" className="btn btn-secondary btn-sm" style={{ textDecoration: "none" }}>
            💬 Tanya AI Konsultan Maklon →
          </Link>
          <a
            href="https://wa.me/6281234567890?text=Halo%20Tim%20Sample%20Lukla%20Manufacturing!%20Saya%20ingin%20mengajukan%20sample%20baru"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary btn-sm"
            style={{ textDecoration: "none", background: "#25D366", borderColor: "#25D366" }}
          >
            💬 Chat Tim Sample WhatsApp
          </a>
        </div>
      </div>
      )}

      {/* Order Status Cards */}
      <div style={{ marginBottom: 32 }}>
        <h3 style={{ marginBottom: 14 }}>Status Pesanan Produksi Anda</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 18,
          }}
        >
          {orders.length === 0 ? (
            <div className="card" style={{ gridColumn: "1 / -1", textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
              {loading ? "Memuat data pesanan..." : "Belum ada pesanan aktif yang terdaftar untuk akun Anda."}
            </div>
          ) : (
            orders.map((ord) => {
              const tag =
                ord.status === "COMPLETED"
                  ? { label: "Delivering — dikirim ke klien", cls: "badge-success" }
                  : ord.status === "SEWING" || ord.status === "MENUNGGU_QC" || ord.status === "QC"
                  ? { label: "Production — sedang diproduksi", cls: "badge-info" }
                  : { label: "Pending — masih di gudang", cls: "badge-warning" };
              return (
              <div key={ord.id} className="card-elevated">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span className="badge badge-purple">{ord.scheme}</span>
                  <span className={`badge ${tag.cls}`}>
                    {tag.label}
                  </span>
                </div>

                <h4 style={{ fontSize: "1.1rem", marginBottom: 6 }}>{ord.order_number}</h4>
                <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 14 }}>
                  Target Selesai: <strong>{ord.target_quantity.toLocaleString("id-ID")} pcs</strong>
                </div>

                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", borderTop: "1px solid var(--border-subtle)", paddingTop: 10 }}>
                  Dibuat pada: {new Date(ord.created_at).toLocaleDateString("id-ID")}
                </div>
              </div>
              );
            })
          )}
        </div>
      </div>

      {/* Inventory Stock Table */}
      <div>
        <h3 style={{ marginBottom: 14 }}>Transparansi Sisa Bahan Baku Anda di Gudang</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Kode Material</th>
                <th>Nama Bahan / Kain</th>
                <th>Sisa Stok Saat Ini</th>
                <th>Satuan</th>
                <th>Status Keamanan</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                    {loading ? "Memuat stok..." : "Tidak ada stok bahan yang tersimpan."}
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={it.id}>
                    <td className="font-mono" style={{ fontWeight: 700, color: "var(--accent-primary)" }}>
                      {it.material_code}
                    </td>
                    <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{it.material_name}</td>
                    <td className="font-mono" style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--color-success)" }}>
                      {it.current_stock.toLocaleString("id-ID")}
                    </td>
                    <td>{it.unit_measure}</td>
                    <td>
                      <span className="badge badge-success">🔒 Bebas Kontaminasi Silang</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </AppLayout>
  );
}
