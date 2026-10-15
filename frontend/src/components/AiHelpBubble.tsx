"use client";

import React, { useEffect, useState } from "react";
import { MarkdownText } from "./MarkdownText";
import { PUBLIC_CHAT_EVENT } from "../lib/public-chat";
import { aiApi } from "../lib/api";

interface MiniMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  whatsapp_handoff_url?: string | null;
}

const PUBLIC_PROMPTS = [
  "Skema maklon apa saja yang tersedia?",
  "Berapa MOQ minimal pemesanan?",
  "Berapa lama pengerjaan sample?",
];

/**
 * Chatbot publik di landing page — bisa dipakai siapa saja tanpa login.
 * Terkunci ke persona client_assistant (konsultan maklon).
 */
export function AiHelpBubble() {
  const [open, setOpen] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<MiniMessage[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "Halo! 👋 Saya asisten maklon Lukla. Tanya soal skema CMT, MOQ, atau estimasi sample — gratis, tanpa perlu login!",
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // CTA publik di landing page ("Tanya AI Konsultan Maklon" dsb.) membuka chat ini
  useEffect(() => {
    const handler = () => {
      setChatOpen(true);
      setOpen(false);
    };
    window.addEventListener(PUBLIC_CHAT_EVENT, handler);
    return () => window.removeEventListener(PUBLIC_CHAT_EVENT, handler);
  }, []);

  const sendMessage = async (textToSend?: string) => {
    const question = (textToSend ?? inputText).trim();
    if (!question || loading) return;
    setError(null);
    setMessages((prev) => [...prev, { id: String(Date.now()), sender: "user", text: question }]);
    setInputText("");
    setLoading(true);
    try {
      const res = await aiApi.askAssistant({ question, persona: "client_assistant" });
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: "ai",
          text: res.answer,
          whatsapp_handoff_url: res.whatsapp_handoff_url,
        },
      ]);
    } catch (err: any) {
      setError(err.message || "Gagal menghubungi AI. Coba lagi sebentar ya.");
    } finally {
      setLoading(false);
    }
  };

  const toggleChat = () => {
    setChatOpen((v) => !v);
    setOpen(false);
  };

  return (
    <div className="ai-bubble-root">
      {/* Jendela chat mini publik */}
      {chatOpen && (
        <div className="ai-chat-window"
        >
          {/* Header */}
          <div
            style={{
              background: "linear-gradient(135deg, var(--jadoo-purple) 0%, var(--jadoo-coral) 100%)",
              color: "#ffffff",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ fontSize: "1.5rem" }}>🤖</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: "0.92rem" }}>Konsultan Maklon Lukla</div>
              <div style={{ fontSize: "0.72rem", opacity: 0.9 }}>Online • Tanpa login</div>
            </div>
            <button
              onClick={() => setChatOpen(false)}
              aria-label="Tutup chat"
              style={{ border: "none", background: "transparent", color: "#fff", cursor: "pointer", fontSize: "1rem" }}
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10, background: "#fafbfc" }}>
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  alignSelf: msg.sender === "user" ? "flex-end" : "flex-start",
                  maxWidth: "88%",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.85rem",
                  lineHeight: 1.6,
                  background: msg.sender === "user" ? "linear-gradient(135deg, var(--jadoo-purple), var(--jadoo-coral))" : "#ffffff",
                  color: msg.sender === "user" ? "#ffffff" : "var(--jadoo-navy)",
                  border: msg.sender === "user" ? "none" : "1px solid var(--border-subtle)",
                  boxShadow: "var(--shadow-subtle)",
                }}
              >
                {msg.sender === "user" ? (
                  <span style={{ whiteSpace: "pre-wrap" }}>{msg.text}</span>
                ) : (
                  <MarkdownText text={msg.text} />
                )}
                {msg.whatsapp_handoff_url && (
                  <a
                    href={msg.whatsapp_handoff_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-sm"
                    style={{
                      display: "inline-flex",
                      marginTop: 10,
                      textDecoration: "none",
                      backgroundColor: "#25D366",
                      color: "#fff",
                      fontWeight: 700,
                      fontSize: "0.75rem",
                      padding: "6px 12px",
                      borderRadius: "var(--radius-md)",
                    }}
                  >
                    💬 Lanjut via WhatsApp →
                  </a>
                )}
              </div>
            ))}
            {loading && (
              <div style={{ alignSelf: "flex-start", fontSize: "0.82rem", color: "var(--jadoo-muted)" }}>
                ⏳ Menjawab...
              </div>
            )}
            {error && (
              <div style={{ fontSize: "0.78rem", color: "var(--color-danger)" }}>{error}</div>
            )}
          </div>

          {/* Quick prompts */}
          <div style={{ display: "flex", gap: 6, padding: "8px 12px", overflowX: "auto", borderTop: "1px solid var(--border-subtle)" }}>
            {PUBLIC_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                disabled={loading}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: "0.7rem", whiteSpace: "nowrap" }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            style={{ display: "flex", gap: 8, padding: 12, borderTop: "1px solid var(--border-default)" }}
          >
            <input
              type="text"
              className="form-input"
              placeholder="Tulis pertanyaan..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={loading}
              style={{ fontSize: "0.85rem" }}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading || !inputText.trim()}>
              ➤
            </button>
          </form>
        </div>
      )}

      {/* Sapaan popup */}
      {open && !chatOpen && (
        <div
          style={{
            background: "#ffffff",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-lg)",
            boxShadow: "0 16px 40px -12px rgba(24, 30, 75, 0.25)",
            padding: "16px 18px",
            maxWidth: 280,
            position: "relative",
          }}
        >
          <button
            onClick={() => setOpen(false)}
            aria-label="Tutup bubble bantuan"
            style={{
              position: "absolute",
              top: 8,
              right: 10,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "0.85rem",
              color: "var(--jadoo-muted)",
            }}
          >
            ✕
          </button>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 8 }}>
            <span style={{ fontSize: "1.6rem" }}>🤖</span>
            <div>
              <div style={{ fontWeight: 800, color: "var(--jadoo-navy)", fontSize: "0.95rem" }}>
                Butuh pertanyaan?
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--jadoo-text)", lineHeight: 1.5 }}>
                Halo! Saya siap membantu soal skema maklon, MOQ, dan estimasi sample. 👋
              </div>
            </div>
          </div>
          <button onClick={() => setChatOpen(true)} className="btn btn-primary btn-sm" style={{ width: "100%" }}>
            Chat sekarang →
          </button>
        </div>
      )}

      <button
        onClick={toggleChat}
        aria-label="Bantuan AI"
        title="Butuh pertanyaan?"
        className="ai-bubble-btn"
        style={{
          width: 60,
          height: 60,
          borderRadius: "50%",
          border: "none",
          cursor: "pointer",
          fontSize: "1.7rem",
          background: "linear-gradient(135deg, var(--jadoo-purple) 0%, var(--jadoo-coral) 100%)",
          boxShadow: "0 10px 28px rgba(219, 39, 119, 0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {chatOpen ? "✕" : "🤖"}
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: -2,
            right: -2,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#22c55e",
            border: "2px solid #ffffff",
          }}
        />
      </button>
    </div>
  );
}
