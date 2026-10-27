"""Pipeline RAG manual: chunking, retrieval berbasis cosine similarity, dan jawaban LLM.

Aturan RAG ada di file ini. Pemanggilan AWS dilakukan lewat FreeRagClients (clients.py),
sehingga logika di sini bisa diuji tanpa koneksi ke AWS.
"""
import math
import threading
import urllib.parse
from dataclasses import dataclass
from typing import Protocol

import logging

from app.core.config import Settings, get_settings
from app.ai.clients import FreeRagClients
from app.ai.errors import RagNotConfiguredError, RagUnavailableError

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "Kamu adalah asisten yang menjawab pertanyaan berdasarkan konteks dokumen yang diberikan. "
    "Jawab hanya berdasarkan konteks. Jika jawabannya tidak ada di konteks, katakan dengan jujur "
    "bahwa informasi tersebut tidak tersedia di dokumen. Jawab dalam bahasa yang sama dengan pertanyaan. "
    "Gunakan bahasa Indonesia yang hangat dan manusiawi, seperti rekan kerja yang membantu — "
    "bukan seperti laporan mesin. Sapa secukupnya, langsung ke inti, dan tutup dengan tawaran bantuan lanjutan bila relevan. "
    "Hindari heading bertingkat (###); gunakan paragraf pendek dan poin-poin sederhana bila perlu. "
    "Jangan memakai emoji."
)
NO_CONTEXT_ANSWER = "Maaf, informasi untuk pertanyaan ini tidak ditemukan di dokumen."
EMPTY_MODEL_ANSWER = "Maaf, model tidak memberikan jawaban. Coba ulangi pertanyaan."

# --- Dual-Assistant Persona Prompts ---
OWNER_TRACKER_PROMPT = (
    "Kamu adalah Owner Tracker, rekan operasional Owner pabrik garmen Lukla Manufacturing — "
    "ramah, sigap, dan bicara seperti rekan kerja, bukan robot. "
    "Tugasmu membantu Owner, Mandor, dan tim internal memantau progres produksi, hasil QC, "
    "ringkasan payroll, status pesanan, dan kondisi inventaris berdasarkan SOP dan DATA LIVE sistem. "
    "Konteks yang diberikan mencakup DUA SUMBER: (1) dokumen SOP dari knowledge base, dan "
    "(2) data operasional real-time dari database sistem (pesanan, produksi, QC, payroll, inventaris, sample). "
    "Prioritaskan data live dari database untuk menjawab pertanyaan terkait kondisi aktual — "
    "sebutkan angka dan nama yang konkret (nomor order, klien, pcs). "
    "Gaya: hangat dan manusiawi, kalimat pendek, langsung ke inti; "
    "boleh memakai **tebal** untuk angka/nama penting dan daftar pendek (-) bila membantu. "
    "JANGAN menulis nama enum teknis (mis. OrderStatus.SAMPLE) — gunakan bahasa manusia "
    "(tahap sampel, tahap potong/cutting, tahap jahit/sewing, antre QC, selesai). "
    "Tanpa emoji. "
    "Jika informasi tidak tersedia di kedua sumber, sampaikan secara jujur dan tawarkan alternatif."
)

CLIENT_ASSISTANT_PROMPT = (
    "Kamu adalah Asisten Calon Klien untuk layanan maklon produksi tas dan garmen Lukla Manufacturing — "
    "hangat, sopan, komunikatif, dan berbicara seperti konsultan pabrik yang profesional dan ramah. "
    "Tugasmu membantu calon klien menjawab pertanyaan seputar alur kerja sama maklon, spesifikasi produk tas/garmen, skema kerja sama "
    "(CMT, Semi-CMT, Full Package), proses sampling v1 hingga massal, standar QC, fasilitas dan kapasitas produksi secara natural dan tuntas. "
    "Fokuslah menjawab apa yang ditanyakan oleh calon klien secara jelas dan informatif berdasarkan konteks SOP yang diberikan. "
    "PENTING: Jangan terburu-buru menyuruh klien memesan atau menghubungi WhatsApp/tim sample di setiap percakapan. "
    "Jadilah asisten konsultasi yang sabar dan informatif terlebih dahulu. "
    "HANYA arahkan klien untuk menghubungi tim pemesanan / tim sampel JIKA klien secara eksplisit menyatakan ingin memesan, membuat sample, meminta penawaran harga resmi, atau menanyakan cara order/kontak tim. "
    "Jika klien belum berniat memesan, jawablah pertanyaannya dengan tuntas dan ramah, lalu tutup dengan tawaran bantuan diskusi seputar produk atau alur (misalnya 'Ada hal lain seputar spesifikasi atau skema maklon yang ingin Anda ketahui?'). "
    "Aturan format jawaban (wajib): tulis teks rapi berbahasa Indonesia. "
    "Boleh memakai **teks tebal** untuk penekanan penting, pastikan setiap ** selalu dibuka dan ditutup. "
    "Jangan memakai emoji. Jangan menulis link, URL, atau nomor WhatsApp di dalam teks jawaban "
    "(tombol WhatsApp hanya akan ditampilkan otomatis oleh sistem saat klien ingin order). "
    "Jangan memakai garis pemisah seperti ---."
)

