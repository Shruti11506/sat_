"""Imagery metadata endpoints.

Registers and retrieves satellite imagery *metadata* records. Does not
process, download, or transform the underlying raster files.
"""
from uuid import UUID

from fastapi import APIRouter, Query, status

from app.schemas.common import ApiResponse, PaginatedData, PaginationMeta
from app.schemas.imagery import ImageryCreate, ImageryCreateResponse, ImageryDeleteResponse, ImageryOut
from app.services import imagery_service

router = APIRouter(prefix="/imagery", tags=["Imagery"])


@router.post(
    "",
    response_model=ApiResponse[ImageryCreateResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Register satellite imagery metadata",
)
def create_imagery(payload: ImageryCreate) -> ApiResponse[ImageryCreateResponse]:
    row = imagery_service.create_imagery(payload)
    return ApiResponse.ok(ImageryCreateResponse(id=row["id"], name=row["name"]))


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
    summary="Get imagery metadata by id",
)
def get_imagery(imagery_id: UUID) -> ApiResponse[ImageryOut]:
    row = imagery_service.get_imagery(str(imagery_id))
    return ApiResponse.ok(ImageryOut(**row))


@router.delete(
    "/{imagery_id}",
    response_model=ApiResponse[ImageryDeleteResponse],
    summary="Unregister an imagery record",
)
def delete_imagery(imagery_id: UUID) -> ApiResponse[ImageryDeleteResponse]:
    imagery_service.delete_imagery(str(imagery_id))
    return ApiResponse.ok(ImageryDeleteResponse(id=imagery_id))
