"""Centralized Supabase client access.

Routes and services must never construct a Supabase client themselves --
always go through `get_supabase()` so credential handling stays in one place.
"""
import logging
from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings
from app.core.exceptions import SupabaseError

logger = logging.getLogger(__name__)


@lru_cache
def get_supabase() -> Client:
    settings = get_settings()

    if not settings.SUPABASE_URL or not settings.SUPABASE_SECRET_KEY:
        raise SupabaseError(
            "Supabase is not configured: set SUPABASE_URL and SUPABASE_SECRET_KEY (see .env.example)."
        )

    try:
        return create_client(settings.SUPABASE_URL, settings.SUPABASE_SECRET_KEY)
    except Exception as exc:  # noqa: BLE001 - translate any client construction failure
        logger.exception("Failed to construct Supabase client")
        raise SupabaseError("Could not connect to Supabase with the configured credentials.") from exc
