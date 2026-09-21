def test_health(client):
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "healthy"
    assert body["data"]["service"] == "satquery-backend"
    assert body["error"] is None


def test_health_supabase_connected(client):
    response = client.get("/api/v1/health/supabase")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "connected"
    assert body["data"]["provider"] == "supabase"
    assert body["error"] is None


def test_health_supabase_disconnected(client, monkeypatch):
    def broken_get_supabase():
        raise RuntimeError("simulated connection failure")

    monkeypatch.setattr("app.api.routes.health.get_supabase", broken_get_supabase)

    response = client.get("/api/v1/health/supabase")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert body["data"]["status"] == "disconnected"
    assert body["error"]["code"] == "SUPABASE_CONNECTION_ERROR"
    # Never leak internals in the error message.
    assert "simulated connection failure" not in body["error"]["message"]


def test_health_storage_connected(client):
    response = client.get("/api/v1/health/storage")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "connected"
    assert body["data"]["bucket"] == "satquery-data"
    assert body["error"] is None


def test_health_storage_disconnected(client, monkeypatch):
    def broken_get_supabase():
        raise RuntimeError("simulated storage failure")

    monkeypatch.setattr("app.api.routes.health.get_supabase", broken_get_supabase)

    response = client.get("/api/v1/health/storage")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert body["data"]["status"] == "disconnected"
    assert body["error"]["code"] == "SUPABASE_STORAGE_ERROR"
