"""Business logic for retrieving analysis_results and evidence.

Retrieval only -- nothing here generates results, evidence, bounding boxes,
or confidence scores. If no AI result exists yet, callers get a 404.
"""
import logging

from app.core.exceptions import NotFoundError, SupabaseError
from app.db.supabase import get_supabase

logger = logging.getLogger(__name__)

RESULTS_TABLE = "analysis_results"
EVIDENCE_TABLE = "evidence"


def get_result(result_id: str) -> dict:
    client = get_supabase()

    try:
        response = (
            client.table(RESULTS_TABLE).select("*").eq("id", result_id).maybe_single().execute()
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Supabase get failed for analysis_results %s", result_id)
        raise SupabaseError("Failed to fetch analysis result.") from exc

    if not response or not response.data:
        raise NotFoundError("RESULT_NOT_FOUND", f"Result '{result_id}' was not found.")

    return response.data


def get_evidence(result_id: str) -> list[dict]:
    # Confirms the parent result exists so callers get RESULT_NOT_FOUND
    # instead of a silently empty list for a bad id.
    get_result(result_id)

    client = get_supabase()
    try:
        response = client.table(EVIDENCE_TABLE).select("*").eq("result_id", result_id).execute()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Supabase list failed for evidence of result %s", result_id)
        raise SupabaseError("Failed to fetch evidence.") from exc

    return response.data or []
