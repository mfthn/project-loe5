"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth-context";
import { authApi } from "../../lib/api";
import { AmbientOrb } from "../../components/visuals/AmbientOrb";

type TabMode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  // ── Tab State ──
  const [tab, setTab] = useState<TabMode>("login");

  // ── Login State ──
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── Register State ──
  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regCompanyName, setRegCompanyName] = useState("");
  const [regContactPerson, setRegContactPerson] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState<{ clientId: string; message: string } | null>(null);

  // ── Shared ──
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // ── Handlers ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!username.trim() || !password) {
      setErrorMsg("Harap isi username dan password.");
      return;
    }
    try {
      setLoading(true);
      await login(username.trim(), password);
      router.push("/dashboard");
    } catch (err: any) {
      setErrorMsg(err.message || "Username atau password tidak valid.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!regUsername || !regPassword || !regEmail || !regCompanyName || !regContactPerson || !regPhone) {
      setErrorMsg("Semua kolom wajib diisi.");
      return;
    }
    try {
      setRegLoading(true);
      const res = await authApi.register({
        username: regUsername.trim(),
        password: regPassword,
        email: regEmail.trim(),
        company_name: regCompanyName.trim(),
        contact_person: regContactPerson.trim(),
        phone_number: regPhone.trim(),
      });
      setRegSuccess({ clientId: res.client_id, message: res.message });
    } catch (err: any) {
      setErrorMsg(err.message || "Registrasi gagal. Periksa data yang dimasukkan.");
    } finally {
      setRegLoading(false);
    }
  };

  const switchTab = (t: TabMode) => {
    setTab(t);
    setErrorMsg(null);
    setRegSuccess(null);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <AmbientOrb size={560} top="-120px" right="-100px" opacity={0.5} blur={90} />
      <AmbientOrb size={400} bottom="-80px" left="-100px" opacity={0.3} blur={80} />

      {/* ── Navbar minimal ── */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          padding: "14px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(16px)",
          borderBottom: "1px solid rgba(196,181,253,0.25)",
        }}
      >
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, overflow: "hidden", boxShadow: "0 4px 10px rgba(124,58,237,0.25)" }}>
            <Image src="/icon.jpeg" alt="Lukla L5" width={36} height={36} style={{ objectFit: "cover" }} priority />
          </div>
          <div>
            <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#2E1065", letterSpacing: "-0.02em" }}>
              Lukla Operations Engine
            </div>
            <div style={{ fontSize: "0.65rem", color: "#84829a", fontWeight: 600 }}>
              Lukla Manufacturing · Ciwidey
            </div>
          </div>
        </Link>
        <Link
          href="/"
          style={{
            fontSize: "0.82rem",
            fontWeight: 700,
            color: "#5B5870",
            padding: "7px 16px",
            border: "1px solid #EDE9FE",
            borderRadius: 9999,
            textDecoration: "none",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#C4B5FD"; e.currentTarget.style.color = "#7C3AED"; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#EDE9FE"; e.currentTarget.style.color = "#5B5870"; }}
        >
          ← Kembali ke Landing
        </Link>
      </header>

      {/* ── Main ── */}
      <main
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px 60px",
          position: "relative",
          zIndex: 2,
        }}
      >
        <div style={{ width: "100%", maxWidth: 480 }}>

          {/* Page heading */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "5px 14px",
                borderRadius: 9999,
                background: "#EDE9FE",
                border: "1px solid #C4B5FD",
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "#2E1065",
                marginBottom: 14,
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#EC4899", display: "inline-block" }} />
              Portal Autentikasi Sistem
            </span>
            <h1
              style={{
                fontSize: "clamp(1.6rem, 4vw, 2.2rem)",
                fontWeight: 800,
                color: "#2E1065",
                letterSpacing: "-0.03em",
                lineHeight: 1.15,
                margin: "0 0 8px 0",
              }}
            >
              {tab === "login" ? "Masuk ke Dashboard" : "Daftar sebagai Klien Maklon"}
            </h1>
            <p style={{ fontSize: "0.9rem", color: "#5B5870", margin: 0 }}>
              {tab === "login"
                ? "Akses modul sesuai hak otorisasi RBAC Anda"
                : "Isi data perusahaan untuk mendapatkan ID Klien unik"}
            </p>
          </div>

          {/* ── Tab Switcher ── */}
          <div
            style={{
              display: "flex",
              background: "#F3F0FF",
              borderRadius: 14,
              padding: 4,
              marginBottom: 24,
              gap: 4,
            }}
          >
            {(["login", "register"] as TabMode[]).map((t) => (
              <button
                key={t}
                id={`tab-${t}`}
                onClick={() => switchTab(t)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "none",
                  fontWeight: 700,
                  fontSize: "0.88rem",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  fontFamily: "inherit",
                  background: tab === t ? "#ffffff" : "transparent",
                  color: tab === t ? "#7C3AED" : "#84829a",
                  boxShadow: tab === t ? "0 2px 8px rgba(124,58,237,0.12)" : "none",
                }}
              >
                {t === "login" ? "🔐 Masuk" : "✨ Daftar Klien"}
              </button>
            ))}
          </div>

          {/* ── Card ── */}
          <div
            style={{
              background: "#ffffff",
              border: "1.5px solid #EDE9FE",
              borderRadius: 24,
              padding: "32px 28px",
              boxShadow: "0 16px 48px rgba(46,16,101,0.08), 0 2px 8px rgba(46,16,101,0.04)",
            }}
          >
            {/* Error Notice */}
            {errorMsg && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 16px",
                  marginBottom: 20,
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 12,
                  color: "#991b1b",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                }}
              >
                <span>⚠️</span>
                <span style={{ flex: 1 }}>{errorMsg}</span>
                <button
                  onClick={() => setErrorMsg(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontWeight: 700, fontSize: "1rem" }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* ═══ TAB: LOGIN ═══ */}
            {tab === "login" && (
              <form id="form-login" onSubmit={handleLogin} noValidate>
                {/* Username */}
                <div style={{ marginBottom: 16 }}>
                  <label htmlFor="login-username" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#2E1065", marginBottom: 6 }}>
                    Username
                  </label>
                  <input
                    id="login-username"
                    type="text"
                    className="form-input"
                    placeholder="Masukkan username Anda"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                    style={{ fontSize: "0.92rem" }}
                  />
                </div>

                {/* Password */}
                <div style={{ marginBottom: 24 }}>
                  <label htmlFor="login-password" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#2E1065", marginBottom: 6 }}>
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
                      style={{ fontSize: "0.92rem", paddingRight: 44 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem", color: "#84829a" }}
                    >
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                <button
                  id="btn-login-submit"
                  type="submit"
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "13px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
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
                >
                  {loading ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> Memproses...</> : "Masuk ke Dashboard →"}
                </button>

                <div style={{ textAlign: "center", marginTop: 20 }}>
                  <span style={{ fontSize: "0.82rem", color: "#84829a" }}>Klien baru? </span>
                  <button
                    type="button"
                    onClick={() => switchTab("register")}
                    style={{ background: "none", border: "none", fontSize: "0.82rem", color: "#7C3AED", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Daftar di sini →
                  </button>
                </div>
              </form>
            )}

            {/* ═══ TAB: REGISTER (KLIEN) ═══ */}
            {tab === "register" && !regSuccess && (
              <form id="form-register-client" onSubmit={handleRegister} noValidate>
                <p style={{ fontSize: "0.8rem", color: "#84829a", marginBottom: 20, lineHeight: 1.5, padding: "10px 14px", background: "#F3F0FF", borderRadius: 10 }}>
                  📋 Formulir ini <strong>khusus untuk klien maklon</strong> (pemesan jasa konveksi). Akun internal pabrik dibuat oleh Owner/Admin.
                </p>

                {/* Data Akun */}
                <div style={{ marginBottom: 8, fontSize: "0.75rem", fontWeight: 800, color: "#7C3AED", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Data Akun
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label htmlFor="reg-username" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#2E1065", marginBottom: 5 }}>Username *</label>
                  <input id="reg-username" type="text" className="form-input" placeholder="contoh: cv_busana_prima" value={regUsername} onChange={(e) => setRegUsername(e.target.value)} required />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label htmlFor="reg-email" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#2E1065", marginBottom: 5 }}>Email *</label>
                  <input id="reg-email" type="email" className="form-input" placeholder="pic@perusahaan.com" value={regEmail} onChange={(e) => setRegEmail(e.target.value)} required />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label htmlFor="reg-password" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#2E1065", marginBottom: 5 }}>Password * (min 6 karakter)</label>
                  <div style={{ position: "relative" }}>
                    <input
                      id="reg-password"
                      type={showRegPassword ? "text" : "password"}
                      className="form-input"
                      placeholder="••••••••"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                      style={{ paddingRight: 44 }}
                    />
                    <button type="button" onClick={() => setShowRegPassword(!showRegPassword)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: "0.9rem", color: "#84829a" }}>
                      {showRegPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                {/* Data Perusahaan */}
                <div style={{ marginBottom: 8, fontSize: "0.75rem", fontWeight: 800, color: "#7C3AED", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                  Data Perusahaan Klien
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label htmlFor="reg-company" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#2E1065", marginBottom: 5 }}>Nama Perusahaan / Brand *</label>
                  <input id="reg-company" type="text" className="form-input" placeholder="contoh: CV Busana Prima" value={regCompanyName} onChange={(e) => setRegCompanyName(e.target.value)} required />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label htmlFor="reg-contact" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#2E1065", marginBottom: 5 }}>Nama PIC / Kontak *</label>
                  <input id="reg-contact" type="text" className="form-input" placeholder="contoh: Bapak Doni" value={regContactPerson} onChange={(e) => setRegContactPerson(e.target.value)} required />
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label htmlFor="reg-phone" style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#2E1065", marginBottom: 5 }}>No. WhatsApp / Telepon *</label>
                  <input id="reg-phone" type="tel" className="form-input" placeholder="contoh: 08198765432" value={regPhone} onChange={(e) => setRegPhone(e.target.value)} required />
                </div>

                <button
                  id="btn-register-submit"
                  type="submit"
                  disabled={regLoading}
                  style={{
                    width: "100%",
                    padding: "13px 20px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 10,
                    background: regLoading ? "#C4B5FD" : "linear-gradient(135deg, #7C3AED 0%, #2E1065 100%)",
                    color: "#ffffff",
                    borderRadius: 9999,
                    border: "none",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    cursor: regLoading ? "not-allowed" : "pointer",
                    boxShadow: regLoading ? "none" : "0 8px 20px rgba(124,58,237,0.35)",
                    transition: "all 0.2s ease",
                    fontFamily: "inherit",
                  }}
                >
                  {regLoading ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> Mendaftarkan...</> : "Daftar & Dapatkan ID Klien →"}
                </button>

                <div style={{ textAlign: "center", marginTop: 20 }}>
                  <span style={{ fontSize: "0.82rem", color: "#84829a" }}>Sudah punya akun? </span>
                  <button
                    type="button"
                    onClick={() => switchTab("login")}
                    style={{ background: "none", border: "none", fontSize: "0.82rem", color: "#7C3AED", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
                  >
                    Masuk di sini →
                  </button>
                </div>
              </form>
            )}

            {/* ═══ REGISTER SUCCESS ═══ */}
            {tab === "register" && regSuccess && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "3rem", marginBottom: 16 }}>🎉</div>
                <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#2E1065", marginBottom: 12 }}>Registrasi Berhasil!</h2>
                <div
                  style={{
                    background: "#F0FDF4",
                    border: "1.5px solid #BBF7D0",
                    borderRadius: 14,
                    padding: "16px 20px",
                    marginBottom: 20,
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#166534", marginBottom: 8 }}>🔑 ID Klien Anda (simpan baik-baik):</div>
                  <code
                    style={{
                      display: "block",
                      fontSize: "0.78rem",
                      fontFamily: "monospace",
                      color: "#065f46",
                      background: "#DCFCE7",
                      padding: "10px 14px",
                      borderRadius: 8,
                      wordBreak: "break-all",
                      fontWeight: 700,
                    }}
                  >
                    {regSuccess.clientId}
                  </code>
                  <p style={{ fontSize: "0.78rem", color: "#15803d", marginTop: 10, marginBottom: 0, lineHeight: 1.5 }}>
                    ID ini digunakan di semua proses pesanan, gudang, dan portal klien Anda.
                  </p>
                </div>
                <p style={{ fontSize: "0.85rem", color: "#5B5870", marginBottom: 20, lineHeight: 1.6 }}>
                  {regSuccess.message}
                </p>
                <button
                  id="btn-goto-login"
                  onClick={() => { setRegSuccess(null); switchTab("login"); }}
                  style={{
                    width: "100%",
                    padding: "13px 20px",
                    background: "linear-gradient(135deg, #7C3AED 0%, #2E1065 100%)",
                    color: "#ffffff",
                    borderRadius: 9999,
                    border: "none",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                    cursor: "pointer",
                    boxShadow: "0 8px 20px rgba(124,58,237,0.35)",
                    fontFamily: "inherit",
                  }}
                >
                  Lanjut ke Halaman Login →
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
