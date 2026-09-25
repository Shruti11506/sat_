"""Imagery metadata + upload endpoints.

Registers and retrieves satellite imagery. `POST /imagery/upload` is the
real upload path the frontend uses (multipart file -> Supabase Storage ->
imagery metadata row); `POST /imagery` remains for metadata-only registration
when a file has already been placed in Storage some other way.
"""
import json
import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, File, Form, Query, UploadFile, status
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.core.exceptions import ValidationAppError
from app.db.supabase import get_supabase
from app.schemas.common import ApiResponse, PaginatedData, PaginationMeta
from app.schemas.imagery import (
    ImageryCreate,
    ImageryCreateResponse,
    ImageryDeleteResponse,
    ImageryOut,
    ImageryUploadResponse,
)
from app.services import conversation_service, imagery_service, raster_service, storage_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/imagery", tags=["Imagery"])


@router.post(
    "",
    response_model=ApiResponse[ImageryCreateResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Register satellite imagery metadata (no file upload)",
)
def create_imagery(payload: ImageryCreate) -> ApiResponse[ImageryCreateResponse]:
    row = imagery_service.create_imagery(payload)
    return ApiResponse.ok(ImageryCreateResponse(id=row["id"], name=row["name"]))


@router.post(
    "/upload",
    response_model=ApiResponse[ImageryUploadResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Upload a satellite image to Supabase Storage and register its metadata",
)
async def upload_imagery(
    file: UploadFile = File(...),
    name: str | None = Form(default=None),
    source: str | None = Form(default=None),
    sensor: str | None = Form(default=None),
    acquisition_date: datetime | None = Form(default=None),
    metadata: str | None = Form(default=None, description="JSON object, as a string"),
    conversation_id: UUID | None = Form(
        default=None,
        description="Conversation this upload belongs to. Never changes the conversation's title.",
    ),
) -> ApiResponse[ImageryUploadResponse]:
    parsed_metadata = None
    if metadata:
        try:
            parsed_metadata = json.loads(metadata)
        except json.JSONDecodeError as exc:
            raise ValidationAppError("INVALID_METADATA", "metadata must be valid JSON.") from exc
        if not isinstance(parsed_metadata, dict):
            raise ValidationAppError("INVALID_METADATA", "metadata must be a JSON object.")

    if conversation_id:
        # Checked before touching Storage so a bad id can't orphan an uploaded file.
        conversation_service.get_conversation(str(conversation_id))

    content = await file.read()
    resolved_content_type = storage_service.validate_upload(
        filename=file.filename or "", content_type=file.content_type, size=len(content)
    )

    storage_path = storage_service.build_storage_path(file.filename)
    settings = get_settings()
    client = get_supabase()

    logger.info(
        "Received upload: filename=%s content_type=%s size=%d bytes",
        file.filename,
        resolved_content_type,
        len(content),
    )

    # TIFF/GeoTIFF: real thumbnail + georeference read from the file, before
    # anything is stored, in a worker thread (CPU-bound). None when it can't be
    # parsed -- the upload then proceeds exactly as for any other file.
    raster = None
    if imagery_service.has_raster_source(storage_path):
        raster = await run_in_threadpool(raster_service.extract, content)

    # If this raises, no database record is created -- see storage_service.upload_file.
    storage_service.upload_file(client, storage_path, content, resolved_content_type)

    row = imagery_service.create_imagery_from_upload(
        name=name or file.filename,
        original_filename=file.filename,
        bucket=settings.SUPABASE_STORAGE_BUCKET,
        storage_path=storage_path,
        mime_type=resolved_content_type,
        file_size=len(content),
        source=source,
        sensor=sensor,
        acquisition_date=acquisition_date,
        metadata=parsed_metadata,
        conversation_id=str(conversation_id) if conversation_id else None,
        raster=raster,
    )
    if conversation_id:
        conversation_service.touch(str(conversation_id))

    # Last, so a failed DB insert above can't leave an orphaned thumbnail too.
    thumbnail_url = None
    if raster and raster.thumbnail_png and imagery_service.upload_thumbnail(client, storage_path, raster.thumbnail_png):
        thumbnail_url = imagery_service.resolve_thumbnail_url(client, storage_path)

    return ApiResponse.ok(
        ImageryUploadResponse(
            id=row["id"],
            name=row["name"],
            original_filename=row["original_filename"],
            bucket=row["bucket"],
            storage_path=row["storage_path"],
            mime_type=row["mime_type"],
            file_size=row["file_size"],
            conversation_id=row.get("conversation_id"),
            thumbnail_url=thumbnail_url,
            latitude=row.get("latitude"),
            longitude=row.get("longitude"),
            bbox=row.get("bbox"),
            cloud_cover=row.get("cloud_cover"),
        )
    )


@router.get(
    "",
    response_model=ApiResponse[PaginatedData[ImageryOut]],
    summary="List registered imagery",
)
def list_imagery(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
) -> ApiResponse[PaginatedData[ImageryOut]]:
    items, total = imagery_service.list_imagery(page=page, page_size=page_size)
    return ApiResponse.ok(
        PaginatedData(
            items=[ImageryOut(**item) for item in items],
            pagination=PaginationMeta(page=page, page_size=page_size, total=total),
        )
    )


@router.get(
    "/{imagery_id}",
    response_model=ApiResponse[ImageryOut],
    summary="Get imagery metadata by id, with a freshly-resolved access URL",
)
def get_imagery(imagery_id: UUID) -> ApiResponse[ImageryOut]:
    row = imagery_service.get_imagery_with_url(str(imagery_id))
    return ApiResponse.ok(ImageryOut(**row))


@router.delete(
    "/{imagery_id}",
    response_model=ApiResponse[ImageryDeleteResponse],
    summary="Delete an imagery record and its Storage object",
)
def delete_imagery(imagery_id: UUID) -> ApiResponse[ImageryDeleteResponse]:
    imagery_service.delete_imagery(str(imagery_id))
    return ApiResponse.ok(ImageryDeleteResponse(id=imagery_id))
