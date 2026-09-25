"""Business logic for the profile / analytics page.

Identity: this SIH prototype has no login and exactly one workspace profile
(enforced in the database, see migrations/0004). `get_current_profile` is the
ONLY place the acting profile is determined, and it never reads anything the
client sends -- adding real auth later means changing just that function
(plus user_id scoping in the aggregation).

Numbers: every aggregate comes from the `profile_dashboard()` Postgres
function in one round trip (COUNT / GROUP BY run in the database). This
module only derives streaks from the per-day counts and keyword categories
(usage_classifier) from the grouped rows. Nothing is sampled, estimated or
filled in: no data means zeros and empty lists.
"""
import logging
import re
import uuid
from collections import Counter
from datetime import date, datetime, timedelta, timezone

from app.core.config import get_settings
from app.core.exceptions import (
    SchemaNotMigratedError,
    StorageError,
    SupabaseError,
    ValidationAppError,
)
from app.db.supabase import execute_read, get_supabase
from app.schemas.profile import ProfileUpdate
from app.services import storage_service, usage_classifier

logger = logging.getLogger(__name__)

TABLE = "profiles"
RECENT_ACTIVITY_LIMIT = 10

AVATAR_PREFIX = "avatars"
AVATAR_MAX_BYTES = 5 * 1024 * 1024
AVATAR_CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}

USERNAME_RE = re.compile(r"[a-z0-9_]{3,30}")
DISPLAY_NAME_MAX = 60
HEADLINE_MAX = 60
BIO_MAX = 160

# Only used if the seeded profile row is missing (e.g. deleted by hand): a
# neutral placeholder the user renames via Edit Profile, not a real identity.
DEFAULT_PROFILE = {"display_name": "SatQuery Explorer", "username": "explorer"}

MIGRATION_HINT = (
    "Profile analytics are not set up yet: apply "
    "backend/supabase/migrations/0004_profile_analytics.sql in the Supabase SQL editor."
)
# PostgREST: missing table / missing function; Postgres: undefined table / function.
_MISSING_SCHEMA_CODES = {"PGRST205", "PGRST202", "42P01", "42883"}


def _raise_supabase(exc: Exception, message: str):
    if getattr(exc, "code", None) in _MISSING_SCHEMA_CODES:
        raise SchemaNotMigratedError(MIGRATION_HINT) from exc
    raise SupabaseError(message) from exc


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---- Profile record ------------------------------------------------------------

def _select_profile(client) -> dict | None:
    try:
        response = execute_read(client.table(TABLE).select("*").order("created_at").limit(1))
    except Exception as exc:  # noqa: BLE001
        logger.exception("Supabase read failed for profiles")
        _raise_supabase(exc, "Failed to load profile.")
    return (response.data or [None])[0]


def get_current_profile() -> dict:
    """The profile this request acts as: the single workspace profile."""
    client = get_supabase()
    row = _select_profile(client)
    if row:
        return row

    now = _now()
    try:
        response = client.table(TABLE).insert({**DEFAULT_PROFILE, "created_at": now, "updated_at": now}).execute()
    except Exception as exc:  # noqa: BLE001
        # A concurrent request may have created it first (profiles_singleton).
        row = _select_profile(client)
        if row:
            return row
        logger.exception("Supabase insert failed for profiles")
        _raise_supabase(exc, "Failed to create profile.")
    if not response.data:
        raise SupabaseError("Profile insert returned no data.")
    return response.data[0]


def profile_timezone(profile: dict) -> str:
    return profile.get("timezone") or get_settings().APP_TIMEZONE


def to_public_user(profile: dict) -> dict:
    return {
        "id": profile["id"],
        "username": profile["username"],
        "display_name": profile["display_name"],
        "headline": profile.get("headline"),
        "bio": profile.get("bio"),
        "plan": profile.get("plan") or "free",
        "avatar_url": storage_service.resolve_url(get_supabase(), profile.get("avatar_path")),
        "timezone": profile_timezone(profile),
    }


