"use client";

import React, { useState } from "react";
import Link from "next/link";
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
        background: "radial-gradient(ellipse at top center, #fff1da 0%, #fbfbfd 70%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
      }}
    >
      <div style={{ maxWidth: 1000, width: "100%" }}>
        {/* Brand Header */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <Link href="/" style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 60,
                height: 60,
                borderRadius: "var(--radius-lg)",
                background: "linear-gradient(135deg, var(--jadoo-coral) 0%, var(--jadoo-orange) 100%)",
                fontSize: "1.8rem",
                boxShadow: "var(--shadow-coral)",
                marginBottom: 16,
              }}
            >
              🏔️
            </div>
            <h1
              className="heading-editorial"
              style={{
                fontSize: "2.4rem",
                marginBottom: 8,
                color: "var(--jadoo-ink)",
              }}
            >
              Lukla <span style={{ color: "var(--jadoo-coral)" }}>Operations Engine</span>
            </h1>
          </Link>
          <p style={{ color: "var(--jadoo-text)", fontSize: "1rem" }}>
            Portal Operasional Konveksi Ciwidey & Maklon B2B (project-loe5)
          </p>
        </div>

        {errorMsg && <Notice type="danger" message={errorMsg} onClose={() => setErrorMsg(null)} />}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(320px, 380px) 1fr",
            gap: 32,
            alignItems: "start",
          }}
        >
          {/* Manual Login Form */}
          <div className="card-elevated">
            <h2 style={{ fontSize: "1.3rem", marginBottom: 6, color: "var(--jadoo-navy)" }}>Masuk Sistem</h2>
            <p style={{ fontSize: "0.88rem", color: "var(--jadoo-muted)", marginBottom: 24 }}>
              Gunakan kredensial terdaftar untuk mengakses hak otorisasi modul.
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
                {loading ? "Memproses..." : "Masuk ke Dashboard →"}
              </button>
            </form>

            <div style={{ marginTop: 24, textAlign: "center" }}>
              <Link href="/" style={{ fontSize: "0.88rem", color: "var(--jadoo-coral)", fontWeight: 600 }}>
                ← Kembali ke Halaman Utama (Landing Page)
              </Link>
            </div>
          </div>

          {/* Quick Demo Role Switcher */}
          <div className="card" style={{ background: "#ffffff" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <span className="badge badge-coral" style={{ marginBottom: 6 }}>
                  ⚡ Quick Login Evaluasi Hackathon
                </span>
                <h3 style={{ fontSize: "1.2rem", color: "var(--jadoo-navy)" }}>Pilih Akun Demo (8 Peran RBAC)</h3>
                <div style={{ fontSize: "0.82rem", color: "var(--jadoo-muted)" }}>
                  Klik salah satu tombol peran untuk langsung menguji fungsionalitas dan pembatasan modul:
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
                    background: "var(--bg-subtle)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-md)",
                    padding: "14px 16px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, fontSize: "0.9rem", color: "var(--jadoo-navy)" }}>
                        {acc.name}
                      </span>
                      <span className="badge badge-purple" style={{ fontSize: "0.68rem" }}>
                        {acc.role}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.78rem", color: "var(--jadoo-text)", lineHeight: 1.45 }}>
                      {acc.description}
                    </div>
                  </div>

                  <button
                    onClick={() => handleQuick(acc.username)}
                    className="btn btn-secondary btn-sm"
                    style={{ width: "100%", justifyContent: "center", fontWeight: 700 }}
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
