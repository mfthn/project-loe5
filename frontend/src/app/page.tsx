"use client";

import React from "react";
import { Navbar } from "../components/landing/Navbar";
import { HeroSection } from "../components/landing/HeroSection";
import { BentoGrid } from "../components/landing/BentoGrid";
import { SkemaSection } from "../components/landing/SkemaSection";
import { WorkflowSection } from "../components/landing/WorkflowSection";
import { FeaturesSection } from "../components/landing/FeaturesSection";
import { PortalKlienSection } from "../components/landing/PortalKlienSection";
import { StatsSection } from "../components/landing/StatsSection";
import { FaqSection } from "../components/landing/FaqSection";
import { ClosingCtaSection } from "../components/landing/ClosingCtaSection";
import { Footer } from "../components/landing/Footer";
import { ChatWidget } from "../components/landing/ChatWidget";

export default function LandingPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#FFFFFF",
        color: "#0F0F14",
        fontFamily: "var(--font-sans)",
        display: "flex",
        flexDirection: "column",
        overflowX: "hidden",
      }}
    >
      {/* 5.1 Navbar */}
      <Navbar />

      <main style={{ paddingTop: "72px" }}>
        {/* 5.2 Hero Section */}
        <HeroSection />

        {/* 5.3 Bento Grid */}
        <BentoGrid />

        {/* 5.4 Skema Kerja Sama (CMT, Semi-CMT, Full Package) */}
        <SkemaSection />

        {/* 5.5 Alur 6 Fase (Cara Kerja) */}
        <WorkflowSection />

        {/* 5.6 Fitur Unggulan (3 Blok Besar Selang-Seling) */}
        <FeaturesSection />

        {/* 5.7 Portal Klien B2B */}
        <PortalKlienSection />

        {/* 5.8 Statistik & Pernyataan Kepercayaan */}
        <StatsSection />

        {/* 5.9 FAQ (Accordion) */}
        <FaqSection />

        {/* 5.10 Closing CTA */}
        <ClosingCtaSection />
      </main>

      {/* 5.11 Footer */}
      <Footer />

      {/* Floating Pop-up Chatbot Publik (/rag) */}
      <ChatWidget />
    </div>
  );
}
