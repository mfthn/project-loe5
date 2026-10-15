"use client";

import React, { useState } from "react";

export const SAMPLE_CHAT_TEMPLATE = `Halo Tim Sample Lukla Manufacturing! 👋
Saya ingin berdiskusi mengenai kebutuhan produksi dan pembuatan sampel baru.

Detail Pengajuan Sampel:
- Nama / Brand: [Isi Nama Brand/Perusahaan Anda]
- Jenis Produk: Tas / Apparel / Garmen
- Skema Maklon: [CMT / Semi-CMT / Full Package]
- Rencana Jumlah (Estimasi Qty): [Contoh: 100 - 500 pcs]
- Bahan Baku: [Disediakan Sendiri / Dari Pabrik]
- Referensi Desain / Techpack: [Ada / Menyusul]

Mohon informasi ketersediaan jadwal tim sample dan tahap pembuatan sample v1 selanjutnya. Terima kasih!`;

interface KontakPemesananCardProps {
  whatsappNumber?: string;
  telegramUsername?: string;
  showTemplatePreview?: boolean;
  compact?: boolean;
}

export function KontakPemesananCard({
  whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "08xx-xxxx-xxxx",
  telegramUsername = process.env.NEXT_PUBLIC_TELEGRAM_USERNAME || "@username_admin",
  showTemplatePreview = true,
  compact = false,
}: KontakPemesananCardProps) {
  const [copied, setCopied] = useState(false);
  const [showFullTemplate, setShowFullTemplate] = useState(false);

  // Sanitasi nomor WhatsApp untuk link wa.me
  const cleanPhone = whatsappNumber.replace(/[^0-9]/g, "");
  const waTarget = cleanPhone.startsWith("0")
    ? `62${cleanPhone.slice(1)}`
    : cleanPhone.startsWith("62")
    ? cleanPhone
    : cleanPhone.length > 5
    ? cleanPhone
    : "6281234567890"; // fallback nomor resmi pabrik

  const cleanTele = telegramUsername.replace("@", "");
  const teleTarget = cleanTele !== "username_admin" ? cleanTele : "lukla_manufacturing";

  const waUrl = `https://wa.me/${waTarget}?text=${encodeURIComponent(SAMPLE_CHAT_TEMPLATE)}`;
  const teleUrl = `https://t.me/${teleTarget}?text=${encodeURIComponent(SAMPLE_CHAT_TEMPLATE)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(SAMPLE_CHAT_TEMPLATE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div style={{ marginTop: 14, width: "100%", maxWidth: 640 }}>
      {/* Label Header */}
      <div
        style={{
          fontSize: "0.85rem",
          fontWeight: 700,
          color: "var(--text-secondary, #94a3b8)",
          marginBottom: 8,
          letterSpacing: "0.01em",
        }}
      >
        Kontak pemesanan
      </div>

      {/* Main Dark Box - Mirip Persis Screenshot */}
      <div
        style={{
          background: "#09090b",
          border: "1px solid #27272a",
          borderRadius: 14,
          padding: "14px 18px",
          color: "#ffffff",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
        }}
      >
        {/* Row 1: WhatsApp */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 12,
            borderBottom: "1px solid #1f1f23",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* WhatsApp Icon */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(37, 211, 102, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#f4f4f5" }}>
                WhatsApp
              </div>
              <div style={{ fontSize: "0.86rem", color: "#a1a1aa", fontFamily: "monospace", marginTop: 1 }}>
                {whatsappNumber}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "0.78rem", color: "#71717a" }}>
              Ganti dengan nomor resmi
            </span>
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm"
              style={{
                background: "#25D366",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: "0.78rem",
                fontWeight: 700,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              Buka Chat ↗
            </a>
          </div>
        </div>

        {/* Row 2: Telegram */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingTop: 12,
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Telegram Icon */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "rgba(56, 189, 248, 0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#f4f4f5" }}>
                Telegram
              </div>
              <div style={{ fontSize: "0.86rem", color: "#a1a1aa", fontFamily: "monospace", marginTop: 1 }}>
                {telegramUsername}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "0.78rem", color: "#71717a" }}>
              Ganti dengan username resmi
            </span>
            <a
              href={teleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-sm"
              style={{
                background: "#0284c7",
                color: "#ffffff",
                border: "none",
                borderRadius: 8,
                padding: "6px 12px",
                fontSize: "0.78rem",
                fontWeight: 700,
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                whiteSpace: "nowrap",
                cursor: "pointer",
              }}
            >
              Buka Chat ↗
            </a>
          </div>
        </div>

        {/* Template Chat untuk Bagian Sample Perusahaan */}
        {showTemplatePreview && (
          <div
            style={{
              marginTop: 14,
              paddingTop: 12,
              borderTop: "1px dashed #27272a",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 8,
              }}
            >
              <div style={{ fontSize: "0.78rem", color: "#cbd5e1", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                <span>📝</span>
                <span>Template Chat untuk Bagian Sample Perusahaan:</span>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  background: copied ? "#059669" : "#27272a",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: 6,
                  padding: "4px 10px",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.2s",
                }}
              >
                {copied ? "✓ Tersalin ke Clipboard" : "📋 Salin Template"}
              </button>
            </div>

            <div
              style={{
                background: "#18181b",
                border: "1px solid #27272a",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: "0.76rem",
                color: "#e4e4e7",
                lineHeight: 1.5,
                fontFamily: "monospace",
                whiteSpace: "pre-wrap",
                maxHeight: showFullTemplate ? "none" : "86px",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {SAMPLE_CHAT_TEMPLATE}
              {!showFullTemplate && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    height: 36,
                    background: "linear-gradient(to bottom, transparent, #18181b)",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    paddingBottom: 2,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setShowFullTemplate(true)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#a78bfa",
                      fontSize: "0.72rem",
                      cursor: "pointer",
                      fontWeight: 600,
                    }}
                  >
                    Lihat selengkapnya ↓
                  </button>
                </div>
              )}
            </div>
            {showFullTemplate && (
              <div style={{ textAlign: "right", marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setShowFullTemplate(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#a78bfa",
                    fontSize: "0.72rem",
                    cursor: "pointer",
                  }}
                >
                  Sembunyikan ↑
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
