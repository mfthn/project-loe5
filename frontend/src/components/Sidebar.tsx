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
          padding: "24px 20px 20px",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Link href="/dashboard" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "var(--radius-md)",
              background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.2rem",
              boxShadow: "0 4px 12px rgba(59, 130, 246, 0.4)",
            }}
          >
            🏔️
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "#ffffff", letterSpacing: "-0.02em" }}>
              LUKLA <span style={{ color: "var(--accent-primary)" }}>OPS</span>
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              Garment Engine v2.0
            </div>
          </div>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm"
            style={{ display: "none" }} // Show on mobile if needed
          >
            ×
          </button>
        )}
      </div>

      {/* Navigation Modules */}
      <div style={{ flex: 1, padding: "16px 12px", overflowY: "auto" }}>
        <div
          style={{
            fontSize: "0.72rem",
            fontWeight: 700,
            textTransform: "uppercase",
            color: "var(--text-muted)",
            letterSpacing: "0.08em",
            padding: "8px 12px 10px",
          }}
        >
          Modul Operasional
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: 4 }}>
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
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.88rem",
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#ffffff" : "var(--text-secondary)",
                  background: isActive ? "var(--accent-primary)" : "transparent",
                  transition: "all var(--transition-fast)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: "1.1rem" }}>{mod.icon}</span>
                  <span>{mod.label}</span>
                </div>
                {mod.badge && (
                  <span
                    style={{
                      fontSize: "0.68rem",
                      padding: "2px 6px",
                      borderRadius: "var(--radius-full)",
                      background: isActive ? "rgba(255, 255, 255, 0.2)" : "rgba(59, 130, 246, 0.15)",
                      color: isActive ? "#ffffff" : "var(--accent-primary)",
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
          borderTop: "1px solid var(--border-subtle)",
          background: "rgba(11, 15, 25, 0.4)",
        }}
      >
        {/* Quick Role Switcher for Hackathon Demo */}
        <div style={{ marginBottom: 12 }}>
          <label
            style={{
              fontSize: "0.68rem",
              fontWeight: 700,
              textTransform: "uppercase",
              color: "var(--text-muted)",
              display: "block",
              marginBottom: 4,
            }}
          >
            Demo Simulasi Peran (RBAC):
          </label>
          <select
            className="form-select"
            value={user?.username || ""}
            onChange={handleRoleChange}
            disabled={switching}
            style={{
              padding: "6px 8px",
              fontSize: "0.78rem",
              background: "var(--bg-surface-elevated)",
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
            padding: "8px 10px",
            background: "var(--bg-surface)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ overflow: "hidden", paddingRight: 8 }}>
            <div style={{ fontWeight: 600, fontSize: "0.84rem", color: "var(--text-primary)", whiteSpace: "nowrap", textOverflow: "ellipsis", overflow: "hidden" }}>
              {user?.name || "Belum Login"}
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
              <span className={`badge ${user?.role === "OWNER" ? "badge-purple" : "badge-neutral"}`} style={{ fontSize: "0.65rem", padding: "1px 6px" }}>
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
