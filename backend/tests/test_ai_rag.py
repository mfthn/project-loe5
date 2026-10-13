"""Pengujian RAG tanpa memanggil AWS. Semua pemanggilan AWS diganti FakeClients."""
import pytest

from app.core.config import Settings
from app.main import app
from app.modules.ai.errors import RagNotConfiguredError, RagUnavailableError, RagUpstreamError
from app.modules.ai.service import (
    NO_CONTEXT_ANSWER,
    RagService,
    chunk_text,
    cosine_similarity,
    get_rag_service,
)

VOCAB = ["cuti", "gaji", "seragam"]

DOC = (
    "Prosedur cuti tahunan berlaku setelah satu tahun kerja. "
    "Cuti diajukan minimal tiga hari sebelumnya. "
    "Gaji dibayarkan setiap tanggal lima bulan berikutnya. "
    "Seragam kerja disediakan perusahaan setiap enam bulan."
)


def fake_embed(text: str) -> list[float]:
    lower = text.lower()
    return [float(lower.count(word)) for word in VOCAB]


class FakeClients:
    def __init__(self, document: str = DOC, fail_converse: bool = False) -> None:
        self.document = document
        self.fail_converse = fail_converse
        self.prompts: list[str] = []

    def read_document(self) -> str:
        return self.document

    def embed(self, text: str) -> list[float]:
        return fake_embed(text)

    def converse(self, system_prompt: str, user_text: str) -> str:
        if self.fail_converse:
            raise RagUpstreamError("gagal uji")
        self.prompts.append(user_text)
        return "Jawaban uji."


def make_settings(**overrides) -> Settings:
    values = dict(s3_bucket="bucket-uji", chunk_size=90, chunk_overlap=10, top_k=4, similarity_threshold=0.3)
    values.update(overrides)
    return Settings(_env_file=None, **values)


# ---------- chunking dan cosine ----------

def test_chunk_short_text_is_single_chunk():
    chunks = chunk_text("abc", 800, 100)
    assert len(chunks) == 1
    assert chunks[0].text == "abc" and chunks[0].index == 0


def test_chunk_respects_size_overlap_and_covers_text():
    text = " ".join(f"kata{i}" for i in range(300))
    chunks = chunk_text(text, 200, 40)

    assert len(chunks) > 1
    assert all(len(c.text) <= 200 for c in chunks)
    assert [c.index for c in chunks] == list(range(len(chunks)))
    assert chunks[1].start < chunks[0].end  # ada overlap
    assert chunks[-1].end == len(text)      # seluruh teks tercakup


def test_chunk_rejects_overlap_not_smaller_than_size():
    with pytest.raises(ValueError):
        chunk_text("teks apa saja", 100, 100)


def test_cosine_similarity_basic_values():
    assert cosine_similarity([1.0, 0.0], [1.0, 0.0]) == pytest.approx(1.0)
    assert cosine_similarity([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0)
    assert cosine_similarity([0.0, 0.0], [1.0, 1.0]) == 0.0


# ---------- pipeline ----------

def test_ask_returns_answer_and_relevant_sources():
    service = RagService(make_settings(), FakeClients())

    result = service.ask("Berapa lama cuti?")

    assert result["answer"] == "Jawaban uji."
    assert result["sources"], "harus ada sumber yang relevan"
    assert all(s["score"] >= 0.3 for s in result["sources"])
    assert "cuti" in result["sources"][0]["text"].lower()


def test_ask_without_relevant_context_skips_llm():
    clients = FakeClients()
    service = RagService(make_settings(), clients)

    result = service.ask("Apa kabar?")

    assert result == {"answer": NO_CONTEXT_ANSWER, "sources": []}
    assert clients.prompts == []  # LLM tidak dipanggil tanpa konteks


def test_empty_document_raises_unavailable():
    service = RagService(make_settings(), FakeClients(document="   "))
    with pytest.raises(RagUnavailableError):
        service.build_index()


def test_missing_bucket_raises_not_configured():
    service = RagService(make_settings(s3_bucket=""), FakeClients())
    with pytest.raises(RagNotConfiguredError):
        service.build_index()


# ---------- endpoint ----------

@pytest.fixture
def use_service(client):
    """Mengganti dependency RAG dengan service berisi fake clients."""
    def _install(service: RagService):
        app.dependency_overrides[get_rag_service] = lambda: service
        return client
    yield _install
    app.dependency_overrides.pop(get_rag_service, None)


def test_post_ask_returns_answer(use_service):
    http = use_service(RagService(make_settings(), FakeClients()))

    res = http.post("/api/v1/ai/ask", json={"question": "Berapa lama cuti?"})

    assert res.status_code == 200
    body = res.json()
    assert body["answer"] == "Jawaban uji."
    assert body["sources"]


def test_post_ask_rejects_blank_question(use_service):
    http = use_service(RagService(make_settings(), FakeClients()))

    res = http.post("/api/v1/ai/ask", json={"question": "   "})

    assert res.status_code == 422


def test_post_ask_returns_503_when_not_configured(use_service):
    http = use_service(RagService(make_settings(s3_bucket=""), FakeClients()))

    res = http.post("/api/v1/ai/ask", json={"question": "Berapa lama cuti?"})

    assert res.status_code == 503


def test_post_ask_returns_502_when_aws_fails(use_service):
    http = use_service(RagService(make_settings(), FakeClients(fail_converse=True)))

    res = http.post("/api/v1/ai/ask", json={"question": "Berapa lama cuti?"})

    assert res.status_code == 502
