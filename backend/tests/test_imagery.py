def _register_imagery(client, name="sentinel_scene_001"):
    return client.post(
        "/api/v1/imagery",
        json={
            "name": name,
            "source": "Sentinel-2",
            "sensor": "MSI",
            "acquisition_date": "2026-09-20T10:30:00Z",
            "storage_path": "imagery/sample.tif",
        },
    )


def test_create_imagery(client):
    response = _register_imagery(client)
    assert response.status_code == 201
    body = response.json()
    assert body["success"] is True
    assert body["data"]["name"] == "sentinel_scene_001"
    assert body["data"]["status"] == "registered"
    assert body["error"] is None


def test_create_imagery_missing_name(client):
    response = client.post("/api/v1/imagery", json={"source": "Sentinel-2"})
    assert response.status_code == 422
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "VALIDATION_ERROR"


def test_list_imagery(client):
    _register_imagery(client, name="scene-a")
    _register_imagery(client, name="scene-b")

    response = client.get("/api/v1/imagery?page=1&page_size=20")
    assert response.status_code == 200
    body = response.json()
    assert body["success"] is True
    assert body["data"]["pagination"]["total"] == 2
    assert len(body["data"]["items"]) == 2


def test_get_imagery(client):
    created = _register_imagery(client).json()["data"]

    response = client.get(f"/api/v1/imagery/{created['id']}")
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["id"] == created["id"]
    assert body["data"]["name"] == "sentinel_scene_001"


def test_get_imagery_not_found(client):
    response = client.get("/api/v1/imagery/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "IMAGE_NOT_FOUND"


def test_get_imagery_invalid_uuid(client):
    response = client.get("/api/v1/imagery/not-a-uuid")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_delete_imagery(client):
    created = _register_imagery(client).json()["data"]

    response = client.delete(f"/api/v1/imagery/{created['id']}")
    assert response.status_code == 200
    assert response.json()["data"]["status"] == "deleted"

    follow_up = client.get(f"/api/v1/imagery/{created['id']}")
    assert follow_up.status_code == 404
