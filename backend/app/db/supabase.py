"""Centralized Supabase client access.

Routes and services must never construct a Supabase client themselves --
always go through `get_supabase()` so credential handling stays in one place.
"""
import base64
import json
import logging
import time
from functools import lru_cache

import httpx
from supabase import Client, create_client

from app.core.config import get_settings
from app.core.exceptions import SupabaseError, SupabaseNotConfiguredError

logger = logging.getLogger(__name__)

# execute_read: pause before each retry of a dropped read (2 retries).
READ_RETRY_PAUSES_S = (0.25, 0.75)

NOT_CONFIGURED_MESSAGE = (
    "Supabase is not configured: backend/.env needs SUPABASE_URL and SUPABASE_SECRET_KEY "
    "(copy backend/.env.example to backend/.env and fill in the project's values -- see README.md)."
)
WRONG_KEY_MESSAGE = (
    "SUPABASE_SECRET_KEY in backend/.env is the publishable/anon key. The backend needs the "
    "project's secret (service_role) key: with the publishable key Row Level Security makes every "
    "table read as empty, so history would silently show nothing."
)


def secret_key_kind(key: str) -> str:
    """Which kind of Supabase API key this is, from its format alone (never logged).

    "secret" / "service_role" work for the backend; "publishable" / "anon"
    are browser keys that RLS locks out of every table.
    """
    key = (key or "").strip()
    if key.startswith("sb_secret_"):
        return "secret"
    if key.startswith("sb_publishable_"):
        return "publishable"
    if key.count(".") == 2:  # legacy JWT key: the role is in its payload
        try:
            payload = key.split(".")[1]
            payload += "=" * (-len(payload) % 4)
            return json.loads(base64.urlsafe_b64decode(payload)).get("role") or "unknown"
        except (ValueError, json.JSONDecodeError):
            return "unknown"
    return "unknown"


def supabase_config_problem(settings=None) -> str | None:
    """Why the configured Supabase credentials can't work, or None if they look usable."""
    settings = settings or get_settings()
    url, key = settings.SUPABASE_URL.strip(), settings.SUPABASE_SECRET_KEY.strip()
    if not url or not key or url.startswith("YOUR_") or key.startswith("YOUR_"):
        return NOT_CONFIGURED_MESSAGE
    if secret_key_kind(key) in ("publishable", "anon"):
        return WRONG_KEY_MESSAGE
    return None


@lru_cache
def get_supabase() -> Client:
    settings = get_settings()

    problem = supabase_config_problem(settings)
    if problem:
        raise SupabaseNotConfiguredError(problem)

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

    Up to two retries, with a short pause first: the sidebar's two history
    reads run concurrently on the same HTTP/2 connection, and an IMMEDIATE
    retry could land on that dying connection too (seen on a fresh clone:
    both reads and both retries failed -> "Unable to load conversation
    history."). The pause lets httpx retire it and open a new connection.
    """
    for attempt, pause in enumerate(READ_RETRY_PAUSES_S):
        try:
            return query.execute()
        except httpx.TransportError:
            logger.warning("Supabase connection dropped mid-request; retrying read (%d)", attempt + 1)
            time.sleep(pause)
    return query.execute()
