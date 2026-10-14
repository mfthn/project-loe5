"use client";

import React, { useEffect, useState } from "react";
import { fetchAiStatus } from "../lib/api";

interface TopBarProps {
  title: string;
  subtitle?: string;
  onMenuClick?: () => void;
}

export function TopBar({ title, subtitle, onMenuClick }: TopBarProps) {
  const [aiOnline, setAiOnline] = useState<boolean | null>(null);
  const [timeStr, setTimeStr] = useState<string>("");

  useEffect(() => {
    fetchAiStatus().then((res) => setAiOnline(res.ok));

    const updateClock = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZoneName: "short",
        }),
      );
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="btn btn-ghost btn-sm"
            style={{ fontSize: "1.2rem", padding: "6px 8px" }}
          >
            ☰
          </button>
        )}
        <div>
          <h1 style={{ fontSize: "1.2rem", margin: 0, fontWeight: 700 }}>{title}</h1>
          {subtitle && (
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{subtitle}</div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {/* Live Factory Clock */}
        <div
          className="font-mono"
          style={{
            fontSize: "0.85rem",
            color: "var(--text-secondary)",
            background: "var(--bg-surface)",
            padding: "4px 10px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-subtle)",
          }}
        >
          🕒 {timeStr || "--:--:--"}
        </div>

        {/* AI & Backend Status Pill */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            className={`badge ${aiOnline ? "badge-success" : aiOnline === false ? "badge-warning" : "badge-neutral"}`}
            title="Koneksi AWS Bedrock Titan & Nova Lite RAG Engine"
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: aiOnline ? "var(--color-success)" : "var(--color-warning)",
                display: "inline-block",
              }}
            />
            {aiOnline ? "AI Bedrock Active" : "AI Syncing"}
          </div>
        </div>
      </div>
    </header>
  );
}
