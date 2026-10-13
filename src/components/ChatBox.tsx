"use client";

import { useState, useRef, useEffect, type FormEvent } from "react";
import type { ChatTurn } from "@/lib/bedrock";

// Komponen chat yang dipakai oleh dua asisten AI.
// Riwayat disimpan di state browser lalu dikirim ke server setiap pesan.
// Fungsi "send" diberikan oleh halaman, sehingga komponen ini tidak tahu siapa asistennya.
export function ChatBox({
  title,
  placeholder,
  send,
  intro,
}: {
  title: string;
  placeholder: string;
  send: (history: ChatTurn[]) => Promise<string>;
  intro: string;
}) {
  const [messages, setMessages] = useState<ChatTurn[]>([{ role: "assistant", text: intro }]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  // Scroll otomatis ke pesan terbaru
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    // Intro hanya sapaan lokal, tidak dikirim ke model sebagai giliran asisten
    const next: ChatTurn[] = [...messages, { role: "user", text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const reply = await send(next.filter((m, i) => !(i === 0 && m.role === "assistant")));
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", text: "Koneksi terputus. Silakan coba lagi." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card chat">
      <h2>{title}</h2>
      <div className="chat-log" ref={logRef}>
        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role === "user" ? "user" : "bot"}`}>
            {m.text}
          </div>
        ))}
        {loading && <div className="bubble bot muted">Sedang mengetik...</div>}
      </div>
      <form className="chat-form" onSubmit={onSubmit}>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={placeholder} />
        <button className="btn" type="submit" disabled={loading || !input.trim()}>
          Kirim
        </button>
      </form>
    </div>
  );
}
