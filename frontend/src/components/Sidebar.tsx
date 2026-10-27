"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/auth-context";
import { getAllowedModules } from "../lib/rbac";

export function Sidebar({ isOpen, onClose }: { isOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const modules = getAllowedModules(user?.role);
  const userInitial = user?.name?.charAt(0)?.toUpperCase() || "?";

  return (
    <aside className={`sidebar ${isOpen ? "open" : ""}`}>
      {/* ── Brand Header ── */}
      <div
        style={{
          padding: "20px 18px 18px",
          borderBottom: "1px solid rgba(196, 181, 253, 0.22)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 10,
              overflow: "hidden",
              flexShrink: 0,
              boxShadow: "0 4px 10px rgba(0, 0, 0, 0.35)",
              border: "1px solid rgba(196, 181, 253, 0.4)",
            }}
          >
            <Image
              src="/icon.jpeg"
              alt="Lukla L5 Logo"
              width={38}
              height={38}
              style={{ objectFit: "cover", width: "100%", height: "100%" }}
              priority
            />
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 800,
                fontSize: "0.95rem",
                color: "#ffffff",
                lineHeight: 1.2,
                letterSpacing: "-0.02em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Lukla <span style={{ color: "#C4B5FD" }}>Ops Engine</span>
            </div>
            <div
              style={{
                fontSize: "0.65rem",
                color: "#A78BFA",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              Garment Engine v2.0
            </div>
          </div>
        </Link>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="mobile-sidebar-close"
            aria-label="Tutup menu navigasi"
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
            color: "#A78BFA",
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
                  padding: "10px 12px",
                  borderRadius: 12,
                  fontSize: "0.88rem",
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#2E1065" : "#DCD3FA",
                  background: isActive ? "#ffffff" : "transparent",
                  boxShadow: isActive ? "0 6px 16px rgba(0, 0, 0, 0.3)" : "none",
                  transition: "all 0.15s ease",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
                    e.currentTarget.style.color = "#ffffff";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "#DCD3FA";
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
                      fontSize: "0.64rem",
                      padding: "2px 7px",
                      borderRadius: 9999,
                      background: isActive ? "#EDE9FE" : "rgba(255, 255, 255, 0.14)",
                      color: isActive ? "#2E1065" : "#EDE9FE",
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

      {/* ── Bottom: User Card ── */}
      <div
        style={{
          padding: "14px 14px 16px",
          borderTop: "1px solid rgba(196, 181, 253, 0.22)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px",
            background: "rgba(255, 255, 255, 0.08)",
            borderRadius: 12,
            border: "1px solid rgba(255, 255, 255, 0.14)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
            {/* Avatar initial */}
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: "#ffffff",
                color: "#2E1065",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: "0.85rem",
                flexShrink: 0,
              }}
            >
              {userInitial}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  color: "#ffffff",
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
                    background: "rgba(255, 255, 255, 0.16)",
                    color: "#ffffff",
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
            aria-label="Keluar / Logout"
            style={{
              background: "#dc2626",
              border: "1px solid #dc2626",
              borderRadius: 8,
              padding: "6px 8px",
              cursor: "pointer",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              gap: 4,
              transition: "all 0.15s ease",
              flexShrink: 0,
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
              <path d="M12 3v9" />
              <path d="M6.3 6.3a8 8 0 1 0 11.4 0" />
            </svg>
          </button>
        </div>
      </div>
    </aside>
  );
}
