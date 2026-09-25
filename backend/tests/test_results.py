def test_get_result_not_found(client):
    response = client.get("/api/v1/results/00000000-0000-0000-0000-000000000000")
    assert response.status_code == 404
    body = response.json()
    assert body["success"] is False
    assert body["error"]["code"] == "RESULT_NOT_FOUND"


def test_get_result_invalid_uuid(client):
    response = client.get("/api/v1/results/not-a-uuid")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_get_evidence_result_not_found(client):
    response = client.get("/api/v1/results/00000000-0000-0000-0000-000000000000/evidence")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "RESULT_NOT_FOUND"


def test_get_evidence_empty_for_existing_result(client, fake_supabase):
    # Seed a result row directly since results are never created by this API yet.
    fake_supabase.store["analysis_results"] = [
        {
            "id": "11111111-1111-1111-1111-111111111111",
            "job_id": "22222222-2222-2222-2222-222222222222",
            "answer": None,
            "confidence": None,
            "model_name": None,
            "analysis_type": "vqa",
            "raw_output": None,
        }
    ]

    response = client.get("/api/v1/results/11111111-1111-1111-1111-111111111111")
    assert response.status_code == 200
    assert response.json()["data"]["answer"] is None

    evidence_response = client.get("/api/v1/results/11111111-1111-1111-1111-111111111111/evidence")
    assert evidence_response.status_code == 200
    body = evidence_response.json()
    assert body["success"] is True
    assert body["data"] == []
