"use client";

import React from "react";
import Link from "next/link";
import { LANDING_CONTENT } from "../../content/landing";

export function ClosingCtaSection() {
  const { closingCta, brand } = LANDING_CONTENT;

  return (
    <section
      style={{
        padding: "100px 0",
        background: "#FFFFFF",
      }}
    >
      <div className="container" style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
        {/* Kartu Besar Ungu di Tengah (30% Ungu Dominan) */}
        <div
          style={{
            background: "linear-gradient(135deg, #2E1065 0%, #1F0B46 100%)",
            borderRadius: 36,
            padding: "64px 48px",
            color: "#ffffff",
            textAlign: "center",
            boxShadow: "0 24px 60px rgba(46, 16, 101, 0.35)",
            border: "1.5px solid rgba(196, 181, 253, 0.3)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Ambient Glow */}
          <div
            style={{
              position: "absolute",
              top: "-50%",
              left: "50%",
              transform: "translateX(-50%)",
              width: "80%",
              height: "100%",
              background: "radial-gradient(ellipse at center, rgba(236, 72, 153, 0.28) 0%, transparent 70%)",
              filter: "blur(60px)",
              pointerEvents: "none",
            }}
          />

          <div style={{ position: "relative", zIndex: 2, maxWidth: 680, margin: "0 auto" }}>
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
              {closingCta.badge}
            </span>

            <h2
              style={{
                fontSize: "clamp(2.1rem, 4.2vw, 3rem)",
                fontWeight: 800,
                color: "#ffffff",
                letterSpacing: "-0.03em",
                lineHeight: 1.15,
                margin: "0 0 18px 0",
              }}
            >
              {closingCta.title}
            </h2>

            <p style={{ fontSize: "1.1rem", color: "#C4B5FD", lineHeight: 1.6, margin: "0 0 36px 0" }}>
              {closingCta.subtitle}
            </p>

            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <a
                href={brand.consultationWhatsapp}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  background: "#25D366",
                  color: "#ffffff",
                  padding: "16px 36px",
                  borderRadius: 9999,
                  fontWeight: 700,
                  fontSize: "1rem",
                  textDecoration: "none",
                  boxShadow: "0 12px 28px rgba(37, 211, 102, 0.4)",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#20BA5C";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#25D366";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <span>💬</span>
                <span>Hubungi Bagian Pemesanan (WhatsApp)</span>
              </a>

              <a
                href="#skema"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(255, 255, 255, 0.12)",
                  color: "#ffffff",
                  border: "1.5px solid rgba(196, 181, 253, 0.4)",
                  padding: "16px 30px",
                  borderRadius: 9999,
                  fontWeight: 700,
                  fontSize: "1rem",
                  textDecoration: "none",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.22)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.12)")}
              >
                <span>Lihat 3 Skema Maklon →</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
