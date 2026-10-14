"""Skema request dan response endpoint RAG."""
import enum
from typing import Annotated

from pydantic import BaseModel, StringConstraints

Question = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class AssistantPersona(str, enum.Enum):
    """Persona AI Dual-Assistant:
    - OWNER_TRACKER : asisten operasional internal untuk Owner / Mandor.
    - CLIENT_ASSISTANT: asisten publik B2B untuk calon klien maklon.
    """
    OWNER_TRACKER = "owner_tracker"
    CLIENT_ASSISTANT = "client_assistant"


class AskRequest(BaseModel):
    question: Question


class DualAskRequest(BaseModel):
    """Request untuk AI Dual-Assistant dengan pilihan persona."""
    question: Question
    persona: AssistantPersona = AssistantPersona.OWNER_TRACKER


class SourceOut(BaseModel):
    chunk_index: int
    start: int
    end: int
    score: float
    text: str


class AskResponse(BaseModel):
    answer: str
    sources: list[SourceOut]


class DualAskResponse(BaseModel):
    """Response AI Dual-Assistant dengan metadata persona & link handoff WhatsApp."""
    persona: AssistantPersona
    persona_label: str
    answer: str
    sources: list[SourceOut]
    whatsapp_handoff_url: str | None = None


class ReindexResponse(BaseModel):
    chunks: int


class RagStatusResponse(BaseModel):
    index_ready: bool
    chunks: int
    document: str
