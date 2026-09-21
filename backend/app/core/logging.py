"""Application-wide logging configuration."""
import logging
import sys


def configure_logging(app_env: str = "development") -> None:
    level = logging.DEBUG if app_env == "development" else logging.INFO

    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
        stream=sys.stdout,
    )

    # Never let noisy third-party loggers leak request/response bodies
    # (which could contain Supabase keys) at DEBUG level.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
