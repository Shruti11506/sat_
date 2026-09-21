"""Analysis request endpoint.

MUST NOT perform AI inference. Creates an analysis_jobs record only.
"""
from fastapi import APIRouter, status

from app.schemas.analysis import AnalysisCreate, AnalysisCreateResponse
from app.schemas.common import ApiResponse
from app.services import analysis_service

router = APIRouter(prefix="/analysis", tags=["Analysis"])


@router.post(
    "",
    response_model=ApiResponse[AnalysisCreateResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Create an analysis request (no AI inference is performed)",
)
def create_analysis(payload: AnalysisCreate) -> ApiResponse[AnalysisCreateResponse]:
    job = analysis_service.create_analysis(payload)
    return ApiResponse.ok(AnalysisCreateResponse(job_id=job["id"], status=job["status"]))
