"""Evidence retrieval endpoint. Retrieval only -- never generates evidence."""
from uuid import UUID

from fastapi import APIRouter

from app.schemas.common import ApiResponse
from app.schemas.results import EvidenceOut
from app.services import result_service

router = APIRouter(prefix="/results", tags=["Evidence"])


@router.get(
    "/{result_id}/evidence",
    response_model=ApiResponse[list[EvidenceOut]],
    summary="Get evidence records for a stored analysis result",
)
def get_evidence(result_id: UUID) -> ApiResponse[list[EvidenceOut]]:
    rows = result_service.get_evidence(str(result_id))
    return ApiResponse.ok([EvidenceOut(**row) for row in rows])
