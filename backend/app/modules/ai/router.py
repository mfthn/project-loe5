"""Endpoint RAG AI — role-based chatbot untuk Lukla Operations Engine.

Tiga kelompok endpoint:
  1. POST /ai/rag          → Chatbot publik (S3 only). Untuk: Landing page, klien aktif.
                             Selalu append WhatsApp handoff di akhir jawaban.
  2. POST /ai/ask-agent    → Owner Tracker (S3 + live DB). Untuk: Owner / internal.
                             Menggabungkan knowledge base + data operasional real-time.
  3. POST /ai/assistant    → Legacy dual-assistant (backward compat, tanpa DB live).
  4. POST /ai/ask          → Endpoint generik (backward compat, S3 only, tanpa handoff).
  5. POST /ai/reindex      → Rebuild embedding index dari S3.
  6. GET  /ai/status       → Status index RAG.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.modules.ai.db_context import build_db_context
from app.modules.ai.errors import RagError, RagUpstreamError
from app.modules.ai.schemas import (
    AskRequest,
    AskResponse,
    AssistantPersona,
    DualAskRequest,
    DualAskResponse,
    RagStatusResponse,
    ReindexResponse,
)
from app.modules.ai.service import RagService, get_rag_service
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.models import User, UserRole

router = APIRouter(prefix="/ai", tags=["ai"])

# Label human-readable per persona
_PERSONA_LABELS = {
    AssistantPersona.OWNER_TRACKER: "Owner Tracker — Asisten Operasional Internal",
    AssistantPersona.CLIENT_ASSISTANT: "Asisten Calon Klien — B2B Maklon",
}


def _to_http(exc: RagError) -> HTTPException:
    """Kegagalan AWS dianggap 502 (layanan hulu). Konfigurasi/data kosong dianggap 503."""
    status = 502 if isinstance(exc, RagUpstreamError) else 503
    return HTTPException(status_code=status, detail=str(exc))


# ── 1. /rag — Chatbot publik (Landing page & Klien) ───────────────────────────

@router.post(
    "/rag",
    response_model=AskResponse,
    summary="Chatbot Publik (S3 Knowledge Base + WhatsApp Handoff)",
    description=(
        "Endpoint chatbot untuk **calon klien B2B dan klien aktif**. "
        "Menjawab pertanyaan seputar maklon, skema harga, proses sampling, dan QC "
        "berdasarkan dokumen SOP dari S3. "
        "Setiap jawaban selalu diakhiri dengan ajakan kontak WhatsApp."
    ),
)
def ask_client(
    body: AskRequest,
    rag: RagService = Depends(get_rag_service),
) -> AskResponse:
    try:
        result = rag.ask_client(body.question)
    except RagError as e:
        raise _to_http(e) from e
    return AskResponse(**result)


# ── 2. /ask-agent — Owner Tracker (S3 + live DB) ─────────────────────────────

@router.post(
    "/ask-agent",
    response_model=AskResponse,
    summary="Owner Tracker AI (S3 Knowledge Base + Data Operasional Real-time)",
    description=(
        "Endpoint chatbot untuk **Owner dan tim internal**. "
        "Menggabungkan dokumen SOP dari S3 dengan data live dari database sistem "
        "(pesanan aktif, output produksi, payroll, inventaris, QC, sample). "
        "Digunakan untuk monitoring, analisis bisnis, dan pengambilan keputusan operasional. "
        "**Hanya untuk pengguna dengan role `owner` atau `admin`.**"
    ),
)
def ask_agent(
    body: AskRequest,
    rag: RagService = Depends(get_rag_service),
    db: Session = Depends(get_db),
) -> AskResponse:
    try:
        db_ctx = build_db_context(db)
        result = rag.ask_agent(body.question, db_ctx)
    except RagError as e:
        raise _to_http(e) from e
    return AskResponse(**result)


@router.get(
    "/ask-agent",
    response_model=AskResponse,
    summary="Owner Tracker AI via GET (S3 + live DB)",
    include_in_schema=False,  # Tersembunyi di docs — untuk testing via browser
)
def ask_agent_get(
    question: str,
    rag: RagService = Depends(get_rag_service),
    db: Session = Depends(get_db),
) -> AskResponse:
    try:
        db_ctx = build_db_context(db)
        result = rag.ask_agent(question, db_ctx)
    except RagError as e:
        raise _to_http(e) from e
    return AskResponse(**result)


# ── 3. /assistant — Legacy dual-assistant (backward compat) ───────────────────

@router.post(
    "/assistant",
    response_model=DualAskResponse,
    summary="AI Dual-Assistant — Pilih Persona (Legacy)",
    description=(
        "Endpoint legacy untuk memilih persona secara eksplisit. "
        "Gunakan `/rag` untuk klien atau `/ask-agent` untuk owner (dengan data live DB). "
        "Endpoint ini tidak menyertakan data real-time dari database."
    ),
)
def ask_dual_assistant(
    body: DualAskRequest,
    rag: RagService = Depends(get_rag_service),
    current_user: User = Depends(get_current_user),
) -> DualAskResponse:
    """AI Dual-Assistant — pilih persona sesuai kebutuhan:

    - **owner_tracker**: Asisten operasional internal untuk Owner.
      Membantu memantau produksi, QC, payroll, dan status pesanan berbasis SOP.
    - **client_assistant**: Asisten publik B2B untuk calon klien maklon.
      Menjelaskan alur kerja sama, skema harga, proses sampling, dan standar QC.
    """
    if current_user.role not in (UserRole.OWNER, UserRole.KLIEN_MAKLON):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="AI Assistant hanya tersedia untuk akun Owner dan Klien.",
        )

    if current_user.role == UserRole.KLIEN_MAKLON:
        if body.persona != AssistantPersona.CLIENT_ASSISTANT:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akun klien hanya dapat menggunakan persona Asisten Klien.",
            )
        if current_user.client_id is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Akun klien belum terhubung ke data klien yang valid.",
            )
    elif body.persona != AssistantPersona.OWNER_TRACKER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Persona Asisten Klien hanya tersedia untuk akun klien.",
        )

    try:
        result = rag.ask_with_persona(body.question, body.persona.value)
    except RagError as e:
        raise _to_http(e) from e
    return DualAskResponse(
        persona=body.persona,
        persona_label=_PERSONA_LABELS[body.persona],
        answer=result["answer"],
        sources=result["sources"],
        whatsapp_handoff_url=result.get("whatsapp_handoff_url"),
    )


# ── 4. /ask — Generik S3 RAG (backward compat) ────────────────────────────────

@router.post(
    "/ask",
    response_model=AskResponse,
    summary="RAG Generik (S3 only, tanpa persona)",
    description="Endpoint generik untuk testing. Gunakan `/rag` atau `/ask-agent` di produksi.",
)
def ask(body: AskRequest, rag: RagService = Depends(get_rag_service)) -> AskResponse:
    try:
        result = rag.ask(body.question)
    except RagError as e:
        raise _to_http(e) from e
    return AskResponse(**result)


# ── 5 & 6. Utilities ──────────────────────────────────────────────────────────

@router.post("/reindex", response_model=ReindexResponse)
def reindex(rag: RagService = Depends(get_rag_service)) -> ReindexResponse:
    try:
        count = rag.build_index()
    except RagError as e:
        raise _to_http(e) from e
    return ReindexResponse(chunks=count)


@router.get("/status", response_model=RagStatusResponse)
def rag_status(rag: RagService = Depends(get_rag_service)) -> RagStatusResponse:
    return RagStatusResponse(
        index_ready=rag.is_ready,
        chunks=rag.chunk_count,
        document=rag.document_uri,
    )
