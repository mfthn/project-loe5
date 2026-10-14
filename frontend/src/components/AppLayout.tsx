"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "../lib/auth-context";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { canAccessModule, type AppModule } from "../lib/rbac";

interface AppLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  requiredModule?: AppModule;
}

export function AppLayout({ children, title, subtitle, requiredModule }: AppLayoutProps) {
  const { user, loading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-primary)",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div style={{ fontSize: "2rem" }}>🏔️</div>
        <div style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
          Memuat sesi Lukla Operations Engine...
        </div>
      </div>
    );
  }

  // Jika belum login sama sekali
  if (!user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var(--bg-primary)",
          padding: 24,
        }}
      >
        <div className="card-elevated" style={{ maxWidth: 440, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: "2.5rem", marginBottom: 12 }}>🔒</div>
          <h2 style={{ marginBottom: 8 }}>Sesi Masuk Diperlukan</h2>
          <p style={{ marginBottom: 24 }}>
            Silakan masuk dengan akun terdaftar untuk mengakses platform operasional Lukla.
          </p>
          <Link href="/login" className="btn btn-primary" style={{ width: "100%" }}>
            Buka Halaman Login →
          </Link>
        </div>
      </div>
    );
  }

  // Jika modul membutuhkan izin RBAC tertentu dan peran user tidak diizinkan
  const hasAccess = requiredModule ? canAccessModule(user.role, requiredModule) : true;

  return (
    <div className="app-container">
      <Sidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
      <div className="main-content">
        <TopBar
          title={title}
          subtitle={subtitle}
          onMenuClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        />
        <main className="page-body">
          {!hasAccess ? (
            <div className="card" style={{ borderColor: "var(--color-danger-border)", padding: 32 }}>
              <div style={{ fontSize: "2rem", marginBottom: 12 }}>🚫</div>
              <h2 style={{ color: "var(--color-danger)", marginBottom: 8 }}>Akses Ditolak (RBAC)</h2>
              <p style={{ marginBottom: 20 }}>
                Peran Anda saat ini (<strong>{user.role}</strong>) tidak memiliki otorisasi untuk
                mengakses modul <strong>{requiredModule}</strong>.
              </p>
              <div style={{ display: "flex", gap: 12 }}>
                <Link href="/dashboard" className="btn btn-primary">
                  Kembali ke Dashboard
                </Link>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