def is_order_intent(question: str) -> bool:
    """Mendeteksi apakah pertanyaan klien memiliki intensi nyata untuk memesan,
    membuat sampel, meminta penawaran harga resmi, atau meminta kontak pemesanan."""
    q = question.lower()
    triggers = [
        "mau pesan", "mau order", "cara pesan", "cara order", "ingin pesan", "ingin order",
        "buat sample", "bikin sample", "ajukan sample", "pengajuan sample", "order sample",
        "pesan sample", "minta penawaran", "penawaran harga", "minta quotation", "quotation",
        "nomor wa", "whatsapp tim", "kontak wa", "kontak pemesanan", "hubungi tim",
        "form order", "form pemesanan", "tahap order", "siap order", "siap pesan",
        "kirim sample", "mulai order", "mulai pesan", "bagaimana cara memesan",
        "kontak langsung", "mau buat sampel", "mau bikin sampel", "hubungi admin",
        "kontak admin", "nomor admin", "link whatsapp", "link wa"
    ]
    return any(t in q for t in triggers)

# Kontak handoff WhatsApp dengan template chat untuk tim sample
SAMPLE_HANDOFF_TEXT = (
    "Halo Tim Sample Lukla Manufacturing! Saya ingin berdiskusi mengenai kebutuhan produksi dan pembuatan sampel baru.\n\n"
    "Detail Pengajuan Sampel:\n"
    "- Nama / Brand: \n"
    "- Jenis Produk: Tas / Garmen\n"
    "- Skema Maklon: [CMT / Semi-CMT / Full Package]\n"
    "- Estimasi Qty: \n"
    "- Bahan Baku: [Sendiri / Pabrik]\n"
    "Mohon info ketersediaan jadwal tim sample. Terima kasih!"
)

