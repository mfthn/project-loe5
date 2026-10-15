"use client";

import React from "react";
import { LANDING_CONTENT } from "../../content/landing";

export function StatsSection() {
  const { stats } = LANDING_CONTENT;

  return (
    <section
      id="tentang"
      style={{
        padding: "90px 0",
        background: "#FFFFFF",
      }}
    >
      <div className="container" style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", maxWidth: 680, margin: "0 auto 60px auto" }}>
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
            {stats.badge}
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
            {stats.title}
          </h2>
          <p style={{ fontSize: "1.05rem", color: "#5B5870", lineHeight: 1.6, margin: 0 }}>
            {stats.subtitle}
          </p>
        </div>

        {/* 4 Stats Cards */}
        <div
          className="stats-grid-container"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 24,
          }}
        >
          {stats.items.map((it, idx) => (
            <div
              key={idx}
              style={{
                background: "#FAF8FF",
                borderRadius: 24,
                padding: "32px 24px",
                border: "1.5px solid #EDE9FE",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "space-between",
                boxShadow: "0 8px 24px rgba(46, 16, 101, 0.04)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#C4B5FD";
                e.currentTarget.style.transform = "translateY(-4px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#EDE9FE";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 4, marginBottom: 8 }}>
                  <span
                    style={{
                      fontSize: "clamp(2.75rem, 4vw, 3.5rem)",
                      fontWeight: 800,
                      color: it.verified ? "#7C3AED" : "#5B5870",
                      lineHeight: 1,
                      letterSpacing: "-0.03em",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {it.value}
                  </span>
                  <span style={{ fontSize: "1rem", fontWeight: 700, color: "#EC4899" }}>
                    {it.unit}
                  </span>
                </div>

                <h4 style={{ fontSize: "1.05rem", fontWeight: 800, color: "#2E1065", margin: "0 0 8px 0" }}>
                  {it.label}
                </h4>

                <p style={{ fontSize: "0.85rem", color: "#5B5870", lineHeight: 1.5, margin: 0 }}>
                  {it.desc}
                </p>
              </div>

              {!it.verified && (
                <div
                  style={{
                    marginTop: 16,
                    padding: "4px 8px",
                    borderRadius: 6,
                    background: "#ffffff",
                    border: "1px dashed #C4B5FD",
                    fontSize: "0.68rem",
                    color: "#84829a",
                  }}
                >
                  *angka historis dikonfirmasi saat onboarding
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
