"""Health check endpoints."""
import logging

from fastapi import APIRouter

from app.core.config import get_settings
from app.core.exceptions import SupabaseNotConfiguredError
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


def _check_database(client) -> bool:
    try:
        # A real authenticated round trip through PostgREST -> Postgres, not just a URL check.
        client.table("imagery").select("id", count="exact").limit(1).execute()
        return True
    except Exception:  # noqa: BLE001 - deliberately broad: this IS the health check
        logger.exception("Supabase database health check failed")
        return False


def _check_storage(client, bucket_name: str) -> bool:
    try:
        # get_bucket (not list()) is required here: list() on a bucket name
        # that doesn't exist returns [] instead of raising, which previously
        # made this check falsely report "connected" for a nonexistent bucket.
        client.storage.get_bucket(bucket_name)
        return True
    except Exception:  # noqa: BLE001 - deliberately broad: this IS the health check
        logger.exception("Supabase storage health check failed for bucket %s", bucket_name)
        return False


@router.get(
    "/supabase",
    response_model=ApiResponse[dict],
    summary="Verify Supabase connectivity: client, database, and the imagery Storage bucket",
)
def health_supabase() -> ApiResponse[dict]:
    settings = get_settings()
    bucket_name = settings.SUPABASE_STORAGE_BUCKET

    try:
        client = get_supabase()
    except SupabaseNotConfiguredError as exc:
        # A setup problem on this machine (backend/.env), not an outage -- say exactly what's wrong.
        return ApiResponse(
            success=False,
            data={"supabase": "not_configured", "database": "not_configured", "storage": "not_configured", "bucket": bucket_name},
            error=ErrorDetail(code=exc.code, message=exc.message),
        )
    except Exception:  # noqa: BLE001
        logger.exception("Supabase client could not be constructed")
        return ApiResponse(
            success=False,
            data={"supabase": "disconnected", "database": "disconnected", "storage": "disconnected", "bucket": bucket_name},
            error=ErrorDetail(code="SUPABASE_CONNECTION_ERROR", message="Unable to connect to Supabase."),
        )

    db_ok = _check_database(client)
    storage_ok = _check_storage(client, bucket_name)

    data = {
        "supabase": "connected" if (db_ok and storage_ok) else "degraded",
        "database": "connected" if db_ok else "disconnected",
        "storage": "connected" if storage_ok else "disconnected",
        "bucket": bucket_name,
    }

    if db_ok and storage_ok:
        return ApiResponse.ok(data)

    if not db_ok and not storage_ok:
        error = ErrorDetail(code="SUPABASE_CONNECTION_ERROR", message="Unable to reach the Supabase database or Storage bucket.")
    elif not db_ok:
        error = ErrorDetail(code="SUPABASE_CONNECTION_ERROR", message="Unable to connect to the Supabase database.")
    else:
        error = ErrorDetail(code="SUPABASE_STORAGE_ERROR", message=f"Unable to access the Supabase Storage bucket '{bucket_name}'.")

    return ApiResponse(success=False, data=data, error=error)


@router.get(
    "/storage",
    response_model=ApiResponse[dict],
    summary="Verify backend-to-Supabase Storage connectivity",
)
def health_storage() -> ApiResponse[dict]:
    settings = get_settings()
    bucket_name = settings.SUPABASE_STORAGE_BUCKET
    client = get_supabase()

    if _check_storage(client, bucket_name):
        return ApiResponse.ok({"status": "connected", "bucket": bucket_name})

    return ApiResponse(
        success=False,
        data={"status": "disconnected", "bucket": bucket_name},
        error=ErrorDetail(
            code="SUPABASE_STORAGE_ERROR",
            message="Unable to access the Supabase Storage bucket.",
        ),
    )
