"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth, DEMO_ACCOUNTS } from "../lib/auth-context";
import { getAllowedModules } from "../lib/rbac";

// Icon warna per role dari DESIGN.md (purple brand primary)
const ROLE_COLORS: Record<string, string> = {
  OWNER: "#7C3AED",
  FINANCE_PAYROLL: "#059669",
  MANDOR_LINE: "#d97706",
  MANDOR_QC: "#0284c7",
  MANDOR_GUDANG: "#BE185D",
  OPERATOR_GUDANG: "#EC4899",
  KLIEN: "#6D28D9",
  KLIEN_INTERNAL: "#2E1065",
};

export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { user, quickLogin, logout } = useAuth();
  const [switching, setSwitching] = useState(false);

  const modules = getAllowedModules(user?.role);

  const handleRoleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedUsername = e.target.value;
    if (!selectedUsername) return;
    try {
      setSwitching(true);
      await quickLogin(selectedUsername);
    } catch (err) {
      console.error("Gagal beralih peran:", err);
    } finally {
      setSwitching(false);
    }
  };

  const roleColor = ROLE_COLORS[user?.role || ""] || "#7C3AED";
  const userInitial = user?.name?.charAt(0)?.toUpperCase() || "?";

  return (
    <aside className={`sidebar ${isOpen ? "open" : ""}`}>
      {/* ── Brand Header ── */}
      <div
        style={{
          padding: "24px 22px 20px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <img
            src="/Lukla.jpeg"
            alt="Logo Lukla"
            style={{
              width: 40,
              height: 40,
              borderRadius: "var(--radius-md)",
              objectFit: "cover",
              boxShadow: "var(--shadow-coral)",
              flexShrink: 0,
            }}
          />
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "#ffffff", letterSpacing: "-0.02em" }}>
              Lukla <span style={{ color: "var(--jadoo-coral)" }}>Ops</span>
            </div>
            <div style={{ fontSize: "0.7rem", color: "rgba(237, 233, 254, 0.75)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700 }}>
              Garment Engine v2.0
            </div>
          </div>
        </Link>

        {/* Close button (mobile) */}
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Tutup sidebar"
            style={{
              background: "transparent",
              border: "1px solid #EDE9FE",
              borderRadius: 8,
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#5B5870",
              fontSize: "1rem",
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* ── Navigation Modules ── */}
      <div style={{ flex: 1, padding: "14px 12px", overflowY: "auto" }}>
        <div
          style={{
            fontSize: "0.68rem",
            fontWeight: 800,
            textTransform: "uppercase",
            color: "rgba(237, 233, 254, 0.7)",
            letterSpacing: "0.08em",
            padding: "6px 10px 10px",
          }}
        >
          Modul Operasional
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {modules.map((mod) => {
            const isActive = pathname === mod.href || pathname.startsWith(`${mod.href}/`);
            return (
              <Link
                key={mod.id}
                href={mod.href}
                onClick={onClose}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "11px 14px",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.9rem",
                  fontWeight: isActive ? 700 : 600,
                  color: isActive ? "#ffffff" : "rgba(237, 233, 254, 0.85)",
                  background: isActive
                    ? "linear-gradient(135deg, #7C3AED 0%, #2E1065 100%)"
                    : "transparent",
                  boxShadow: isActive ? "0 6px 16px rgba(124, 58, 237, 0.28)" : "none",
                  transition: "all 0.15s ease",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "#FAF8FF";
                    e.currentTarget.style.color = "#2E1065";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#5B5870";
                  }
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ fontSize: "1.1rem", lineHeight: 1 }}>{mod.icon}</span>
                  <span>{mod.label}</span>
                </div>
                {mod.badge && (
                  <span
                    style={{
                      fontSize: "0.68rem",
                      padding: "2px 8px",
                      borderRadius: "var(--radius-full)",
                      background: isActive ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.15)",
                      color: isActive ? "#ffffff" : "#EDE9FE",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {mod.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* ── Bottom: Demo Switcher & User Card ── */}
      <div
        style={{
          padding: 16,
          borderTop: "1px solid rgba(255, 255, 255, 0.15)",
          background: "rgba(255, 255, 255, 0.06)",
        }}
      >
        {/* Quick Role Switcher (hackathon demo) */}
        <div style={{ marginBottom: 10 }}>
          <label
            style={{
              fontSize: "0.65rem",
              fontWeight: 800,
              textTransform: "uppercase",
              color: "rgba(237, 233, 254, 0.7)",
              display: "block",
              marginBottom: 4,
              letterSpacing: "0.06em",
            }}
          >
            ⚡ Demo RBAC — Ganti Peran:
          </label>
          <select
            className="form-select"
            value={user?.username || ""}
            onChange={handleRoleChange}
            disabled={switching}
            style={{
              padding: "7px 10px",
              fontSize: "0.78rem",
              background: "#ffffff",
              borderColor: "#EDE9FE",
              borderRadius: 10,
              color: "#2E1065",
              fontWeight: 600,
            }}
          >
            {DEMO_ACCOUNTS.map((acc) => (
              <option key={acc.username} value={acc.username}>
                {acc.name} — {acc.role}
              </option>
            ))}
          </select>
        </div>

        {/* User Card */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px",
            background: "#ffffff",
            borderRadius: 12,
            border: "1px solid #EDE9FE",
            boxShadow: "0 2px 8px rgba(46, 16, 101, 0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
            {/* Avatar initial */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: `linear-gradient(135deg, ${roleColor} 0%, #2E1065 100%)`,
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "0.85rem",
                flexShrink: 0,
                boxShadow: `0 3px 8px ${roleColor}44`,
              }}
            >
              {userInitial}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  color: "#2E1065",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  overflow: "hidden",
                }}
              >
                {user?.name || "Belum Login"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                <span
                  style={{
                    fontSize: "0.62rem",
                    padding: "1px 6px",
                    borderRadius: 9999,
                    background: "#EDE9FE",
                    color: "#7C3AED",
                    fontWeight: 700,
                  }}
                >
                  {user?.role || "GUEST"}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            title="Keluar / Logout"
            style={{
              background: "transparent",
              border: "1px solid #fecaca",
              borderRadius: 8,
              padding: "5px 8px",
              cursor: "pointer",
              color: "#dc2626",
              fontSize: "0.78rem",
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontWeight: 700,
              transition: "all 0.15s ease",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#fef2f2";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            🚪
          </button>
        </div>
      </div>
    </aside>
  );
}
