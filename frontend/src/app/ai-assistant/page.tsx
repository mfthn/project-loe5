"use client";

import React, { useState } from "react";
import { AppLayout } from "../../components/AppLayout";
import { Notice } from "../../components/Notice";
import { aiApi } from "../../lib/api";
import { useAuth } from "../../lib/auth-context";
import type { AssistantPersona, DualAskResponse, SourceDocument } from "../../types/api";

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  sources?: SourceDocument[];
  persona: AssistantPersona;
  timestamp: string;
  whatsapp_handoff_url?: string | null;
}

const OWNER_PROMPTS = [
  "Berapa kapasitas mesin aktif saat ini dan bagaimana alur produksi?",
  "Bagaimana cara kerja Pool Bonus QC Mandor berdasarkan SOP?",
  "Jelaskan aturan Audit Lock pada Payroll Sabtu (FR-10).",
  "Mengapa bahan Klien A tidak boleh keluar untuk pesanan Klien B?",
];

const CLIENT_PROMPTS = [
  "Apa saja tahapan order maklon dari sample sampai produksi?",
  "Apa perbedaan skema maklon CMT, Semi-CMT, dan Full Package?",
  "Saya ingin negosiasi pesanan jaket 500 pcs dengan Tim Sampel",
  "Berapa estimasi waktu pengerjaan sample dan minimal order (MOQ)?",
];

export default function AiAssistantPage() {
  const { user } = useAuth();
  const isClient = user?.role === "KLIEN_MAKLON";
  const persona: AssistantPersona = isClient ? "client_assistant" : "owner_tracker";
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "Halo! Saya AI Assistant Lukla Operations Engine. Silakan tanyakan hal yang ingin Anda ketahui.",
      persona: "owner_tracker",
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "danger" | "warning"; message: string } | null>(null);

  const handleSendMessage = async (textToSend?: string) => {
    const question = textToSend || inputText;
    if (!question.trim()) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: "user",
      text: question,
      persona,
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);

    try {
      const res: DualAskResponse = await aiApi.askAssistant({
        question,
        persona,
      });

      const aiMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: "ai",
        text: res.answer,
        sources: res.sources,
        persona: res.persona,
        timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        whatsapp_handoff_url: res.whatsapp_handoff_url,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setNotice({
        type: "danger",
        message: err.message || "Gagal menghubungi AI Bedrock RAG. Periksa kredensial AWS.",
      });
    } finally {
      setLoading(false);
    }
  };

  const activeQuickPrompts = persona === "owner_tracker" ? OWNER_PROMPTS : CLIENT_PROMPTS;

  return (
    <AppLayout
      title="AI Dual-Assistant (Owner Tracker & Konsultan Maklon)"
      subtitle="Amazon Bedrock RAG Titan & Nova Lite — Satu pipeline RAG dengan dua persona cerdas (Fase 7 - P1)"
      requiredModule="ai-assistant"
    >
      {notice && (
        <Notice
          type={notice.type}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}

      {/* Persona Toggle Bar */}
      <div
        className="card-elevated"
        style={{
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14,
        }}
      >
        <div>
          <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 700 }}>
            Mode Asisten:
          </div>
          <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>
            {persona === "owner_tracker"
              ? "👔 Owner Business & Operations Tracker (Internal)"
              : "🤝 Asisten Calon Klien B2B (Konsultan Maklon)"}
          </div>
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
                <span>{msg.sender === "user" ? "Anda" : msg.persona === "owner_tracker" ? "AI Owner Tracker" : "AI Asisten Klien"}</span>
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
              persona === "owner_tracker"
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
