"""Bridge Telegram <-> AI Lukla.

Alur: Telegram user -> bot ini (polling) -> backend -> Bedrock RAG.
- Chat biasa -> POST /api/v1/ai/rag (publik, SOP + handoff WhatsApp, tanpa auth).
- /owner      -> POST /api/v1/ai/ask-agent (SOP + data live DB, butuh role
  OWNER/MANDOR; bot login otomatis sebagai service account, lalu akses
  dibatasi ke TELEGRAM_ALLOWED_IDS di bot ini).

Jalankan dari folder backend:
    export TELEGRAM_BOT_TOKEN=...       # token BotFather
    export TELEGRAM_API_USER=hendra_owner
    export TELEGRAM_API_PASSWORD=...    # password akun service (untuk /owner)
    export TELEGRAM_ALLOWED_IDS=123456789,namapengguna   # opsional, untuk /owner
    python scripts/telegram_bot.py
"""
import html
import logging
import os
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parent.parent / ".env")
except ImportError:  # python-dotenv belum diinstal: pakai env sistem saja
    pass

import httpx
from telegram import Update
from telegram.constants import ChatAction
from telegram.ext import ApplicationBuilder, CommandHandler, ContextTypes, MessageHandler, filters

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("telegram_bot")

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000/api/v1")
RAG_URL = f"{API_BASE_URL}/ai/rag"  # publik: SOP + WhatsApp handoff
AGENT_URL = f"{API_BASE_URL}/ai/ask-agent"  # internal: SOP + data live database
LOGIN_URL = f"{API_BASE_URL}/auth/login"
# Service account untuk endpoint internal (/owner). Harus ber-role OWNER/MANDOR.
API_USER = os.getenv("TELEGRAM_API_USER", "hendra_owner")
API_PASSWORD = os.getenv("TELEGRAM_API_PASSWORD", "")
# Daftar Telegram user id ATAU username yang boleh memakai /owner, pisahkan koma.
# Contoh: TELEGRAM_ALLOWED_IDS=123456789,Andrez238. Username tanpa @, case-insensitive.
ALLOWED_IDS = {
    s.strip().lstrip("@").lower()
    for s in os.getenv("TELEGRAM_ALLOWED_IDS", "").split(",")
    if s.strip()
}

_bearer: str | None = None


async def _login() -> str | None:
    """Login sebagai service account, kembalikan Bearer token (di-cache)."""
    global _bearer
    if not API_PASSWORD:
        return None
    try:
        async with httpx.AsyncClient(timeout=30) as cli:
            r = await cli.post(LOGIN_URL, json={"username": API_USER, "password": API_PASSWORD})
    except httpx.ConnectError:
        return None
    if not r.is_success:
        log.warning("Login service account gagal: %s", r.status_code)
        _bearer = None
        return None
    _bearer = r.json().get("access_token")
    return _bearer

MAX_TG_LEN = 4000


def _split(text: str) -> list[str]:
    return [text[i : i + MAX_TG_LEN] for i in range(0, len(text), MAX_TG_LEN)] or ["(kosong)"]


def _to_telegram_html(text: str) -> str:
    """Ubah markdown ringan model (**tebal**, ### judul) menjadi HTML Telegram.

    Urutan penting: escape dulu, baru pasang tag. List (- / 1.) dibiarkan
    sebagai teks biasa agar tidak perlu escaping MarkdownV2 yang rewel.
    """
    import re

    out_lines = []
    for ln in text.split("\n"):
        m = re.match(r"^(#{1,4})\s+(.*)$", ln.strip())
        if m:
            # Baris judul -> tebal penuh
            out_lines.append(f"<b>{html.escape(m.group(2))}</b>")
            continue
        esc = html.escape(ln)
        # **tebal** -> <b>tebal</b> (non-greedy, hanya pasangan sebaris)
        esc = re.sub(r"\*\*([^\n*]+)\*\*", r"<b>\1</b>", esc)
        out_lines.append(esc)
    out = "\n".join(out_lines)
    # Link handoff WhatsApp dijadikan tautan klik
    out = re.sub(
        r"Lanjut via WhatsApp: (https?://\S+)",
        r'Lanjut via WhatsApp: <a href="\1">Chat WhatsApp</a>',
        out,
    )
    return out


def _strip_markdown(text: str) -> str:
    """Fallback teks polos bila HTML ditolak Telegram: buang semua simbol mentah."""
    import re

    text = re.sub(r"^#{1,4}\s+", "", text, flags=re.MULTILINE)
    text = text.replace("**", "")
    return text


async def _reply_chunks(message, text: str) -> None:
    """Kirim per potongan; coba HTML dulu, jatuh ke teks polos bila ditolak."""
    from telegram.error import BadRequest

    for part in _split(text):
        try:
            await message.reply_text(_to_telegram_html(part), parse_mode="HTML")
        except BadRequest:
            await message.reply_text(_strip_markdown(part))


async def _ask_backend(question: str, url: str, need_auth: bool = False) -> str:
    async def _post(token: str | None):
        headers = {"Authorization": f"Bearer {token}"} if token else {}
        async with httpx.AsyncClient(timeout=90) as cli:
            return await cli.post(url, json={"question": question}, headers=headers)

    try:
        if need_auth and not _bearer:
            await _login()
        r = await _post(_bearer if need_auth else None)
        if r.status_code == 401 and need_auth:
            # Token kedaluwarsa/invalid -> login ulang sekali lalu coba lagi.
            await _login()
            r = await _post(_bearer)
    except httpx.ConnectError:
        return "Backend mati. Nyalakan dulu: `uvicorn app.main:app --reload` di folder backend."
    if r.status_code == 422:
        return "Pertanyaan kosong / terlalu panjang (maks 2000 karakter)."
    if r.status_code in (401, 403):
        if need_auth and not API_PASSWORD:
            return "Perintah /owner belum bisa dipakai: TELEGRAM_API_PASSWORD belum diisi di server bot."
        return "Akses ditolak backend (butuh role OWNER/MANDOR). Hubungi admin."
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
    await _reply_chunks(update.message, answer)


async def handle_owner(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user = update.effective_user
    uid = str(user.id)
    username = (user.username or "").lower()
    if uid.lower() not in ALLOWED_IDS and username not in ALLOWED_IDS:
        log.info("/owner ditolak: id=%s username=%s", uid, username or "-")
        await update.message.reply_text("Maaf, perintah /owner hanya untuk internal yang terdaftar.")
        return
    q = " ".join(context.args).strip()
    if not q:
        await update.message.reply_text("Pakai: /owner <pertanyaan>, contoh: /owner ringkas output sewing minggu ini")
        return
    await update.message.chat.send_action(ChatAction.TYPING)
    answer = await _ask_backend(q, AGENT_URL, need_auth=True)
    await _reply_chunks(update.message, answer)


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
