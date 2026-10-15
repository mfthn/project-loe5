"use client";

import React, { useState, useEffect } from "react";
import { AppLayout } from "../../components/AppLayout";
import { Notice } from "../../components/Notice";
import { aiApi } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import type { DualAskResponse, SourceDocument } from "../../types/api";

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  sources?: SourceDocument[];
  timestamp: string;
  whatsapp_handoff_url?: string | null;
  mode?: "owner_agent" | "client_rag";
}

const OWNER_PROMPTS = [
  "Berapa kapasitas mesin aktif saat ini dan status pesanan di lini produksi?",
  "Bagaimana proyeksi dan kalkulasi Pool Bonus QC Mandor saat ini?",
  "Jelaskan data audit lock dan rekap upah borongan payroll Sabtu ini.",
  "Tampilkan ringkasan stok bahan baku dan peringatan kontaminasi di gudang.",
];

const CLIENT_PROMPTS = [
  "Apa saja tahapan order maklon dari sample sampai produksi?",
  "Apa perbedaan skema maklon CMT, Semi-CMT, dan Full Package?",
  "Bagaimana alur pembuatan sampel dari v1 hingga konversi pesanan massal?",
  "Berapa estimasi waktu pengerjaan sample dan minimal order (MOQ)?",
  "Aksesoris apa saja yang disediakan Lukla pada skema Semi-CMT?",
];

