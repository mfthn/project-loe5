"use client";

import React, { useState } from "react";
import { LANDING_CONTENT } from "../../content/landing";

export function FaqSection() {
  const { faq } = LANDING_CONTENT;
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIdx(openIdx === idx ? null : idx);
  };

  return (
    <section
      id="faq"
      style={{
        padding: "100px 0",
        background: "#FAF8FF",
        borderTop: "1px solid #EDE9FE",
        borderBottom: "1px solid #EDE9FE",
      }}
    >
      <div className="container" style={{ maxWidth: 860, margin: "0 auto", padding: "0 24px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <span
            style={{
              display: "inline-block",
              padding: "6px 16px",
              borderRadius: 9999,
              background: "#EDE9FE",
              color: "#6D28D9",
              fontSize: "0.82rem",
              fontWeight: 700,
              marginBottom: 12,
            }}
          >
            {faq.badge}
          </span>
          <h2
            style={{
              fontSize: "clamp(2rem, 3.8vw, 2.75rem)",
              fontWeight: 800,
              color: "#2E1065",
              letterSpacing: "-0.025em",
              lineHeight: 1.15,
              margin: "0 0 16px 0",
            }}
          >
            {faq.title}
          </h2>
          <p style={{ fontSize: "1.05rem", color: "#5B5870", lineHeight: 1.6, margin: 0 }}>
            {faq.subtitle}
          </p>
        </div>

        {/* Accordion List */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {faq.items.map((item, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                style={{
                  background: "#ffffff",
                  borderRadius: 18,
                  border: `1.5px solid ${isOpen ? "#C4B5FD" : "#EDE9FE"}`,
                  boxShadow: isOpen ? "0 8px 24px rgba(124, 58, 237, 0.08)" : "0 2px 8px rgba(0, 0, 0, 0.02)",
                  overflow: "hidden",
                  transition: "all 0.2s ease",
                }}
              >
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  aria-expanded={isOpen}
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    padding: "20px 24px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                    color: "inherit",
                  }}
                >
                  <span style={{ fontSize: "1.05rem", fontWeight: 700, color: isOpen ? "#7C3AED" : "#2E1065", lineHeight: 1.4 }}>
                    {item.q}
                  </span>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: "50%",
                      background: isOpen ? "#EDE9FE" : "#FAF8FF",
                      color: isOpen ? "#7C3AED" : "#5B5870",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "1.1rem",
                      fontWeight: 800,
                      flexShrink: 0,
                      transition: "transform 0.2s ease",
                      transform: isOpen ? "rotate(45deg)" : "rotate(0deg)",
                    }}
                  >
                    +
                  </span>
                </button>

                {isOpen && (
                  <div
                    style={{
                      padding: "0 24px 22px 24px",
                      fontSize: "0.95rem",
                      color: "#5B5870",
                      lineHeight: 1.65,
                      borderTop: "1px solid #FAF8FF",
                    }}
                  >
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
