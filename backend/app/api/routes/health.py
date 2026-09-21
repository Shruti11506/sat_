"""Health check endpoints."""
import logging

from fastapi import APIRouter

from app.core.config import get_settings
from app.db.supabase import get_supabase
from app.schemas.common import ApiResponse, ErrorDetail

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/health", tags=["Health"])


@router.get(
    "",
    response_model=ApiResponse[dict],
    summary="Service liveness check",
)
def health() -> ApiResponse[dict]:
    settings = get_settings()
    return ApiResponse.ok(
        {
            "status": "healthy",
            "service": "satquery-backend",
            "version": settings.APP_VERSION,
        }
    )


@router.get(
    "/supabase",
    response_model=ApiResponse[dict],
    summary="Verify backend-to-Supabase connectivity (performs a real PostgreSQL query)",
)
def health_supabase() -> ApiResponse[dict]:
    try:
        client = get_supabase()
        # A real authenticated round trip through PostgREST -> Postgres, not just a URL check.
        client.table("imagery").select("id", count="exact").limit(1).execute()
    except Exception:  # noqa: BLE001 - deliberately broad: this IS the health check
        logger.exception("Supabase database health check failed")
        return ApiResponse(
            success=False,
            data={"status": "disconnected"},
            error=ErrorDetail(
                code="SUPABASE_CONNECTION_ERROR", message="Unable to connect to Supabase."
            ),
        )

    return ApiResponse.ok({"status": "connected", "provider": "supabase"})


@router.get(
    "/storage",
    response_model=ApiResponse[dict],
    summary="Verify backend-to-Supabase Storage connectivity",
)
def health_storage() -> ApiResponse[dict]:
    settings = get_settings()
    bucket_name = settings.SUPABASE_STORAGE_BUCKET

    try:
        client = get_supabase()
        # Cheap, read-only: lists (doesn't upload/delete) to prove bucket access.
        client.storage.from_(bucket_name).list(path="", options={"limit": 1})
    except Exception:  # noqa: BLE001 - deliberately broad: this IS the health check
        logger.exception("Supabase storage health check failed")
        return ApiResponse(
            success=False,
            data={"status": "disconnected", "bucket": bucket_name},
            error=ErrorDetail(
                code="SUPABASE_STORAGE_ERROR",
                message="Unable to access the Supabase Storage bucket.",
            ),
        )

    return ApiResponse.ok({"status": "connected", "bucket": bucket_name})
