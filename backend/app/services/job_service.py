"""Business logic for the analysis_jobs resource.

This module only creates and retrieves job *records*. It never executes,
schedules, or simulates AI processing -- jobs are created with status
"queued" and stay there until a future AI layer picks them up.
"""
import logging
from uuid import UUID

from app.core.exceptions import NotFoundError, SupabaseError
from app.db.supabase import get_supabase
from app.schemas.analysis import AnalysisType

logger = logging.getLogger(__name__)

TABLE = "analysis_jobs"


def create_job(imagery_id: UUID, analysis_type: AnalysisType, query: str | None) -> dict:
    client = get_supabase()
    row = {
        "imagery_id": str(imagery_id),
        "analysis_type": analysis_type.value,
        "query": query,
        "status": "queued",
    }

    try:
        response = client.table(TABLE).insert(row).execute()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Supabase insert failed for analysis_jobs")
        raise SupabaseError("Failed to create analysis job.") from exc

    if not response.data:
        raise SupabaseError("Analysis job insert returned no data.")

    return response.data[0]


def get_job(job_id: str) -> dict:
    client = get_supabase()

    try:
        response = client.table(TABLE).select("*").eq("id", job_id).maybe_single().execute()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Supabase get failed for analysis_jobs %s", job_id)
        raise SupabaseError("Failed to fetch analysis job.") from exc

    if not response or not response.data:
        raise NotFoundError("JOB_NOT_FOUND", f"Analysis job '{job_id}' was not found.")

    return response.data
