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
    query: str | None = Field(default=None, max_length=2000)


class AnalysisCreateResponse(BaseModel):
    job_id: UUID
    status: str = "queued"
