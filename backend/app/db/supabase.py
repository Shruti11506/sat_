"""Centralized Supabase client access.

Routes and services must never construct a Supabase client themselves --
always go through `get_supabase()` so credential handling stays in one place.
"""
import logging
from functools import lru_cache

import httpx
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


def execute_read(query):
    """Execute a READ query, retrying once if the pooled connection was dropped.

    The cached client reuses one HTTP/2 connection; after it idles, Supabase can
    close it, and every request in flight on it fails with httpx
    RemoteProtocolError "Server disconnected" (seen live: GET /conversations
    returned 500 on the first load after idle). A second attempt opens a fresh
    connection. Reads only -- a write that failed mid-flight may already have
    been applied, so it must not be blindly repeated.
    """
    try:
        return query.execute()
    except httpx.TransportError:
        logger.warning("Supabase connection dropped mid-request; retrying read once")
        return query.execute()
