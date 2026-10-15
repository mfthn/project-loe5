"use client";

import React from "react";

interface AmbientOrbProps {
  size?: number;
  top?: string | number;
  left?: string | number;
  right?: string | number;
  bottom?: string | number;
  opacity?: number;
  blur?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * AmbientOrb
 * Terinspirasi langsung dari Referensi 1 (lingkaran gradasi kabut lembut).
 * Palet warna: HANYA ungu (#C4B5FD, #A78BFA) dan pink (#FBCFE8, #F472B6) — TANPA warna biru.
 * Menghasilkan efek berkabut lembut yang melayang perlahan di latar belakang hero & section kunci.
 */
export function AmbientOrb({
  size = 520,
  top,
  left,
  right,
  bottom,
  opacity = 0.55,
  blur = 72,
  className = "",
  style,
}: AmbientOrbProps) {
  return (
    <div
      aria-hidden="true"
      className={`ambient-orb-wrapper ${className}`}
      style={{
        position: "absolute",
        width: size,
        height: size,
        top,
        left,
        right,
        bottom,
        pointerEvents: "none",
        zIndex: 0,
        filter: `blur(${blur}px)`,
        opacity,
        ...style,
      }}
    >
      <div
        className="ambient-orb-gradient"
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 35% 35%, rgba(244, 114, 182, 0.75) 0%, rgba(167, 139, 250, 0.7) 45%, rgba(196, 181, 253, 0.45) 70%, transparent 100%)",
        }}
      />
    </div>
  );
}
