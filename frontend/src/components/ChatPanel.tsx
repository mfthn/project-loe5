"use client";

import React, { useState } from "react";
import { MarkdownText } from "./MarkdownText";
import { Notice } from "./Notice";
import { aiApi } from "../lib/api";
import type { AssistantPersona, DualAskResponse, SourceDocument } from "../types/api";

export type ChatMode = "dual" | "client" | "owner";

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  sources?: SourceDocument[];
  persona: AssistantPersona;
  timestamp: string;
  whatsapp_handoff_url?: string | null;
}

interface ModeConfig {
  lockPersona: AssistantPersona | null;
  welcome: string;
  welcomePersona: AssistantPersona;
  prompts: Record<AssistantPersona, string[]>;
  placeholders: Record<AssistantPersona, string>;
}

const OWNER_PROMPTS = [
  "Berapa kapasitas mesin aktif saat ini dan bagaimana alur produksi?",
  "Bagaimana cara kerja Pool Bonus QC Mandor berdasarkan SOP?",
  "Jelaskan aturan Audit Lock pada Payroll Sabtu (FR-10).",
  "Mengapa bahan Klien A tidak boleh keluar untuk pesanan Klien B?",
];

const CLIENT_PROMPTS = [
  "Apa perbedaan skema maklon CMT, Semi-CMT, dan Full Package?",
  "Saya ingin negosiasi pesanan jaket 500 pcs dengan Tim Sampel",
  "Berapa estimasi waktu pengerjaan sample dan minimal order (MOQ)?",
  "Bisa lihat rincian gaji internal karyawan atau keuntungan pabrik?",
];

const ANALYSIS_PROMPTS: string[] = [
  "Analisis kapasitas mesin aktif dan bottleneck produksi saat ini.",
  "Bagaimana tren QC dan akumulasi pool bonus mandor periode ini?",
  "Jelaskan status payroll dan aturan Audit Lock Sabtu (FR-10).",
  "Order mana yang paling membutuhkan perhatian prioritas?",
];

const MODE_CONFIG: Record<ChatMode, ModeConfig> = {
  dual: {
    lockPersona: null,
    welcome:
      "Halo! Saya adalah AI Assistant Lukla Operations Engine. Silakan pilih persona yang ingin Anda ajak diskusi atau tanyakan seputar SOP operasional dan layanan kami.",
    welcomePersona: "owner_tracker",
    prompts: { owner_tracker: OWNER_PROMPTS, client_assistant: CLIENT_PROMPTS },
    placeholders: {
      owner_tracker: "Tanyakan kondisi operasional, SOP payroll, QC, atau kapasitas...",
      client_assistant: "Tanyakan tentang alur maklon, skema CMT, estimasi waktu, atau MOQ...",
    },
  },
  client: {
    lockPersona: "client_assistant",
    welcome:
      "Halo! Selamat datang di layanan Konsultasi Maklon Lukla. Saya siap membantu Anda seputar skema CMT / Semi-CMT / Full Package, estimasi sample, MOQ, dan proses kerja sama. Silakan bertanya! 👋",
    welcomePersona: "client_assistant",
    prompts: { owner_tracker: [], client_assistant: CLIENT_PROMPTS },
    placeholders: {
      owner_tracker: "",
      client_assistant: "Tanyakan skema maklon, MOQ, estimasi sample, atau negosiasi pesanan...",
    },
  },
  owner: {
    lockPersona: "owner_tracker",
    welcome:
      "Halo! Saya adalah Analis Operasional Anda. Saya memantau kapasitas produksi, QC, payroll, dan pesanan berdasarkan SOP pabrik. Apa yang ingin Anda analisis hari ini? 📊",
    welcomePersona: "owner_tracker",
    prompts: { owner_tracker: ANALYSIS_PROMPTS, client_assistant: [] },
    placeholders: {
      owner_tracker: "Minta analisis kapasitas, tren QC, payroll, atau prioritas order...",
      client_assistant: "",
    },
  },
};

const AI_LABEL: Record<AssistantPersona, string> = {
  owner_tracker: "AI Analisis Owner",
  client_assistant: "AI Konsultan Maklon",
};

export function ChatPanel({ mode }: { mode: ChatMode }) {
  const config = MODE_CONFIG[mode];
  const [persona, setPersona] = useState<AssistantPersona>(config.lockPersona ?? "owner_tracker");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "ai",
      text: config.welcome,
      persona: config.welcomePersona,
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
        message: err.message || "Gagal menghubungi AI Service. Silakan coba lagi beberapa saat.",
      });
    } finally {
      setLoading(false);
    }
  };

  const activeQuickPrompts = config.prompts[persona];

  return (
    <>
      {notice && (
        <Notice
          type={notice.type}
          message={notice.message}
          onClose={() => setNotice(null)}
        />
      )}

      {/* Persona Toggle Bar — hanya untuk mode dual */}
      {config.lockPersona === null && (
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
              Pilih Mode Persona AI:
            </div>
            <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>
              {persona === "owner_tracker"
                ? "👔 Owner Business & Operations Tracker (Internal)"
                : "🤝 Asisten Calon Klien B2B (Konsultan Maklon)"}
            </div>
          </div>

          <div style={{ display: "flex", background: "var(--bg-secondary)", padding: 4, borderRadius: "var(--radius-md)" }}>
            <button
              onClick={() => setPersona("owner_tracker")}
              className={`btn btn-sm ${persona === "owner_tracker" ? "btn-primary" : "btn-ghost"}`}
            >
              👔 Owner Tracker
            </button>
            <button
              onClick={() => setPersona("client_assistant")}
              className={`btn btn-sm ${persona === "client_assistant" ? "btn-primary" : "btn-ghost"}`}
            >
              🤝 Asisten Calon Klien
            </button>
          </div>
        </div>
      )}

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
                <span>{msg.sender === "user" ? "Anda" : AI_LABEL[msg.persona] ?? "AI Assistant"}</span>
                <span>{msg.timestamp}</span>
              </div>
              {msg.sender === "user" ? (
                <div style={{ whiteSpace: "pre-wrap" }}>{msg.text}</div>
              ) : (
                <MarkdownText text={msg.text} />
              )}

              {/* RAG Document Sources Citation */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="chat-sources">
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>📚 Rujukan Dokumen SOP:</div>
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
            <div
              className="chat-bubble chat-bubble-ai"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                background: "#ffffff",
                border: "1px solid #EDE9FE",
                boxShadow: "0 2px 6px rgba(109, 40, 217, 0.06)",
              }}
            >
              <div className="typing-dots" style={{ color: "#7C3AED" }}>
                <span />
                <span />
                <span />
              </div>
              <span style={{ fontSize: "0.85rem", color: "#6D28D9" }}>
                Sedang menganalisis dokumen SOP & menyiapkan jawaban...
              </span>
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
            placeholder={config.placeholders[persona]}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={loading}
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !inputText.trim()}
            style={{ flexShrink: 0, whiteSpace: "nowrap" }}
          >
            Kirim 🚀
          </button>
        </form>
      </div>
    </>
  );
}
