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
    assert body["data"]["supabase"] == "connected"
    assert body["data"]["database"] == "connected"
    assert body["data"]["storage"] == "connected"
    assert body["data"]["bucket"] == "Satquery"
    assert body["error"] is None


def test_health_supabase_database_down(client, fake_supabase, monkeypatch):
    def broken_execute(*args, **kwargs):
        raise RuntimeError("simulated db failure")

    monkeypatch.setattr(
        "tests.fakes.FakeQuery.execute", broken_execute
    )

    response = client.get("/api/v1/health/supabase")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert body["data"]["database"] == "disconnected"
    assert body["data"]["storage"] == "connected"
    assert body["error"]["code"] == "SUPABASE_CONNECTION_ERROR"


def test_health_supabase_bucket_missing(client, fake_supabase):
    fake_supabase.storage.buckets.clear()  # simulate the configured bucket not existing

    response = client.get("/api/v1/health/supabase")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert body["data"]["database"] == "connected"
    assert body["data"]["storage"] == "disconnected"
    assert body["error"]["code"] == "SUPABASE_STORAGE_ERROR"
    # Never leak internals in the error message.
    assert "credential" not in body["error"]["message"].lower()


def test_health_storage_connected(client):
    response = client.get("/api/v1/health/storage")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "connected"
    assert body["data"]["bucket"] == "Satquery"
    assert body["error"] is None


def test_health_storage_bucket_missing(client, fake_supabase):
    fake_supabase.storage.buckets.clear()

    response = client.get("/api/v1/health/storage")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is False
    assert body["data"]["status"] == "disconnected"
    assert body["error"]["code"] == "SUPABASE_STORAGE_ERROR"
