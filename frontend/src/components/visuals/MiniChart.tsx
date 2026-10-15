"use client";

import React from "react";

/**
 * MiniLineChart
 * Digunakan pada Bento Card Gelap Ungu (Pemisahan Stok Otomatis).
 * Meniru pola kurva referensi 2 dengan warna ungu muda dan aksen pink point.
 */
export function MiniLineChart() {
  return (
    <div style={{ width: "100%", height: 110, position: "relative" }}>
      <svg
        viewBox="0 0 320 110"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "100%", overflow: "visible" }}
      >
        <defs>
          <linearGradient id="purpleGradient" x1="0" y1="0" x2="0" y2="100" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C4B5FD" stopOpacity="0.45" />
            <stop stopColor="#7C3AED" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Gridlines */}
        <line x1="0" y1="30" x2="320" y2="30" stroke="rgba(196, 181, 253, 0.15)" strokeDasharray="3 3" />
        <line x1="0" y1="65" x2="320" y2="65" stroke="rgba(196, 181, 253, 0.15)" strokeDasharray="3 3" />
        <line x1="0" y1="100" x2="320" y2="100" stroke="rgba(196, 181, 253, 0.15)" strokeDasharray="3 3" />

        {/* Area fill */}
        <path
          d="M0 85 C40 80, 80 40, 130 50 C180 60, 220 20, 270 25 C295 27, 310 40, 320 45 L320 110 L0 110 Z"
          fill="url(#purpleGradient)"
        />

        {/* Primary Line */}
        <path
          d="M0 85 C40 80, 80 40, 130 50 C180 60, 220 20, 270 25 C295 27, 310 40, 320 45"
          stroke="#C4B5FD"
          strokeWidth="3"
          strokeLinecap="round"
        />

        {/* Active Pink Data Point */}
        <circle cx="270" cy="25" r="5" fill="#EC4899" />
        <circle cx="270" cy="25" r="10" stroke="#EC4899" strokeWidth="2" strokeOpacity="0.5" />
      </svg>
    </div>
  );
}

/**
 * MiniBarChart
 * Digunakan pada Bento Card Output 30 Menit.
 * Visualisasi balok interval 30 menit dengan warna ungu dan highlight pink.
 */
export function MiniBarChart() {
  const bars = [42, 65, 58, 84, 76, 92, 88, 98];

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 64, width: "100%", paddingTop: 8 }}>
      {bars.map((height, i) => {
        const isHighlight = i === bars.length - 1;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${height}%`,
              borderRadius: "4px 4px 2px 2px",
              background: isHighlight ? "linear-gradient(180deg, #EC4899 0%, #DB2777 100%)" : "rgba(124, 58, 237, 0.25)",
              position: "relative",
            }}
          />
        );
      })}
    </div>
  );
}
