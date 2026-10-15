"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth, DEMO_ACCOUNTS } from "../../lib/auth-context";
import { AmbientOrb } from "../../components/visuals/AmbientOrb";

// Role badge color map (DESIGN.md)
const ROLE_PALETTE: Record<string, { bg: string; color: string; border: string; emoji: string }> = {
  OWNER: { bg: "#EDE9FE", color: "#2E1065", border: "#C4B5FD", emoji: "👑" },
  FINANCE_PAYROLL: { bg: "#ecfdf5", color: "#065f46", border: "#a7f3d0", emoji: "💰" },
  MANDOR_LINE: { bg: "#fffbeb", color: "#92400e", border: "#fde68a", emoji: "🏭" },
  MANDOR_QC: { bg: "#f0f9ff", color: "#075985", border: "#bae6fd", emoji: "🔍" },
  MANDOR_GUDANG: { bg: "#fdf2f8", color: "#BE185D", border: "#FBCFE8", emoji: "📦" },
  OPERATOR_GUDANG: { bg: "#fdf2f8", color: "#BE185D", border: "#FBCFE8", emoji: "🗄️" },
  KLIEN: { bg: "#EDE9FE", color: "#6D28D9", border: "#C4B5FD", emoji: "🤝" },
  KLIEN_INTERNAL: { bg: "#EDE9FE", color: "#2E1065", border: "#C4B5FD", emoji: "🏔️" },
};

