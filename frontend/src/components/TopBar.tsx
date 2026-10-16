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
  const [aiChunks, setAiChunks] = useState(0);
  const [timeStr, setTimeStr] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");

  useEffect(() => {
    let alive = true;
    const checkAi = () => {
      fetchAiStatus().then((res) => {
        if (!alive) return;
        setAiOnline(res.ok && res.indexReady);
        setAiChunks(res.chunks);
      });
    };
    checkAi();
    const aiTimer = setInterval(checkAi, 60000);

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
    return () => {
      alive = false;
      clearInterval(aiTimer);
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <img
          src="/Lukla.jpeg"
          alt="Logo Lukla"
          style={{
            width: 36,
            height: 36,
            borderRadius: "var(--radius-sm)",
            objectFit: "cover",
            boxShadow: "var(--shadow-coral)",
            flexShrink: 0,
          }}
        />
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

        <div className="topbar-heading">
          <h1
            className="topbar-title"
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
              className="topbar-subtitle"
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

      <div className="topbar-actions" style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Live Factory Clock (disembunyikan di mobile) */}
        <div
          className="font-mono topbar-clock"
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
          <span className="topbar-ai-text">
            {aiOnline ? `AI Aktif • ${aiChunks} chunk` : aiOnline === false ? "AI Offline" : "AI Sync..."}
          </span>
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
            <span className="topbar-user-name" style={{ color: "#84829a", fontWeight: 500 }}>{user.name}</span>
            <span
              className="topbar-user-role"
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
