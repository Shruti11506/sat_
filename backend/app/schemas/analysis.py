"""Pydantic schemas for the analysis resource.

NOTE: `AnalysisType` is an API-level contract only. It intentionally does not
map to any AI model, tool, or orchestration logic -- the AI/model layer does
not exist yet in this milestone.
"""
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class AnalysisType(str, Enum):
    VQA = "vqa"
    CAPTIONING = "captioning"
    SCENE_DESCRIPTION = "scene_description"
    CHANGE_DETECTION = "change_detection"
    CHANGE_VQA = "change_vqa"
    OPTICAL_SAR_ANALYSIS = "optical_sar_analysis"
    REGION_GROUNDING = "region_grounding"
    GENERAL_ANALYSIS = "general_analysis"


class AnalysisCreate(BaseModel):
    imagery_id: UUID
    analysis_type: AnalysisType
    # Not `min_length=1` here on purpose: a whitespace-only string would still
    # pass that check. Emptiness is checked explicitly in analysis_service so
    # it raises the documented INVALID_QUERY error instead of a generic 422.
    query: str = Field(..., max_length=2000)
    # Optional so existing clients keep working; the UI always sends it.
    conversation_id: UUID | None = None
    # Image pair queries: imagery_id is Image 1, this is Image 2. Omitted for
    # single-image queries.
    comparison_imagery_id: UUID | None = None


class AnalysisCreateResponse(BaseModel):
    job_id: UUID
    imagery_id: UUID
    comparison_imagery_id: UUID | None = None
    analysis_type: AnalysisType
    query: str
    conversation_id: UUID | None = None
    status: str = "queued"
