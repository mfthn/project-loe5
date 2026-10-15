"use client";

import React from "react";
import Link from "next/link";
import { LANDING_CONTENT } from "../../content/landing";

export function FeaturesSection() {
  const { features } = LANDING_CONTENT;

  return (
    <section
      id="fitur"
      style={{
        padding: "100px 0",
        background: "#FFFFFF",
      }}
    >
      <div className="container" style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
        {/* Section Header */}
        <div style={{ textAlign: "center", maxWidth: 680, margin: "0 auto 80px auto" }}>
          <span
            style={{
              display: "inline-block",
              padding: "6px 16px",
              borderRadius: 9999,
              background: "#EDE9FE",
              color: "#6D28D9",
              fontSize: "0.82rem",
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            Inovasi Operasional Garmen
          </span>
          <h2
            style={{
              fontSize: "clamp(2rem, 3.8vw, 2.75rem)",
              fontWeight: 800,
              color: "#2E1065",
              letterSpacing: "-0.025em",
              lineHeight: 1.15,
              margin: "0 0 16px 0",
            }}
          >
            Tiga Sistem Proteksi Utama Pabrik Kami
          </h2>
          <p style={{ fontSize: "1.05rem", color: "#5B5870", lineHeight: 1.6, margin: 0 }}>
            Menjamin keamanan material brand Anda dan keakuratan setiap meter kain yang dipotong.
          </p>
        </div>

        {/* 3 Feature Blocks (Alternating Layout) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 96 }}>
          {features.map((feat) => {
            const isReverse = feat.reverse;
            return (
              <div
                key={feat.id}
                className="feature-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 64,
                  alignItems: "center",
                  direction: isReverse ? "rtl" : "ltr",
                }}
              >
                {/* Teks Deskripsi */}
                <div style={{ direction: "ltr" }}>
                  <span
                    style={{
                      display: "inline-block",
                      padding: "5px 14px",
                      borderRadius: 9999,
                      background: "#EDE9FE",
                      color: "#7C3AED",
                      fontSize: "0.78rem",
                      fontWeight: 800,
                      marginBottom: 14,
                    }}
                  >
                    {feat.badge}
                  </span>
                  <h3
                    style={{
                      fontSize: "clamp(1.75rem, 3vw, 2.35rem)",
                      fontWeight: 800,
                      color: "#2E1065",
                      lineHeight: 1.2,
                      letterSpacing: "-0.02em",
                      margin: "0 0 16px 0",
                    }}
                  >
                    {feat.title}
                  </h3>
                  <p style={{ fontSize: "1.02rem", color: "#5B5870", lineHeight: 1.65, margin: "0 0 24px 0" }}>
                    {feat.desc}
                  </p>

                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px 0", display: "flex", flexDirection: "column", gap: 12 }}>
                    {feat.highlights.map((h, i) => (
                      <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: "0.92rem", color: "#2E1065" }}>
                        <span style={{ color: "#EC4899", fontWeight: 800 }}>✓</span>
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href={feat.linkHref}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: "0.92rem",
                      fontWeight: 700,
                      color: "#7C3AED",
                      textDecoration: "none",
                      padding: "10px 0",
                      borderBottom: "2px solid #C4B5FD",
                      transition: "all 0.2s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#7C3AED")}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#C4B5FD")}
                  >
                    <span>{feat.linkText}</span>
                    <span>→</span>
                  </Link>
                </div>

                {/* Mockup / Visualisasi Fitur */}
                <div style={{ direction: "ltr" }}>
                  {feat.id === "kontaminasi" && (
                    <div
                      style={{
                        background: "linear-gradient(145deg, #FAF8FF 0%, #FFFFFF 100%)",
                        borderRadius: 28,
                        padding: "36px",
                        border: "1.5px solid #C4B5FD",
                        boxShadow: "0 20px 48px rgba(124, 58, 237, 0.12)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#2E1065" }}>
                          SISTEM GUARD GUDANG CUTTING
                        </span>
                        <span style={{ padding: "4px 10px", borderRadius: 9999, background: "#FEE2E2", color: "#DC2626", fontSize: "0.75rem", fontWeight: 700 }}>
                          🛑 Guard Aktif
                        </span>
                      </div>

                      <div style={{ background: "#ffffff", padding: "16px", borderRadius: 16, border: "1px solid #EDE9FE", marginBottom: 14 }}>
                        <div style={{ fontSize: "0.75rem", color: "#5B5870", marginBottom: 4 }}>Surat Jalan Meja Potong:</div>
                        <div style={{ fontWeight: 700, color: "#2E1065", fontSize: "0.95rem" }}>PO-0142 (Klien Maklon A)</div>
                      </div>

                      <div
                        style={{
                          background: "#FEF2F2",
                          padding: "16px",
                          borderRadius: 16,
                          border: "1px solid #FECACA",
                          color: "#991B1B",
                        }}
                      >
                        <div style={{ fontWeight: 700, fontSize: "0.88rem", display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <span>⚠️</span>
                          <span>Pemindaian Dicegat: Bahan Tidak Cocok!</span>
                        </div>
                        <div style={{ fontSize: "0.8rem", lineHeight: 1.45 }}>
                          Kain Tag ID #KLN02-ROLL88 terdaftar milik Klien B. Sistem menolak pemotongan untuk order Klien A.
                        </div>
                      </div>
                    </div>
                  )}

                  {feat.id === "terminal-30m" && (
                    <div
                      style={{
                        background: "linear-gradient(145deg, #2E1065 0%, #1F0B46 100%)",
                        borderRadius: 28,
                        padding: "36px",
                        border: "1.5px solid rgba(196, 181, 253, 0.3)",
                        boxShadow: "0 20px 48px rgba(46, 16, 101, 0.35)",
                        color: "#ffffff",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#C4B5FD" }}>
                          TABLET MANDOR LINE 2 (INTERVAL 30M)
                        </span>
                        <span style={{ background: "rgba(236, 72, 153, 0.2)", color: "#FBCFE8", padding: "4px 10px", borderRadius: 9999, fontSize: "0.75rem", fontWeight: 700 }}>
                          14:00 - 14:30 WIB
                        </span>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
                        <div style={{ background: "rgba(255, 255, 255, 0.08)", padding: 14, borderRadius: 14 }}>
                          <div style={{ fontSize: "0.72rem", color: "#C4B5FD" }}>Target Interval</div>
                          <div style={{ fontSize: "1.35rem", fontWeight: 800 }}>45 pcs</div>
                        </div>
                        <div style={{ background: "rgba(255, 255, 255, 0.08)", padding: 14, borderRadius: 14 }}>
                          <div style={{ fontSize: "0.72rem", color: "#C4B5FD" }}>Output Terverifikasi</div>
                          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#34D399" }}>48 pcs (+3)</div>
                        </div>
                      </div>

                      <div style={{ padding: "12px 14px", background: "rgba(196, 181, 253, 0.12)", borderRadius: 12, fontSize: "0.78rem", color: "#C4B5FD" }}>
                        ⏱️ Stopwatch Rata-rata Sewing: <strong>38 detik per komponen badan</strong> (Sesuai Time Study v2)
                      </div>
                    </div>
                  )}

                  {feat.id === "payroll-audit" && (
                    <div
                      style={{
                        background: "linear-gradient(145deg, #FAF8FF 0%, #FFFFFF 100%)",
                        borderRadius: 28,
                        padding: "36px",
                        border: "1.5px solid #C4B5FD",
                        boxShadow: "0 20px 48px rgba(124, 58, 237, 0.12)",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#2E1065" }}>
                          REKAP BORONGAN MINGGUAN (SABTU)
                        </span>
                        <span style={{ background: "#EDE9FE", color: "#6D28D9", padding: "4px 10px", borderRadius: 9999, fontSize: "0.75rem", fontWeight: 700 }}>
                          🔒 Status: Locked (FR-10.1)
                        </span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "0.85rem", marginBottom: 18 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#ffffff", borderRadius: 10, border: "1px solid #EDE9FE" }}>
                          <span style={{ color: "#5B5870" }}>Upah Jahit Borongan (Rate Card)</span>
                          <span style={{ fontWeight: 700, color: "#2E1065" }}>Pcs Lolos × Rate Komponen</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#ffffff", borderRadius: 10, border: "1px solid #EDE9FE" }}>
                          <span style={{ color: "#5B5870" }}>Uang Makan (FR-10.2 Fleksibel)</span>
                          <span style={{ fontWeight: 700, color: "#7C3AED" }}>10–15% dari Total Ongkos Jahit</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", background: "#FAF5FF", borderRadius: 10, border: "1px solid #FBCFE8" }}>
                          <span style={{ color: "#5B5870" }}>Pool Bonus QC 3-Arah (FR-10.3)</span>
                          <span style={{ fontWeight: 700, color: "#EC4899" }}>Dibagi Rata 2 Mandor + 1 Kepala Ops</span>
                        </div>
                      </div>

                      <div style={{ fontSize: "0.75rem", color: "#5B5870", textAlign: "center" }}>
                        *Dihitung setiap Sabtu tanpa batas penjahit; output diverifikasi mandor sebelum kunci audit.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
