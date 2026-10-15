"use client";

import React from "react";
import Link from "next/link";
import { LANDING_CONTENT } from "../../content/landing";

export function Footer() {
  const { footer } = LANDING_CONTENT;

  return (
    <footer
      style={{
        background: "#1F0B46",
        color: "#ffffff",
        paddingTop: "80px",
        paddingBottom: "40px",
        borderTop: "1px solid rgba(196, 181, 253, 0.2)",
      }}
    >
      <div className="container" style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
        {/* Main Footer Columns */}
        <div
          className="footer-grid-container"
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr",
            gap: 40,
            marginBottom: 60,
          }}
        >
          {/* Brand Info */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  overflow: "hidden",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
                  flexShrink: 0,
                }}
              >
                <img
                  src="/icon.jpeg"
                  alt="Lukla L5"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </div>
              <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#ffffff" }}>
                {footer.brandName}
              </span>
            </div>

            <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#C4B5FD", marginBottom: 4 }}>
              {footer.companyName}
            </div>
            <div style={{ fontSize: "0.76rem", color: "#A78BFA", marginBottom: 10 }}>
              Lukla Manufacturing × Snøhund — Ciwidey Production Facility
            </div>

            <p style={{ fontSize: "0.82rem", color: "#C4B5FD", opacity: 0.85, lineHeight: 1.6, margin: "0 0 16px 0", maxWidth: 300 }}>
              {footer.disclaimer}
            </p>

            <div style={{ fontSize: "0.8rem", color: "#C4B5FD", opacity: 0.75, lineHeight: 1.5 }}>
              📍 {footer.address}
            </div>
          </div>

          {/* 4 Link Columns */}
          {footer.columns.map((col, idx) => (
            <div key={idx}>
              <div
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "#ffffff",
                  marginBottom: 18,
                }}
              >
                {col.title}
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {col.links.map((link, lIdx) => (
                  <li key={lIdx}>
                    <Link
                      href={link.href}
                      style={{
                        fontSize: "0.85rem",
                        color: "#C4B5FD",
                        textDecoration: "none",
                        transition: "color 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#ffffff")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#C4B5FD")}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar: Copyright & Compliance */}
        <div
          style={{
            paddingTop: 28,
            borderTop: "1px solid rgba(196, 181, 253, 0.15)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            fontSize: "0.8rem",
            color: "#C4B5FD",
            opacity: 0.75,
          }}
        >
          <div>{footer.copyright}</div>
          <div style={{ display: "flex", gap: 20 }}>
            <span>SOP Standar Garmen Ekspor</span>
            <span>•</span>
            <span>ISO 9001 Alignment (Pabrik Ciwidey)</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
