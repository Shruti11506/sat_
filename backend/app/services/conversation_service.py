"""Business logic for the conversations resource.

A conversation groups a chat's uploads (imagery.conversation_id) and queries
(analysis_jobs.conversation_id). Title rules:

* A new conversation is titled "New Chat" (title_source "default").
* Uploading files never changes the title.
* `generate_title` sets the title ONCE from the conversation's first
  meaningful query (title_source "auto"), and is a no-op afterwards.
* A manual rename sets title_source "user"; it is never overwritten.
"""
import logging
from datetime import datetime, timezone

from app.core.exceptions import NotFoundError, SupabaseError, ValidationAppError
from app.db.supabase import execute_read, get_supabase
from app.schemas.conversations import DEFAULT_CONVERSATION_TITLE, TitleSource
from app.services import imagery_service, storage_service, title_service

logger = logging.getLogger(__name__)

TABLE = "conversations"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_conversation() -> dict:
    client = get_supabase()
    now = _now()
    row = {
        "title": DEFAULT_CONVERSATION_TITLE,
        "title_source": TitleSource.DEFAULT.value,
        "created_at": now,
        "updated_at": now,
    }
    try:
        response = client.table(TABLE).insert(row).execute()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Supabase insert failed for conversations")
        raise SupabaseError("Failed to create conversation.") from exc

    if not response.data:
        raise SupabaseError("Conversation insert returned no data.")
    return response.data[0]


def list_conversations(limit: int = 100) -> list[dict]:
    """Most recently active first (updated_at is bumped by uploads and queries)."""
    client = get_supabase()
    try:
        response = execute_read(
            client.table(TABLE).select("*").order("updated_at", desc=True).limit(limit)
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Supabase list failed for conversations")
        raise SupabaseError("Failed to list conversations.") from exc
    return response.data or []


def get_conversation(conversation_id: str) -> dict:
    client = get_supabase()
    try:
        response = (
            client.table(TABLE).select("*").eq("id", conversation_id).maybe_single().execute()
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Supabase get failed for conversation %s", conversation_id)
        raise SupabaseError("Failed to fetch conversation.") from exc

    if not response or not response.data:
        raise NotFoundError(
            "CONVERSATION_NOT_FOUND", f"Conversation '{conversation_id}' was not found."
        )
    return response.data


def _select_for_conversation(table: str, conversation_id: str) -> list[dict]:
    client = get_supabase()
    try:
        response = (
            client.table(table)
            .select("*")
            .eq("conversation_id", conversation_id)
            .order("created_at")
            .execute()
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Supabase list failed for %s of conversation %s", table, conversation_id)
        raise SupabaseError(f"Failed to load conversation {table}.") from exc
    return response.data or []


def get_conversation_detail(conversation_id: str) -> dict:
    """The conversation plus its uploads (with fresh access URLs) and queries, oldest first."""
    conversation = get_conversation(conversation_id)
    client = get_supabase()
    imagery = [
        {**row, "url": storage_service.resolve_url(client, row.get("storage_path"))}
        for row in _select_for_conversation("imagery", conversation_id)
    ]
    jobs = _select_for_conversation("analysis_jobs", conversation_id)
    return {**conversation, "imagery": imagery, "jobs": jobs}


def _update(conversation_id: str, changes: dict) -> dict:
    client = get_supabase()
    try:
        response = client.table(TABLE).update(changes).eq("id", conversation_id).execute()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Supabase update failed for conversation %s", conversation_id)
        raise SupabaseError("Failed to update conversation.") from exc

    if not response.data:
        raise NotFoundError(
            "CONVERSATION_NOT_FOUND", f"Conversation '{conversation_id}' was not found."
        )
    return response.data[0]


def touch(conversation_id: str) -> None:
    """Bump updated_at so the conversation sorts to the top of the sidebar.

    Best-effort: the upload/query that triggered it has already succeeded.
    """
    try:
        _update(conversation_id, {"updated_at": _now()})
    except Exception:  # noqa: BLE001
        logger.exception("Failed to bump updated_at for conversation %s", conversation_id)


def rename_conversation(conversation_id: str, title: str) -> dict:
    cleaned = " ".join((title or "").split())
    if not cleaned:
        raise ValidationAppError("INVALID_TITLE", "Title cannot be empty.")
    get_conversation(conversation_id)
    return _update(conversation_id, {"title": cleaned, "title_source": TitleSource.USER.value})


def generate_title(conversation_id: str) -> dict:
    """Title the conversation from its FIRST meaningful query, exactly once.

    The query is read from the stored analysis_jobs rows rather than taken
    from the client, so the title always reflects the real first query no
    matter how often (or late) this is called. No-op once the title is
    "auto" or "user", or while there is no meaningful query yet.
    """
    conversation = get_conversation(conversation_id)
    if conversation.get("title_source") != TitleSource.DEFAULT.value:
        return conversation

    for job in _select_for_conversation("analysis_jobs", conversation_id):
        title = title_service.generate_conversation_title(job.get("query"))
        if title:
            return _update(
                conversation_id, {"title": title, "title_source": TitleSource.AUTO.value}
            )
    return conversation


def delete_conversation(conversation_id: str) -> None:
    """Delete the conversation with its queries and uploads (rows + Storage files).

    Order matters because of foreign keys: analysis_jobs -> imagery, so jobs
    go first, then each imagery (DB row, then Storage object -- see
    imagery_service.delete_imagery), then the conversation itself.
    """
    get_conversation(conversation_id)
    client = get_supabase()

    try:
        client.table("analysis_jobs").delete().eq("conversation_id", conversation_id).execute()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to delete analysis_jobs of conversation %s", conversation_id)
        raise SupabaseError("Failed to delete conversation queries.") from exc

    for row in _select_for_conversation("imagery", conversation_id):
        imagery_service.delete_imagery(row["id"])

    try:
        client.table(TABLE).delete().eq("id", conversation_id).execute()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Supabase delete failed for conversation %s", conversation_id)
        raise SupabaseError("Failed to delete conversation.") from exc
