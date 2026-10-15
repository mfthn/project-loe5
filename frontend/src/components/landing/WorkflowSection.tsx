"use client";

import React, { useState } from "react";
import { LANDING_CONTENT } from "../../content/landing";

export function WorkflowSection() {
  const { workflow } = LANDING_CONTENT;
  const [activeStep, setActiveStep] = useState<number>(0);

  return (
    <section
      id="alur"
      style={{
        padding: "100px 0",
        background: "#FAF8FF",
        borderTop: "1px solid #EDE9FE",
        borderBottom: "1px solid #EDE9FE",
      }}
    >
      <div className="container" style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px" }}>
        {/* Header */}
        <div style={{ textAlign: "center", maxWidth: 700, margin: "0 auto 64px auto" }}>
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
            {workflow.badge}
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
            {workflow.title}
          </h2>
          <p style={{ fontSize: "1.05rem", color: "#5B5870", lineHeight: 1.6, margin: 0 }}>
            {workflow.subtitle}
          </p>
        </div>

        {/* Stepper Grid (6 Steps with Connector Line) */}
        <div
          className="workflow-stepper"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 16,
            position: "relative",
          }}
        >
          {workflow.steps.map((st, i) => {
            const isActive = activeStep === i;
            return (
              <div
                key={st.num}
                onClick={() => setActiveStep(i)}
                onMouseEnter={() => setActiveStep(i)}
                style={{
                  background: isActive ? "#ffffff" : "transparent",
                  borderRadius: 20,
                  padding: "24px 18px",
                  border: isActive ? "2px solid #7C3AED" : "1.5px solid transparent",
                  boxShadow: isActive ? "0 16px 36px rgba(124, 58, 237, 0.12)" : "none",
                  cursor: "pointer",
                  transition: "all 0.25s ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-start",
                  position: "relative",
                }}
              >
                {/* Step Number with Active Pink Dot */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "1.45rem",
                      fontWeight: 800,
                      color: isActive ? "#7C3AED" : "#C4B5FD",
                      lineHeight: 1,
                    }}
                  >
                    {st.num}
                  </span>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: isActive ? "#EC4899" : "transparent",
                      border: `2px solid ${isActive ? "#EC4899" : "#C4B5FD"}`,
                      transition: "all 0.2s ease",
                    }}
                  />
                </div>

                {/* Step Title */}
                <h4
                  style={{
                    fontSize: "1rem",
                    fontWeight: 800,
                    color: isActive ? "#2E1065" : "#5B5870",
                    margin: "0 0 10px 0",
                    lineHeight: 1.25,
                  }}
                >
                  {st.title}
                </h4>

                {/* Step Description */}
                <p
                  style={{
                    fontSize: "0.82rem",
                    color: isActive ? "#5B5870" : "#84829a",
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  {st.desc}
                </p>
              </div>
            );
          })}
        </div>

        {/* Selected Step Spotlight Bar */}
        <div
          style={{
            marginTop: 40,
            padding: "20px 28px",
            background: "#ffffff",
            borderRadius: 20,
            border: "1.5px solid #EDE9FE",
            boxShadow: "0 8px 24px rgba(46, 16, 101, 0.04)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span
              style={{
                background: "#7C3AED",
                color: "#ffffff",
                padding: "6px 14px",
                borderRadius: 9999,
                fontWeight: 800,
                fontSize: "0.85rem",
                fontFamily: "monospace",
              }}
            >
              Fase {workflow.steps[activeStep].num}
            </span>
            <span style={{ fontSize: "1.05rem", fontWeight: 700, color: "#2E1065" }}>
              {workflow.steps[activeStep].title}: {workflow.steps[activeStep].desc}
            </span>
          </div>

          <a
            href="#skema"
            style={{
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "#7C3AED",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>Konsultasikan fase ini</span>
            <span>→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
