"""Analysis result retrieval endpoint. Retrieval only -- never generates results."""
from uuid import UUID

from fastapi import APIRouter

from app.schemas.common import ApiResponse
from app.schemas.results import ResultOut
from app.services import result_service

router = APIRouter(prefix="/results", tags=["Results"])


@router.get(
    "/{result_id}",
    response_model=ApiResponse[ResultOut],
    summary="Get a stored analysis result by id",
)
def get_result(result_id: UUID) -> ApiResponse[ResultOut]:
    row = result_service.get_result(str(result_id))
    return ApiResponse.ok(ResultOut(**row))