export default function LoginPage() {
  const router = useRouter();
  const { login, quickLogin } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setErrorMsg("Harap masukkan username.");
      return;
    }
    try {
      setLoading(true);
      setErrorMsg(null);
      await login(username, password);
      router.push("/dashboard");
    } catch (err: any) {
      setErrorMsg(err.message || "Username atau password tidak valid.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuick = async (u: string) => {
    try {
      setLoadingRole(u);
      setErrorMsg(null);
      await quickLogin(u);
      router.push("/dashboard");
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal login otomatis.");
    } finally {
      setLoadingRole(null);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at top center, #F3E8FF 0%, #F8FAFC 70%)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ maxWidth: 1000, width: "100%" }}>
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <Link href="/" style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
            <img
              src="/Lukla.jpeg"
              alt="Logo Lukla"
              style={{
                width: 60,
                height: 60,
                borderRadius: "var(--radius-lg)",
                objectFit: "cover",
                boxShadow: "var(--shadow-coral)",
                marginBottom: 16,
              }}
            />
            <h1
              style={{
                fontSize: "clamp(1.75rem, 4vw, 2.5rem)",
                fontWeight: 800,
                color: "#2E1065",
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                margin: "0 0 10px 0",
              }}
            >
              Masuk ke Dashboard Operasional
            </h1>
          </Link>
          <p style={{ color: "var(--jadoo-text)", fontSize: "1rem" }}>
            Portal Operasional Konveksi Ciwidey & Maklon B2B (project-loe5)
          </p>
        </div>

        {errorMsg && <Notice type="danger" message={errorMsg} onClose={() => setErrorMsg(null)} />}

        <div
          className="login-grid"
        >
          {/* Manual Login Form */}
          <div className="card-elevated">
            <h2 style={{ fontSize: "1.3rem", marginBottom: 6, color: "var(--jadoo-navy)" }}>Masuk Sistem</h2>
            <p style={{ fontSize: "0.88rem", color: "var(--jadoo-muted)", marginBottom: 24 }}>
              Gunakan kredensial terdaftar untuk mengakses hak otorisasi modul.
            </p>
          </div>

          {/* Error notice */}
          {errorMsg && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "14px 18px",
                marginBottom: 24,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 14,
                color: "#991b1b",
                fontSize: "0.88rem",
                fontWeight: 600,
                maxWidth: 460,
                margin: "0 auto 24px auto",
              }}
            >
              <span>⚠️</span>
              <span>{errorMsg}</span>
              <button
                onClick={() => setErrorMsg(null)}
                style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontWeight: 700, fontSize: "1rem" }}
              >
                ✕
              </button>
            </div>
          )}

          {/* ── Two column layout ── */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(300px, 380px) 1fr",
              gap: 28,
              alignItems: "start",
            }}
            className="login-grid"
          >
            {/* ── Kiri: Form Login ── */}
            <div
              style={{
                background: "#ffffff",
                border: "1.5px solid #EDE9FE",
                borderRadius: 28,
                padding: "32px",
                boxShadow: "0 16px 48px rgba(46,16,101,0.08), 0 2px 8px rgba(46,16,101,0.04)",
              }}
            >
              {/* Card Header */}
              <div style={{ marginBottom: 24 }}>
                <span
                  style={{
                    display: "inline-block",
                    padding: "4px 12px",
                    borderRadius: 9999,
                    background: "#EDE9FE",
                    color: "#6D28D9",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    marginBottom: 10,
                    letterSpacing: "0.04em",
                  }}
                >
                  🔐 FORM LOGIN
                </span>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#2E1065", margin: "0 0 6px 0" }}>
                  Masuk ke Sistem
                </h2>
                <p style={{ fontSize: "0.82rem", color: "#84829a", margin: 0, lineHeight: 1.5 }}>
                  Gunakan kredensial terdaftar untuk akses hak otorisasi modul.
                </p>
              </div>

              <form onSubmit={handleSubmit} noValidate>
                {/* Username */}
                <div style={{ marginBottom: 16 }}>
                  <label
                    htmlFor="login-username"
                    style={{
                      display: "block",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      color: "#2E1065",
                      marginBottom: 6,
                    }}
                  >
                    Username
                  </label>
                  <input
                    id="login-username"
                    type="text"
                    className="form-input"
                    placeholder="contoh: owner, mandor_agus, klien_a"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                    style={{ fontSize: "0.92rem" }}
                  />
                </div>

                {/* Password */}
                <div style={{ marginBottom: 20 }}>
                  <label
                    htmlFor="login-password"
                    style={{
                      display: "block",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      color: "#2E1065",
                      marginBottom: 6,
                    }}
                  >
                    Password
                  </label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      className="form-input"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      style={{ fontSize: "0.92rem", paddingRight: 40 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                        color: "#84829a",
                      }}
                    >
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                {/* Submit button */}
                <button
                  id="btn-login-submit"
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    padding: "13px 20px",
                    background: loading ? "#C4B5FD" : "linear-gradient(135deg, #7C3AED 0%, #2E1065 100%)",
                    color: "#ffffff",
                    borderRadius: 9999,
                    border: "none",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    cursor: loading ? "not-allowed" : "pointer",
                    boxShadow: loading ? "none" : "0 8px 20px rgba(124,58,237,0.35)",
                    transition: "all 0.2s ease",
                    fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 14px 28px rgba(124,58,237,0.42)"; }}}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(124,58,237,0.35)"; }}
                >
                  {loading ? (
                    <>
                      <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
                      Memproses...
                    </>
                  ) : (
                    <>
                      <span>Masuk ke Dashboard</span>
                      <span
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          background: "rgba(255,255,255,0.2)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "0.85rem",
                        }}
                      >
                        →
                      </span>
                    </>
                  )}
                </button>
              </form>

              {/* Divider */}
              <div
                style={{
                  margin: "24px 0",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1, height: 1, background: "#EDE9FE" }} />
                <span style={{ fontSize: "0.75rem", color: "#84829a", fontWeight: 600, whiteSpace: "nowrap" }}>
                  atau gunakan Quick Login Demo
                </span>
                <div style={{ flex: 1, height: 1, background: "#EDE9FE" }} />
              </div>

              {/* Back to landing */}
              <div style={{ textAlign: "center" }}>
                <Link
                  href="/"
                  style={{
                    fontSize: "0.82rem",
                    color: "#7C3AED",
                    fontWeight: 600,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  ← Kembali ke Halaman Publik
                </Link>
              </div>
            </div>

            {/* ── Kanan: Quick Role Switcher (Demo RBAC) ── */}
            <div
              style={{
                background: "#FAF8FF",
                border: "1.5px solid #EDE9FE",
                borderRadius: 28,
                padding: "28px",
                boxShadow: "0 8px 24px rgba(46,16,101,0.04)",
              }}
            >
              <div style={{ marginBottom: 20 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "4px 12px",
                    borderRadius: 9999,
                    background: "rgba(236,72,153,0.12)",
                    color: "#BE185D",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    marginBottom: 10,
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#EC4899", display: "inline-block" }} />
                  ⚡ QUICK LOGIN EVALUASI
                </span>
                <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#2E1065", margin: "0 0 6px 0" }}>
                  Pilih Akun Demo — 8 Peran RBAC
                </h2>
                <p style={{ fontSize: "0.8rem", color: "#5B5870", margin: 0, lineHeight: 1.5 }}>
                  Klik satu tombol peran untuk langsung menguji fungsionalitas dan pembatasan modul per role.
                </p>
              </div>

              {/* Role cards grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 10,
                }}
              >
                {DEMO_ACCOUNTS.map((acc) => {
                  const palette = ROLE_PALETTE[acc.role] || ROLE_PALETTE.KLIEN;
                  const isThisLoading = loadingRole === acc.username;
                  return (
                    <div
                      key={acc.username}
                      style={{
                        background: "#ffffff",
                        border: "1.5px solid #EDE9FE",
                        borderRadius: 18,
                        padding: "14px 16px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 10,
                        transition: "all 0.2s ease",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#C4B5FD"; e.currentTarget.style.boxShadow = "0 6px 16px rgba(46,16,101,0.06)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#EDE9FE"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
                    >
                      {/* Role header */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ fontSize: "1.1rem" }}>{palette.emoji}</span>
                          <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "#2E1065" }}>
                            {acc.name}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: "0.62rem",
                            padding: "2px 8px",
                            borderRadius: 9999,
                            background: palette.bg,
                            color: palette.color,
                            border: `1px solid ${palette.border}`,
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {acc.role}
                        </span>
                      </div>

                      {/* Description */}
                      <p style={{ fontSize: "0.75rem", color: "#84829a", margin: 0, lineHeight: 1.5 }}>
                        {acc.description}
                      </p>

                      {/* Quick login button */}
                      <button
                        id={`btn-quicklogin-${acc.username}`}
                        onClick={() => handleQuick(acc.username)}
                        disabled={!!loadingRole}
                        style={{
                          width: "100%",
                          padding: "9px 14px",
                          borderRadius: 9999,
                          border: "1.5px solid #C4B5FD",
                          background: isThisLoading ? "#7C3AED" : "#FAF8FF",
                          color: isThisLoading ? "#ffffff" : "#2E1065",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          cursor: loadingRole ? "not-allowed" : "pointer",
                          opacity: loadingRole && !isThisLoading ? 0.5 : 1,
                          transition: "all 0.15s ease",
                          fontFamily: "inherit",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                        }}
                        onMouseEnter={(e) => { if (!loadingRole) { e.currentTarget.style.background = "#7C3AED"; e.currentTarget.style.color = "#ffffff"; e.currentTarget.style.borderColor = "#7C3AED"; }}}
                        onMouseLeave={(e) => { if (!isThisLoading) { e.currentTarget.style.background = "#FAF8FF"; e.currentTarget.style.color = "#2E1065"; e.currentTarget.style.borderColor = "#C4B5FD"; }}}
                      >
                        {isThisLoading ? "⟳ Memuat..." : `Masuk Sebagai ${acc.role} →`}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Mobile CSS for login grid */}
      <style>{`
        @media (max-width: 768px) {
          .login-grid {
            grid-template-columns: 1fr !important;
          }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
