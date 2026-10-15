"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth, DEMO_ACCOUNTS } from "../lib/auth-context";
import { AiHelpBubble } from "../components/AiHelpBubble";
import { openPublicChat } from "../lib/public-chat";

// PlusGrid dekoratif seperti di nextjs-react-fe
function PlusGrid({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: "10px 18px",
        fontSize: "20px",
        color: "#e5e5e5",
        userSelect: "none",
        pointerEvents: "none",
        lineHeight: 1,
      }}
      className={className}
    >
      {Array.from({ length: 25 }, (_, i) => {
        const isCoral = i === 0;
        const isPurple = i === 12;
        return (
          <span
            key={i}
            style={{
              color: isCoral ? "var(--jadoo-coral)" : isPurple ? "var(--jadoo-purple)" : "#e5e5e5",
            }}
          >
            +
          </span>
        );
      })}
    </div>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const [activeService, setActiveService] = useState<number>(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const services = [
    {
      title: "Gudang Anti-Kontaminasi",
      body: "Proteksi otomatis (P0): bahan milik satu klien tidak dapat dikeluarkan untuk pesanan klien lain.",
      icon: "📦",
      tag: "Skenario 1 (P0)",
    },
    {
      title: "Sample & Stopwatch Digital",
      body: "Pengukuran presisi detik penjahitan per komponen garmen dan approval versi prototipe terkunci.",
      icon: "⏱️",
      tag: "Skenario 4 (P0)",
    },
    {
      title: "Terminal 30 Menit Pabrik",
      body: "Antarmuka layar sentuh ramah operator lantai kerja untuk pencatatan output interval dan validasi mandor.",
      icon: "⚙️",
      tag: "P0 Lantai Kerja",
    },
    {
      title: "QC & Pool Bonus Mandor",
      body: "Pencatatan mutu LOLOS/REPAIR/DEFECT dan pool bonus mandor terakumulasi otomatis dari pcs lolos.",
      icon: "🔍",
      tag: "Skenario 3 (P0)",
    },
  ];

  const schemes = [
    {
      name: "CMT (Cut, Make, Trim)",
      desc: "Kain dan aksesoris disediakan penuh oleh mitra klien. Pabrik menyediakan tenaga potong, jahit, QC, dan packing.",
      tag: "Paling Populer",
      moq: "Min. 100 pcs/model",
    },
    {
      name: "Semi-CMT",
      desc: "Kain utama dari klien, sedangkan benang, kancing, zipper, dan aksesoris disediakan langsung oleh pabrik.",
      tag: "Fleksibel",
      moq: "Min. 150 pcs/model",
    },
    {
      name: "Full Package (FOB)",
      desc: "Solusi hulu ke hilir. Pengadaan bahan baku, pembuatan pola, sampling, produksi hingga siap display di store.",
      tag: "Layanan Lengkap",
      moq: "Min. 300 pcs/model",
    },
  ];

  return (
    <div style={{ background: "#ffffff", color: "var(--jadoo-navy)", minHeight: "100vh" }}>
      {/* Top Navbar */}
      <nav
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: "24px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(12px)",
          zIndex: 50,
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img
            src="/Lukla.jpeg"
            alt="Logo Lukla"
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--radius-md)",
              objectFit: "cover",
              boxShadow: "var(--shadow-coral)",
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{ fontSize: "1.35rem", fontWeight: 800, letterSpacing: "-0.03em", color: "var(--jadoo-navy)" }}>
              Lukla <span style={{ color: "var(--jadoo-coral)" }}>Ops</span>
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--jadoo-muted)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700 }}>
              Garment Operations Engine
            </div>
          </div>
        </Link>

        {/* Center Links */}
        <div className="landing-nav-links">
          <a href="#services" style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--jadoo-text)" }}>
            Fitur Operasional
          </a>
          <a href="#schemes" style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--jadoo-text)" }}>
            Skema Maklon
          </a>
          <a href="#workflow" style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--jadoo-text)" }}>
            Alur 3 Langkah
          </a>
          <button onClick={openPublicChat} style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--jadoo-purple)", background: "none", border: "none", cursor: "pointer" }}>
            AI Assistant ✨
          </button>
        </div>

        {/* Right CTA */}
        <div className="landing-nav-cta">
          {user ? (
            <Link href="/dashboard" className="btn btn-primary">
              Buka Dashboard ({user.role}) →
            </Link>
          ) : (
            <>
              <Link href="/login" className="btn btn-secondary">
                Masuk Sistem
              </Link>
              <Link href="/login" className="btn btn-primary">
                Coba Demo RBAC →
              </Link>
            </>
          )}
        </div>

        {/* Hamburger (mobile) */}
        <button
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label="Buka menu navigasi"
          className="btn btn-secondary btn-sm landing-hamburger"
          style={{ fontSize: "1.2rem", padding: "8px 12px" }}
        >
          {mobileMenuOpen ? "✕" : "☰"}
        </button>
      </nav>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="landing-mobile-menu">
          <a href="#services" onClick={() => setMobileMenuOpen(false)}>Fitur Operasional</a>
          <a href="#schemes" onClick={() => setMobileMenuOpen(false)}>Skema Maklon</a>
          <a href="#workflow" onClick={() => setMobileMenuOpen(false)}>Alur 3 Langkah</a>
          <button onClick={() => { setMobileMenuOpen(false); openPublicChat(); }}>AI Assistant ✨</button>
          {user ? (
            <Link href="/dashboard">Buka Dashboard ({user.role}) →</Link>
          ) : (
            <>
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>Masuk Sistem</Link>
              <Link href="/login" onClick={() => setMobileMenuOpen(false)}>Coba Demo RBAC →</Link>
            </>
          )}
        </div>
      )}

      {/* Hero Section */}
      <section
        className="hero-grid hero-section"
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          position: "relative",
        }}
      >
        {/* Ambient Warm Blur Glow */}
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: 20,
            right: 40,
            width: 480,
            height: 480,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255, 241, 218, 0.8) 0%, rgba(223, 105, 81, 0.15) 60%, transparent 80%)",
            filter: "blur(60px)",
            zIndex: 0,
            pointerEvents: "none",
          }}
        />

        <div style={{ position: "relative", zIndex: 1 }}>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "1.1rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--jadoo-coral)",
              marginBottom: 16,
            }}
          >
            Manufaktur Konveksi & Maklon B2B Ciwidey
          </p>

          <h1
            className="heading-editorial hero-title"
          >
            Operasional Pabrik Terpadu dengan Kapasitas <span style={{ color: "var(--jadoo-coral)" }}>±70 Mesin</span>
          </h1>

          <p
            style={{
              fontSize: "1.08rem",
              lineHeight: 1.7,
              color: "var(--jadoo-text)",
              marginBottom: 36,
              maxWidth: 540,
            }}
          >
            Platform operasional lengkap untuk <em>Lukla Manufacturing & Snøhund Brand Management</em>. Melayani pesanan internal dan brand klien secara paralel dengan proteksi anti-kontaminasi gudang, terminal output 30 menit, dan payroll audit lock Sabtu permanen.
          </p>

          <div className="hero-cta-row">
            <Link href="/login" className="btn btn-primary btn-lg">
              Buka Dashboard Operasional →
            </Link>
            <button onClick={openPublicChat} className="btn btn-secondary btn-lg" style={{ borderColor: "#E9D5FF" }}>
              💬 Tanya AI Konsultan Maklon
            </button>
          </div>

          {/* Quick Metrics Under CTA */}
          <div
            className="hero-metrics"
          >
            <div>
              <div className="font-mono" style={{ fontSize: "1.7rem", fontWeight: 800, color: "var(--jadoo-navy)" }}>
                ±70
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--jadoo-muted)", fontWeight: 600 }}>
                Mesin Jahit Aktif
              </div>
            </div>

            <div>
              <div className="font-mono" style={{ fontSize: "1.7rem", fontWeight: 800, color: "var(--jadoo-coral)" }}>
                30 Min
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--jadoo-muted)", fontWeight: 600 }}>
                Interval Validasi Output
              </div>
            </div>

            <div>
              <div className="font-mono" style={{ fontSize: "1.7rem", fontWeight: 800, color: "var(--color-success)" }}>
                100%
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--jadoo-muted)", fontWeight: 600 }}>
                Isolasi Bahan Anti-Silang
              </div>
            </div>
          </div>
        </div>

        {/* Hero Visual Card (Jadoo Card Signature Style) */}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              background: "#ffffff",
              borderRadius: "var(--radius-xl)",
              padding: 32,
              boxShadow: "0 25px 60px -15px rgba(24, 30, 75, 0.12)",
              border: "1px solid rgba(229, 231, 235, 0.8)",
              position: "relative",
            }}
          >
            {/* Badge on card */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <span className="badge badge-coral">PO-2026-LUKLA-001</span>
              <span className="badge badge-success">🔒 Anti-Kontaminasi Aktif</span>
            </div>

            <div style={{ fontSize: "1.3rem", fontWeight: 700, color: "var(--jadoo-navy)", marginBottom: 6 }}>
              Heavyweight Fleece Hoodie 330gsm
            </div>
            <div style={{ fontSize: "0.88rem", color: "var(--jadoo-text)", marginBottom: 20 }}>
              Klien Maklon: PT Tekstil Maju • Skema CMT
            </div>

            {/* Progress Bar */}
            <div style={{ background: "var(--jadoo-chip)", padding: 18, borderRadius: "var(--radius-md)", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", fontWeight: 600, marginBottom: 8 }}>
                <span>Progres Output Jahit</span>
                <span className="font-mono" style={{ color: "var(--jadoo-coral)" }}>740 / 1,000 pcs (74%)</span>
              </div>
              <div style={{ width: "100%", height: 8, background: "#e5e7eb", borderRadius: 4, overflow: "hidden" }}>
                <div
                  style={{
                    width: "74%",
                    height: "100%",
                    background: "linear-gradient(90deg, var(--jadoo-coral), var(--jadoo-orange))",
                    borderRadius: 4,
                  }}
                />
              </div>
            </div>

            {/* Mini Floating Card on Top (Like in Jadoo) */}
            <div
              className="hero-mini-grid"
            >
              <div style={{ background: "var(--jadoo-cream)", padding: 14, borderRadius: "var(--radius-md)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--jadoo-muted)", fontWeight: 700, textTransform: "uppercase" }}>
                  Status Pipeline
                </div>
                <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--jadoo-navy)" }}>
                  SEWING → QC
                </div>
              </div>

              <div style={{ background: "#f3f0ff", padding: 14, borderRadius: "var(--radius-md)" }}>
                <div style={{ fontSize: "0.75rem", color: "var(--jadoo-muted)", fontWeight: 700, textTransform: "uppercase" }}>
                  QC Pass Rate
                </div>
                <div className="font-mono" style={{ fontWeight: 800, fontSize: "1.1rem", color: "var(--jadoo-purple)" }}>
                  98.4% Lolos
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services / Feature Pillars */}
      <section
        id="services"
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: "80px 28px",
          position: "relative",
        }}
      >
        <PlusGrid className="absolute right-6 top-16 hidden lg:grid" />

        <div style={{ textAlign: "center", marginBottom: 54 }}>
          <p
            style={{
              fontSize: "1.1rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--jadoo-coral)",
              marginBottom: 10,
            }}
          >
            Pilar Operasional Utama
          </p>
          <h2
            className="heading-editorial"
            style={{
              fontSize: "clamp(1.7rem, 4vw, 2.8rem)",
              fontWeight: 700,
              color: "var(--jadoo-ink)",
            }}
          >
            Dirancang Sesuai Kebutuhan Nyata Pabrik
          </h2>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 28,
          }}
        >
          {services.map((s, idx) => {
            const isHovered = activeService === idx;
            return (
              <div
                key={s.title}
                onMouseEnter={() => setActiveService(idx)}
                style={{
                  background: isHovered ? "#ffffff" : "#ffffff",
                  borderRadius: "var(--radius-xl)",
                  padding: "36px 28px",
                  textAlign: "center",
                  border: isHovered ? "1px solid #E9D5FF" : "1px solid var(--border-subtle)",
                  boxShadow: isHovered ? "var(--shadow-hover)" : "var(--shadow-card)",
                  transition: "all var(--transition-normal)",
                  position: "relative",
                  cursor: "pointer",
                }}
              >
                {/* Decorative Coral Accent on Active Card */}
                {isHovered && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      left: -8,
                      bottom: 0,
                      width: 14,
                      height: 80,
                      borderTopLeftRadius: 24,
                      borderBottomLeftRadius: 24,
                      background: "var(--jadoo-coral)",
                    }}
                  />
                )}

                <div
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: "var(--radius-lg)",
                    background: "var(--jadoo-cream)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "2rem",
                    margin: "0 auto 24px",
                  }}
                >
                  {s.icon}
                </div>

                <span className="badge badge-purple" style={{ marginBottom: 12, fontSize: "0.7rem" }}>
                  {s.tag}
                </span>

                <h3 style={{ fontSize: "1.2rem", fontWeight: 700, color: "var(--jadoo-navy)", marginBottom: 12 }}>
                  {s.title}
                </h3>

                <p style={{ fontSize: "0.92rem", color: "var(--jadoo-text)", lineHeight: 1.6 }}>
                  {s.body}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Schemes Section */}
      <section
        id="schemes"
        style={{
          background: "var(--bg-subtle)",
          padding: "90px 28px",
          borderTop: "1px solid var(--border-subtle)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ maxWidth: 1240, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 54 }}>
            <p
              style={{
                fontSize: "1.1rem",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--jadoo-coral)",
                marginBottom: 10,
              }}
            >
              Model Kerja Sama Maklon
            </p>
            <h2
              className="heading-editorial"
              style={{
                fontSize: "clamp(1.7rem, 4vw, 2.8rem)",
                fontWeight: 700,
                color: "var(--jadoo-ink)",
              }}
            >
              Pilihan Skema Fleksibel untuk Brand Anda
            </h2>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
              gap: 28,
            }}
          >
            {schemes.map((sch) => (
              <div
                key={sch.name}
                className="card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                    <span className="badge badge-coral">{sch.tag}</span>
                    <span className="badge badge-neutral">{sch.moq}</span>
                  </div>
                  <h3 style={{ fontSize: "1.35rem", marginBottom: 12, color: "var(--jadoo-navy)" }}>
                    {sch.name}
                  </h3>
                  <p style={{ fontSize: "0.95rem", color: "var(--jadoo-text)", lineHeight: 1.6 }}>
                    {sch.desc}
                  </p>
                </div>

                <div style={{ marginTop: 28, paddingTop: 18, borderTop: "1px solid var(--border-subtle)" }}>
                  <Link href="/login" className="btn btn-secondary" style={{ width: "100%" }}>
                    Simulasikan di Portal Klien →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3 Steps Workflow Section (Inspired by Jadoo Book a trip) */}
      <section
        id="workflow"
        className="workflow-grid landing-section"
        style={{
          maxWidth: 1240,
          margin: "0 auto",
        }}
      >
        <div>
          <p
            style={{
              fontSize: "1.1rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--jadoo-coral)",
              marginBottom: 10,
            }}
          >
            Mudah dan Terstandardisasi
          </p>
          <h2
            className="heading-editorial"
            style={{
              fontSize: "clamp(1.7rem, 4vw, 2.8rem)",
              fontWeight: 700,
              lineHeight: 1.2,
              color: "var(--jadoo-ink)",
              marginBottom: 40,
            }}
          >
            Alur Produksi Maklon dalam 3 Langkah Teruji
          </h2>

          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <div style={{ display: "flex", gap: 20 }}>
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "var(--radius-md)",
                  background: "#fef3c7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.3rem",
                  flexShrink: 0,
                }}
              >
                📐
              </div>
              <div>
                <h4 style={{ fontSize: "1.1rem", marginBottom: 6, color: "var(--jadoo-navy)" }}>
                  1. Pembuatan Prototipe & Stopwatch Time Study
                </h4>
                <p style={{ fontSize: "0.92rem", color: "var(--jadoo-text)", margin: 0 }}>
                  Tim sample membuat versi pola, mengukur detik penjahitan dengan stopwatch digital, dan menunggu approval resmi versi.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 20 }}>
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "var(--radius-md)",
                  background: "#fee2e2",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.3rem",
                  flexShrink: 0,
                }}
              >
                ✂️
              </div>
              <div>
                <h4 style={{ fontSize: "1.1rem", marginBottom: 6, color: "var(--jadoo-navy)" }}>
                  2. Pengeluaran Kain & Terminal 30 Menit
                </h4>
                <p style={{ fontSize: "0.92rem", color: "var(--jadoo-text)", margin: 0 }}>
                  Gudang mengeluarkan kain dengan validasi anti-kontaminasi silang, lalu penjahit mencatat output per 30 menit di terminal layar sentuh.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: 20 }}>
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: "var(--radius-md)",
                  background: "#dcfce7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.3rem",
                  flexShrink: 0,
                }}
              >
                🔍
              </div>
              <div>
                <h4 style={{ fontSize: "1.1rem", marginBottom: 6, color: "var(--jadoo-navy)" }}>
                  3. Quality Control & Kunci Payroll Sabtu
                </h4>
                <p style={{ fontSize: "0.92rem", color: "var(--jadoo-text)", margin: 0 }}>
                  Inspeksi mutu per batch menghasilkan pool bonus mandor, dan sistem mengunci payroll Sabtu secara permanen (Audit Lock).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Interactive AI Demo Teaser */}
        <div
          style={{
            background: "linear-gradient(135deg, #181e4b 0%, #14183e 100%)",
            borderRadius: "var(--radius-xl)",
            padding: 36,
            color: "#ffffff",
            boxShadow: "0 25px 60px -15px rgba(24, 30, 75, 0.3)",
          }}
        >
          <span className="badge badge-purple" style={{ marginBottom: 12 }}>
            Amazon Bedrock Titan & Nova Lite
          </span>
          <h3 style={{ fontSize: "1.6rem", color: "#ffffff", marginBottom: 14 }}>
            AI Dual-Assistant Bertenaga RAG
          </h3>
          <p style={{ fontSize: "0.92rem", color: "#94a3b8", lineHeight: 1.6, marginBottom: 24 }}>
            Dilatih langsung dari dokumen SOP manufaktur kami untuk menjawab pertanyaan operasional pabrik atau konsultasi maklon B2B secara instan.
          </p>

          <div
            style={{
              background: "rgba(255, 255, 255, 0.08)",
              borderRadius: "var(--radius-md)",
              padding: 18,
              marginBottom: 24,
            }}
          >
            <div style={{ fontSize: "0.8rem", color: "var(--jadoo-coral)", fontWeight: 700, marginBottom: 6 }}>
              Contoh Pertanyaan Konsultasi:
            </div>
            <div style={{ fontSize: "0.92rem", color: "#f8fafc" }}>
              "Berapa minimal pemesanan (MOQ) untuk pembuatan hoodie fleece dengan skema CMT?"
            </div>
          </div>

          <button onClick={openPublicChat} className="btn btn-primary" style={{ width: "100%" }}>
            Mulai Percakapan dengan AI →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer
        className="landing-footer"
        style={{
          borderTop: "1px solid var(--border-subtle)",
          maxWidth: 1240,
          margin: "0 auto",
        }}
      >
        <div
          className="landing-footer-grid"
        >
          <div>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--jadoo-navy)", marginBottom: 12 }}>
              Lukla Operations Engine
            </div>
            <p style={{ fontSize: "0.9rem", color: "var(--jadoo-text)", maxWidth: 360, lineHeight: 1.6 }}>
              Platform operasional pabrik garmen konveksi Ciwidey (Lukla Manufacturing & Snøhund Brand Management). Melayani brand internal dan klien maklon B2B dengan kapasitas dinamis ±70 mesin.
            </p>
          </div>

          <div className="landing-footer-links">
          <div>
            <h4 style={{ fontSize: "1rem", color: "var(--jadoo-navy)", marginBottom: 16 }}>Modul Utama</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "0.9rem", color: "var(--jadoo-text)" }}>
              <Link href="/gudang">Gudang Multi-Klien</Link>
              <Link href="/sample">Sample & Stopwatch</Link>
              <Link href="/produksi">Terminal Produksi 30m</Link>
              <Link href="/qc">Quality Control & Bonus</Link>
              <Link href="/payroll">Payroll & Audit Lock</Link>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: "1rem", color: "var(--jadoo-navy)", marginBottom: 16 }}>Akses Cepat</h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: "0.9rem", color: "var(--jadoo-text)" }}>
              <Link href="/login">Masuk Akun Sistem</Link>
              <Link href="/portal-klien">Portal Klien Maklon</Link>
              <button onClick={openPublicChat} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: "0.9rem", color: "var(--jadoo-text)", textAlign: "left" }}>AI Konsultan Maklon (Publik)</button>
              <a href="http://localhost:8000/docs" target="_blank" rel="noreferrer">API Documentation</a>
            </div>
          </div>
          </div>
        </div>

        <div className="landing-footer-bottom">
          <div>© 2026 Lukla Operations Engine (project-loe5). All rights reserved.</div>
          <div className="watermark">Made with ♥ @makewithteeam5</div>
          <div className="landing-footer-meta">
            <span>Ciwidey, Bandung, Jawa Barat</span>
            <span className="dot">•</span>
            <span>PostgreSQL 16 & AWS Bedrock RAG</span>
          </div>
        </div>
      </footer>

      <AiHelpBubble />
    </div>
  );
}
