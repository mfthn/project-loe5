"""Bridge Telegram <-> AI Lukla.

Alur: Telegram user -> bot ini (polling) -> backend -> Bedrock RAG.
- Chat biasa -> POST /api/v1/ai/rag (publik, SOP + handoff WhatsApp, tanpa auth).
- /owner      -> POST /api/v1/ai/ask-agent (SOP + data live DB, tanpa auth di sisi
  backend; akses dibatasi ke TELEGRAM_ALLOWED_IDS di bot ini).

Jalankan dari folder backend (token dibaca dari env / backend/.env):
    export TELEGRAM_BOT_TOKEN=...   # token BotFather
    export TELEGRAM_ALLOWED_IDS=123456789,namapengguna   # opsional, untuk /owner
    python scripts/telegram_bot.py
"""
import logging
import os

import httpx
from telegram import Update
from telegram.constants import ChatAction
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes, MessageHandler, filters

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("telegram_bot")

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000/api/v1")
RAG_URL = f"{API_BASE_URL}/ai/rag"  # publik: SOP + WhatsApp handoff
AGENT_URL = f"{API_BASE_URL}/ai/ask-agent"  # internal: SOP + data live database
# Daftar Telegram user id ATAU username yang boleh memakai /owner, pisahkan koma.
# Contoh: TELEGRAM_ALLOWED_IDS=123456789,Andrez238. Username tanpa @, case-insensitive.
ALLOWED_IDS = {
    s.strip().lstrip("@").lower()
    for s in os.getenv("TELEGRAM_ALLOWED_IDS", "").split(",")
    if s.strip()
}

MAX_TG_LEN = 4000


def _split(text: str) -> list[str]:
    return [text[i : i + MAX_TG_LEN] for i in range(0, len(text), MAX_TG_LEN)] or ["(kosong)"]


async def _ask_backend(question: str, url: str) -> str:
    try:
        async with httpx.AsyncClient(timeout=90) as cli:
            r = await cli.post(url, json={"question": question})
    except httpx.ConnectError:
        return "Backend mati. Nyalakan dulu: `uvicorn app.main:app --reload` di folder backend."
    if r.status_code == 422:
        return "Pertanyaan kosong / terlalu panjang (maks 2000 karakter)."
    if r.status_code in (502, 503):
        try:
            return f"Layanan AI belum siap: {r.json().get('detail', '')}".strip()
        except Exception:  # noqa: BLE001
            return "Layanan AI belum siap (cek AWS/S3 di backend/.env lalu POST /api/v1/ai/reindex)."
    if not r.is_success:
        return f"Backend error {r.status_code}. Coba lagi sebentar."
    data = r.json()
    answer = data.get("answer", "").strip() or "(AI tidak memberi jawaban)"
    wa = data.get("whatsapp_handoff_url")
    if wa:
        answer += f"\n\nLanjut via WhatsApp: {wa}"
    return answer


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    await update.message.reply_text(
        "Halo! Saya Konsultan Maklon Lukla.\n"
        "Langsung ketik pertanyaan soal skema CMT, MOQ, atau estimasi sample.\n\n"
        "Perintah:\n"
        "/owner <pertanyaan> - khusus internal (butuh izin TELEGRAM_ALLOWED_IDS)"
    )


async def handle_public(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    q = (update.message.text or "").strip()
    if not q:
        return
    await update.message.chat.send_action(ChatAction.TYPING)
    answer = await _ask_backend(q, RAG_URL)
    for part in _split(answer):
        await update.message.reply_text(part)


async def handle_owner(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    uid = str(user.id)
    username = (user.username or "").lower()
    if uid.lower() not in ALLOWED_IDS and username not in ALLOWED_IDS:
        await update.message.reply_text("Maaf, perintah /owner hanya untuk internal yang terdaftar.")
        return
    q = " ".join(context.args).strip()
    if not q:
        await update.message.reply_text("Pakai: /owner <pertanyaan>, contoh: /owner ringkas output sewing minggu ini")
        return
    await update.message.chat.send_action(ChatAction.TYPING)
    answer = await _ask_backend(q, AGENT_URL)
    for part in _split(answer):
        await update.message.reply_text(part)


def main() -> None:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "")
    if not token:
        raise SystemExit("TELEGRAM_BOT_TOKEN belum diisi. export TELEGRAM_BOT_TOKEN=... dulu.")
    log.info("RAG publik: %s | Owner agent: %s", RAG_URL, AGENT_URL)
    app = ApplicationBuilder().token(token).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", start))
    app.add_handler(CommandHandler("owner", handle_owner))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_public))
    app.run_polling()


if __name__ == "__main__":
    main()
