"""Pydantic schemas for the analysis_results and evidence resources.

Retrieval-only: nothing in this module generates results or evidence.
"""
from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.schemas.analysis import AnalysisType


class ResultOut(BaseModel):
    id: UUID
    job_id: UUID
    answer: str | None = None
    confidence: float | None = None
    model_name: str | None = None
    analysis_type: AnalysisType
    raw_output: dict[str, Any] | None = None
    created_at: datetime | None = None


class EvidenceOut(BaseModel):
    id: UUID
    result_id: UUID
    evidence_type: str
    description: str | None = None
    source_reference: str | None = None
    bbox: dict[str, Any] | None = None
    confidence: float | None = None
    metadata: dict[str, Any] | None = None
    created_at: datetime | None = None
