"use client";

import React from "react";
import Link from "next/link";
import { LANDING_CONTENT } from "../../content/landing";

export function SkemaSection() {
  const { skema } = LANDING_CONTENT;

  return (
    <section
      id="skema"
      style={{
        padding: "100px 0",
        background: "#FFFFFF",
      }}
    >
      <div className="container" style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", maxWidth: 720, margin: "0 auto 60px auto" }}>
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
            {skema.badge}
          </span>
          <h2
            style={{
              fontSize: "clamp(2rem, 4vw, 2.85rem)",
              fontWeight: 800,
              color: "#2E1065",
              letterSpacing: "-0.025em",
              lineHeight: 1.15,
              margin: "0 0 16px 0",
            }}
          >
            {skema.title}
          </h2>
          <p style={{ fontSize: "1.08rem", color: "#5B5870", lineHeight: 1.6, margin: 0 }}>
            {skema.subtitle}
          </p>
        </div>

        {/* 3 Skema Cards Grid */}
        <div
          className="skema-grid-container"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 28,
            alignItems: "stretch",
          }}
        >
          {skema.cards.map((c) => {
            const isHighlight = c.highlight;
            return (
              <div
                key={c.id}
                style={{
                  background: isHighlight ? "linear-gradient(180deg, #FAF8FF 0%, #FFFFFF 100%)" : "#FFFFFF",
                  borderRadius: 28,
                  padding: "40px 32px",
                  border: isHighlight ? "2px solid #7C3AED" : "1.5px solid #EDE9FE",
                  boxShadow: isHighlight
                    ? "0 24px 50px -12px rgba(124, 58, 237, 0.22)"
                    : "0 10px 30px rgba(46, 16, 101, 0.05)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                  transform: isHighlight ? "scale(1.02)" : "scale(1)",
                  transition: "transform 0.25s ease, box-shadow 0.25s ease",
                }}
              >
                {/* Badge Penanda */}
                {c.badge && (
                  <div
                    style={{
                      position: "absolute",
                      top: -14,
                      left: "50%",
                      transform: "translateX(-50%)",
                      background: isHighlight ? "linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)" : "#EDE9FE",
                      color: isHighlight ? "#ffffff" : "#2E1065",
                      padding: "6px 18px",
                      borderRadius: 9999,
                      fontSize: "0.75rem",
                      fontWeight: 800,
                      boxShadow: "0 4px 12px rgba(124, 58, 237, 0.25)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.badge}
                  </div>
                )}

                <div>
                  {/* Singkatan & Nama Skema */}
                  <div style={{ marginBottom: 16, marginTop: c.badge ? 8 : 0 }}>
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: "0.85rem",
                        fontWeight: 800,
                        color: isHighlight ? "#7C3AED" : "#5B5870",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        marginBottom: 4,
                      }}
                    >
                      {c.code}
                    </span>
                    <h3 style={{ fontSize: "1.45rem", fontWeight: 800, color: "#2E1065", margin: 0, lineHeight: 1.25 }}>
                      {c.name}
                    </h3>
                  </div>

                  {/* Kalimat Ringkas Siapa Menyediakan Bahan */}
                  <p
                    style={{
                      fontSize: "0.95rem",
                      fontWeight: 600,
                      color: isHighlight ? "#6D28D9" : "#2E1065",
                      background: isHighlight ? "#EDE9FE" : "#FAF8FF",
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: "1px solid rgba(196, 181, 253, 0.4)",
                      lineHeight: 1.5,
                      marginBottom: 20,
                    }}
                  >
                    {c.tagline}
                  </p>

                  {/* Tag Cocok Untuk */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: "0.72rem", color: "#5B5870", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em", marginBottom: 4 }}>
                      Cocok untuk:
                    </div>
                    <div style={{ fontSize: "0.85rem", color: "#2E1065", fontWeight: 600 }}>
                      {c.fitFor}
                    </div>
                  </div>

                  {/* Poin Tanggung Jawab */}
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: "0.72rem", color: "#5B5870", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em", marginBottom: 8 }}>
                      Cakupan Kerja Sama:
                    </div>
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                      {c.points.map((pt, i) => (
                        <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: "0.88rem", color: "#5B5870", lineHeight: 1.5 }}>
                          <span style={{ color: "#7C3AED", fontWeight: 800, marginTop: 1 }}>✓</span>
                          <span>{pt}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
