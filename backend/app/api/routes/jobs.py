"""Analysis job retrieval endpoint."""
from uuid import UUID

from fastapi import APIRouter

from app.schemas.common import ApiResponse
from app.schemas.jobs import JobOut
from app.services import job_service

router = APIRouter(prefix="/jobs", tags=["Jobs"])


@router.get(
    "/{job_id}",
    response_model=ApiResponse[JobOut],
    summary="Get an analysis job by id",
)
def get_job(job_id: UUID) -> ApiResponse[JobOut]:
    row = job_service.get_job(str(job_id))
    return ApiResponse.ok(JobOut(**row))
