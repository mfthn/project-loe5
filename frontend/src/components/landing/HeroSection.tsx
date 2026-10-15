"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { HERO_HEADLINES } from "../../content/landing";
import { HeroObject } from "../visuals/HeroObject";
import { AmbientOrb } from "../visuals/AmbientOrb";

export function HeroSection() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  // Auto-slide every 5.5 seconds unless user hovers
  useEffect(() => {
    if (isPaused) return;

    const timer = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % HERO_HEADLINES.length);
        setIsFading(false);
      }, 350);
    }, 5500);

    return () => clearInterval(timer);
  }, [isPaused]);

  const currentHeadline = HERO_HEADLINES[currentIndex];

  return (
    <section
      id="hero"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{
        position: "relative",
        overflow: "hidden",
        paddingTop: "48px",
        paddingBottom: "88px",
        background: "#FFFFFF",
      }}
    >
      {/* Ambient Orb Background Blur (Ungu-Pink) */}
      <AmbientOrb size={640} top="-120px" right="-80px" opacity={0.65} blur={90} />
      <AmbientOrb size={480} top="240px" left="-140px" opacity={0.35} blur={80} />

      <div
        className="container"
        style={{
          maxWidth: 1280,
          margin: "0 auto",
          padding: "0 24px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.15fr 0.85fr",
            gap: "48px",
            alignItems: "center",
          }}
          className="hero-grid"
        >
          {/* Sisi Kiri: Teks & CTA */}
          <div>
            {/* Auto-Slide Content Wrapper with stable container and smooth fade transition */}
            <div
              style={{
                opacity: isFading ? 0 : 1,
                transform: isFading ? "translateY(6px)" : "translateY(0)",
                transition: "opacity 0.3s ease, transform 0.3s ease",
              }}
            >
              {/* Badge Kecil Pill (Fixed Height Box) */}
              <div style={{ minHeight: 36, marginBottom: 20, display: "flex", alignItems: "center" }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "7px 16px",
                    borderRadius: 9999,
                    background: "#EDE9FE",
                    border: "1px solid #C4B5FD",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    color: "#2E1065",
                    boxShadow: "0 2px 8px rgba(124, 58, 237, 0.08)",
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: "50%",
                      background: "#EC4899",
                      display: "inline-block",
                      animation: "pulse 2s infinite",
                    }}
                  />
                  {currentHeadline.badge}
                </span>
              </div>

              {/* Headline H1 (Fixed MinHeight: accommodates 3 lines without shifting layout) */}
              <div
                style={{
                  minHeight: "clamp(160px, 18vw, 215px)",
                  display: "flex",
                  alignItems: "flex-start",
                  marginBottom: 16,
                }}
              >
                <h1
                  style={{
                    fontSize: "clamp(2.75rem, 5.5vw, 4.25rem)",
                    fontWeight: 800,
                    color: "#2E1065",
                    lineHeight: 1.08,
                    letterSpacing: "-0.03em",
                    margin: 0,
                  }}
                >
                  {currentHeadline.headline}
                </h1>
              </div>

              {/* Subheadline (Fixed MinHeight: accommodates 3 lines without shifting CTA) */}
              <div
                style={{
                  minHeight: "clamp(75px, 9vw, 95px)",
                  display: "flex",
                  alignItems: "flex-start",
                  marginBottom: 36,
                }}
              >
                <p
                  style={{
                    fontSize: "clamp(1.05rem, 1.8vw, 1.2rem)",
                    lineHeight: 1.6,
                    color: "#5B5870",
                    maxWidth: 580,
                    margin: 0,
                  }}
                >
                  {currentHeadline.subheadline}
                </p>
              </div>
            </div>

            {/* Dua CTA Buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 28 }}>
              {/* Primary CTA */}
              <a
                href="#skema"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 14,
                  background: "#7C3AED",
                  color: "#ffffff",
                  padding: "12px 20px 12px 28px",
                  borderRadius: 9999,
                  fontWeight: 700,
                  fontSize: "1rem",
                  textDecoration: "none",
                  boxShadow: "0 12px 28px -4px rgba(124, 58, 237, 0.38)",
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
                <span>Lihat Skema Kerja Sama</span>
                <span
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "#ffffff",
                    color: "#7C3AED",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.95rem",
                    fontWeight: 800,
                  }}
                >
                  →
                </span>
              </a>

              {/* Secondary CTA */}
              <a
                href="#alur"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "#ffffff",
                  color: "#2E1065",
                  border: "1.5px solid #C4B5FD",
                  padding: "14px 26px",
                  borderRadius: 9999,
                  fontWeight: 700,
                  fontSize: "1rem",
                  textDecoration: "none",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#7C3AED";
                  e.currentTarget.style.background = "#FAF8FF";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#C4B5FD";
                  e.currentTarget.style.background = "#ffffff";
                }}
              >
                <span>Pelajari Alur Produksi</span>
              </a>
            </div>

            {/* Auto Slider Indicators (Progress Bar & Active Dot) */}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {HERO_HEADLINES.map((_, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setIsFading(true);
                    setTimeout(() => {
                      setCurrentIndex(idx);
                      setIsFading(false);
                    }, 250);
                  }}
                  aria-label={`Slide ${idx + 1}`}
                  style={{
                    width: currentIndex === idx ? 28 : 8,
                    height: 8,
                    borderRadius: 9999,
                    background: currentIndex === idx ? "#7C3AED" : "#EDE9FE",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Sisi Kanan: Objek Visual Hero Floating */}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <HeroObject />
          </div>
        </div>

        {/* Baris Brand Internal & Fasilitas (Sesuai SRS v2.0) */}
        <div
          style={{
            marginTop: 72,
            paddingTop: 36,
            borderTop: "1px solid #EDE9FE",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 20,
          }}
        >
          <div style={{ fontSize: "0.82rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "#5B5870" }}>
            Lini Produksi Internal &amp; Fasilitas Manufaktur:
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <span
              style={{
                padding: "8px 20px",
                borderRadius: 12,
                background: "#FAF8FF",
                border: "1.5px solid #C4B5FD",
                fontSize: "0.88rem",
                fontWeight: 700,
                color: "#2E1065",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>🏔️</span>
              <span>Snøhund (Internal Brand)</span>
            </span>
            <span
              style={{
                padding: "8px 16px",
                borderRadius: 12,
                background: "#F5F3FF",
                border: "1px solid #EDE9FE",
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "#6D28D9",
              }}
            >
              Ciwidey Production Facility
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
