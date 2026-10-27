"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatClientCode } from "../lib/config";
import type { User } from "../types/api";

interface ClientProfileCardProps {
  user: User | null;
  className?: string;
}

export function ClientProfileCard({ user, className = "" }: ClientProfileCardProps) {
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  // ID Klien resmi: LOE5-<nomor HP>
  const rawClientId = user.client?.client_code || user.client_code || user.client_id;
  const clientCode = formatClientCode(rawClientId);

  const companyName = user.client?.company_name || user.name || "Perusahaan Klien";
  const contactPerson = user.client?.contact_person || user.name;
  const phoneNumber = user.client?.phone_number || "Belum diisi";
  const email = user.email || "-";
  const registerDate = user.created_at
    ? new Date(user.created_at).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "-";

  const handleCopyId = () => {
    navigator.clipboard.writeText(clientCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`card-elevated ${className}`}
      style={{
        marginBottom: 24,
        background: "linear-gradient(135deg, #ffffff 0%, #FAF8FF 100%)",
        border: "1.5px solid #C4B5FD",
        borderRadius: 18,
        padding: "24px",
        boxShadow: "0 10px 25px rgba(124, 58, 237, 0.08)",
      }}
    >
      {/* Top Header: Badge, Title & Copy Client ID */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 16,
          paddingBottom: 18,
          borderBottom: "1px solid #EDE9FE",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Avatar Icon */}
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: "1.5rem",
              fontWeight: 800,
              boxShadow: "0 6px 16px rgba(124, 58, 237, 0.28)",
            }}
          >
            {companyName.charAt(0).toUpperCase()}
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: "1.25rem", color: "#2E1065", fontWeight: 800 }}>
                {companyName}
              </h3>
              <span
                style={{
                  padding: "3px 10px",
                  borderRadius: 9999,
                  background: "#ECFDF5",
                  border: "1px solid #A7F3D0",
                  color: "#059669",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
                Akun Terverifikasi
              </span>
            </div>
            <div style={{ fontSize: "0.82rem", color: "#6D28D9", fontWeight: 600, marginTop: 2 }}>
              Profil Klien Maklon &amp; Brand Terdaftar
            </div>
          </div>
        </div>

        {/* Client ID Badge (LOE5-<nomor HP>) */}
        <div
          style={{
            background: "#2E1065",
            borderRadius: 12,
            padding: "10px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: "#ffffff",
          }}
        >
          <div>
            <div style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#C4B5FD", fontWeight: 700 }}>
              ID Klien Resmi (LOE5 + Nomor HP)
            </div>
            <div style={{ fontFamily: "monospace", fontSize: "1.15rem", fontWeight: 800, color: "#FAF5FF", letterSpacing: "0.05em" }}>
              {clientCode}
            </div>
          </div>

          <button
            type="button"
            onClick={handleCopyId}
            style={{
              background: copied ? "#059669" : "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.25)",
              color: "#ffffff",
              borderRadius: 8,
              padding: "6px 12px",
              fontSize: "0.75rem",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.2s",
              whiteSpace: "nowrap",
            }}
            title="Salin ID Klien"
          >
            {copied ? "✓ Tersalin" : "Salin ID"}
          </button>
        </div>
      </div>

      {/* Grid Profil Pendaftar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginTop: 18,
        }}
      >
        <div style={{ background: "#ffffff", padding: "12px 16px", borderRadius: 10, border: "1px solid #EDE9FE" }}>
          <div style={{ fontSize: "0.72rem", color: "#84829a", fontWeight: 600 }}>Penanggung Jawab (PIC)</div>
          <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#2E1065", marginTop: 2 }}>
            {contactPerson}
          </div>
        </div>

        <div style={{ background: "#ffffff", padding: "12px 16px", borderRadius: 10, border: "1px solid #EDE9FE" }}>
          <div style={{ fontSize: "0.72rem", color: "#84829a", fontWeight: 600 }}>No. WhatsApp / Telepon</div>
          <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#2E1065", marginTop: 2, fontFamily: "monospace" }}>
            {phoneNumber}
          </div>
        </div>

        <div style={{ background: "#ffffff", padding: "12px 16px", borderRadius: 10, border: "1px solid #EDE9FE" }}>
          <div style={{ fontSize: "0.72rem", color: "#84829a", fontWeight: 600 }}>Email Terdaftar</div>
          <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#2E1065", marginTop: 2 }}>
            {email}
          </div>
        </div>

        <div style={{ background: "#ffffff", padding: "12px 16px", borderRadius: 10, border: "1px solid #EDE9FE" }}>
          <div style={{ fontSize: "0.72rem", color: "#84829a", fontWeight: 600 }}>Username Login</div>
          <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#7C3AED", marginTop: 2, fontFamily: "monospace" }}>
            @{user.username}
          </div>
        </div>

        <div style={{ background: "#ffffff", padding: "12px 16px", borderRadius: 10, border: "1px solid #EDE9FE" }}>
          <div style={{ fontSize: "0.72rem", color: "#84829a", fontWeight: 600 }}>Tanggal Pendaftaran</div>
          <div style={{ fontSize: "0.92rem", fontWeight: 700, color: "#2E1065", marginTop: 2 }}>
            {registerDate}
          </div>
        </div>
      </div>

      {/* Footer Info & Quick Link */}
      <div
        style={{
          marginTop: 16,
          paddingTop: 12,
          borderTop: "1px dashed #EDE9FE",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ fontSize: "0.78rem", color: "#6D28D9", display: "flex", alignItems: "center", gap: 6 }}>
          <span>🔒</span>
          <span>
            ID Klien <strong>{clientCode}</strong> digunakan sebagai identitas utama pemisahan stok bahan baku, rekap pesanan, dan pengajuan sample Anda di pabrik Lukla.
          </span>
        </div>

        <Link
          href="/ai-assistant"
          style={{
            fontSize: "0.82rem",
            fontWeight: 700,
            color: "#7C3AED",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span>Tanya Asisten AI seputar Order</span>
          <span>→</span>
        </Link>
      </div>
    </div>
  );
}
