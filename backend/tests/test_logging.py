import logging

import pytest

from app.core.logging import configure_logging


@pytest.mark.parametrize("app_env", ["development", "production"])
def test_http_header_loggers_never_emit_debug(app_env):
    # These loggers print request headers (incl. the Supabase apikey /
    # authorization header) at DEBUG, so they must stay silenced even in
    # development mode.
    configure_logging(app_env)
    for name in ("httpx", "httpcore", "hpack", "h2"):
        assert not logging.getLogger(name).isEnabledFor(logging.DEBUG), name
