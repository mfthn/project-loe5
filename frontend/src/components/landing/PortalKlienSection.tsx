"use client";

import React from "react";
import Link from "next/link";
import { LANDING_CONTENT } from "../../content/landing";

export function PortalKlienSection() {
  const { portalKlien } = LANDING_CONTENT;

  return (
    <section
      id="portal-klien"
      style={{
        padding: "100px 0",
        background: "#FAF8FF",
        borderTop: "1px solid #EDE9FE",
        borderBottom: "1px solid #EDE9FE",
      }}
    >
      <div className="container" style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1.15fr",
            gap: 60,
            alignItems: "center",
          }}
          className="portal-grid"
        >
          {/* Sisi Kiri: Deskripsi & CTA Masuk Portal */}
          <div>
            <span
              style={{
                display: "inline-block",
                padding: "6px 16px",
                borderRadius: 9999,
                background: "#EDE9FE",
                color: "#6D28D9",
                fontSize: "0.82rem",
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              {portalKlien.badge}
            </span>
            <h2
              style={{
                fontSize: "clamp(2rem, 3.8vw, 2.75rem)",
                fontWeight: 800,
                color: "#2E1065",
                lineHeight: 1.15,
                letterSpacing: "-0.025em",
                margin: "0 0 18px 0",
              }}
            >
              {portalKlien.title}
            </h2>
            <p style={{ fontSize: "1.05rem", color: "#5B5870", lineHeight: 1.6, margin: "0 0 28px 0" }}>
              {portalKlien.subtitle}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 36 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "0.95rem", color: "#2E1065", fontWeight: 600 }}>
                <span style={{ color: "#7C3AED", fontSize: "1.1rem" }}>👁️</span>
                <span>Akses Read-Only: Pantau status batch tanpa risiko merusak data</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "0.95rem", color: "#2E1065", fontWeight: 600 }}>
                <span style={{ color: "#7C3AED", fontSize: "1.1rem" }}>📦</span>
                <span>Saldo Stok Bahan Titipan: Cek sisa meter kain per rol langsung di gudang</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: "0.95rem", color: "#2E1065", fontWeight: 600 }}>
                <span style={{ color: "#7C3AED", fontSize: "1.1rem" }}>📑</span>
                <span>Unduh Surat Jalan &amp; Rekap QC per batch pengiriman</span>
              </div>
            </div>

            <Link
              href={portalKlien.ctaHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 12,
                background: "#7C3AED",
                color: "#ffffff",
                padding: "14px 28px",
                borderRadius: 9999,
                fontWeight: 700,
                fontSize: "0.95rem",
                textDecoration: "none",
                boxShadow: "0 10px 24px rgba(124, 58, 237, 0.3)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#6D28D9";
                e.currentTarget.style.transform = "translateY(-2px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "#7C3AED";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <span>{portalKlien.ctaText}</span>
              <span>→</span>
            </Link>
          </div>

          {/* Sisi Kanan: Mockup Visual Kartu Tracker Klien (Bukan Screenshot Asli) */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 28,
              padding: "36px",
              border: "1.5px solid #C4B5FD",
              boxShadow: "0 24px 60px rgba(124, 58, 237, 0.12)",
            }}
          >
            {/* Header Mockup */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24, paddingBottom: 18, borderBottom: "1px solid #EDE9FE" }}>
              <div>
                <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#5B5870", fontWeight: 700 }}>
                  PORTAL MITRA MAKLON B2B
                </span>
                <div style={{ fontSize: "1.2rem", fontWeight: 800, color: "#2E1065" }}>
                  PO #LK-2026-0142 (Jaket Gunung Outdoor)
                </div>
              </div>
              <span
                style={{
                  background: "#ECFDF5",
                  color: "#059669",
                  border: "1px solid #A7F3D0",
                  padding: "5px 12px",
                  borderRadius: 9999,
                  fontSize: "0.78rem",
                  fontWeight: 700,
                }}
              >
                On Schedule
              </span>
            </div>

            {/* Stage Progress Bar (Sample -> Cutting -> Sewing -> QC -> Selesai) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {portalKlien.stages.map((stg, idx) => {
                const isCompleted = stg.status === "Selesai";
                const isOngoing = stg.status === "Sedang Berjalan";
                return (
                  <div
                    key={stg.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 18px",
                      borderRadius: 14,
                      background: isOngoing ? "#FAF8FF" : isCompleted ? "#ffffff" : "#FAFAFA",
                      border: `1px solid ${isOngoing ? "#7C3AED" : isCompleted ? "#EDE9FE" : "#F3F4F6"}`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <span
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: isCompleted ? "#7C3AED" : isOngoing ? "#EC4899" : "#E5E7EB",
                          color: "#ffffff",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.78rem",
                          fontWeight: 800,
                        }}
                      >
                        {isCompleted ? "✓" : idx + 1}
                      </span>
                      <div>
                        <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#2E1065" }}>{stg.name}</div>
                        <div style={{ fontSize: "0.75rem", color: "#5B5870" }}>{stg.date}</div>
                      </div>
                    </div>

                    <span
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        color: isCompleted ? "#7C3AED" : isOngoing ? "#EC4899" : "#9CA3AF",
                      }}
                    >
                      {stg.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
