"""Supabase Storage helpers.

Scope for this milestone: register/resolve storage paths for the
`satquery-data` bucket. Actual file upload and GeoTIFF processing are
out of scope -- see CLAUDE.md.
"""
from app.core.config import get_settings

# Conceptual folder layout inside the bucket, kept as constants so
# services/routes reference one source of truth instead of raw strings.
IMAGERY_PREFIX = "imagery/"
RESULTS_PREFIX = "results/"
EVIDENCE_PREFIX = "evidence/"
EXPORTS_PREFIX = "exports/"


def build_storage_path(prefix: str, filename: str) -> str:
    return f"{prefix.rstrip('/')}/{filename.lstrip('/')}"


def get_public_url(client, file_path: str) -> str | None:
    """Resolve a public URL for a file already stored in the bucket.

    Returns None if the file_path is empty -- callers should treat storage_url
    as optional metadata, not a guarantee the object exists.
    """
    if not file_path:
        return None

    settings = get_settings()
    bucket = client.storage.from_(settings.SUPABASE_STORAGE_BUCKET)
    result = bucket.get_public_url(file_path)
    return result if isinstance(result, str) else result.get("publicUrl") if result else None
