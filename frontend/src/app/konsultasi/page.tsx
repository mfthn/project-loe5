"use client";

import React from "react";
import { AppLayout } from "../../components/AppLayout";
import { ChatPanel } from "../../components/ChatPanel";

export default function KonsultasiPage() {
  return (
    <AppLayout
      title="Konsultasi Maklon B2B"
      subtitle="Asisten Konsultan Maklon — skema CMT, estimasi sample, MOQ, dan negosiasi pesanan via AI Knowledge Base"
      requiredModule="konsultasi"
    >
      <ChatPanel mode="client" />
    </AppLayout>
  );
}
