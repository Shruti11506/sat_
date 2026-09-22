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


def list_history(limit: int = 50) -> list[dict]:
    """Analysis jobs joined with their imagery's name, most recent first.

    Retrieval only -- reflects exactly what's stored, never invents a title
    or status. Used by the sidebar/history UI as its sole data source.
    """
    client = get_supabase()

    try:
        response = (
            client.table(TABLE).select("*").order("created_at", desc=True).limit(limit).execute()
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Supabase list failed for analysis_jobs history")
        raise SupabaseError("Failed to list analysis history.") from exc

    jobs = response.data or []

    # One batched lookup for every distinct imagery_id, not one request per
    # job -- an N+1 pattern here previously fired dozens of rapid concurrent
    # requests against the shared Supabase client and intermittently tripped
    # a Cloudflare-level 400 under load (observed live with ~15 history rows).
    imagery_ids = list({job["imagery_id"] for job in jobs if job.get("imagery_id")})
    names_by_id: dict[str, str] = {}
    if imagery_ids:
        try:
            imagery_rows = (
                client.table("imagery").select("id,name").in_("id", imagery_ids).execute()
            )
            names_by_id = {row["id"]: row["name"] for row in (imagery_rows.data or [])}
        except Exception:  # noqa: BLE001 - name enrichment is best-effort, never fails the whole list
            logger.exception("Failed to batch-fetch imagery names for history")

    return [
        {**job, "job_id": job["id"], "imagery_name": names_by_id.get(job["imagery_id"])}
        for job in jobs
    ]
