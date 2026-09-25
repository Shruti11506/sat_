"""Business logic for the imagery resource. No route or HTTP concerns here."""
import logging
from datetime import datetime
from typing import Any

from app.core.config import get_settings
from app.core.exceptions import NotFoundError, StorageError, SupabaseError
from app.db.supabase import get_supabase
from app.schemas.imagery import ImageryCreate
from app.services import raster_service, storage_service

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


def create_imagery_from_upload(
    *,
    name: str,
    original_filename: str,
    bucket: str,
    storage_path: str,
    mime_type: str,
    file_size: int,
    source: str | None,
    sensor: str | None,
    acquisition_date: datetime | None,
    metadata: dict[str, Any] | None,
    conversation_id: str | None = None,
    raster: raster_service.RasterInfo | None = None,
) -> dict:
    """Insert the imagery metadata row after a successful Storage upload.

    Must only be called once storage_service.upload_file() has succeeded --
    this never uploads anything itself, it only persists metadata.
    """
    client = get_supabase()
    row: dict[str, Any] = {
        "name": name,
        "original_filename": original_filename,
        "bucket": bucket,
        "storage_path": storage_path,
        "mime_type": mime_type,
        "file_size": file_size,
        "source": source,
        "sensor": sensor,
        "acquisition_date": acquisition_date.isoformat() if acquisition_date else None,
        "metadata": metadata,
    }
    if conversation_id:
        row["conversation_id"] = conversation_id
    if raster:
        # Only what the file itself carries; absent values stay NULL.
        for column in ("latitude", "longitude", "bbox", "cloud_cover"):
            value = getattr(raster, column)
            if value is not None:
                row[column] = value

    try:
        response = client.table(TABLE).insert(row).execute()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Supabase insert failed for uploaded imagery %s/%s", bucket, storage_path)
        raise SupabaseError("Image uploaded to Storage but failed to save its metadata.") from exc

    if not response.data:
        raise SupabaseError("Imagery insert returned no data.")

    created = response.data[0]
    logger.info("Database record created for imagery id=%s", created.get("id"))
    return created


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


def has_raster_source(storage_path: str | None) -> bool:
    """TIFF uploads are the only ones that ever get a generated thumbnail."""
    return bool(storage_path) and storage_service.get_extension(storage_path) in storage_service.RASTER_EXTENSIONS


def resolve_thumbnail_url(client, storage_path: str | None) -> str | None:
    """Signed URL of the generated PNG thumbnail, or None if there isn't one
    (non-TIFF, a record from before thumbnails, or a file that couldn't be parsed)."""
    if not has_raster_source(storage_path):
        return None
    return storage_service.resolve_url(client, raster_service.thumbnail_path_for(storage_path), missing_ok=True)


def upload_thumbnail(client, storage_path: str, png: bytes) -> bool:
    """Best-effort: a failure leaves the upload without a thumbnail, nothing more."""
    try:
        storage_service.upload_file(client, raster_service.thumbnail_path_for(storage_path), png, "image/png")
        return True
    except Exception:  # noqa: BLE001
        logger.warning("Thumbnail upload failed for %s; the original is stored and unaffected", storage_path)
        return False


def get_imagery_with_url(imagery_id: str) -> dict:
    row = get_imagery(imagery_id)
    client = get_supabase()
    row = dict(row)
    row["url"] = storage_service.resolve_url(client, row.get("storage_path"))
    row["thumbnail_url"] = resolve_thumbnail_url(client, row.get("storage_path"))
    return row


def delete_imagery(imagery_id: str) -> None:
    # Confirms existence first so callers get a proper 404 instead of a silent no-op.
    row = get_imagery(imagery_id)

    client = get_supabase()
    storage_path = row.get("storage_path")

    # DB delete runs FIRST, deliberately -- not storage-first. imagery.id has
    # an incoming FK from analysis_jobs.imagery_id, so the DB delete can fail
    # (e.g. a job still references this image) for reasons having nothing to
    # do with Storage. Deleting the Storage object before confirming the DB
    # delete would succeed risks exactly the orphaned-record state the spec
    # warns against: a DB row whose storage_path points at a file that's
    # already gone. Running the DB delete first means a blocked delete (FK
    # violation, etc.) leaves both sides untouched and consistent.
    try:
        client.table(TABLE).delete().eq("id", imagery_id).execute()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Supabase delete failed for imagery %s", imagery_id)
        raise SupabaseError("Failed to delete imagery.") from exc

    if storage_path:
        try:
            storage_service.delete_file(client, storage_path)
        except StorageError:
            # The DB record is already gone at this point -- the Storage
            # object is now orphaned. There is no distributed transaction
            # across Postgres and Storage to roll back with, so this is
            # logged loudly for manual cleanup rather than silently retried.
            logger.error(
                "Imagery record %s was deleted but its Storage object %s/%s could NOT be "
                "deleted -- orphaned file, needs manual cleanup.",
                imagery_id,
                get_settings().SUPABASE_STORAGE_BUCKET,
                storage_path,
            )
            raise

        if has_raster_source(storage_path):
            try:
                storage_service.delete_file(client, raster_service.thumbnail_path_for(storage_path))
            except StorageError:
                logger.error("Thumbnail for deleted imagery %s could not be removed -- orphaned file.", imagery_id)
