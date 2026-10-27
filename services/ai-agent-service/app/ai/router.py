"""Endpoint AI Chatbot — role-based untuk Lukla Operations Engine.

Kelompok endpoint:
  1. POST /ai/rag          → Chatbot publik (landing page & klien aktif).
  2. POST /ai/ask-agent    → Owner Tracker (knowledge base + data live DB). Untuk OWNER/MANDOR.
  3. POST /ai/assistant    → Dual-assistant legacy (backward compat).
  4. POST /ai/ask          → Endpoint generik (backward compat).
  5. POST /ai/reindex      → Rebuild embedding index knowledge base.
  6. GET  /ai/status       → Status index RAG (publik untuk health status).
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.ai.db_context import build_db_context
from app.ai.errors import RagError, RagUpstreamError
from app.ai.schemas import (
    AskRequest,
    AskResponse,
    AssistantPersona,
    DualAskRequest,
    DualAskResponse,
    RagStatusResponse,
    ReindexResponse,
)
from app.ai.service import RagService, get_rag_service
from app.modules.auth.dependencies import require_roles
from app.modules.auth.models import User, UserRole

router = APIRouter(prefix="/ai", tags=["ai"])

_OWNER_AGENT_ROLES = [UserRole.OWNER, UserRole.MANDOR]
_OWNER_ONLY_ROLES = [UserRole.OWNER]

# Label human-readable per persona
_PERSONA_LABELS = {
    AssistantPersona.OWNER_TRACKER: "Owner Tracker — Asisten Operasional Internal",
    AssistantPersona.CLIENT_ASSISTANT: "Asisten Calon Klien — B2B Maklon",
}


def _to_http(exc: RagError) -> HTTPException:
    """Kegagalan layanan AI dianggap 502. Konfigurasi/data kosong dianggap 503."""
    status_code = 502 if isinstance(exc, RagUpstreamError) else 503
    return HTTPException(status_code=status_code, detail=str(exc))


# ── 1. /rag — Chatbot publik (Landing page & Klien) ────────────────────────────

@router.post(
    "/rag",
    response_model=AskResponse,
    summary="Chatbot Publik (Knowledge Base + WhatsApp Handoff)",
    description=(
        "Endpoint chatbot untuk **calon klien B2B dan klien aktif**. "
        "Menjawab pertanyaan seputar maklon, skema harga, proses sampling, dan QC "
        "berdasarkan knowledge base SOP perusahaan. "
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


# ── 2. /ask-agent — Owner Tracker (Knowledge Base + live DB) ──────────────────

@router.post(
    "/ask-agent",
    response_model=AskResponse,
    summary="Owner Tracker AI (Knowledge Base + Data Operasional Real-time)",
    description=(
        "Endpoint chatbot untuk **Owner dan tim internal**. "
        "Menggabungkan knowledge base SOP dengan data live dari database sistem "
        "(pesanan aktif, output produksi, payroll, inventaris, QC, sample). "
        "Digunakan untuk monitoring, analisis bisnis, dan pengambilan keputusan operasional. "
        "**Hanya untuk OWNER dan MANDOR.**"
    ),
    dependencies=[Depends(require_roles(_OWNER_AGENT_ROLES))],
)
def ask_agent(
    body: AskRequest,
    db: Session = Depends(get_db),
    rag: RagService = Depends(get_rag_service),
) -> AskResponse:
    try:
        live_db_context = build_db_context(db)
        result = rag.ask_agent(body.question, db_context=live_db_context)
    except RagError as e:
        raise _to_http(e) from e
    return AskResponse(**result)


@router.post(
    "/ask-agent/stream",
    summary="Streaming Owner Tracker AI (SSE)",
    description="Stream respons kata per kata untuk chat interaktif Owner Tracker.",
    dependencies=[Depends(require_roles(_OWNER_AGENT_ROLES))],
)
def ask_agent_stream(
    body: AskRequest,
    db: Session = Depends(get_db),
    rag: RagService = Depends(get_rag_service),
):
    try:
        live_db_context = build_db_context(db)
        stream_gen = rag.ask_agent_stream(body.question, db_context=live_db_context)
    except RagError as e:
        raise _to_http(e) from e

    def _event_stream():
        try:
            for token in stream_gen:
                yield f"data: {token}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as exc:
            yield f"data: [ERROR: {exc}]\n\n"

    return StreamingResponse(
        _event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get(
    "/ask-agent",
    response_model=AskResponse,
    summary="Owner Tracker AI via GET (Knowledge Base + live DB)",
    include_in_schema=False,  # Tersembunyi di docs — untuk testing via browser
    dependencies=[Depends(require_roles(_OWNER_AGENT_ROLES))],
)
def ask_agent_get(
    q: str,
    db: Session = Depends(get_db),
    rag: RagService = Depends(get_rag_service),
) -> AskResponse:
    try:
        live_db_context = build_db_context(db)
        result = rag.ask_agent(q, db_context=live_db_context)
    except RagError as e:
        raise _to_http(e) from e
    return AskResponse(**result)


# ── 3. /assistant — Dual-Assistant (backward compat) ──────────────────────────

@router.post(
    "/assistant",
    response_model=DualAskResponse,
    summary="AI Dual-Assistant (Pilih Persona)",
    description=(
        "Endpoint dual-assistant yang fleksibel. Pilih persona via request body:\n\n"
        "- `owner_tracker`: Untuk Owner / internal (hanya knowledge base SOP, tanpa live DB).\n"
        "- `client_assistant`: Untuk calon klien (dilengkapi tombol WhatsApp handoff)."
    ),
)
def ask_dual_assistant(
    body: DualAskRequest,
    rag: RagService = Depends(get_rag_service),
) -> DualAskResponse:
    """AI Dual-Assistant — pilih persona sesuai kebutuhan:

    - **owner_tracker**: Asisten operasional internal untuk Owner.
      Membantu memantau produksi, QC, payroll, dan status pesanan berbasis knowledge base.
    - **client_assistant**: Asisten publik B2B untuk calon klien maklon.
      Menjelaskan alur kerja sama, skema harga, proses sampling, dan standar QC.
    """
    try:
        if body.persona == AssistantPersona.OWNER_TRACKER:
            result = rag.ask_agent(body.question, db_context=None)
        else:
            result = rag.ask_client(body.question)
    except RagError as e:
        raise _to_http(e) from e
    return DualAskResponse(
        persona=body.persona,
        persona_label=_PERSONA_LABELS[body.persona],
        answer=result["answer"],
        sources=result["sources"],
        whatsapp_handoff_url=result.get("whatsapp_handoff_url"),
    )


# ── 4. /ask — Generik RAG (backward compat) ───────────────────────────────────

@router.post(
    "/ask",
    response_model=AskResponse,
    summary="RAG Generik (tanpa persona)",
    description="Endpoint generik untuk testing. Gunakan `/rag` atau `/ask-agent` di produksi.",
)
def ask(body: AskRequest, rag: RagService = Depends(get_rag_service)) -> AskResponse:
    try:
        result = rag.ask(body.question)
    except RagError as e:
        raise _to_http(e) from e
    return AskResponse(**result)


# ── 5 & 6. Utilities ──────────────────────────────────────────────────────────

@router.post(
    "/reindex",
    response_model=ReindexResponse,
    dependencies=[Depends(require_roles(_OWNER_ONLY_ROLES))],
)
def reindex(rag: RagService = Depends(get_rag_service)) -> ReindexResponse:
    try:
        count = rag.build_index()
    except RagError as e:
        raise _to_http(e) from e
    return ReindexResponse(chunks=count)


@router.get(
    "/status",
    response_model=RagStatusResponse,
)
def rag_status(rag: RagService = Depends(get_rag_service)) -> RagStatusResponse:
    if not rag.is_ready:
        try:
            rag.build_index()
        except Exception:
            pass
    return RagStatusResponse(
        index_ready=rag.is_ready,
        chunks=rag.chunk_count,
        document=rag.document_uri,
    )
