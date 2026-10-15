"use client";

import React from "react";
import Image from "next/image";

/**
 * HeroObject
 * Visual hero utama (Pilihan C - Disarankan):
 * Komposisi "Tag Produk & Barcode Garmen" yang tampak mengapung (floating 3D-styled)
 * dengan bayangan lembut, sebagai metafora visual langsung untuk isolasi stok & proteksi anti-kontaminasi silang multi-klien.
 * Palet warna: Putih dominan, Ungu (#7C3AED, #2E1065), dan aksen Pink (#EC4899).
 */
export function HeroObject() {
  return (
    <div className="hero-object-container" style={{ position: "relative", width: "100%", maxWidth: 540, margin: "0 auto" }}>
      {/* Bayangan ambient ungu-pink di bawah objek */}
      <div
        style={{
          position: "absolute",
          top: "15%",
          left: "10%",
          width: "80%",
          height: "75%",
          background: "radial-gradient(ellipse at center, rgba(124, 58, 237, 0.25) 0%, rgba(236, 72, 153, 0.18) 50%, transparent 75%)",
          filter: "blur(48px)",
          zIndex: 1,
          pointerEvents: "none",
        }}
      />

      {/* Main Floating Composition */}
      <div className="hero-floating-element" style={{ position: "relative", zIndex: 2 }}>
        {/* KARTU UTAMA: Tag Bahan Terverifikasi (Klien A • Order #0142) */}
        <div
          style={{
            background: "linear-gradient(145deg, #ffffff 0%, #FAF8FF 100%)",
            borderRadius: 28,
            border: "1.5px solid rgba(196, 181, 253, 0.6)",
            padding: "28px 28px 24px 28px",
            boxShadow: "0 24px 50px -12px rgba(124, 58, 237, 0.18), 0 1px 3px rgba(0, 0, 0, 0.04)",
            position: "relative",
            backdropFilter: "blur(12px)",
          }}
        >
          {/* Hangtag Hole & Thread Ribbon */}
          <div
            style={{
              position: "absolute",
              top: -16,
              left: "50%",
              transform: "translateX(-50%)",
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#ffffff",
              border: "3px solid #7C3AED",
              boxShadow: "0 4px 10px rgba(124, 58, 237, 0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#EC4899" }} />
          </div>

          {/* Header Tag */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  overflow: "hidden",
                  boxShadow: "0 4px 12px rgba(124, 58, 237, 0.3)",
                  flexShrink: 0,
                }}
              >
                <Image
                  src="/icon.jpeg"
                  alt="Lukla L5"
                  width={36}
                  height={36}
                  style={{ objectFit: "cover", width: "100%", height: "100%" }}
                />
              </div>
              <div>
                <div style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "#5B5870", fontWeight: 700 }}>
                  MATERIAL TAG • GUDANG CIWIDEY
                </div>
                <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#2E1065" }}>
                  Klien A • Pesanan 0142
                </div>
              </div>
            </div>

            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: "#EDE9FE",
                color: "#6D28D9",
                padding: "6px 12px",
                borderRadius: 9999,
                fontSize: "0.78rem",
                fontWeight: 700,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#059669", display: "inline-block" }} />
              Terverifikasi
            </span>
          </div>

          {/* Spesifikasi Garmen Mini Table */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 10,
              padding: "14px 16px",
              background: "#ffffff",
              borderRadius: 16,
              border: "1px solid #EDE9FE",
              marginBottom: 18,
            }}
          >
            <div>
              <div style={{ fontSize: "0.7rem", color: "#5B5870", textTransform: "uppercase", fontWeight: 600 }}>Komponen</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#2E1065" }}>Jaket Gunung v2</div>
            </div>
            <div>
              <div style={{ fontSize: "0.7rem", color: "#5B5870", textTransform: "uppercase", fontWeight: 600 }}>Bahan Baku</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#2E1065" }}>Taslan WP 3L</div>
            </div>
            <div>
              <div style={{ fontSize: "0.7rem", color: "#5B5870", textTransform: "uppercase", fontWeight: 600 }}>Target Lini</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#7C3AED" }}>500 Pcs</div>
            </div>
          </div>

          {/* Barcode & Anti-Kontaminasi Indicator */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            {/* Barcode SVG Mockup */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 32 }}>
                {[3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 4, 2, 1, 3, 1, 2, 4, 2, 1, 3].map((w, idx) => (
                  <div
                    key={idx}
                    style={{
                      width: w * 1.6,
                      height: "100%",
                      background: idx % 4 === 0 ? "#7C3AED" : "#2E1065",
                      borderRadius: 1,
                    }}
                  />
                ))}
              </div>
              <div style={{ fontSize: "0.68rem", fontFamily: "monospace", letterSpacing: "0.15em", color: "#5B5870" }}>
                *LK-TAG-KLN01-0142*
              </div>
            </div>

            {/* Pill Status Meja Potong */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                borderRadius: 9999,
                background: "#FAF8FF",
                border: "1px solid #C4B5FD",
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "#2E1065",
              }}
            >
              <span style={{ fontSize: "0.9rem" }}>🛡️</span>
              <span>Kunci Meja Potong: Aman</span>
            </div>
          </div>
        </div>

        {/* KARTU OVERLAY 1: Badge Anti-Kontaminasi Silang (Pojok Kiri Bawah) */}
        <div
          className="hero-subcard-bottom"
          style={{
            position: "absolute",
            bottom: -22,
            left: -20,
            background: "#2E1065",
            color: "#ffffff",
            padding: "14px 18px",
            borderRadius: 20,
            boxShadow: "0 18px 36px rgba(46, 16, 101, 0.35)",
            border: "1px solid rgba(196, 181, 253, 0.3)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            maxWidth: 290,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "rgba(236, 72, 153, 0.2)",
              border: "1.5px solid #EC4899",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: "1.05rem" }}>🔒</span>
          </div>
          <div>
            <div style={{ fontSize: "0.82rem", fontWeight: 700, color: "#ffffff" }}>
              Anti-Kontaminasi Silang
            </div>
            <div style={{ fontSize: "0.72rem", color: "#C4B5FD", lineHeight: 1.3 }}>
              Sistem memblokir kain Klien A ditarik untuk Klien B
            </div>
          </div>
        </div>

        {/* KARTU OVERLAY 2: Pill Pulse Real-time (Pojok Kanan Atas) */}
        <div
          className="hero-subcard-top"
          style={{
            position: "absolute",
            top: 20,
            right: -24,
            background: "#ffffff",
            border: "1.5px solid #FBCFE8",
            padding: "10px 16px",
            borderRadius: 9999,
            boxShadow: "0 12px 28px rgba(236, 72, 153, 0.15)",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span
            style={{
              position: "relative",
              display: "inline-flex",
              width: 10,
              height: 10,
            }}
          >
            <span
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                background: "#EC4899",
                opacity: 0.75,
                animation: "ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite",
              }}
            />
            <span
              style={{
                position: "relative",
                display: "inline-block",
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "#EC4899",
              }}
            />
          </span>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#2E1065" }}>
            Lini Jahit: <strong>±70 Mesin Aktif</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
