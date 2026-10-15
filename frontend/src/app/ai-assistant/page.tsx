"use client";

import React from "react";
import { AppLayout } from "../../components/AppLayout";
import { ChatPanel } from "../../components/ChatPanel";

export default function AiAssistantPage() {
  return (
    <AppLayout
      title="AI Dual-Assistant (Owner Tracker & Konsultan Maklon)"
      subtitle="Amazon Bedrock RAG Titan & Nova Lite — Satu pipeline RAG dengan dua persona cerdas (Fase 7 - P1)"
      requiredModule="ai-assistant"
    >
      <ChatPanel mode="dual" />
    </AppLayout>
  );
}
