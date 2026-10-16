"""Pengujian RAG tanpa memanggil AWS. Semua pemanggilan AWS diganti FakeClients."""
import pytest
import uuid

from app.core.config import Settings
from app.main import app
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User, UserRole
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
    def _install(service: RagService, role: UserRole = UserRole.OWNER):
        app.dependency_overrides[get_rag_service] = lambda: service
        app.dependency_overrides[get_current_user] = lambda: User(
            id=uuid.uuid4(),
            username="test-user",
            hashed_password="x",
            name="Test User",
            role=role,
            client_id=uuid.uuid4() if role == UserRole.KLIEN_MAKLON else None,
        )
        return client
    yield _install
    app.dependency_overrides.pop(get_rag_service, None)
    app.dependency_overrides.pop(get_current_user, None)


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


def test_post_ask_agent_returns_answer(use_service):
    http = use_service(RagService(make_settings(), FakeClients()))

    res = http.post("/api/v1/ai/ask-agent", json={"question": "Berapa lama cuti?"})

    assert res.status_code == 200
    body = res.json()
    assert body["answer"] == "Jawaban uji."
    assert body["sources"]


def test_post_ask_agent_rejects_blank_question(use_service):
    http = use_service(RagService(make_settings(), FakeClients()))

    res = http.post("/api/v1/ai/ask-agent", json={"question": "   "})

    assert res.status_code == 422


# ===========================================================================
# Dual-Assistant Tests (Fase 7 — FR-AI)
# ===========================================================================

def test_dual_assistant_owner_tracker_persona(use_service):
    """POST /ai/assistant dengan persona owner_tracker harus mengembalikan label yang benar."""
    http = use_service(RagService(make_settings(), FakeClients()))

    res = http.post(
        "/api/v1/ai/assistant",
        json={"question": "Berapa lama cuti?", "persona": "owner_tracker"},
    )

    assert res.status_code == 200
    body = res.json()
    assert body["persona"] == "owner_tracker"
    assert "Owner Tracker" in body["persona_label"]
    assert body["answer"] == "Jawaban uji."
    assert body["sources"]


def test_dual_assistant_client_assistant_persona(use_service):
    """POST /ai/assistant dengan persona client_assistant harus mengembalikan label yang benar."""
    http = use_service(
        RagService(make_settings(), FakeClients()), role=UserRole.KLIEN_MAKLON
    )

    res = http.post(
        "/api/v1/ai/assistant",
        # Gunakan kata dari DOC agar ada hits di FakeClients
        json={"question": "Bagaimana prosedur cuti?", "persona": "client_assistant"},
    )

    assert res.status_code == 200
    body = res.json()
    assert body["persona"] == "client_assistant"
    assert "Calon Klien" in body["persona_label"]
    assert body["answer"] == "Jawaban uji."


def test_client_cannot_select_owner_tracker(use_service):
    http = use_service(
        RagService(make_settings(), FakeClients()), role=UserRole.KLIEN_MAKLON
    )

    response = http.post(
        "/api/v1/ai/assistant",
        json={"question": "Status order", "persona": "owner_tracker"},
    )

    assert response.status_code == 403


def test_non_owner_operational_role_cannot_use_dual_assistant(use_service):
    http = use_service(
        RagService(make_settings(), FakeClients()), role=UserRole.MANDOR
    )

    response = http.post(
        "/api/v1/ai/assistant",
        json={"question": "Status produksi", "persona": "owner_tracker"},
    )

    assert response.status_code == 403


def test_dual_assistant_default_persona_is_owner_tracker(use_service):
    """Persona default harus owner_tracker jika tidak disertakan."""
    http = use_service(RagService(make_settings(), FakeClients()))

    res = http.post(
        "/api/v1/ai/assistant",
        json={"question": "Berapa gaji penjahit?"},
    )

    assert res.status_code == 200
    body = res.json()
    assert body["persona"] == "owner_tracker"


def test_dual_assistant_invalid_persona_returns_422(use_service):
    """Persona yang tidak valid harus ditolak (HTTP 422)."""
    http = use_service(RagService(make_settings(), FakeClients()))

    res = http.post(
        "/api/v1/ai/assistant",
        json={"question": "Test", "persona": "invalid_persona"},
    )

    assert res.status_code == 422


def test_dual_assistant_no_context_client_response(use_service):
    """ask_with_persona pada dokumen kosong melempar RagUnavailableError (dokumen kosong)."""
    from app.modules.ai.errors import RagUnavailableError
    from app.modules.ai.service import RagService as RS

    class EmptyFakeClients(FakeClients):
        def read_document(self) -> str:
            return ""  # dokumen kosong

    import pytest
    svc = RS(make_settings(), EmptyFakeClients())
    with pytest.raises(RagUnavailableError):
        svc.ask_with_persona("Berapa biaya CMT?", "client_assistant")


def test_dual_assistant_no_context_owner_response(use_service):
    """ask_with_persona pada dokumen kosong melempar RagUnavailableError."""
    from app.modules.ai.errors import RagUnavailableError
    from app.modules.ai.service import RagService as RS

    class EmptyFakeClients(FakeClients):
        def read_document(self) -> str:
            return ""

    import pytest
    svc = RS(make_settings(), EmptyFakeClients())
    with pytest.raises(RagUnavailableError):
        svc.ask_with_persona("Status produksi hari ini?", "owner_tracker")


class FakeMultiClients(FakeClients):
    def __init__(self, documents: dict) -> None:
        super().__init__(document="")
        self.documents = documents

    def read_documents(self) -> dict:
        if not self.documents:
            from app.modules.ai.errors import RagUpstreamError as _Up

            raise _Up("Tidak ada dokumen .md di bucket uji.")
        return dict(self.documents)


def test_build_index_menggabung_multi_dokumen():
    from app.modules.ai.service import RagService

    svc = RagService(
        make_settings(similarity_threshold=0.0),
        FakeMultiClients({"a.md": "skema maklon CMT tas", "b.md": "jadwal sampling hoodie"}),
    )
    n = svc.build_index()
    assert n > 0 and svc.is_ready
    hits = svc.retrieve("skema maklon")
    assert len(hits) > 0


def test_build_index_bucket_kosong_error_jelas():
    from app.modules.ai.errors import RagUpstreamError
    from app.modules.ai.service import RagService

    svc = RagService(make_settings(), FakeMultiClients({}))
    try:
        svc.build_index()
        raise AssertionError("seharusnya gagal")
    except RagUpstreamError as e:
        assert ".md" in str(e)
