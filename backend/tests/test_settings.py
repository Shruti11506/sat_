"""Settings endpoints: persisted per profile, validated, never keyed by a client id."""
import pytest

from app.services import settings_service


def test_first_read_creates_defaults(client, fake_supabase):
    body = client.get("/api/v1/settings").json()
    assert body["success"] is True
    data = body["data"]
    assert data["preferences"] == {
        "theme": "dark",
        "language": "en",
        "sidebar_density": "comfortable",
        "default_data_type": "optical_rgb",
        "default_analysis_task": "scene_description",
    }
    assert data["notifications"] == {"analysis_completion": True, "product_updates": False, "usage_alerts": True}
    assert data["privacy"] == {"save_analysis_results": True, "share_usage_analytics": False}
    # Profile comes from the profiles table, not a copy in user_settings.
    profile = fake_supabase.store["profiles"][0]
    assert data["profile"]["display_name"] == profile["display_name"]
    assert "display_name" not in fake_supabase.store["user_settings"][0]

    client.get("/api/v1/settings")
    assert len(fake_supabase.store["user_settings"]) == 1  # created once


def test_patch_persists_only_sent_fields(client, fake_supabase):
    response = client.patch(
        "/api/v1/settings",
        json={"theme": "system", "notify_product_updates": True, "default_data_type": "sar"},
    )
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["preferences"]["theme"] == "system"
    assert data["preferences"]["default_data_type"] == "sar"
    assert data["preferences"]["sidebar_density"] == "comfortable"
    assert data["notifications"]["product_updates"] is True

    again = client.get("/api/v1/settings").json()["data"]
    assert again["preferences"]["theme"] == "system"
    assert again["notifications"]["product_updates"] is True


def test_empty_patch_is_a_no_op(client, fake_supabase):
    before = client.get("/api/v1/settings").json()["data"]
    after = client.patch("/api/v1/settings", json={}).json()["data"]
    assert after == before


@pytest.mark.parametrize(
    "payload",
    [
        {"theme": "purple"},
        {"language": "fr"},
        {"sidebar_density": "tiny"},
        {"default_analysis_task": "make_it_up"},
        {"notify_usage_alerts": "maybe"},
        {"user_id": "00000000-0000-0000-0000-000000000000"},
        {"profile_id": "00000000-0000-0000-0000-000000000000"},
        {"display_name": "Someone"},
    ],
)
def test_patch_rejects_invalid_or_unknown_fields(client, fake_supabase, payload):
    response = client.patch("/api/v1/settings", json=payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert all(row.get("profile_id") != payload.get("profile_id") for row in fake_supabase.store.get("user_settings", []))


def test_client_supplied_ids_do_not_select_another_row(client, fake_supabase):
    mine = client.get("/api/v1/settings").json()["data"]
    fake_supabase.store["user_settings"].append(
        {"id": "other-row", "profile_id": "someone-else", **settings_service.DEFAULTS, "theme": "light"}
    )
    other = client.get("/api/v1/settings?user_id=someone-else&profile_id=someone-else").json()["data"]
    assert other["preferences"]["theme"] == mine["preferences"]["theme"] == "dark"
    client.patch("/api/v1/settings?profile_id=someone-else", json={"theme": "system"})
    assert next(r for r in fake_supabase.store["user_settings"] if r["id"] == "other-row")["theme"] == "light"


def test_unmigrated_database_reports_the_migration(client, fake_supabase):
    fake_supabase.missing = {"user_settings"}
    response = client.get("/api/v1/settings")
    assert response.status_code == 503
    error = response.json()["error"]
    assert error["code"] == "SCHEMA_NOT_MIGRATED"
    assert "0005_user_settings.sql" in error["message"]
