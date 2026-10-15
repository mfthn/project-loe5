"use client";

import React, { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { aiApi } from "../../lib/api";
import type { DualAskResponse, SourceDocument } from "../../types/api";

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  sources?: SourceDocument[];
  timestamp: string;
  whatsapp_handoff_url?: string | null;
}

const QUICK_PROMPTS = [
  "Berapa minimal pemesanan (MOQ) untuk jaket?",
  "Apa perbedaan skema CMT dan Semi-CMT?",
  "Bagaimana prosedur pembuatan sample awal?",
  "Berapa hari estimasi waktu pengerjaan produksi?",
];

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "ai",
      text: "Halo! Selamat datang di Lukla Operations Engine. Ada yang bisa kami bantu seputar skema maklon, alur pembuatan sample, atau kapasitas pabrik konveksi kami?",
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSend = async (textToSend?: string) => {
    const question = textToSend || inputText;
    if (!question.trim()) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: "user",
      text: question,
      timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setLoading(true);

    try {
      // Landing page chat widget ALWAYS calls public client /ai/rag (S3 knowledge base only)
      const res: DualAskResponse = await aiApi.askClient(question);

      const aiMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: "ai",
        text: res.answer,
        sources: res.sources,
        timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
        whatsapp_handoff_url: res.whatsapp_handoff_url,
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: "ai",
          text: "Maaf, sistem asisten AI sedang sibuk atau offline. Anda dapat langsung berkonsultasi dengan tim pemesanan kami via WhatsApp.",
          timestamp: new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
          whatsapp_handoff_url: "https://wa.me/6281234567890?text=Halo%20Tim%20Pemesanan%20Lukla,%20saya%20ingin%20konsultasi%20produksi.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", bottom: 28, right: 28, zIndex: 9999 }}>
      {/* Floating Avatar Trigger with Speech Bubble Prompt (Inspired by User Screenshot) */}
      {!isOpen && (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 14 }}>
          {/* Floating Speech Bubble Prompt */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: 20,
              padding: "16px 18px",
              boxShadow: "0 14px 36px rgba(46, 16, 101, 0.16)",
              border: "1.5px solid #EDE9FE",
              maxWidth: 240,
              position: "relative",
              fontSize: "0.86rem",
              color: "#2E1065",
              lineHeight: 1.45,
              animation: "fadeInUp 0.3s ease",
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4, color: "#7C3AED", fontSize: "0.78rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Asisten SOP Maklon
            </div>
            <div
              onClick={() => setIsOpen(true)}
              style={{ cursor: "pointer", fontWeight: 600 }}
            >
              Mau konsultasi skema maklon atau alur sample? Tanyakan langsung di sini!
            </div>
          </div>

          {/* Circular Avatar Button with Green Ring (Like Samsung/Telco Style) */}
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label="Buka Asisten Chatbot"
            style={{
              width: 68,
              height: 68,
              borderRadius: "50%",
              background: "#ffffff",
              padding: 4,
              border: "3px solid #10B981", // Green active circle ring
              boxShadow: "0 10px 28px rgba(16, 185, 129, 0.35), 0 4px 12px rgba(46, 16, 101, 0.12)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              transition: "transform 0.25s ease, box-shadow 0.25s ease",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "scale(1.06) translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 14px 32px rgba(16, 185, 129, 0.45)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "scale(1) translateY(0)";
              e.currentTarget.style.boxShadow = "0 10px 28px rgba(16, 185, 129, 0.35), 0 4px 12px rgba(46, 16, 101, 0.12)";
            }}
          >
            {/* L5 Brand Avatar Icon */}
            <div
              style={{
                width: "100%",
                height: "100%",
                borderRadius: "50%",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <Image
                src="/icon.jpeg"
                alt="Lukla Operations Assistant"
                width={60}
                height={60}
                style={{ objectFit: "cover", width: "100%", height: "100%" }}
              />
            </div>

            {/* Online Green Pulsing Indicator Dot */}
            <span
              style={{
                position: "absolute",
                bottom: 2,
                right: 2,
                width: 14,
                height: 14,
                borderRadius: "50%",
                background: "#10B981",
                border: "2.5px solid #ffffff",
              }}
            />
          </button>
        </div>
      )}

      {/* Pop-up Chat Modal / Drawer */}
      {isOpen && (
        <div
          style={{
            width: "clamp(320px, 92vw, 400px)",
            height: "clamp(480px, 75vh, 600px)",
            background: "#ffffff",
            borderRadius: 24,
            boxShadow: "0 24px 64px rgba(46, 16, 101, 0.25)",
            border: "1.5px solid #C4B5FD",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "fadeInUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          {/* Header */}
          <div
            style={{
              background: "linear-gradient(135deg, #2E1065 0%, #1F0B46 100%)",
              color: "#ffffff",
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid rgba(196, 181, 253, 0.2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 10,
                  overflow: "hidden",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                }}
              >
                <Image src="/icon.jpeg" alt="L5" width={32} height={32} style={{ objectFit: "cover" }} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", lineHeight: 1.2 }}>
                  Asisten Maklon Lukla
                </div>
                <div style={{ fontSize: "0.7rem", color: "#C4B5FD", display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981" }} />
                  Ditenagai S3 SOP RAG Bedrock
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Tutup chat"
              style={{
                background: "rgba(255, 255, 255, 0.12)",
                border: "none",
                color: "#ffffff",
                width: 28,
                height: 28,
                borderRadius: "50%",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.9rem",
              }}
            >
              ✕
            </button>
          </div>

          {/* Messages Stream */}
          <div
            style={{
              flex: 1,
              padding: "16px",
              overflowY: "auto",
              background: "#FAF8FF",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {messages.map((m) => {
              const isUser = m.sender === "user";
              return (
                <div
                  key={m.id}
                  style={{
                    alignSelf: isUser ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    background: isUser ? "#7C3AED" : "#ffffff",
                    color: isUser ? "#ffffff" : "#2E1065",
                    padding: "10px 14px",
                    borderRadius: isUser ? "16px 16px 2px 16px" : "16px 16px 16px 2px",
                    boxShadow: "0 2px 8px rgba(46, 16, 101, 0.05)",
                    border: isUser ? "none" : "1px solid #EDE9FE",
                    fontSize: "0.86rem",
                    lineHeight: 1.5,
                  }}
                >
                  <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>

                  {/* Sources citation if any */}
                  {m.sources && m.sources.length > 0 && (
                    <div style={{ marginTop: 8, paddingTop: 6, borderTop: "1px dashed rgba(124, 58, 237, 0.2)", fontSize: "0.7rem", color: "#6D28D9" }}>
                      📚 Rujukan: {m.sources.map((s) => s.source_file?.split("/").pop() || "Dokumen SOP").slice(0, 2).join(", ")}
                    </div>
                  )}

                  {/* WhatsApp handoff button at the end of answer */}
                  {m.whatsapp_handoff_url && (
                    <div style={{ marginTop: 10 }}>
                      <a
                        href={m.whatsapp_handoff_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: "#25D366",
                          color: "#ffffff",
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          padding: "6px 12px",
                          borderRadius: 9999,
                          textDecoration: "none",
                          boxShadow: "0 2px 8px rgba(37, 211, 102, 0.3)",
                        }}
                      >
                        <span>💬</span>
                        <span>Chat WhatsApp Tim Pemesanan →</span>
                      </a>
                    </div>
                  )}

                  <div
                    style={{
                      fontSize: "0.65rem",
                      opacity: 0.7,
                      textAlign: isUser ? "right" : "left",
                      marginTop: 4,
                    }}
                  >
                    {m.timestamp}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div
                style={{
                  alignSelf: "flex-start",
                  background: "#ffffff",
                  color: "#6D28D9",
                  padding: "10px 14px",
                  borderRadius: "16px 16px 16px 2px",
                  fontSize: "0.82rem",
                  border: "1px solid #EDE9FE",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ animation: "pulse 1s infinite" }}>⏳</span>
                <span>Mencari rujukan SOP pabrik di S3...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Chips */}
          <div
            style={{
              padding: "8px 12px",
              background: "#ffffff",
              borderTop: "1px solid #EDE9FE",
              display: "flex",
              gap: 6,
              overflowX: "auto",
              whiteSpace: "nowrap",
            }}
          >
            {QUICK_PROMPTS.map((qp, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSend(qp)}
                disabled={loading}
                style={{
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  color: "#5B5870",
                  background: "#FAF8FF",
                  border: "1px solid #C4B5FD",
                  borderRadius: 9999,
                  padding: "4px 10px",
                  cursor: "pointer",
                }}
              >
                {qp}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              padding: "12px",
              background: "#ffffff",
              borderTop: "1px solid #EDE9FE",
              display: "flex",
              gap: 8,
            }}
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Tanyakan skema maklon, sampel, dll..."
              disabled={loading}
              style={{
                flex: 1,
                padding: "8px 14px",
                borderRadius: 9999,
                border: "1.5px solid #EDE9FE",
                fontSize: "0.85rem",
                outline: "none",
                color: "#2E1065",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#7C3AED")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "#EDE9FE")}
            />
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              style={{
                background: "#7C3AED",
                color: "#ffffff",
                border: "none",
                borderRadius: "50%",
                width: 36,
                height: 36,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: loading || !inputText.trim() ? "not-allowed" : "pointer",
                opacity: loading || !inputText.trim() ? 0.6 : 1,
              }}
            >
              ➔
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
