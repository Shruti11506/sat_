def _register_imagery(client, name="scene-for-history"):
    return client.post("/api/v1/imagery", json={"name": name}).json()["data"]["id"]


def test_history_empty(client):
    response = client.get("/api/v1/analysis/history")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"] == []


def test_history_reflects_real_jobs_most_recent_first(client):
    imagery_id = _register_imagery(client)

    client.post(
        "/api/v1/analysis",
        json={"imagery_id": imagery_id, "analysis_type": "vqa", "query": "First query"},
    )
    second = client.post(
        "/api/v1/analysis",
        json={"imagery_id": imagery_id, "analysis_type": "general_analysis", "query": "Second query"},
    ).json()["data"]

    response = client.get("/api/v1/analysis/history")
    assert response.status_code == 200
    items = response.json()["data"]
    assert len(items) == 2
    # Most recent first.
    assert items[0]["job_id"] == second["job_id"]
    assert items[0]["query"] == "Second query"
    assert items[0]["imagery_id"] == imagery_id
    assert items[0]["imagery_name"] == "scene-for-history"
    assert items[0]["status"] == "queued"


def test_history_survives_deleted_imagery(client, fake_supabase):
    imagery_id = _register_imagery(client, name="temp-scene")
    client.post(
        "/api/v1/analysis",
        json={"imagery_id": imagery_id, "analysis_type": "vqa", "query": "Still here?"},
    )

    # Simulate the imagery row being gone (e.g. deleted separately) without
    # going through the API's FK-guarded delete -- history must not 500.
    fake_supabase.store["imagery"] = [
        r for r in fake_supabase.store["imagery"] if r["id"] != imagery_id
    ]

    response = client.get("/api/v1/analysis/history")
    assert response.status_code == 200
    items = response.json()["data"]
    assert len(items) == 1
    assert items[0]["imagery_name"] is None


def test_history_respects_limit(client):
    imagery_id = _register_imagery(client)
    for i in range(3):
        client.post(
            "/api/v1/analysis",
            json={"imagery_id": imagery_id, "analysis_type": "vqa", "query": f"Query {i}"},
        )

    response = client.get("/api/v1/analysis/history?limit=2")
    assert response.status_code == 200
    assert len(response.json()["data"]) == 2
