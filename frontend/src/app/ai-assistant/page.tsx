"use client";

import React from "react";
import { AppLayout } from "../../components/AppLayout";
import { ChatPanel } from "../../components/ChatPanel";

export default function AiAssistantPage() {
  return (
    <AppLayout
      title={isOwner ? "Owner Monitoring & Analytics Agent (/ask-agent)" : "Asisten Konsultasi Maklon (/rag)"}
      subtitle={
        isOwner
          ? "Monitoring real-time: Dokumen SOP (S3) + Live Database (Orders, Output 30m, QC, Payroll, Stok)"
          : "Knowledge Base SOP Maklon (S3) — Panduan Alur Produksi & Konsultasi Pemesanan"
      }
      requiredModule="ai-assistant"
    >
      <ChatPanel mode="dual" />
    </AppLayout>
  );
}
