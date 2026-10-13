"""Skema request dan response endpoint RAG."""
from typing import Annotated

from pydantic import BaseModel, StringConstraints

Question = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class AskRequest(BaseModel):
    question: Question


class SourceOut(BaseModel):
    chunk_index: int
    start: int
    end: int
    score: float
    text: str


class AskResponse(BaseModel):
    answer: str
    sources: list[SourceOut]


class ReindexResponse(BaseModel):
    chunks: int


class RagStatusResponse(BaseModel):
    index_ready: bool
    chunks: int
    document: str
