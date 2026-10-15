"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { fetchAiStatus } from "../lib/api";
import { useAuth } from "../lib/auth-context";

interface TopBarProps {
  title: string;
  subtitle?: string;
  onMenuClick?: () => void;
  menuOpen?: boolean;
}

export function TopBar({ title, subtitle, onMenuClick, menuOpen }: TopBarProps) {
  const { user } = useAuth();
  const [aiOnline, setAiOnline] = useState<boolean | null>(null);
  const [timeStr, setTimeStr] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");

  useEffect(() => {
    fetchAiStatus().then((res) => setAiOnline(res.ok));

    const updateClock = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
      setDateStr(
        now.toLocaleDateString("id-ID", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }),
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="topbar">
      {/* ── Kiri: Hamburger + Judul Halaman ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {onMenuClick && (
          <button
            type="button"
            onClick={onMenuClick}
            aria-label={menuOpen ? "Sembunyikan menu navigasi" : "Tampilkan menu navigasi"}
            aria-expanded={menuOpen}
            style={{
              background: "transparent",
              border: "1px solid #EDE9FE",
              borderRadius: 10,
              width: 36,
              height: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              color: "#2E1065",
              fontSize: "1rem",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#FAF8FF"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            ☰
          </button>
        )}

        <div>
          <h1
            style={{
              fontSize: "1.1rem",
              margin: 0,
              fontWeight: 700,
              color: "#2E1065",
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <div
              style={{
                fontSize: "0.72rem",
                color: "#84829a",
                marginTop: 1,
                fontWeight: 500,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      </div>

      {/* ── Kanan: Clock + AI Status + User Quick Info ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Live Factory Clock */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 12px",
            background: "#FAF8FF",
            border: "1px solid #EDE9FE",
            borderRadius: 9999,
          }}
        >
          <span style={{ fontSize: "0.75rem", color: "#84829a" }}>🕒</span>
          <span
            className="font-mono"
            style={{
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "#2E1065",
              letterSpacing: "0.02em",
            }}
          >
            {timeStr || "--:--:--"}
          </span>
          <span style={{ fontSize: "0.72rem", color: "#84829a", borderLeft: "1px solid #EDE9FE", paddingLeft: 6 }}>
            {dateStr}
          </span>
        </div>

        {/* AI RAG Status Pill */}
        <div
          title="Status koneksi AWS Bedrock RAG Engine"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "5px 12px",
            borderRadius: 9999,
            background: aiOnline ? "#ecfdf5" : aiOnline === false ? "#fffbeb" : "#FAF8FF",
            border: `1px solid ${aiOnline ? "#a7f3d0" : aiOnline === false ? "#fde68a" : "#EDE9FE"}`,
            fontSize: "0.75rem",
            fontWeight: 700,
            color: aiOnline ? "#059669" : aiOnline === false ? "#d97706" : "#84829a",
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: aiOnline ? "#059669" : aiOnline === false ? "#d97706" : "#84829a",
              display: "inline-block",
            }}
          />
          {aiOnline ? "AI Aktif" : aiOnline === false ? "AI Offline" : "AI Sync..."}
        </div>

        {/* User role badge */}
        {user && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "5px 12px 5px 8px",
              background: "#EDE9FE",
              border: "1px solid #C4B5FD",
              borderRadius: 9999,
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "#2E1065",
              whiteSpace: "nowrap",
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: 6,
                overflow: "hidden",
              }}
            >
              <Image src="/icon.jpeg" alt="logo" width={20} height={20} style={{ objectFit: "cover" }} />
            </div>
            <span style={{ color: "#84829a", fontWeight: 500 }}>{user.name}</span>
            <span
              style={{
                background: "#7C3AED",
                color: "#fff",
                borderRadius: 9999,
                padding: "1px 7px",
                fontSize: "0.62rem",
              }}
            >
              {user.role}
            </span>
          </div>
        )}

        {/* Link kembali ke landing jika belum login */}
        {!user && (
          <Link
            href="/login"
            style={{
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "#7C3AED",
              padding: "6px 14px",
              background: "#EDE9FE",
              border: "1px solid #C4B5FD",
              borderRadius: 9999,
              textDecoration: "none",
            }}
          >
            Masuk →
          </Link>
        )}
      </div>
    </header>
  );
}
