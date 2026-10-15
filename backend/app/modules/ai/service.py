"""Pipeline RAG manual: chunking, retrieval berbasis cosine similarity, dan jawaban LLM.

Aturan RAG ada di file ini. Pemanggilan AWS dilakukan lewat AwsRagClients (clients.py),
sehingga logika di sini bisa diuji tanpa koneksi ke AWS.
"""
import math
import threading
from dataclasses import dataclass
from typing import Protocol

from app.core.config import Settings, get_settings
from app.modules.ai.clients import AwsRagClients
from app.modules.ai.errors import RagNotConfiguredError, RagUnavailableError

SYSTEM_PROMPT = (
    "Kamu adalah asisten yang menjawab pertanyaan berdasarkan konteks dokumen yang diberikan. "
    "Jawab hanya berdasarkan konteks. Jika jawabannya tidak ada di konteks, katakan dengan jujur "
    "bahwa informasi tersebut tidak tersedia di dokumen. Jawab dalam bahasa yang sama dengan pertanyaan."
)
NO_CONTEXT_ANSWER = "Maaf, informasi untuk pertanyaan ini tidak ditemukan di dokumen."
EMPTY_MODEL_ANSWER = "Maaf, model tidak memberikan jawaban. Coba ulangi pertanyaan."

# --- Dual-Assistant Persona Prompts ---
OWNER_TRACKER_PROMPT = (
    "Kamu adalah Owner Tracker, asisten AI operasional internal pabrik garmen Lukla Manufacturing. "
    "Tugasmu membantu Owner, Mandor, dan tim internal memantau progres produksi, hasil QC, "
    "ringkasan payroll, status pesanan, dan kondisi inventaris berdasarkan SOP dan DATA LIVE sistem. "
    "Konteks yang diberikan mencakup DUA SUMBER: (1) dokumen SOP dari knowledge base, dan "
    "(2) data operasional real-time dari database sistem (pesanan, produksi, QC, payroll, inventaris, sample). "
    "Prioritaskan data live dari database untuk menjawab pertanyaan terkait kondisi aktual. "
    "Berikan jawaban ringkas, berbasis data, dan gunakan format terstruktur jika diperlukan. "
    "Jika informasi tidak tersedia di kedua sumber, sampaikan secara jujur."
)

CLIENT_ASSISTANT_PROMPT = (
    "Kamu adalah Asisten Calon Klien, asisten AI publik untuk layanan maklon garmen Lukla Manufacturing. "
    "Tugasmu membantu calon klien B2B memahami alur kerja sama maklon, skema harga (CMT, Semi-CMT, "
    "Full Package), proses sampling, standar QC, dan cara memulai kerja sama. "
    "Gunakan bahasa yang ramah, profesional, dan persuasif. Dorong calon klien untuk menghubungi tim. "
    "Jawab hanya berdasarkan konteks SOP yang diberikan. Jika tidak ada di konteks, sampaikan secara jujur. "
    "Di akhir setiap jawaban, selalu tambahkan ajakan untuk menghubungi tim kami jika ingin konsultasi lebih lanjut."
)

# Kontak handoff WhatsApp untuk client assistant
WHATSAPP_HANDOFF_URL = (
    "https://wa.me/6281234567890?text=Halo%20Tim%20Lukla%20Manufacturing%2C%20"
    "saya%20ingin%20konsultasi%20layanan%20maklon"
)
WHATSAPP_HANDOFF_MSG = (
    "\n\n---\n📞 **Tertarik bekerja sama?** Hubungi tim kami langsung via "
    f"[WhatsApp](https://wa.me/6281234567890) untuk konsultasi dan penawaran harga."
)


@dataclass(frozen=True)
class Chunk:
    index: int
    text: str
    start: int
    end: int


@dataclass(frozen=True)
class Hit:
    chunk: Chunk
    score: float


class RagClients(Protocol):
    """Kontrak yang dipakai service. AwsRagClients memenuhinya; pengujian memakai fake."""

    def read_document(self) -> str: ...
    def embed(self, text: str) -> list[float]: ...
    def converse(self, system_prompt: str, user_text: str) -> str: ...


