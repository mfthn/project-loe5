"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { LANDING_CONTENT } from "../../content/landing";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
          ? "rgba(255, 255, 255, 0.82)"
          : "transparent",
        backdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
        WebkitBackdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
        borderBottom: scrolled
          ? "1px solid rgba(196, 181, 253, 0.35)"
          : "1px solid transparent",
        boxShadow: scrolled
          ? "0 4px 24px rgba(46, 16, 101, 0.06)"
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
            gap: 32,
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
          }}
        >
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

        {/* CTA Actions (Sisi Paling Kanan: Icon Login) */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
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
            {/* SVG Login / Sign-in Icon */}
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
            <Link
              href="/login"
              className="btn btn-secondary"
              style={{ flex: 1, textAlign: "center", borderRadius: 9999 }}
            >
              Masuk
            </Link>
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
