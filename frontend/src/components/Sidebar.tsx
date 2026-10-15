"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth, DEMO_ACCOUNTS } from "../lib/auth-context";
import { getAllowedModules } from "../lib/rbac";

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

  return (
    <aside className={`sidebar ${isOpen ? "open" : ""}`}>
      {/* Brand Logo & Header */}
      <div
        style={{
          padding: "24px 22px 20px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
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
        {onClose && (
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ display: "none" }}
          >
            ×
          </button>
        )}
      </div>

      {/* Navigation Modules */}
      <div style={{ flex: 1, padding: "18px 14px", overflowY: "auto" }}>
        <div
          style={{
            fontSize: "0.72rem",
            fontWeight: 800,
            textTransform: "uppercase",
            color: "rgba(237, 233, 254, 0.7)",
            letterSpacing: "0.08em",
            padding: "8px 12px 12px",
          }}
        >
          Modul Operasional Pabrik
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 6 }}>
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
                    ? "linear-gradient(135deg, var(--jadoo-coral) 0%, var(--jadoo-orange) 100%)"
                    : "transparent",
                  boxShadow: isActive ? "var(--shadow-coral)" : "none",
                  transition: "all var(--transition-fast)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: "1.15rem" }}>{mod.icon}</span>
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

      {/* Bottom User Profile & Switcher */}
      <div
        style={{
          padding: 16,
          borderTop: "1px solid rgba(255, 255, 255, 0.15)",
          background: "rgba(255, 255, 255, 0.06)",
        }}
      >
        {/* Quick Role Switcher for Hackathon Demo */}
        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              fontSize: "0.7rem",
              fontWeight: 800,
              textTransform: "uppercase",
              color: "rgba(237, 233, 254, 0.7)",
              display: "block",
              marginBottom: 4,
            }}
          >
            Demo Peran (RBAC 8 Role):
          </label>
          <select
            className="form-select"
            value={user?.username || ""}
            onChange={handleRoleChange}
            disabled={switching}
            style={{
              padding: "7px 10px",
              fontSize: "0.8rem",
              background: "#ffffff",
              borderColor: "var(--border-default)",
            }}
          >
            {DEMO_ACCOUNTS.map((acc) => (
              <option key={acc.username} value={acc.username}>
                {acc.name} ({acc.role})
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
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
            boxShadow: "var(--shadow-subtle)",
          }}
        >
          <div style={{ overflow: "hidden", paddingRight: 8 }}>
            <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "var(--jadoo-navy)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
              {user?.name || "Belum Login"}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--jadoo-muted)", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
              <span className="badge badge-coral" style={{ fontSize: "0.65rem", padding: "1px 6px" }}>
                {user?.role || "GUEST"}
              </span>
            </div>
          </div>
          <button
            onClick={logout}
            title="Keluar / Logout"
            className="btn btn-ghost btn-sm"
            style={{ padding: "6px 8px", color: "var(--color-danger)" }}
          >
            🚪
          </button>
        </div>
      </div>
    </aside>
  );
}
