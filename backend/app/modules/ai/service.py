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
