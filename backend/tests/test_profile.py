"""Profile / analytics endpoints: real aggregation of stored rows, no sample data."""
from datetime import date, timedelta

import pytest

from app.services import profile_service, usage_classifier

TODAY = date(2026, 9, 25)
IMG_A = "11111111-1111-1111-1111-111111111111"
IMG_B = "22222222-2222-2222-2222-222222222222"


def _job(fake, day: date, query: str, *, imagery_id=IMG_A, status="queued", analysis_type="general_analysis"):
    fake.store.setdefault("analysis_jobs", []).append({
        "id": f"00000000-0000-0000-0000-{len(fake.store.get('analysis_jobs', [])):012d}",
        "imagery_id": imagery_id,
        "analysis_type": analysis_type,
        "query": query,
        "status": status,
        "created_at": f"{day.isoformat()}T10:00:00+00:00",
    })


def _scene(fake, imagery_id: str, filename: str, mime: str, day: date = TODAY):
    fake.store.setdefault("imagery", []).append({
        "id": imagery_id,
        "name": filename,
        "original_filename": filename,
        "mime_type": mime,
        "sensor": None,
        "source": None,
        "created_at": f"{day.isoformat()}T09:00:00+00:00",
    })


@pytest.fixture
def pinned_today(fake_supabase):
    fake_supabase.today = TODAY
    return fake_supabase


def test_dashboard_with_no_data_is_all_zero_and_empty(client, pinned_today):
    body = client.get("/api/v1/profile/dashboard").json()
    assert body["success"] is True
    data = body["data"]

    assert data["stats"] == {"total_queries": 0, "scenes_analyzed": 0, "current_streak": 0, "longest_streak": 0}
    assert data["features"] == []
    assert data["recent_activity"] == []
    assert data["insights"]["most_used_data_type"] is None
    assert data["insights"]["most_common_task"] is None
    assert data["insights"]["avg_queries_per_active_day"] is None
    # The four real data types always show, at zero; no "Unclassified" row.
    assert [r["label"] for r in data["remote_sensing_usage"]] == ["Optical / RGB", "Multispectral", "SAR", "Optical + SAR"]
    assert all(r["scenes"] == 0 and r["percentage"] == 0 for r in data["remote_sensing_usage"])
    # A full year of zero days, starting on a Sunday and ending today.
    activity = data["activity"]
    assert activity[-1] == {"date": TODAY.isoformat(), "query_count": 0}
    assert date.fromisoformat(activity[0]["date"]).weekday() == 6
    assert 365 <= len(activity) <= 371
    assert all(d["query_count"] == 0 for d in activity)


def test_dashboard_aggregates_stored_rows(client, pinned_today):
    fake = pinned_today
    _scene(fake, IMG_A, "S1A_IW_GRDH_20260920.tif", "image/tiff")
    _scene(fake, IMG_B, "delhi_rgb.jpg", "image/jpeg")
    _job(fake, TODAY, "Highlight water bodies")
    _job(fake, TODAY, "highlight water bodies ", status="completed")
    _job(fake, TODAY - timedelta(days=1), "Detect buildings in this SAR image", status="failed")
    _job(fake, TODAY - timedelta(days=2), "What is shown here?", imagery_id=IMG_B)

    data = client.get("/api/v1/profile/dashboard").json()["data"]

    assert data["stats"] == {"total_queries": 4, "scenes_analyzed": 2, "current_streak": 3, "longest_streak": 3}
    counts = {d["date"]: d["query_count"] for d in data["activity"]}
    assert counts[TODAY.isoformat()] == 2
    assert counts[(TODAY - timedelta(days=1)).isoformat()] == 1

    insights = data["insights"]
    assert insights["most_common_task"] == "Water Body Analysis"
    assert insights["successful_analyses"] == 1
    assert insights["failed_analyses"] == 1
    assert insights["pending_analyses"] == 2
    assert insights["scenes_uploaded"] == 2
    assert insights["active_days"] == 3
    assert insights["avg_queries_per_active_day"] == 1.3

    features = {f["feature"]: f["query_count"] for f in data["features"]}
    assert features == {"Water Body Analysis": 2, "Image Analysis": 1, "SAR Analysis": 1, "Scene Description": 1}

    usage = {r["data_type"]: r for r in data["remote_sensing_usage"]}
    assert usage["sar"]["scenes"] == 1 and usage["sar"]["query_count"] == 3 and usage["sar"]["percentage"] == 50.0
    assert usage["optical_rgb"]["scenes"] == 1 and usage["optical_rgb"]["query_count"] == 1
    assert "unclassified" not in usage
    # Tie on scenes (1 each) is broken by display order, not invented.
    assert insights["most_used_data_type"] == "Optical / RGB"

    recent = data["recent_activity"]
    assert recent[0]["created_at"] >= recent[-1]["created_at"]
    kinds = {(r["kind"], r["activity_type"]) for r in recent}
    assert ("upload", "Scene uploaded") in kinds
    assert ("query", "Building Detection") in kinds