def chunk_text(text: str, size: int, overlap: int) -> list[Chunk]:
    """Memecah teks menjadi potongan berukuran tetap dengan overlap.

    Pemotongan diusahakan di spasi terdekat agar kata tidak terpotong. Posisi awal selalu
    maju, sehingga perulangan pasti berhenti.
    """
    if size <= 0 or overlap < 0 or overlap >= size:
        raise ValueError("Syarat chunking: size > 0 dan 0 <= overlap < size.")

    chunks: list[Chunk] = []
    start, n = 0, len(text)
    while start < n:
        end = min(start + size, n)
        if end < n:
            cut = text.rfind(" ", start + size // 2, end)
            if cut != -1:
                end = cut
        piece = text[start:end].strip()
        if piece:
            chunks.append(Chunk(index=len(chunks), text=piece, start=start, end=end))
        if end >= n:
            break
        start = max(end - overlap, start + 1)
    return chunks


def cosine_similarity(a: list[float], b: list[float]) -> float:
    if len(a) != len(b):
        raise ValueError("Dimensi vektor tidak sama.")
    dot = sum(x * y for x, y in zip(a, b))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return dot / norm if norm else 0.0


class RagService:
    def __init__(self, settings: Settings, clients: RagClients) -> None:
        self._s = settings
        self._clients = clients
        self._index: list[tuple[Chunk, list[float]]] = []
        self._lock = threading.Lock()

    @property
    def document_uri(self) -> str:
        return f"s3://{self._s.s3_bucket}/{self._s.s3_document_key}"

    @property
    def is_ready(self) -> bool:
        return bool(self._index)

    @property
    def chunk_count(self) -> int:
        return len(self._index)

    def build_index(self) -> int:
        """Membaca dokumen, memecahnya, lalu membuat embedding. Index lama diganti hanya jika semua berhasil."""
        with self._lock:
            return self._build_locked()

    def _build_locked(self) -> int:
        # Dicek di sini agar build_index() dan ask() (lewat _ensure_index) sama-sama terlindungi
        if not self._s.s3_bucket:
            raise RagNotConfiguredError("S3_BUCKET belum diisi di backend/.env.")
        text = self._clients.read_document()
        chunks = chunk_text(text, self._s.chunk_size, self._s.chunk_overlap)
        if not chunks:
            raise RagUnavailableError(f"Dokumen {self.document_uri} kosong.")
        # Embedding dihitung untuk semua chunk dulu, baru index diganti sekaligus
        index = [(chunk, self._clients.embed(chunk.text)) for chunk in chunks]
        self._index = index
        return len(index)

    def _ensure_index(self) -> None:
        if self.is_ready:
            return
        with self._lock:
            if not self._index:
                self._build_locked()

    def retrieve(self, question: str) -> list[Hit]:
        self._ensure_index()
        query_vec = self._clients.embed(question)
        scored = [Hit(chunk=c, score=cosine_similarity(query_vec, v)) for c, v in self._index]
        scored.sort(key=lambda h: h.score, reverse=True)
        return [h for h in scored[: self._s.top_k] if h.score >= self._s.similarity_threshold]

    def ask(self, question: str) -> dict:
        hits = self.retrieve(question)
        if not hits:
            # Tidak memanggil LLM tanpa konteks, agar model tidak menebak
            return {"answer": NO_CONTEXT_ANSWER, "sources": []}

        context = "\n\n".join(f"[Chunk {h.chunk.index}]\n{h.chunk.text}" for h in hits)
        user_text = f"Konteks:\n{context}\n\nPertanyaan: {question}"
        answer = self._clients.converse(SYSTEM_PROMPT, user_text).strip() or EMPTY_MODEL_ANSWER

        return {
            "answer": answer,
            "sources": [
                {
                    "chunk_index": h.chunk.index,
                    "start": h.chunk.start,
                    "end": h.chunk.end,
                    "score": round(h.score, 4),
                    "text": h.chunk.text,
                }
                for h in hits
            ],
        }

    def ask_client(self, question: str) -> dict:
        """Endpoint /rag — Chatbot publik untuk calon klien & klien aktif B2B.

        Hanya menggunakan S3 knowledge base. Selalu menambahkan WhatsApp
        handoff URL di akhir jawaban untuk mendorong kontak lebih lanjut.
        Mem-blokir pertanyaan terkait data internal perusahaan.
        """
        internal_keywords = [
            "gaji", "slip gaji", "upah borongan internal", "rahasia perusahaan",
            "klien lain", "payroll", "data karyawan",
        ]
        if any(k in question.lower() for k in internal_keywords):
            return {
                "answer": (
                    "Maaf, saya tidak dapat mengakses informasi internal tersebut. "
                    "Untuk informasi lebih lanjut, silakan hubungi tim kami secara langsung."
                    + WHATSAPP_HANDOFF_MSG
                ),
                "sources": [],
                "whatsapp_handoff_url": WHATSAPP_HANDOFF_URL,
                "db_context_used": False,
            }

        hits = self.retrieve(question)
        if not hits:
            return {
                "answer": (
                    "Maaf, saya tidak menemukan informasi yang relevan di dokumen SOP kami. "
                    "Tim kami siap membantu Anda secara langsung."
                    + WHATSAPP_HANDOFF_MSG
                ),
                "sources": [],
                "whatsapp_handoff_url": WHATSAPP_HANDOFF_URL,
                "db_context_used": False,
            }

        context = "\n\n".join(f"[Chunk {h.chunk.index}]\n{h.chunk.text}" for h in hits)
        user_text = f"Konteks:\n{context}\n\nPertanyaan: {question}"
        raw_answer = self._clients.converse(CLIENT_ASSISTANT_PROMPT, user_text).strip() or EMPTY_MODEL_ANSWER
        answer = raw_answer + WHATSAPP_HANDOFF_MSG

        return {
            "answer": answer,
            "whatsapp_handoff_url": WHATSAPP_HANDOFF_URL,
            "db_context_used": False,
            "sources": [
                {
                    "chunk_index": h.chunk.index,
                    "start": h.chunk.start,
                    "end": h.chunk.end,
                    "score": round(h.score, 4),
                    "text": h.chunk.text,
                }
                for h in hits
            ],
        }

    def ask_agent(self, question: str, db_context: str) -> dict:
        """Endpoint /ask-agent — Owner Tracker dengan S3 RAG + data live database.

        db_context: string hasil build_db_context(db) dari db_context.py yang
        berisi snapshot operasional real-time (orders, produksi, QC, payroll,
        inventaris, sample). Di-inject ke dalam prompt sebelum chunk SOP.
        """
        hits = self.retrieve(question)
        sop_context = (
            "\n\n".join(f"[Dokumen SOP — Chunk {h.chunk.index}]\n{h.chunk.text}" for h in hits)
            if hits
            else "(Tidak ada chunk SOP yang relevan untuk pertanyaan ini.)"
        )

        combined_context = (
            f"--- DATA OPERASIONAL REAL-TIME (dari database sistem) ---\n"
            f"{db_context}\n\n"
            f"--- DOKUMEN SOP (dari knowledge base) ---\n"
            f"{sop_context}"
        )
        user_text = f"Konteks:\n{combined_context}\n\nPertanyaan: {question}"
        answer = (
            self._clients.converse(OWNER_TRACKER_PROMPT, user_text).strip()
            or EMPTY_MODEL_ANSWER
        )

        return {
            "answer": answer,
            "whatsapp_handoff_url": None,
            "db_context_used": True,
            "sources": [
                {
                    "chunk_index": h.chunk.index,
                    "start": h.chunk.start,
                    "end": h.chunk.end,
                    "score": round(h.score, 4),
                    "text": h.chunk.text,
                }
                for h in hits
            ],
        }

    def ask_with_persona(self, question: str, persona: str) -> dict:
        """FR-AI: Menjawab pertanyaan menggunakan persona AI Dual-Assistant (legacy endpoint /assistant).

        persona = 'owner_tracker'   → system prompt internal operasional (tanpa DB live).
        persona = 'client_assistant' → system prompt publik B2B calon klien.
        Gunakan ask_agent() dan ask_client() untuk versi lengkap.
        """
        system_prompt = (
            OWNER_TRACKER_PROMPT if persona == "owner_tracker" else CLIENT_ASSISTANT_PROMPT
        )
        hits = self.retrieve(question)
        handoff_url = WHATSAPP_HANDOFF_URL if persona == "client_assistant" else None
        if not hits:
            no_ctx = (
                "Maaf, saya tidak menemukan informasi yang relevan di dokumen SOP. "
                "Silakan hubungi tim kami secara langsung."
                if persona == "client_assistant"
                else NO_CONTEXT_ANSWER
            )
            return {"answer": no_ctx, "sources": [], "whatsapp_handoff_url": handoff_url}

        context = "\n\n".join(f"[Chunk {h.chunk.index}]\n{h.chunk.text}" for h in hits)
        user_text = f"Konteks:\n{context}\n\nPertanyaan: {question}"
        answer = self._clients.converse(system_prompt, user_text).strip() or EMPTY_MODEL_ANSWER

        return {
            "answer": answer,
            "whatsapp_handoff_url": handoff_url,
            "sources": [
                {
                    "chunk_index": h.chunk.index,
                    "start": h.chunk.start,
                    "end": h.chunk.end,
                    "score": round(h.score, 4),
                    "text": h.chunk.text,
                }
                for h in hits
            ],
        }


_service: RagService | None = None
_service_lock = threading.Lock()


def get_rag_service() -> RagService:
    """Satu instance per proses. Klien AWS dibuat saat pertama kali dipakai, bukan saat import."""
    global _service
    if _service is None:
        with _service_lock:
            if _service is None:
                settings = get_settings()
                _service = RagService(settings, AwsRagClients(settings))
    return _service
