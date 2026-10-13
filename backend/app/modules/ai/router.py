"""Endpoint RAG: /api/v1/ai/ask, /api/v1/ai/reindex, dan /api/v1/ai/status."""
from fastapi import APIRouter, Depends, HTTPException

from app.modules.ai.errors import RagError, RagUpstreamError
from app.modules.ai.schemas import AskRequest, AskResponse, RagStatusResponse, ReindexResponse
from app.modules.ai.service import RagService, get_rag_service

router = APIRouter(prefix="/ai", tags=["ai"])


def _to_http(exc: RagError) -> HTTPException:
    # Kegagalan AWS dianggap 502 (layanan hulu). Konfigurasi atau data kosong dianggap 503.
    status = 502 if isinstance(exc, RagUpstreamError) else 503
    return HTTPException(status_code=status, detail=str(exc))


@router.post("/ask", response_model=AskResponse)
def ask(body: AskRequest, rag: RagService = Depends(get_rag_service)) -> AskResponse:
    try:
        result = rag.ask(body.question)
    except RagError as e:
        raise _to_http(e) from e
    return AskResponse(**result)


@router.post("/reindex", response_model=ReindexResponse)
def reindex(rag: RagService = Depends(get_rag_service)) -> ReindexResponse:
    try:
        count = rag.build_index()
    except RagError as e:
        raise _to_http(e) from e
    return ReindexResponse(chunks=count)


@router.get("/status", response_model=RagStatusResponse)
def rag_status(rag: RagService = Depends(get_rag_service)) -> RagStatusResponse:
    return RagStatusResponse(index_ready=rag.is_ready, chunks=rag.chunk_count, document=rag.document_uri)
