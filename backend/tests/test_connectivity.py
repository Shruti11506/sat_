import httpx
import pytest

from app.core.config import Settings
from app.db.supabase import execute_read
from tests.fakes import FakeQuery

PREFLIGHT_HEADERS = {
    "Access-Control-Request-Method": "GET",
    "Access-Control-Request-Headers": "content-type",
}


# ---- CORS ---------------------------------------------------------------

@pytest.mark.parametrize(
    "origin", ["http://localhost:5173", "http://localhost:5176", "http://127.0.0.1:5176"]
)
def test_preflight_allows_local_frontend_on_any_port_in_development(client, origin):
    # `npm run dev` moves to 5174, 5175, ... when 5173 is busy; a preflight
    # rejected there made the sidebar show "Unable to load conversation history."
    response = client.options("/api/v1/conversations", headers={"Origin": origin, **PREFLIGHT_HEADERS})
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin


@pytest.mark.parametrize("origin", ["https://evil.example.com", "http://localhost.evil.com"])
def test_preflight_rejects_non_local_origins(client, origin):
    response = client.options("/api/v1/conversations", headers={"Origin": origin, **PREFLIGHT_HEADERS})
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_production_uses_explicit_cors_origins_only():
    assert Settings(APP_ENV="production").cors_origin_regex is None
    assert Settings(APP_ENV="development").cors_origin_regex is not None


# ---- Dropped Supabase connection ---------------------------------------------

class _FlakyQuery:
    def __init__(self, failures):
        self.failures = failures
        self.calls = 0

    def execute(self):
        self.calls += 1
        if self.calls <= self.failures:
            raise httpx.RemoteProtocolError("Server disconnected")
        return "ok"


@pytest.fixture
def pauses(monkeypatch):
    slept = []
    monkeypatch.setattr("app.db.supabase.time.sleep", slept.append)
    return slept


def test_execute_read_retries_after_dropped_connection(pauses):
    query = _FlakyQuery(failures=1)
    assert execute_read(query) == "ok"
    assert query.calls == 2
    assert pauses == [0.25]  # paused before retrying, so a fresh connection is used


def test_execute_read_survives_two_drops(pauses):
    # Both concurrent sidebar reads can hit the dying HTTP/2 connection, and
    # an immediate retry could hit it too (seen on a fresh clone).
    query = _FlakyQuery(failures=2)
    assert execute_read(query) == "ok"
    assert query.calls == 3
    assert pauses == [0.25, 0.75]


def test_execute_read_gives_up_after_third_failure(pauses):
    query = _FlakyQuery(failures=3)
    with pytest.raises(httpx.RemoteProtocolError):
        execute_read(query)
    assert query.calls == 3


def _drop_first_connection(monkeypatch):
    original = FakeQuery.execute
    state = {"dropped": False}

    def flaky_execute(self):
        if not state["dropped"]:
            state["dropped"] = True
            raise httpx.RemoteProtocolError("Server disconnected")
        return original(self)

    monkeypatch.setattr(FakeQuery, "execute", flaky_execute)


def test_conversation_list_survives_dropped_connection(client, monkeypatch):
    _drop_first_connection(monkeypatch)
    response = client.get("/api/v1/conversations")
    assert response.status_code == 200
    assert response.json()["success"] is True


def test_history_survives_dropped_connection(client, monkeypatch):
    _drop_first_connection(monkeypatch)
    response = client.get("/api/v1/analysis/history")
    assert response.status_code == 200
    assert response.json()["success"] is True
