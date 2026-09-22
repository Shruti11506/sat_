"""Schema for GET /api/v1/analysis/history -- analysis_jobs joined with imagery.

Retrieval only. Reflects exactly what's in Supabase; never fabricates a title,
status, or any other field.
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.analysis import AnalysisType
from app.schemas.jobs import JobStatus


class HistoryItem(BaseModel):
    job_id: UUID
    imagery_id: UUID
    imagery_name: str | None = None
    query: str
    analysis_type: AnalysisType
    status: JobStatus
    created_at: datetime | None = None
