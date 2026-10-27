"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { LANDING_CONTENT } from "../../content/landing";
import { useAuth } from "../../lib/auth-context";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const dashboardUrl = user?.role === "KLIEN_MAKLON" ? "/portal-klien" : "/dashboard";

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        width: "100%",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        background: scrolled
          ? "rgba(255, 255, 255, 0.65)"
          : "rgba(255, 255, 255, 0.40)",
        backdropFilter: "blur(24px) saturate(190%)",
        WebkitBackdropFilter: "blur(24px) saturate(190%)",
        borderBottom: scrolled
          ? "1px solid rgba(196, 181, 253, 0.35)"
          : "1px solid rgba(255, 255, 255, 0.25)",
        boxShadow: scrolled
          ? "0 8px 32px 0 rgba(46, 16, 101, 0.07)"
          : "none",
      }}
    >
      <div
        style={{
          width: "100%",
          padding: "14px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Brand Logo (Sisi Paling Kiri) */}
        <Link
          href="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            textDecoration: "none",
            color: "inherit",
            flexShrink: 0,
          }}
        >
          {/* Logo Mark: L5 Icon */}
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              overflow: "hidden",
              flexShrink: 0,
              boxShadow: "0 6px 14px rgba(124, 58, 237, 0.25)",
            }}
          >
            <Image
              src="/icon.jpeg"
              alt="Lukla L5"
              width={40}
              height={40}
              style={{ objectFit: "cover", width: "100%", height: "100%" }}
              priority
            />
          </div>
          <div>
            <div
              style={{
                fontSize: "1.05rem",
                fontWeight: 800,
                color: "#2E1065",
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
              }}
            >
              Lukla Operations Engine
            </div>
            <div style={{ fontSize: "0.72rem", color: "#5B5870", fontWeight: 600 }}>
              Lukla Manufacturing • Ciwidey
            </div>
          </div>
        </Link>

        {/* Desktop Navigation Links (Persis di Center) */}
        <nav
          className="desktop-nav"
          style={{
            display: "none",
            alignItems: "center",
            gap: 28,
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
          {/* Menu Dashboard Aktif Jika Sudah Login */}
          {user && (
            <Link
              href={dashboardUrl}
              style={{
                fontSize: "0.92rem",
                fontWeight: 700,
                color: "#7C3AED",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 12px",
                borderRadius: 8,
                background: "rgba(124, 58, 237, 0.08)",
                border: "1px solid rgba(124, 58, 237, 0.2)",
              }}
            >
              <span>📊</span>
              <span>Dashboard Saya</span>
            </Link>
          )}

          {LANDING_CONTENT.nav.links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              style={{
                fontSize: "0.92rem",
                fontWeight: 600,
                color: "#5B5870",
                textDecoration: "none",
                transition: "color 0.15s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#7C3AED")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#5B5870")}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* CTA Actions (Sisi Paling Kanan) */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
          {user ? (
            /* Bila Sudah Login */
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Link
                href={dashboardUrl}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 16px",
                  borderRadius: 9999,
                  background: "linear-gradient(135deg, #7C3AED 0%, #2E1065 100%)",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "0.86rem",
                  textDecoration: "none",
                  boxShadow: "0 4px 14px rgba(124, 58, 237, 0.35)",
                  transition: "all 0.2s ease",
                }}
              >
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.25)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                  }}
                >
                  {(user.name || user.username).charAt(0).toUpperCase()}
                </div>
                <span>Dashboard ({user.role}) →</span>
              </Link>

              <button
                type="button"
                onClick={() => logout()}
                title="Keluar dari sesi"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 12px",
                  borderRadius: 9999,
                  background: "#dc2626",
                  border: "1px solid #dc2626",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#b91c1c";
                  e.currentTarget.style.borderColor = "#b91c1c";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#dc2626";
                  e.currentTarget.style.borderColor = "#dc2626";
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
                  <path d="M12 3v9" />
                  <path d="M6.3 6.3a8 8 0 1 0 11.4 0" />
                </svg>
                Keluar
              </button>
            </div>
          ) : (
            /* Bila Belum Login */
            <Link
              href="/login"
              aria-label="Masuk Portal / Login"
              title="Masuk ke Portal Operasional"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 18px",
                borderRadius: 9999,
                background: "#FAF8FF",
                border: "1.5px solid #C4B5FD",
                color: "#2E1065",
                fontWeight: 700,
                fontSize: "0.88rem",
                textDecoration: "none",
                boxShadow: "0 2px 8px rgba(124, 58, 237, 0.08)",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#7C3AED";
                e.currentTarget.style.background = "#7C3AED";
                e.currentTarget.style.color = "#ffffff";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#C4B5FD";
                e.currentTarget.style.background = "#FAF8FF";
                e.currentTarget.style.color = "#2E1065";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              <span className="login-btn-text">Masuk</span>
            </Link>
          )}

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            style={{
              display: "none",
              background: "transparent",
              border: "1px solid #EDE9FE",
              borderRadius: 10,
              padding: 8,
              cursor: "pointer",
              color: "#2E1065",
            }}
          >
            <span style={{ fontSize: "1.2rem", lineHeight: 1 }}>{mobileMenuOpen ? "✕" : "☰"}</span>
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div
          style={{
            background: "#ffffff",
            borderBottom: "1px solid #EDE9FE",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          {user && (
            <Link
              href={dashboardUrl}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                fontSize: "1rem",
                fontWeight: 700,
                color: "#7C3AED",
                textDecoration: "none",
                padding: "8px 0",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>📊</span>
              <span>Ke Dashboard ({user.role})</span>
            </Link>
          )}

          {LANDING_CONTENT.nav.links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              style={{
                fontSize: "1rem",
                fontWeight: 600,
                color: "#2E1065",
                textDecoration: "none",
                padding: "8px 0",
              }}
            >
              {link.label}
            </a>
          ))}
          <div style={{ paddingTop: 12, borderTop: "1px solid #EDE9FE", display: "flex", gap: 10 }}>
            {user ? (
              <button
                type="button"
                onClick={() => { setMobileMenuOpen(false); logout(); }}
                className="btn"
                style={{
                  flex: 1,
                  textAlign: "center",
                  borderRadius: 9999,
                  background: "#dc2626",
                  border: "1px solid #dc2626",
                  color: "#ffffff",
                  fontWeight: 700,
                }}
              >
                Keluar ({user.username})
              </button>
            ) : (
              <Link
                href="/login"
                className="btn btn-secondary"
                style={{ flex: 1, textAlign: "center", borderRadius: 9999 }}
              >
                Masuk
              </Link>
            )}
            <Link
              href="/ai-assistant"
              className="btn"
              style={{ flex: 1, textAlign: "center", background: "#7C3AED", color: "#ffffff", borderRadius: 9999 }}
            >
              Konsultasi
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

