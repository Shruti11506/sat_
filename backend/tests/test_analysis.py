def _register_imagery(client):
    response = client.post(
        "/api/v1/imagery",
        json={"name": "scene-for-analysis", "source": "Sentinel-2"},
    )
    return response.json()["data"]["id"]


def test_create_analysis(client):
    imagery_id = _register_imagery(client)

    response = client.post(
        "/api/v1/analysis",
        json={"imagery_id": imagery_id, "analysis_type": "vqa", "query": "What is visible?"},
    )
    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True
    assert body["data"]["status"] == "queued"
    assert "job_id" in body["data"]


def test_create_analysis_invalid_type(client):
    imagery_id = _register_imagery(client)

    response = client.post(
        "/api/v1/analysis",
        json={"imagery_id": imagery_id, "analysis_type": "not_a_real_type"},
    )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_create_analysis_imagery_not_found(client):
    response = client.post(
        "/api/v1/analysis",
        json={
            "imagery_id": "00000000-0000-0000-0000-000000000000",
            "analysis_type": "vqa",
        },
    )
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "IMAGE_NOT_FOUND"


def test_get_job(client):
    imagery_id = _register_imagery(client)
    job_id = client.post(
        "/api/v1/analysis",
        json={"imagery_id": imagery_id, "analysis_type": "general_analysis"},
    ).json()["data"]["job_id"]

    response = client.get(f"/api/v1/jobs/{job_id}")
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["id"] == job_id
    assert body["data"]["status"] == "queued"
    assert body["data"]["analysis_type"] == "general_analysis"


def test_get_job_not_found(client):
    response = client.get("/api/v1/jobs/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "JOB_NOT_FOUND"
