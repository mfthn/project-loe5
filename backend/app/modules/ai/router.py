"""Endpoint AI Chatbot — role-based untuk Lukla Operations Engine.

Kelompok endpoint:
  1. POST /ai/rag          → Chatbot publik (landing page & klien aktif).
  2. POST /ai/ask-agent    → Owner Tracker (knowledge base + data live DB). Untuk OWNER/MANDOR.
  3. POST /ai/assistant    → Dual-assistant legacy (backward compat).
  4. POST /ai/ask          → Endpoint generik (backward compat).
  5. POST /ai/reindex      → Rebuild embedding index knowledge base.
  6. GET  /ai/status       → Status index RAG.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
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
from app.modules.auth.dependencies import get_current_user, require_roles
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
    rag: RagService = Depends(get_rag_service),
    db: Session = Depends(get_db),
) -> AskResponse:
    try:
        db_ctx = build_db_context(db)
        result = rag.ask_agent(body.question, db_ctx)
    except RagError as e:
        raise _to_http(e) from e
    return AskResponse(**result)


@router.post(
    "/ask-agent/stream",
    summary="Owner Tracker AI streaming (SSE teks)",
    description="Sama seperti /ask-agent tetapi jawaban mengalir per potongan agar terasa instan.",
    dependencies=[Depends(require_roles(_OWNER_AGENT_ROLES))],
    response_class=StreamingResponse,
)
def ask_agent_stream(
    body: AskRequest,
    rag: RagService = Depends(get_rag_service),
    db: Session = Depends(get_db),
):
    try:
        db_ctx = build_db_context(db)
        chunks = rag.ask_agent_stream(body.question, db_ctx)
    except RagError as e:
        raise _to_http(e) from e

    def event_source():
        try:
            for piece in chunks:
                yield piece
        except RagError as e:
            yield f"\n\n[ERROR] {e}"

    return StreamingResponse(event_source(), media_type="text/plain; charset=utf-8")


@router.get(
    "/ask-agent",
    response_model=AskResponse,
    summary="Owner Tracker AI via GET (Knowledge Base + live DB)",
    include_in_schema=False,  # Tersembunyi di docs — untuk testing via browser
    dependencies=[Depends(require_roles(_OWNER_AGENT_ROLES))],
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
      Membantu memantau produksi, QC, payroll, dan status pesanan berbasis knowledge base.
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
