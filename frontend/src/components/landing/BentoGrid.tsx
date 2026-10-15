"use client";

import React from "react";
import { LANDING_CONTENT } from "../../content/landing";
import { MiniLineChart, MiniBarChart } from "../visuals/MiniChart";

export function BentoGrid() {
  const { bento } = LANDING_CONTENT;

  return (
    <section
      id="layanan"
      style={{
        padding: "80px 0 100px 0",
        background: "#FAF8FF",
        borderTop: "1px solid #EDE9FE",
        borderBottom: "1px solid #EDE9FE",
      }}
    >
      <div className="container" style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
        {/* Section Header */}
        <div style={{ textAlign: "center", maxWidth: 680, margin: "0 auto 52px auto" }}>
          <span
            style={{
              display: "inline-block",
              padding: "6px 14px",
              borderRadius: 9999,
              background: "#EDE9FE",
              color: "#6D28D9",
              fontSize: "0.82rem",
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            {bento.sectionBadge}
          </span>
          <h2
            style={{
              fontSize: "clamp(2rem, 3.8vw, 2.75rem)",
              fontWeight: 800,
              color: "#2E1065",
              letterSpacing: "-0.025em",
              lineHeight: 1.15,
              margin: "0 0 14px 0",
            }}
          >
            {bento.sectionTitle}
          </h2>
          <p style={{ fontSize: "1.05rem", color: "#5B5870", lineHeight: 1.6, margin: 0 }}>
            {bento.sectionSubtitle}
          </p>
        </div>

        {/* Bento Grid Asymmetric Layout (2 Rows x Responsive Columns) */}
        <div
          className="bento-grid-container"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: 24,
          }}
        >
          {/* KARTU 1: Gelap Ungu (Pemisahan Stok Otomatis + MiniLineChart) - 7 Kolom */}
          <a
            href="#fitur"
            className="bento-card-link"
            style={{
              gridColumn: "span 7",
              background: "linear-gradient(145deg, #2E1065 0%, #1E0A45 100%)",
              borderRadius: 28,
              padding: "36px 36px 32px 36px",
              color: "#ffffff",
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 20px 48px -10px rgba(46, 16, 101, 0.4)",
              border: "1px solid rgba(196, 181, 253, 0.2)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              position: "relative",
              overflow: "hidden",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.boxShadow = "0 28px 60px -8px rgba(46, 16, 101, 0.55)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 20px 48px -10px rgba(46, 16, 101, 0.4)";
            }}
          >
            {/* Ambient inner glow */}
            <div
              style={{
                position: "absolute",
                top: -60,
                right: -60,
                width: 200,
                height: 200,
                borderRadius: "50%",
                background: "rgba(236, 72, 153, 0.25)",
                filter: "blur(50px)",
                pointerEvents: "none",
              }}
            />

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span
                  style={{
                    background: "rgba(196, 181, 253, 0.18)",
                    border: "1px solid rgba(196, 181, 253, 0.3)",
                    padding: "6px 14px",
                    borderRadius: 9999,
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: "#C4B5FD",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>🛡️</span>
                  <span>Proteksi Anti-Kontaminasi Silang</span>
                </span>
                <span style={{ fontSize: "1.2rem", color: "#C4B5FD" }}>↗</span>
              </div>

              <h3 style={{ fontSize: "1.65rem", fontWeight: 800, color: "#ffffff", margin: "0 0 10px 0", lineHeight: 1.25 }}>
                Pemisahan stok otomatis per klien
              </h3>
              <p style={{ fontSize: "0.95rem", color: "#C4B5FD", lineHeight: 1.55, maxWidth: 440, margin: 0 }}>
                Sistem memblokir pengeluaran bahan jika Tag ID klien tidak cocok dengan nomor pesanan di meja potong.
              </p>
            </div>

            {/* Visual Mini Line Chart */}
            <div style={{ marginTop: 28, paddingTop: 12, borderTop: "1px solid rgba(196, 181, 253, 0.15)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", color: "#C4B5FD", marginBottom: 6 }}>
                <span>Akurasi Alokasi Rak Gudang</span>
                <span style={{ color: "#EC4899", fontWeight: 700 }}>100% Terisolasi</span>
              </div>
              <MiniLineChart />
            </div>
          </a>

          {/* KARTU 2: Putih Terang (Angka Besar + Dot Indikator Referensi 2) - 5 Kolom */}
          <a
            href="#alur"
            className="bento-card-link"
            style={{
              gridColumn: "span 5",
              background: "#ffffff",
              borderRadius: 28,
              padding: "36px 32px",
              color: "#2E1065",
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 10px 30px rgba(46, 16, 101, 0.05)",
              border: "1.5px solid #EDE9FE",
              transition: "transform 0.2s ease, border-color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.borderColor = "#C4B5FD";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.borderColor = "#EDE9FE";
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#6D28D9", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Interval Pencatatan
                </span>
                <span style={{ fontSize: "1.1rem", color: "#7C3AED" }}>↗</span>
              </div>

              {/* Angka Interval Output dari Dokumen SRS */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: "3.75rem", fontWeight: 800, color: "#7C3AED", lineHeight: 1, letterSpacing: "-0.03em" }}>
                  30
                </span>
                <span style={{ fontSize: "1.25rem", fontWeight: 800, color: "#EC4899" }}>
                  Menit
                </span>
              </div>

              <div
                style={{
                  display: "inline-block",
                  padding: "4px 10px",
                  borderRadius: 6,
                  background: "#FAF8FF",
                  border: "1px dashed #C4B5FD",
                  fontSize: "0.72rem",
                  color: "#5B5870",
                  marginBottom: 16,
                }}
              >
                *standar interval mandor di floor produksi (SRS FR-7.3)
              </div>

              <h4 style={{ fontSize: "1.2rem", fontWeight: 800, color: "#2E1065", margin: "0 0 8px 0" }}>
                Input Output Real-Time
              </h4>
              <p style={{ fontSize: "0.9rem", color: "#5B5870", lineHeight: 1.5, margin: 0 }}>
                Pencatatan bertahap per 30 menit meniadakan selisih rekap antara penjahit borongan dan mandor meja.
              </p>
            </div>

            {/* Pagination Dots (Meniru Referensi 2) */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 24, paddingTop: 16, borderTop: "1px solid #EDE9FE" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#7C3AED" }} />
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EDE9FE" }} />
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#EDE9FE" }} />
              <span style={{ marginLeft: "auto", fontSize: "0.78rem", fontWeight: 700, color: "#7C3AED" }}>
                Lihat alur QC →
              </span>
            </div>
          </a>

          {/* KARTU 3: Visual Seragam Kerja Operator Pabrik & Output 30 Menit - 6 Kolom */}
          <a
            href="#alur"
            className="bento-card-link"
            style={{
              gridColumn: "span 6",
              background: "#ffffff",
              borderRadius: 28,
              padding: "32px",
              color: "#2E1065",
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 10px 30px rgba(46, 16, 101, 0.05)",
              border: "1.5px solid #EDE9FE",
              position: "relative",
              overflow: "hidden",
              transition: "transform 0.2s ease, border-color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.borderColor = "#C4B5FD";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.borderColor = "#EDE9FE";
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span
                  style={{
                    background: "#EDE9FE",
                    color: "#6D28D9",
                    padding: "5px 12px",
                    borderRadius: 9999,
                    fontSize: "0.75rem",
                    fontWeight: 700,
                  }}
                >
                  ⏱️ Terminal Produksi
                </span>
                <span style={{ fontSize: "1.1rem", color: "#7C3AED" }}>↗</span>
              </div>

              <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#2E1065", margin: "0 0 6px 0" }}>
                Output tercatat tiap 30 menit
              </h3>
              <p style={{ fontSize: "0.88rem", color: "#5B5870", lineHeight: 1.5, margin: 0, maxWidth: 360 }}>
                Input interval mandor langsung dari tablet layar sentuh dengan stopwatch time study standar garmen.
              </p>
            </div>

            {/* Visual Card Body: Badge ±70 Mesin & Mini Bar Chart */}
            <div
              style={{
                marginTop: 20,
                padding: "16px",
                background: "#FAF8FF",
                borderRadius: 18,
                border: "1px solid #EDE9FE",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#2E1065" }}>
                  Kapasitas Lini Dinamis
                </span>
                <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "#7C3AED" }}>
                  ±70 Mesin Aktif
                </span>
              </div>
              <MiniBarChart />
            </div>
          </a>

          {/* KARTU 4: Pink-Lembut Aksen 10% (Payroll Borongan Otomatis Sabtu) - 6 Kolom */}
          <a
            href="#skema"
            className="bento-card-link"
            style={{
              gridColumn: "span 6",
              background: "linear-gradient(145deg, #FDF2F8 0%, #FAF5FF 100%)",
              borderRadius: 28,
              padding: "32px",
              color: "#2E1065",
              textDecoration: "none",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              boxShadow: "0 10px 30px rgba(236, 72, 153, 0.08)",
              border: "1.5px solid #FBCFE8",
              position: "relative",
              transition: "transform 0.2s ease, border-color 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-4px)";
              e.currentTarget.style.borderColor = "#EC4899";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.borderColor = "#FBCFE8";
            }}
          >
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span
                  style={{
                    background: "rgba(236, 72, 153, 0.15)",
                    color: "#BE185D",
                    padding: "5px 12px",
                    borderRadius: 9999,
                    fontSize: "0.75rem",
                    fontWeight: 700,
                  }}
                >
                  💰 Kunci Audit Sabtu
                </span>
                <span style={{ fontSize: "1.1rem", color: "#EC4899" }}>↗</span>
              </div>

              <h3 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#2E1065", margin: "0 0 6px 0" }}>
                Payroll borongan dihitung otomatis setiap Sabtu
              </h3>
              <p style={{ fontSize: "0.88rem", color: "#5B5870", lineHeight: 1.5, margin: 0 }}>
                Upah dihitung langsung dari output terverifikasi ditambah uang makan 12% dan pembagian pool bonus QC tiga arah.
              </p>
            </div>

            <div
              style={{
                marginTop: 20,
                padding: "12px 16px",
                background: "#ffffff",
                borderRadius: 16,
                border: "1px solid rgba(236, 72, 153, 0.2)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "1.1rem" }}>🔒</span>
                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#2E1065" }}>
                  Audit Lock Permanen
                </span>
              </div>
              <span style={{ fontSize: "0.78rem", color: "#BE185D", fontWeight: 700 }}>
                Tidak bisa diubah sepihak
              </span>
            </div>
          </a>
        </div>
      </div>
    </section>
  );
}
