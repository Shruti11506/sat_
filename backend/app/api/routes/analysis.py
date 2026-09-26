"""Analysis request endpoint.

MUST NOT perform AI inference. Creates an analysis_jobs record only.
"""
from fastapi import APIRouter, Query, status

from app.schemas.analysis import AnalysisCreate, AnalysisCreateResponse
from app.schemas.common import ApiResponse
from app.schemas.history import HistoryItem
from app.services import analysis_service, job_service

router = APIRouter(prefix="/analysis", tags=["Analysis"])


@router.post(
    "",
    response_model=ApiResponse[AnalysisCreateResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create an analysis request (no AI inference is performed)",
)
def create_analysis(payload: AnalysisCreate) -> ApiResponse[AnalysisCreateResponse]:
    job = analysis_service.create_analysis(payload)
    return ApiResponse.ok(
        AnalysisCreateResponse(
            job_id=job["id"],
            imagery_id=job["imagery_id"],
            comparison_imagery_id=job.get("comparison_imagery_id"),
            analysis_type=job["analysis_type"],
            query=job["query"],
            conversation_id=job.get("conversation_id"),
            status=job["status"],
        )
    )


@router.get(
    "/history",
    response_model=ApiResponse[list[HistoryItem]],
    summary="List analysis requests (analysis_jobs joined with imagery), most recent first",
)
def get_history(limit: int = Query(default=50, ge=1, le=200)) -> ApiResponse[list[HistoryItem]]:
    items = job_service.list_history(limit=limit)
    return ApiResponse.ok([HistoryItem(**item) for item in items])