def test_streak_stays_alive_until_today_ends_and_breaks_after_a_gap(client, pinned_today):
    fake = pinned_today
    for offset in (1, 2, 5, 6, 7, 8):  # yesterday+2 days ago, and a 4-day run earlier
        _job(fake, TODAY - timedelta(days=offset), "analyze")
    stats = client.get("/api/v1/profile").json()["data"]["stats"]
    assert stats["current_streak"] == 2
    assert stats["longest_streak"] == 4

    fake.today = TODAY + timedelta(days=2)  # a full day without queries
    stats = client.get("/api/v1/profile").json()["data"]["stats"]
    assert stats["current_streak"] == 0
    assert stats["longest_streak"] == 4


def test_compute_streaks_ignores_future_days():
    assert profile_service.compute_streaks([TODAY + timedelta(days=1), TODAY], TODAY) == (1, 1)
    assert profile_service.compute_streaks([], TODAY) == (0, 0)


def test_profile_ignores_client_supplied_user_id(client, fake_supabase):
    first = client.get("/api/v1/profile").json()["data"]["user"]
    other = client.get("/api/v1/profile?user_id=00000000-0000-0000-0000-000000000000").json()["data"]["user"]
    assert first["id"] == other["id"]
    assert len(fake_supabase.store["profiles"]) == 1
    # No storage paths or other internals leak into the public shape.
    assert "avatar_path" not in first


def test_patch_updates_only_sent_fields_and_persists(client, fake_supabase):
    before = client.get("/api/v1/profile").json()["data"]["user"]
    response = client.patch(
        "/api/v1/profile",
        json={"display_name": "  Parth   Bulbule ", "username": "@ParthB_123", "bio": "Mapping floods."},
    )
    assert response.status_code == 200
    user = response.json()["data"]
    assert user["display_name"] == "Parth Bulbule"
    assert user["username"] == "parthb_123"
    assert user["bio"] == "Mapping floods."
    assert user["headline"] == before["headline"]

    again = client.get("/api/v1/profile").json()["data"]["user"]
    assert again["display_name"] == "Parth Bulbule"

    cleared = client.patch("/api/v1/profile", json={"bio": "   "}).json()["data"]
    assert cleared["bio"] is None


@pytest.mark.parametrize(
    "payload,code",
    [
        ({"display_name": "   "}, "INVALID_DISPLAY_NAME"),
        ({"display_name": "x" * 61}, "INVALID_DISPLAY_NAME"),
        ({"username": "ab"}, "INVALID_USERNAME"),
        ({"username": "has space"}, "INVALID_USERNAME"),
        ({"bio": "x" * 161}, "INVALID_BIO"),
        ({"headline": "x" * 61}, "INVALID_HEADLINE"),
    ],
)
def test_patch_rejects_invalid_values(client, fake_supabase, payload, code):
    response = client.patch("/api/v1/profile", json=payload)
    assert response.status_code == 422
    assert response.json()["error"]["code"] == code