WHATSAPP_HANDOFF_URL = (
    "https://wa.me/6281234567890?text=" + urllib.parse.quote(SAMPLE_HANDOFF_TEXT)
)
# Pesan handoff teks polos (tanpa emoji, tanpa **, tanpa link markdown, tanpa ---):
# frontend me-render markdown dan menampilkan tombol WhatsApp terpisah.
WHATSAPP_HANDOFF_MSG = (
    "\n\nTertarik bekerja sama? Hubungi tim kami langsung via WhatsApp "
    "untuk konsultasi dan penawaran harga."
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
    """Kontrak yang dipakai service. FreeRagClients memenuhinya; pengujian memakai fake."""

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
        s3_bucket = getattr(self._s, "s3_bucket", None)
        s3_key = getattr(self._s, "s3_document_key", None)
        if s3_bucket and s3_key:
            return f"s3://{s3_bucket}/{s3_key}"
        docs_path = getattr(self._s, "docs_local_path", "data/docs")
        return f"local://{docs_path}"

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
        read_multi = getattr(self._clients, "read_documents", None)
        if callable(read_multi):
            docs = read_multi()
            if not docs:
                raise RagUnavailableError("Tidak ada dokumen SOP lokal atau S3 yang ditemukan.")
            text = "\n\n".join(f"# Sumber: {key}\n{body}" for key, body in docs.items())
            uri = f"knowledge-base ({len(docs)} dokumen .md)"
        elif getattr(self._clients, "read_document", None):
            text = self._clients.read_document()
            uri = getattr(self, "document_uri", "local-doc")
        else:
            raise RagNotConfiguredError("Provider dokumen RAG belum terkonfigurasi.")
        chunks = chunk_text(text, self._s.chunk_size, self._s.chunk_overlap)
        if not chunks:
            raise RagUnavailableError(f"Dokumen {uri} kosong.")
        # Embedding paralel (4 worker) — jauh lebih cepat dari serial per chunk
        from concurrent.futures import ThreadPoolExecutor

        texts = [c.text for c in chunks]
        with ThreadPoolExecutor(max_workers=4) as pool:
            vectors = list(pool.map(self._clients.embed, texts))
        index = list(zip(chunks, vectors))
        self._index = index
        self._save_disk_cache()
        return len(index)

    def _disk_cache_path(self):
        from pathlib import Path

        return Path(__file__).resolve().parents[3] / ".rag_index.json"

    def _save_disk_cache(self) -> None:
        """Simpan indeks + fingerprint dokumen ke disk agar restart tak membangun ulang."""
        import json

        fp_fn = getattr(self._clients, "documents_fingerprint", None)
        try:
            fingerprint = fp_fn() if callable(fp_fn) else None
            payload = {
                "fingerprint": fingerprint,
                "chunk_size": self._s.chunk_size,
                "chunk_overlap": self._s.chunk_overlap,
                "chunks": [
                    {"index": c.index, "text": c.text, "start": c.start, "end": c.end}
                    for c, _ in self._index
                ],
                "vectors": [v for _, v in self._index],
            }
            self._disk_cache_path().write_text(json.dumps(payload), encoding="utf-8")
        except Exception:  # noqa: BLE001 — cache opsional, jangan gagalkan build
            logger.exception("Gagal menyimpan cache indeks RAG")

    def _load_disk_cache(self) -> bool:
        """Muat indeks dari disk bila fingerprint dokumen masih cocok."""
        import json

        fp_fn = getattr(self._clients, "documents_fingerprint", None)
        if not callable(fp_fn):
            return False
        try:
            payload = json.loads(self._disk_cache_path().read_text(encoding="utf-8"))
        except Exception:  # noqa: BLE001 — belum ada cache
            return False
        try:
            if payload.get("fingerprint") != fp_fn():
                return False
            if payload.get("chunk_size") != self._s.chunk_size:
                return False
            chunks = [Chunk(**c) for c in payload.get("chunks", [])]
            vectors = payload.get("vectors", [])
            if not chunks or len(chunks) != len(vectors):
                return False
            self._index = list(zip(chunks, vectors))
            return True
        except Exception:  # noqa: BLE001 — cache korup, bangun ulang
            logger.exception("Cache indeks RAG tidak valid")
            return False

    def _ensure_index(self) -> None:
        if self.is_ready:
            return
        with self._lock:
            if not self._index and not self._load_disk_cache():
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

        has_order_intent = is_order_intent(question)
        handoff_url = WHATSAPP_HANDOFF_URL if has_order_intent else None

        hits = self.retrieve(question)
        if not hits:
            msg = (
                "Maaf, informasi spesifik mengenai hal tersebut belum tercantum dalam dokumen panduan kami. "
                "Apakah ada hal lain seputar alur atau layanan maklon yang ingin Anda ketahui?"
            )
            if has_order_intent:
                msg += WHATSAPP_HANDOFF_MSG
            return {
                "answer": msg,
                "sources": [],
                "whatsapp_handoff_url": handoff_url,
                "db_context_used": False,
            }

        context = "\n\n".join(f"[Chunk {h.chunk.index}]\n{h.chunk.text}" for h in hits)
        user_text = f"Konteks:\n{context}\n\nPertanyaan: {question}"
        raw_answer = self._clients.converse(CLIENT_ASSISTANT_PROMPT, user_text).strip() or EMPTY_MODEL_ANSWER
        answer = raw_answer
        if has_order_intent:
            answer = answer + WHATSAPP_HANDOFF_MSG

        return {
            "answer": answer,
            "whatsapp_handoff_url": handoff_url,
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

    def ask_agent_stream(self, question: str, db_context: str):
        """Varian streaming dari ask_agent — yield potongan jawaban."""
        hits = self.retrieve(question)
        sop_context = (
            "\n\n".join(f"[Dokumen SOP — Chunk {h.chunk.index}]\n{h.chunk.text}" for h in hits)
            if hits
            else "(Tidak ada chunk SOP yang relevan untuk pertanyaan ini.)"
        )
        combined_context = (
            "--- DATA OPERASIONAL REAL-TIME (dari database sistem) ---\n"
            f"{db_context}\n\n"
            "--- DOKUMEN SOP (dari knowledge base) ---\n"
            f"{sop_context}"
        )
        user_text = f"Konteks:\n{combined_context}\n\nPertanyaan: {question}"
        stream_fn = getattr(self._clients, "converse_stream", None)
        if not callable(stream_fn):
            yield self._clients.converse(OWNER_TRACKER_PROMPT, user_text)
            return
        yield from stream_fn(OWNER_TRACKER_PROMPT, user_text)

    def ask_with_persona(self, question: str, persona: str) -> dict:
        """FR-AI: Menjawab pertanyaan menggunakan persona AI Dual-Assistant (legacy endpoint /assistant).

        persona = 'owner_tracker'   → system prompt internal operasional (tanpa DB live).
        persona = 'client_assistant' → system prompt publik B2B calon klien.
        Gunakan ask_agent() dan ask_client() untuk versi lengkap.
        """
        system_prompt = (
            OWNER_TRACKER_PROMPT if persona == "owner_tracker" else CLIENT_ASSISTANT_PROMPT
        )
        has_order_intent = is_order_intent(question) if persona == "client_assistant" else False
        handoff_url = WHATSAPP_HANDOFF_URL if has_order_intent else None

        hits = self.retrieve(question)
        if not hits:
            no_ctx = (
                "Maaf, saya tidak menemukan informasi yang relevan di dokumen SOP kami. "
                "Ada hal lain seputar layanan maklon yang ingin Anda tanyakan?"
                if persona == "client_assistant"
                else NO_CONTEXT_ANSWER
            )
            if has_order_intent:
                no_ctx += WHATSAPP_HANDOFF_MSG
            return {"answer": no_ctx, "sources": [], "whatsapp_handoff_url": handoff_url}

        context = "\n\n".join(f"[Chunk {h.chunk.index}]\n{h.chunk.text}" for h in hits)
        user_text = f"Konteks:\n{context}\n\nPertanyaan: {question}"
        answer = self._clients.converse(system_prompt, user_text).strip() or EMPTY_MODEL_ANSWER
        if has_order_intent:
            answer += WHATSAPP_HANDOFF_MSG

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
                _service = RagService(settings, FreeRagClients(settings))
    return _service