def _update(profile_id: str, changes: dict) -> dict:
    client = get_supabase()
    try:
        response = (
            client.table(TABLE)
            .update({**changes, "updated_at": _now()})
            .eq("id", profile_id)
            .execute()
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Supabase update failed for profile %s", profile_id)
        _raise_supabase(exc, "Failed to update profile.")
    if not response.data:
        raise SupabaseError("Profile update returned no data.")
    return response.data[0]


def _optional_text(value: str | None, limit: int, code: str, label: str) -> str | None:
    cleaned = " ".join((value or "").split())
    if len(cleaned) > limit:
        raise ValidationAppError(code, f"{label} must be at most {limit} characters.")
    return cleaned or None


def update_profile(profile: dict, payload: ProfileUpdate) -> dict:
    data = payload.model_dump(exclude_unset=True)
    changes: dict = {}

    if "display_name" in data:
        name = " ".join((data["display_name"] or "").split())
        if not name or len(name) > DISPLAY_NAME_MAX:
            raise ValidationAppError(
                "INVALID_DISPLAY_NAME", f"Display name must be 1-{DISPLAY_NAME_MAX} characters."
            )
        changes["display_name"] = name

    if "username" in data:
        username = (data["username"] or "").strip().lstrip("@").lower()
        if not USERNAME_RE.fullmatch(username):
            raise ValidationAppError(
                "INVALID_USERNAME",
                "Username must be 3-30 characters: lowercase letters, digits or underscores.",
            )
        changes["username"] = username

    if "headline" in data:
        changes["headline"] = _optional_text(data["headline"], HEADLINE_MAX, "INVALID_HEADLINE", "Headline")

    if "bio" in data:
        # Bio keeps its own line breaks trimmed, not collapsed into one line.
        bio = (data["bio"] or "").strip()
        if len(bio) > BIO_MAX:
            raise ValidationAppError("INVALID_BIO", f"Bio must be at most {BIO_MAX} characters.")
        changes["bio"] = bio or None

    if not changes:
        return profile
    return _update(profile["id"], changes)


def set_avatar(profile: dict, *, filename: str, content_type: str | None, content: bytes) -> dict:
    extension = storage_service.get_extension(filename or "")
    if extension not in AVATAR_CONTENT_TYPES:
        raise ValidationAppError("UNSUPPORTED_FILE_TYPE", "Profile photos must be JPG, PNG or WEBP.")
    if not content:
        raise ValidationAppError("EMPTY_FILE", "The uploaded file is empty.")
    if len(content) > AVATAR_MAX_BYTES:
        raise ValidationAppError("FILE_TOO_LARGE", "Profile photos must be 5 MB or smaller.")

    resolved_type = content_type if (content_type or "").startswith("image/") else AVATAR_CONTENT_TYPES[extension]
    old_path = profile.get("avatar_path")
    path = f"{AVATAR_PREFIX}/{profile['id']}/{uuid.uuid4().hex}{extension}"
    client = get_supabase()
    storage_service.upload_file(client, path, content, resolved_type)

    try:
        updated = _update(profile["id"], {"avatar_path": path})
    except Exception:
        # Don't leave an unreferenced file behind.
        _delete_avatar_file(client, path)
        raise

    _delete_avatar_file(client, old_path)
    return updated


def remove_avatar(profile: dict) -> dict:
    old_path = profile.get("avatar_path")
    if not old_path:
        return profile
    updated = _update(profile["id"], {"avatar_path": None})
    _delete_avatar_file(get_supabase(), old_path)
    return updated


def _delete_avatar_file(client, path: str | None) -> None:
    """Best-effort: the profile row is already consistent without this file."""
    if not path:
        return
    try:
        storage_service.delete_file(client, path)
    except StorageError:
        logger.warning("Could not delete old avatar object %s -- orphaned file", path)


# ---- Analytics -------------------------------------------------------------------

def _aggregates(profile: dict) -> dict:
    client = get_supabase()
    try:
        response = execute_read(
            client.rpc(
                "profile_dashboard",
                {"p_timezone": profile_timezone(profile), "p_recent_limit": RECENT_ACTIVITY_LIMIT},
            )
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("profile_dashboard() failed")
        _raise_supabase(exc, "Failed to load profile analytics.")
    return response.data or {}


def compute_streaks(active_days: list[date], today: date) -> tuple[int, int]:
    """(current, longest) runs of consecutive active days.

    The current streak ends today -- or yesterday while today has no query
    yet, since the day isn't over. Days after `today` (clock skew) are ignored.
    """
    days = sorted({d for d in active_days if d <= today})
    longest = run = 0
    previous: date | None = None
    for day in days:
        run = run + 1 if previous and (day - previous).days == 1 else 1
        longest = max(longest, run)
        previous = day

    active = set(days)
    cursor = today if today in active else today - timedelta(days=1)
    current = 0
    while cursor in active:
        current += 1
        cursor -= timedelta(days=1)
    return current, longest


def activity_window(counts: dict[date, int], today: date) -> tuple[date, list[dict]]:
    """Every day of the last year, zeros included, starting on a Sunday so the
    heatmap's week columns line up."""
    start = today - timedelta(days=364)
    start -= timedelta(days=(start.weekday() + 1) % 7)
    days = []
    cursor = start
    while cursor <= today:
        days.append({"date": cursor, "query_count": counts.get(cursor, 0)})
        cursor += timedelta(days=1)
    return start, days


def _most_common(counter: Counter, order: list[str]) -> str | None:
    """Key with the highest count; ties broken by `order` so results are stable."""
    candidates = [key for key in order if counter.get(key, 0) > 0]
    if not candidates:
        return None
    return max(candidates, key=lambda key: (counter[key], -order.index(key)))


def build_dashboard(profile: dict) -> dict:
    agg = _aggregates(profile)
    today = date.fromisoformat(agg["today"]) if agg.get("today") else datetime.now(timezone.utc).date()
    totals = agg.get("totals") or {}
    total_queries = int(totals.get("total_queries") or 0)
    scenes_uploaded = int(agg.get("scenes_uploaded") or 0)
    scenes_analyzed = int(totals.get("scenes_analyzed") or 0)

    counts = {
        date.fromisoformat(row["date"]): int(row["query_count"])
        for row in agg.get("active_days") or []
    }
    current_streak, longest_streak = compute_streaks(list(counts), today)
    activity_start, activity = activity_window(counts, today)

    task_counts: Counter = Counter()
    feature_counts: Counter = Counter()
    for group in agg.get("query_groups") or []:
        n = int(group.get("count") or 0)
        task_counts[usage_classifier.classify_task(group.get("query"), group.get("analysis_type"))] += n
        for feature in usage_classifier.features_for_query(group.get("query"), group.get("analysis_type")):
            feature_counts[feature] += n

    scenes_by_type: Counter = Counter()
    queries_by_type: Counter = Counter()
    for scene in agg.get("scenes") or []:
        key = usage_classifier.classify_data_type(
            name=scene.get("name"),
            original_filename=scene.get("original_filename"),
            sensor=scene.get("sensor"),
            source=scene.get("source"),
            mime_type=scene.get("mime_type"),
        )
        scenes_by_type[key] += 1
        queries_by_type[key] += int(scene.get("query_count") or 0)

    remote_sensing_usage = [
        {
            "data_type": key,
            "label": usage_classifier.DATA_TYPE_LABELS[key],
            "scenes": scenes_by_type[key],
            "percentage": round(100 * scenes_by_type[key] / scenes_uploaded, 1) if scenes_uploaded else 0.0,
            "query_count": queries_by_type[key],
        }
        for key in usage_classifier.DATA_TYPE_ORDER
        # The four real data types always show (0 included); "Unclassified" only when it applies.
        if key != "unclassified" or scenes_by_type[key]
    ]

    classified_order = [k for k in usage_classifier.DATA_TYPE_ORDER if k != "unclassified"]
    top_type = _most_common(scenes_by_type, classified_order) or _most_common(scenes_by_type, ["unclassified"])
    top_task = _most_common(task_counts, list(usage_classifier.TASK_LABELS))

    recent_activity = []
    for row in agg.get("recent") or []:
        if row.get("kind") == "upload":
            activity_type = "Scene uploaded"
        else:
            activity_type = usage_classifier.TASK_LABELS[
                usage_classifier.classify_task(row.get("label"), row.get("analysis_type"))
            ]
        recent_activity.append({
            "id": row["id"],
            "kind": row.get("kind"),
            "activity_type": activity_type,
            "label": row.get("label") or "",
            "status": row.get("status") or "",
            "created_at": row["created_at"],
        })

    return {
        "user": to_public_user(profile),
        "stats": {
            "total_queries": total_queries,
            "scenes_analyzed": scenes_analyzed,
            "current_streak": current_streak,
            "longest_streak": longest_streak,
        },
        "activity": activity,
        "activity_start": activity_start,
        "activity_end": today,
        "insights": {
            "most_used_data_type": usage_classifier.DATA_TYPE_LABELS[top_type] if top_type else None,
            "most_common_task": usage_classifier.TASK_LABELS[top_task] if top_task else None,
            "total_queries": total_queries,
            "scenes_uploaded": scenes_uploaded,
            "scenes_analyzed": scenes_analyzed,
            "successful_analyses": int(totals.get("completed") or 0),
            "failed_analyses": int(totals.get("failed") or 0),
            "pending_analyses": int(totals.get("pending") or 0),
            "active_days": len(counts),
            "avg_queries_per_active_day": round(total_queries / len(counts), 1) if counts else None,
        },
        "features": [
            {"feature": feature, "query_count": n}
            for feature, n in sorted(feature_counts.items(), key=lambda item: (-item[1], item[0]))
        ],
        "remote_sensing_usage": remote_sensing_usage,
        "recent_activity": recent_activity,
    }
