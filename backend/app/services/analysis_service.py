"""Business logic for creating analysis requests.

IMPORTANT: This service performs NO AI inference. It validates that the
referenced imagery exists and that the query is non-empty, then records an
analysis_jobs row so the API has a stable contract for a future AI/agentic
layer to consume. See CLAUDE.md.
"""
from app.core.exceptions import ValidationAppError
from app.schemas.analysis import AnalysisCreate
from app.services import imagery_service, job_service


def create_analysis(payload: AnalysisCreate) -> dict:
    if not payload.query or not payload.query.strip():
        raise ValidationAppError("INVALID_QUERY", "Query cannot be empty.")

    # Raises NotFoundError(IMAGE_NOT_FOUND) if the imagery doesn't exist.
    imagery_service.get_imagery(str(payload.imagery_id))

    return job_service.create_job(
        imagery_id=payload.imagery_id,
        analysis_type=payload.analysis_type,
        query=payload.query.strip(),
    )