export default function AiAssistantPage() {
  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "danger" | "warning"; message: string } | null>(null);

  // Set initial welcome message based on user role
  useEffect(() => {
    if (isOwner) {
      setMessages([
        {
          id: "welcome-owner",
          sender: "ai",
          text: `Halo ${user?.name || "Pak Hendra"}! Saya adalah Owner Monitoring & Analytics Agent. Saya terhubung langsung ke basis pengetahuan SOP dan database sistem operasional terkini (pesanan aktif, output 30 menit, QC, stok gudang, & payroll). Apa analisis operasional yang ingin Anda pantau hari ini?`,
          timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          mode: "owner_agent",
        },
      ]);
    } else {
      setMessages([
        {
          id: "welcome-client",
          sender: "ai",
          text: `Halo! Saya adalah Asisten Konsultasi Maklon Lukla Operations Engine. Silakan tanyakan hal seputar skema kerja sama (CMT/Semi-CMT/Full Package), alur pembuatan sample, prosedur pengiriman bahan, hingga panduan SOP pabrik kami.`,
          timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          mode: "client_rag",
        },
      ]);
    }
  }, [isOwner, user?.name]);

  const handleSendMessage = async (textToSend?: string) => {
    const question = textToSend || inputText;
    if (!question.trim()) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: "user",
      text: question,
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      mode: isOwner ? "owner_agent" : "client_rag",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);

    try {
      // Owner -> /ai/ask-agent (S3 docs + live database tracking)
      // Client/Others -> /ai/rag (S3 docs SOP only + WhatsApp handoff)
      const res: DualAskResponse = isOwner
        ? await aiApi.askAgent(question)
        : await aiApi.askClient(question);

      const aiMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: "ai",
        text: res.answer,
        sources: res.sources,
        timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        whatsapp_handoff_url: res.whatsapp_handoff_url,
        mode: isOwner ? "owner_agent" : "client_rag",
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setNotice({
        type: "danger",
        message: err.message || "Gagal menghubungi AI Bedrock RAG. Periksa status layanan.",
      });
    } finally {
      setLoading(false);
    }
  };

  const activeQuickPrompts = isOwner ? OWNER_PROMPTS : CLIENT_PROMPTS;

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
      {notice && (
        <Notice
          type={notice.type}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}

      {/* Mode Banner */}
      <div
        className="card-elevated"
        style={{
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14,
          background: isOwner ? "linear-gradient(135deg, #FAF5FF 0%, #F3E8FF 100%)" : "#FFFFFF",
          border: isOwner ? "1.5px solid #C4B5FD" : "1px solid #EDE9FE",
        }}
      >
        <div>
          <div style={{ fontSize: "0.78rem", color: "#6D28D9", textTransform: "uppercase", fontWeight: 700 }}>
            {isOwner ? "Akses Khusus Eksekutif / Owner" : "Akses Klien & Mitra Maklon"}
          </div>
          <div style={{ fontWeight: 800, fontSize: "1.1rem", color: "#2E1065" }}>
            {isOwner
              ? "📊 Mode Agentic Analytics — Mengakses S3 SOP + Live Database Sistem"
              : "🤝 Mode Chatbot Maklon — Mengakses S3 SOP Dokumen Publik"}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              padding: "6px 14px",
              borderRadius: 9999,
              background: isOwner ? "#7C3AED" : "#EDE9FE",
              color: isOwner ? "#ffffff" : "#2E1065",
              fontSize: "0.82rem",
              fontWeight: 700,
            }}
          >
            {isOwner ? "Endpoint: /ai/ask-agent (DB Live)" : "Endpoint: /ai/rag (S3 SOP)"}
          </span>
        </div>
      </div>

      {/* Chat Window */}
      <div className="chat-window">
        {/* Messages Stream */}
        <div className="chat-messages">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`chat-bubble ${msg.sender === "user" ? "chat-bubble-user" : "chat-bubble-ai"}`}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", marginBottom: 4, opacity: 0.8 }}>
                <span>{msg.sender === "user" ? "Anda" : msg.mode === "owner_agent" ? "AI Owner Tracker (/ask-agent)" : "AI Asisten Maklon (/rag)"}</span>
                <span>{msg.timestamp}</span>
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>

              {/* RAG Document Sources Citation */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="chat-sources">
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>📚 Rujukan SOP (RAG Bedrock):</div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {msg.sources.map((s, idx) => {
                      const label = s.source_file
                        ? s.source_file.split("/").pop()
                        : s.chunk_index !== undefined
                        ? `Chunk #${s.chunk_index + 1}`
                        : `Kutipan #${idx + 1}`;
                      const scoreText = s.score !== undefined ? ` (${Math.round(s.score * 100)}%)` : "";
                      return (
                        <span
                          key={idx}
                          className="badge badge-neutral"
                          style={{ fontSize: "0.68rem" }}
                          title={s.text || undefined}
                        >
                          📄 {label}{scoreText}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* WhatsApp Handoff to Tim Sampel (Activity Diagram Alur Final) */}
              {msg.whatsapp_handoff_url && (
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px dashed rgba(0,0,0,0.12)" }}>
                  <a
                    href={msg.whatsapp_handoff_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      textDecoration: "none",
                      backgroundColor: "#25D366",
                      borderColor: "#25D366",
                      color: "#ffffff",
                      fontWeight: 700,
                      borderRadius: "var(--radius-md)",
                      padding: "8px 16px",
                      boxShadow: "0 2px 8px rgba(37, 211, 102, 0.35)",
                    }}
                  >
                    <span style={{ fontSize: "1.1rem" }}>💬</span>
                    <span>Lanjut Diskusi / Negosiasi via WhatsApp Tim Sampel →</span>
                  </a>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="chat-bubble chat-bubble-ai">
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ animation: "pulse 1s infinite" }}>⏳</span>
                <span>Menganalisis dokumen SOP dengan Amazon Bedrock...</span>
              </div>
            </div>
          )}
        </div>

        {/* Quick Suggestion Chips */}
        <div
          style={{
            padding: "8px 18px",
            background: "var(--bg-surface)",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            gap: 8,
            overflowX: "auto",
          }}
        >
          {activeQuickPrompts.map((p, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(p)}
              disabled={loading}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: "0.75rem", whiteSpace: "nowrap" }}
            >
              💡 {p}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          style={{
            padding: 16,
            background: "var(--bg-surface)",
            borderTop: "1px solid var(--border-default)",
            display: "flex",
            gap: 12,
          }}
        >
          <input
            type="text"
            className="form-input"
            placeholder={
              isOwner
                ? "Tanyakan kondisi operasional, SOP payroll, QC, atau kapasitas..."
                : "Tanyakan tentang alur maklon, skema CMT, estimasi waktu, atau MOQ..."
            }
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn btn-primary" disabled={loading || !inputText.trim()}>
            Kirim Pertanyaan 🚀
          </button>
        </form>
      </div>
    </AppLayout>
  );
}
