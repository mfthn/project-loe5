"use client";

import React from "react";
import { AppLayout } from "../../components/AppLayout";
import { ChatPanel } from "../../components/ChatPanel";

export default function AnalisisPage() {
  return (
    <AppLayout
      title="Analisis Operasional & Bisnis"
      subtitle="AI Analis Owner — analisis kapasitas produksi, tren QC, payroll, dan prioritas order berbasis AI Knowledge Base"
      requiredModule="analisis"
    >
      <ChatPanel mode="owner" />
    </AppLayout>
  );
}
