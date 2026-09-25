"""Pydantic schemas for the analysis_jobs resource."""
from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel

from app.schemas.analysis import AnalysisType


class JobStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class JobOut(BaseModel):
    id: UUID
    imagery_id: UUID | None = None
    conversation_id: UUID | None = None
    analysis_type: AnalysisType
    query: str | None = None
    status: JobStatus
    model_name: str | None = None
    result_id: UUID | None = None
    error_message: str | None = None
    created_at: datetime | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