def test_avatar_upload_replace_and_remove(client, fake_supabase):
    objects = fake_supabase.storage.objects

    first = client.post("/api/v1/profile/avatar", files={"file": ("me.png", b"png-bytes", "image/png")})
    assert first.status_code == 200
    assert first.json()["data"]["avatar_url"].startswith("https://fake.supabase.co/")
    assert len([k for k in objects if "/avatars/" in f"/{k}"]) == 1

    client.post("/api/v1/profile/avatar", files={"file": ("me2.jpg", b"jpg-bytes", "image/jpeg")})
    avatar_keys = [k for k in objects if k.startswith("Satquery/avatars/")]
    assert len(avatar_keys) == 1 and avatar_keys[0].endswith(".jpg")  # old one cleaned up

    removed = client.delete("/api/v1/profile/avatar").json()["data"]
    assert removed["avatar_url"] is None
    assert not [k for k in objects if k.startswith("Satquery/avatars/")]


def test_avatar_rejects_unsupported_type(client, fake_supabase):
    response = client.post("/api/v1/profile/avatar", files={"file": ("me.tif", b"x", "image/tiff")})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "UNSUPPORTED_FILE_TYPE"
    assert not fake_supabase.storage.objects


def test_unmigrated_database_reports_the_migration(client, fake_supabase):
    fake_supabase.missing = {"profiles", "profile_dashboard"}
    response = client.get("/api/v1/profile/dashboard")
    assert response.status_code == 503
    error = response.json()["error"]
    assert error["code"] == "SCHEMA_NOT_MIGRATED"
    assert "0004_profile_analytics.sql" in error["message"]


def test_slice_endpoints_match_dashboard(client, pinned_today):
    _job(pinned_today, TODAY, "Compare optical and SAR change")
    dashboard = client.get("/api/v1/profile/dashboard").json()["data"]
    assert client.get("/api/v1/profile/insights").json()["data"] == dashboard["insights"]
    assert client.get("/api/v1/profile/features").json()["data"] == dashboard["features"]
    assert client.get("/api/v1/profile/recent-activity").json()["data"] == dashboard["recent_activity"]
    activity = client.get("/api/v1/profile/activity?period=year").json()["data"]
    assert activity["activity"] == dashboard["activity"]
    assert client.get("/api/v1/profile/activity?period=decade").status_code == 422


@pytest.mark.parametrize(
    "query,analysis_type,task",
    [
        ("Highlight water bodies", "general_analysis", "water_body"),
        ("Show flooded areas", "general_analysis", "flood_assessment"),
        ("Detect changes between 2021 and 2026", "general_analysis", "change_detection"),
        ("Classify land cover", "general_analysis", "land_cover"),
        ("Describe this scene", "general_analysis", "scene_description"),
        ("Is the port busy?", "general_analysis", "vqa"),
        ("anything", "change_vqa", "change_detection"),
        ("Analyze this satellite scene", "general_analysis", "image_analysis"),
    ],
)
def test_classify_task(query, analysis_type, task):
    assert usage_classifier.classify_task(query, analysis_type) == task


@pytest.mark.parametrize(
    "filename,mime,data_type",
    [
        ("S1A_IW_GRDH_1SDV.tif", "image/tiff", "sar"),
        ("sentinel2_L2A_msi.tif", "image/tiff", "multispectral"),
        ("LC08_L1TP_146040.tif", "image/tiff", "multispectral"),
        ("fused_optical_sar.tif", "image/tiff", "optical_sar"),
        ("city.png", "image/png", "optical_rgb"),
        ("scene.tif", "image/tiff", "unclassified"),
    ],
)
def test_classify_data_type(filename, mime, data_type):
    assert usage_classifier.classify_data_type(original_filename=filename, mime_type=mime) == data_type
