"use client";

import React from "react";
import Link from "next/link";
import { LANDING_CONTENT } from "../../content/landing";

export function AsistenSection() {
  const { asistenCta, brand } = LANDING_CONTENT;

  return (
    <section
      id="asisten"
      style={{
        padding: "100px 0",
        background: "linear-gradient(145deg, #2E1065 0%, #170733 100%)",
        color: "#ffffff",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Ambient pink glow */}
      <div
        style={{
          position: "absolute",
          top: "10%",
          right: "-10%",
          width: 500,
          height: 500,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(236, 72, 153, 0.22) 0%, transparent 70%)",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}
      />

      <div className="container" style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", position: "relative", zIndex: 2 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 56,
            alignItems: "center",
          }}
          className="asisten-grid"
        >
          {/* Sisi Kiri: Judul & CTA */}
          <div>
            <span
              style={{
                display: "inline-block",
                padding: "6px 16px",
                borderRadius: 9999,
                background: "rgba(196, 181, 253, 0.2)",
                color: "#C4B5FD",
                fontSize: "0.82rem",
                fontWeight: 700,
                border: "1px solid rgba(196, 181, 253, 0.3)",
                marginBottom: 16,
              }}
            >
              {asistenCta.badge}
            </span>

            <h2
              style={{
                fontSize: "clamp(2rem, 3.8vw, 2.85rem)",
                fontWeight: 800,
                color: "#ffffff",
                lineHeight: 1.15,
                letterSpacing: "-0.025em",
                margin: "0 0 18px 0",
              }}
            >
              {asistenCta.title}
            </h2>

            <p style={{ fontSize: "1.08rem", color: "#C4B5FD", lineHeight: 1.6, margin: "0 0 28px 0" }}>
              {asistenCta.subtitle}
            </p>

            {/* Chips Pertanyaan Cepat */}
            <div style={{ marginBottom: 32 }}>
              <div style={{ fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#C4B5FD", fontWeight: 700, marginBottom: 10 }}>
                Pertanyaan Populer Calon Klien:
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {asistenCta.suggestedChips.map((chip, idx) => (
                  <Link
                    key={idx}
                    href={`/ai-assistant?prompt=${encodeURIComponent(chip)}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 14px",
                      borderRadius: 10,
                      background: "rgba(255, 255, 255, 0.08)",
                      border: "1px solid rgba(196, 181, 253, 0.25)",
                      color: "#FAF8FF",
                      fontSize: "0.85rem",
                      textDecoration: "none",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(124, 58, 237, 0.4)";
                      e.currentTarget.style.borderColor = "#EC4899";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                      e.currentTarget.style.borderColor = "rgba(196, 181, 253, 0.25)";
                    }}
                  >
                    <span style={{ color: "#EC4899", fontWeight: 700 }}>💡</span>
                    <span>{chip}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Dua Tombol Aksi */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
              <Link
                href={asistenCta.ctaPrimaryHref}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  background: "#7C3AED",
                  color: "#ffffff",
                  padding: "14px 28px",
                  borderRadius: 9999,
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  textDecoration: "none",
                  boxShadow: "0 10px 24px rgba(124, 58, 237, 0.4)",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#6D28D9")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#7C3AED")}
              >
                <span>💬</span>
                <span>{asistenCta.ctaPrimary}</span>
              </Link>

              <a
                href={brand.consultationWhatsapp}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(255, 255, 255, 0.1)",
                  color: "#ffffff",
                  border: "1px solid rgba(196, 181, 253, 0.4)",
                  padding: "14px 24px",
                  borderRadius: 9999,
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  textDecoration: "none",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.18)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)")}
              >
                <span>📱</span>
                <span>Hubungi Pemesanan</span>
              </a>
            </div>

            <div style={{ fontSize: "0.78rem", color: "#C4B5FD", opacity: 0.85, lineHeight: 1.5 }}>
              {asistenCta.disclaimer}
            </div>
          </div>

          {/* Sisi Kanan: Ilustrasi Percakapan Chatbot (2 Bubble) */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 28,
              padding: "36px",
              boxShadow: "0 24px 60px rgba(0, 0, 0, 0.25)",
              color: "#2E1065",
            }}
          >
            {/* Header Chat */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, paddingBottom: 16, borderBottom: "1px solid #EDE9FE" }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ffffff",
                  fontSize: "1.2rem",
                }}
              >
                🤖
              </div>
              <div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "#2E1065" }}>
                  Asisten Calon Klien (RAG)
                </div>
                <div style={{ fontSize: "0.75rem", color: "#059669", fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#059669", display: "inline-block" }} />
                  Siap Menjawab 24/7 seputar SOP &amp; Maklon
                </div>
              </div>
            </div>

            {/* 2 Chat Bubbles */}
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {/* User Bubble */}
              <div style={{ alignSelf: "flex-end", maxWidth: "85%" }}>
                <div
                  style={{
                    background: "#EDE9FE",
                    color: "#2E1065",
                    padding: "14px 18px",
                    borderRadius: "18px 18px 4px 18px",
                    fontSize: "0.9rem",
                    lineHeight: 1.5,
                    fontWeight: 600,
                  }}
                >
                  {asistenCta.sampleChat[0].text}
                </div>
                <div style={{ fontSize: "0.68rem", color: "#84829a", textAlign: "right", marginTop: 4 }}>
                  Calon Klien • Baru saja
                </div>
              </div>

              {/* AI Bubble */}
              <div style={{ alignSelf: "flex-start", maxWidth: "90%" }}>
                <div
                  style={{
                    background: "#FAF8FF",
                    border: "1.5px solid #C4B5FD",
                    color: "#2E1065",
                    padding: "16px 20px",
                    borderRadius: "18px 18px 18px 4px",
                    fontSize: "0.9rem",
                    lineHeight: 1.55,
                  }}
                >
                  {asistenCta.sampleChat[1].text}
                </div>
                <div style={{ fontSize: "0.68rem", color: "#84829a", marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>📚 Rujukan: SOP Maklon &amp; Time Study Garmen Ciwidey</span>
                </div>
              </div>
            </div>

            {/* Input Mini Teaser */}
            <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #EDE9FE" }}>
              <Link
                href="/ai-assistant"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 18px",
                  borderRadius: 9999,
                  background: "#FAF8FF",
                  border: "1px solid #EDE9FE",
                  color: "#5B5870",
                  fontSize: "0.85rem",
                  textDecoration: "none",
                }}
              >
                <span>Ketik pertanyaan Anda di sini...</span>
                <span
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "#7C3AED",
                    color: "#ffffff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.85rem",
                  }}
                >
                  →
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
