"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth, DEMO_ACCOUNTS } from "../../lib/auth-context";
import { Notice } from "../../components/Notice";

export default function LoginPage() {
  const router = useRouter();
  const { login, quickLogin } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
      setErrorMsg(err.message || "Gagal masuk. Periksa username dan password.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuick = async (u: string) => {
    try {
      setLoading(true);
      setErrorMsg(null);
      await quickLogin(u);
      router.push("/dashboard");
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal login otomatis.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at top center, #172554 0%, #0b0f19 70%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      <div style={{ maxWidth: 960, width: "100%" }}>
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 58,
              height: 58,
              borderRadius: "var(--radius-lg)",
              background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
              fontSize: "1.8rem",
              boxShadow: "0 8px 24px rgba(59, 130, 246, 0.4)",
              marginBottom: 16,
            }}
          >
            🏔️
          </div>
          <h1 style={{ fontSize: "2.1rem", marginBottom: 8, letterSpacing: "-0.03em" }}>
            Lukla Operations Engine
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem" }}>
            Platform Operasional Terpadu Konveksi Ciwidey & Maklon B2B (project-loe5)
          </p>
        </div>

        {errorMsg && <Notice type="danger" message={errorMsg} onClose={() => setErrorMsg(null)} />}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(320px, 380px) 1fr",
            gap: 28,
            alignItems: "start",
          }}
        >
          {/* Manual Login Form */}
          <div className="card-elevated">
            <h2 style={{ fontSize: "1.2rem", marginBottom: 4 }}>Masuk Sistem</h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 20 }}>
              Gunakan akun operasional untuk mengakses modul sesuai peran.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="contoh: owner, mandor_agus, klien_a"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: "100%", marginTop: 8 }}
                disabled={loading}
              >
                {loading ? "Memproses Masuk..." : "Masuk ke Dashboard →"}
              </button>
            </form>
          </div>

          {/* Quick Demo Role Switcher */}
          <div className="card-glass">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <h3 style={{ fontSize: "1.1rem" }}>⚡ Quick Login Demo (8 Peran RBAC)</h3>
                <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  Klik salah satu akun di bawah untuk langsung mencoba tampilan spesifik perannya:
                </div>
              </div>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 12,
              }}
            >
              {DEMO_ACCOUNTS.map((acc) => (
                <div
                  key={acc.username}
                  style={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 10,
                    transition: "border-color var(--transition-fast)",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--text-primary)" }}>
                        {acc.name}
                      </span>
                      <span className={`badge ${acc.role === "OWNER" ? "badge-purple" : "badge-neutral"}`} style={{ fontSize: "0.68rem" }}>
                        {acc.role}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.4 }}>
                      {acc.description}
                    </div>
                  </div>

                  <button
                    onClick={() => handleQuick(acc.username)}
                    className="btn btn-secondary btn-sm"
                    style={{ width: "100%", justifyContent: "center" }}
                    disabled={loading}
                  >
                    Masuk Sebagai {acc.role} →
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
