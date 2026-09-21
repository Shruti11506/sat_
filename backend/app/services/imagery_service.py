"""Business logic for the imagery resource. No route or HTTP concerns here."""
import logging

from app.core.exceptions import NotFoundError, SupabaseError
from app.db.supabase import get_supabase
from app.schemas.imagery import ImageryCreate

logger = logging.getLogger(__name__)

TABLE = "imagery"


def create_imagery(payload: ImageryCreate) -> dict:
    client = get_supabase()
    row = payload.model_dump(mode="json", exclude_none=True)

    try:
        response = client.table(TABLE).insert(row).execute()
    except Exception as exc:  # noqa: BLE001 - translate any client/network failure
        logger.exception("Supabase insert failed for imagery")
        raise SupabaseError("Failed to register imagery.") from exc

    if not response.data:
        raise SupabaseError("Imagery insert returned no data.")

    return response.data[0]


def list_imagery(page: int, page_size: int) -> tuple[list[dict], int]:
    client = get_supabase()
    start = (page - 1) * page_size
    end = start + page_size - 1

    try:
        response = (
            client.table(TABLE)
            .select("*", count="exact")
            .order("created_at", desc=True)
            .range(start, end)
            .execute()
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Supabase list failed for imagery")
        raise SupabaseError("Failed to list imagery.") from exc

    return response.data or [], response.count or 0


def get_imagery(imagery_id: str) -> dict:
    client = get_supabase()

    try:
        response = client.table(TABLE).select("*").eq("id", imagery_id).maybe_single().execute()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Supabase get failed for imagery %s", imagery_id)
        raise SupabaseError("Failed to fetch imagery.") from exc

    if not response or not response.data:
        raise NotFoundError("IMAGE_NOT_FOUND", f"Imagery '{imagery_id}' was not found.")

    return response.data


def delete_imagery(imagery_id: str) -> None:
    # Confirms existence first so callers get a proper 404 instead of a silent no-op.
    get_imagery(imagery_id)

    client = get_supabase()
    try:
        client.table(TABLE).delete().eq("id", imagery_id).execute()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Supabase delete failed for imagery %s", imagery_id)
        raise SupabaseError("Failed to delete imagery.") from exc
