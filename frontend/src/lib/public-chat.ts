"use client";

export const PUBLIC_CHAT_EVENT = "loe:open-ai-chat";

/** Membuka jendela chat publik di landing page (tanpa login). */
export function openPublicChat() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PUBLIC_CHAT_EVENT));
  }
}
