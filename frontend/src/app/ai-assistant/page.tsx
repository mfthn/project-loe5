"use client";

import React, { useState } from "react";
import { AppLayout } from "../../components/AppLayout";
import { Notice } from "../../components/Notice";
import { aiApi } from "../../lib/api";
import type { AssistantPersona, DualAskResponse } from "../../types/api";

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  sources?: { source_file: string; score?: number }[];
  persona: AssistantPersona;
  timestamp: string;
}

const OWNER_PROMPTS = [
  "Berapa kapasitas mesin aktif saat ini dan bagaimana alur produksi?",
  "Bagaimana cara kerja Pool Bonus QC Mandor berdasarkan SOP?",
  "Jelaskan aturan Audit Lock pada Payroll Sabtu (FR-10).",
  "Mengapa bahan Klien A tidak boleh keluar untuk pesanan Klien B?",
];

const CLIENT_PROMPTS = [
  "Apa perbedaan skema maklon CMT, Semi-CMT, dan Full Package?",
  "Berapa estimasi waktu pengerjaan sample dan minimal order (MOQ)?",
  "Bagaimana jaminan kontrol kualitas (QC) di pabrik Lukla?",
  "Bahan baku apa saja yang perlu disediakan oleh klien pada skema CMT?",
];

export default function AiAssistantPage() {
  const [persona, setPersona] = useState<AssistantPersona>("owner_tracker");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "Halo! Saya adalah AI Assistant Lukla Operations Engine yang ditenagai oleh Amazon Bedrock RAG. Silakan pilih persona yang ingin Anda ajak diskusi atau tanyakan seputar SOP operasional dan layanan kami.",
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
                    {msg.sources.map((s, idx) => (
                      <span key={idx} className="badge badge-neutral" style={{ fontSize: "0.68rem" }}>
                        📄 {s.source_file.split("/").pop()}
                      </span>
                    ))}
                  </div>
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
